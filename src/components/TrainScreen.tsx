import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  TrendingUp,
  MoveRight,
  AlertTriangle,
  X,
  Repeat,
} from "lucide-react";
import { useStore, type FinishSummary, type UndoSnapshot } from "@/lib/store";
import type { Exercise, ExerciseLog, Session, TrainingMode, WorkoutDay } from "@/lib/types";
import {
  fmtKg,
  fmtTonnage,
  fmtDateShort,
  sessionVolume,
  sessionDuration,
  detectPlateau,
  suggestedWeightForProfile,
  suggestBonusExercises,
  exerciseForMode,
  targetForMode,
  personalBests,
  isSetRecord,
  e1rm,
  warmupPlan,
  platePlan,
  nextDaySuggestion,
  weeksSinceDeload,
  type LastEntry,
  type PersonalBests,
} from "@/lib/logic";
import { gistBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RestTimer } from "@/components/Gym";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const DRAFT_KEY = "trening-app-draft";
const BONUS_SUGGESTION_KEY = "trening-app-bonus-suggestion";

interface Draft {
  dayId: string;
  date: string;
  entries: ExerciseLog[];
  mode: TrainingMode;
  /** Check-in gotowości (P2-4) — opcjonalny, wpisany PRZED startem dnia na ekranie wyboru. */
  readiness?: { sleep: number; doms: number };
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return { ...parsed, mode: parsed.mode ?? "strength" };
  } catch {
    return null;
  }
}

// P2-7: propozycja składu dnia bonusowego pod deficyt objętości — cache'owana
// (nie liczona przy każdym wejściu na ekran), odświeżana ręcznie przyciskiem
// „Odśwież", gdy w tygodniu coś się zmieniło (nowe sesje itd.).
interface BonusSuggestion {
  dayId: string;
  exerciseIds: string[];
  generatedAt: string;
}

function loadBonusSuggestion(): BonusSuggestion | null {
  try {
    const raw = localStorage.getItem(BONUS_SUGGESTION_KEY);
    return raw ? (JSON.parse(raw) as BonusSuggestion) : null;
  } catch {
    return null;
  }
}

interface LastEntryInfo extends LastEntry {
  mode: TrainingMode;
}

// P1-8: rekord (PR) trafiony podczas treningu — do podsumowania sesji.
interface RecordHit {
  exercise: Exercise;
  kind: "weight" | "e1rm" | "hold";
  value: number;
}

// P2-8: wspolna etykieta/kolor trybu tygodnia - plakietka w loggerze, przelacznik, "Ostatnio".
const MODE_BADGE: Record<TrainingMode, { label: string; short: string; color: string }> = {
  strength: { label: "Siła", short: "siła", color: "#38bdf8" },
  hypertrophy: { label: "Hipertrofia", short: "hip.", color: "#a855f7" },
  deload: { label: "Deload", short: "deload", color: "#f59e0b" },
};

// P2-8: deload dobija o jedna serie robocza mniej (min. 2), zeby objetosc
// spadala tez przez serie, nie tylko przez ciezar. Inne tryby bez zmian.
function setsForMode(ex: Exercise, mode: TrainingMode): number {
  return mode === "deload" ? Math.max(2, ex.targetSets - 1) : ex.targetSets;
}

function fmtRecordHit(kind: RecordHit["kind"], value: number): string {
  if (kind === "hold") return `${value} s`;
  return kind === "e1rm" ? `e1RM ${fmtKg(value)}` : fmtKg(value);
}

export function TrainScreen() {
  const store = useStore();
  const { state } = store;
  const [draft, setDraft] = useState<Draft | null>(loadDraft);
  const [bonusSuggestion, setBonusSuggestion] = useState<BonusSuggestion | null>(loadBonusSuggestion);
  const [summary, setSummary] = useState<FinishSummary[] | null>(null);
  const [sessionRecords, setSessionRecords] = useState<RecordHit[]>([]);
  const [summarySession, setSummarySession] = useState<Session | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(state.settings.restSeconds);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [openWarmups, setOpenWarmups] = useState<Set<number>>(new Set());
  // P2-4: check-in gotowosci - opcjonalny, wypelniany na ekranie wyboru dnia
  // PRZED startem; null = pominiety (brak kary, brak danych w sesji).
  const [readiness, setReadiness] = useState<{ sleep: number; doms: number } | null>(null);
  const pendingBackup = useRef(false);
  const pendingBackupReminder = useRef(false);
  const hasDraft = draft !== null;

  // Mapa exId -> ostatni wynik, liczona JEDNYM przejściem po sesjach i tylko
  // gdy zmieni się historia — inaczej każde wciśnięcie klawisza w loggerze
  // kopiowało i sortowało wszystkie sesje raz na kartę ćwiczenia.
  const lastByExercise = useMemo(() => {
    const map = new Map<string, LastEntryInfo>();
    const sorted = [...state.sessions]
      .filter((s) => s.completed)
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const session of sorted) {
      for (const entry of session.entries) {
        if (map.has(entry.exerciseId)) continue;
        const done = entry.sets.filter((s) => s.done);
        if (done.length === 0) continue;
        map.set(entry.exerciseId, { date: session.date, sets: done, mode: session.mode ?? "strength" });
      }
    }
    return map;
  }, [state.sessions]);

  // P1-8: rekordy życia per ćwiczenie, liczone RAZ na zmianę historii sesji
  // (nie per keystroke w loggerze) — ten sam wzorzec co lastByExercise wyżej.
  const personalBestsByExercise = useMemo(() => {
    const map = new Map<string, PersonalBests>();
    for (const ex of state.exercises) {
      map.set(ex.id, personalBests(state, ex.id));
    }
    return map;
  }, [state.sessions, state.exercises]);

  // P2-8: liczba cwiczen w zastoju - wejscie do nudge'a deloadu (>=3 -> sugestia).
  const plateauCount = useMemo(
    () => state.exercises.filter((ex) => !ex.archived && detectPlateau(state, ex.id)).length,
    [state]
  );
  const weeksSinceDeloadCount = useMemo(() => weeksSinceDeload(state), [state]);

  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, [draft]);

  useEffect(() => {
    try {
      if (bonusSuggestion) localStorage.setItem(BONUS_SUGGESTION_KEY, JSON.stringify(bonusSuggestion));
      else localStorage.removeItem(BONUS_SUGGESTION_KEY);
    } catch {
      // ignore
    }
  }, [bonusSuggestion]);

  // Ekran nie gaśnie podczas treningu (iOS 16.4+ wspiera Wake Lock w PWA).
  // Blokada gubi się, gdy karta wraca z tła — trzeba ją wtedy odnowić.
  useEffect(() => {
    if (!hasDraft) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;

    async function acquire() {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // brak wsparcia albo odmowa (np. bateria) — cicho ignoruj
      }
    }

    function onVisibility() {
      if (active && document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [hasDraft]);

  // Auto-backup do Gista: state tutaj to zamknięcie z renderu, w którym finish()
  // zostało wywołane — jeszcze BEZ właśnie zakończonej sesji (setState jest
  // asynchroniczny). Backup odpalamy dopiero w efekcie po re-renderze, żeby
  // wysłać już zaktualizowany stan (z nową sesją i nowymi celami).
  useEffect(() => {
    if (!pendingBackup.current) return;
    pendingBackup.current = false;
    const { gistToken, gistId } = state.settings;
    if (!gistToken) return;
    gistBackup(gistToken, state, gistId)
      .then(({ gistId: newGistId }) => {
        store.updateSettings({ gistId: newGistId, lastBackup: new Date().toISOString() });
      })
      .catch((err: unknown) => {
        toast("Auto-backup nieudany", err instanceof Error ? err.message : "Nieznany błąd");
      });
  }, [state]);

  // Przypomnienie o reczym backupie (P1-7) — tylko gdy auto-backup jest WYŁĄCZONY
  // (inaczej P0-2 i tak robi backup po każdym treningu, licznik byłby zbędny).
  useEffect(() => {
    if (!pendingBackupReminder.current) return;
    pendingBackupReminder.current = false;
    const { autoBackup, lastBackup } = state.settings;
    if (autoBackup) return;
    const completed = state.sessions.filter((s) => s.completed);
    const sessionsSince = lastBackup ? completed.filter((s) => s.date > lastBackup).length : completed.length;
    if (sessionsSince >= 6) {
      toast("Zrób backup", `Ostatni: ${sessionsSince} treningów temu`, { label: "Przejdź do Więcej", tab: "more" });
    }
  }, [state]);

  const activeDays = state.days.filter((d) => !d.optional || d.active);
  // P2-10: podpowiedz, nie blokada - wszystkie kafelki zostaja klikalne.
  const nextDayId = nextDaySuggestion(state);
  const activeGymProfile = (state.settings.gymProfiles ?? []).find(
    (p) => p.id === state.settings.activeGymProfileId
  ) ?? null;
  const mode: TrainingMode = state.settings.trainingMode ?? "strength";
  // P1-9: rozgrzewka liczy sie wzgledem AKTYWNEGO sprzetu (profil siłowni, jesli
  // ustawiony — spojnie z sugestiami FEAT-1), inaczej domowego z ustawien.
  const warmupBar = activeGymProfile?.barWeight ?? state.settings.barWeight;
  const warmupPlates = activeGymProfile?.plates ?? state.settings.plates;

  function toggleWarmup(entryIdx: number) {
    setOpenWarmups((prev) => {
      const next = new Set(prev);
      if (next.has(entryIdx)) next.delete(entryIdx);
      else next.add(entryIdx);
      return next;
    });
  }

  // P2-4: pierwsze dotknięcie ustawia OBA pola (nietknięte = neutralne 3), żeby
  // nie zapisywać połowicznego stanu. Niska gotowość -> jednorazowa sugestia.
  // Efekt (toast) policzony PRZED setState, nie w jego updaterze — StrictMode
  // (dev) wywołuje updatery dwa razy, co podwoiłoby toast (patrz finishSession).
  function updateReadiness(patch: Partial<{ sleep: number; doms: number }>) {
    const next = { sleep: readiness?.sleep ?? 3, doms: readiness?.doms ?? 3, ...patch };
    if (next.sleep <= 2 || next.sleep + next.doms <= 4) {
      toast("Słaba regeneracja", "Rozważ -1 serię w przysiadzie/MC, izolacje bez zmian.");
    }
    setReadiness(next);
  }

  // `overrideExerciseIds` — propozycja bonusu (P2-7): podmienia skład TYLKO
  // w tym drafcie, plan (state.days) zostaje nietknięty.
  function startDay(dayId: string, overrideExerciseIds?: string[]) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) return;
    const exerciseIds = overrideExerciseIds ?? day.exerciseIds;
    const entries: ExerciseLog[] = exerciseIds
      .map((exId) => {
        const ex = state.exercises.find((e) => e.id === exId);
        if (!ex || ex.archived) return null;
        const hEx = exerciseForMode(ex, mode);
        const target = targetForMode(state, ex, mode);
        return {
          exerciseId: exId,
          targetWeight: target,
          sets: Array.from({ length: setsForMode(ex, mode) }, () => ({
            weight: target,
            // Prefill górnym limitem zakresu (dla trybu tygodnia) — dążymy do
            // maksimum powtórzeń, więc częściej trafisz od razu.
            reps: hEx.repMax,
            done: false,
          })),
        };
      })
      .filter((e): e is ExerciseLog => e !== null);
    setDraft({ dayId, date: new Date().toISOString(), entries, mode, readiness: readiness ?? undefined });
    setReadiness(null);
  }

  function generateBonusSuggestion(day: WorkoutDay) {
    const picks = suggestBonusExercises(state, day.exerciseIds.length);
    setBonusSuggestion({
      dayId: day.id,
      exerciseIds: picks.map((e) => e.id),
      generatedAt: new Date().toISOString(),
    });
  }

  function updateSet(entryIdx: number, setIdx: number, patch: Partial<{ weight: number; reps: number; done: boolean }>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const set = next.entries[entryIdx].sets[setIdx];
      Object.assign(set, patch);
      return next;
    });
    if (patch.done === true) {
      const exId = draft?.entries[entryIdx]?.exerciseId;
      const ex = exId ? state.exercises.find((e) => e.id === exId) : undefined;
      setTimerSeconds(ex?.restSeconds ?? state.settings.restSeconds);
      setTimerKey((k) => k + 1);

      // P1-8: jednorazowy toast, gdy zaznaczenie serii bije rekord życia.
      // `prevSet` to jeszcze stary stan (przed setDraft powyżej) — merge z
      // patchem daje finalny wiersz (weight/reps + done:true).
      const prevSet = draft?.entries[entryIdx]?.sets[setIdx];
      if (ex && prevSet) {
        const finalSet = { ...prevSet, ...patch };
        const best = personalBestsByExercise.get(ex.id);
        const kind = best ? isSetRecord(ex, finalSet, best) : null;
        if (kind) {
          const value = kind === "hold" ? finalSet.reps : kind === "weight" ? finalSet.weight : e1rm(finalSet.weight, finalSet.reps);
          const suffix = kind === "weight" ? ` × ${finalSet.reps}` : "";
          toast("Rekord!", `${ex.name} — ${fmtRecordHit(kind, Math.round(value * 10) / 10)}${suffix}`);
        }
      }
    }
  }

  function addSet(entryIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const sets = next.entries[entryIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({ weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false });
      return next;
    });
  }

  function removeSet(entryIdx: number, setIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.entries[entryIdx].sets.splice(setIdx, 1);
      return next;
    });
  }

  // Nadpisuje cel wpisu (i wszystkie jeszcze niezaliczone serie) sugestią z
  // aktywnego profilu siłowni — tylko w tym drafcie, docelowy plan bez zmian.
  function applyGymSuggestion(entryIdx: number, weight: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const entry = next.entries[entryIdx];
      entry.targetWeight = weight;
      entry.sets = entry.sets.map((s) => (s.done ? s : { ...s, weight }));
      return next;
    });
  }

  // Zamiana ćwiczenia (zajęty sprzęt) — tylko w drafcie tej sesji, plan bez zmian.
  function swapExercise(entryIdx: number, newExId: string) {
    const newEx = state.exercises.find((e) => e.id === newExId);
    if (!newEx) return;
    const hEx = exerciseForMode(newEx, mode);
    const target = targetForMode(state, newEx, mode);
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.entries[entryIdx] = {
        exerciseId: newExId,
        targetWeight: target,
        sets: Array.from({ length: setsForMode(newEx, mode) }, () => ({
          weight: target,
          reps: hEx.repMax, // górny limit zakresu (dla trybu tygodnia), jak przy starcie dnia
          done: false,
        })),
      };
      return next;
    });
    setSwapIdx(null);
  }

  function finish() {
    if (!draft) return;
    const anyDone = draft.entries.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !confirm("Żadna seria nie jest odhaczona. Zakończyć mimo to?")) return;

    // P1-8: rekordy trafione w tym treningu — liczone PRZED finishSession, na
    // rekordach SPRZED tej sesji (personalBestsByExercise jeszcze ich nie
    // zawiera, bo store.finishSession jeszcze nie dopisał tej sesji do stanu).
    // Jeden wpis na ćwiczenie (najlepsza z serii, które biją rekord).
    const recordHits: RecordHit[] = [];
    for (const entry of draft.entries) {
      const ex = state.exercises.find((e) => e.id === entry.exerciseId);
      const best = ex ? personalBestsByExercise.get(ex.id) : undefined;
      if (!ex || !best) continue;
      let top: RecordHit | null = null;
      for (const set of entry.sets) {
        const kind = isSetRecord(ex, set, best);
        if (!kind) continue;
        const value = kind === "hold" ? set.reps : kind === "weight" ? set.weight : e1rm(set.weight, set.reps);
        if (!top || value > top.value) top = { exercise: ex, kind, value };
      }
      if (top) recordHits.push(top);
    }
    setSessionRecords(recordHits);

    const results = store.finishSession({
      dayId: draft.dayId,
      date: draft.date,
      entries: draft.entries,
      mode: draft.mode,
      readiness: draft.readiness,
    });
    setSummary(results.summaries);
    setUndoSnapshot(results.undo);
    // P1-10: "kopia" zapisanej sesji do podsumowania (czas trwania/gęstość) —
    // store.finishSession nie zwraca pełnej sesji, tylko podsumowania progresji;
    // date/entries są identyczne z tym, co właśnie zapisano, finishedAt to ten
    // sam moment (z dokładnością do pojedynczych ms, bez znaczenia po zaokrągleniu).
    setSummarySession({
      id: "summary",
      dayId: draft.dayId,
      date: draft.date,
      entries: draft.entries,
      completed: true,
      mode: draft.mode,
      finishedAt: new Date().toISOString(),
    });
    setDraft(null);

    if (state.settings.autoBackup && state.settings.gistToken) {
      // Fire-and-forget: nie blokuje podsumowania treningu. Sam fetch odpala
      // się w efekcie powyżej, po tym jak state odzwierciedli finishSession().
      pendingBackup.current = true;
    }
    pendingBackupReminder.current = true;
  }

  function cancel() {
    if (confirm("Porzucić ten trening? Wpisane serie przepadną.")) setDraft(null);
  }

  // P2-9: cofniecie zakonczenia - usuwa wlasnie zapisana sesje i przywraca
  // cele (targets/hyperTargets) do stanu SPRZED finishSession. Snapshot zyje
  // tylko w stanie Reacta (nie persystowany) - dziala dopoki widac podsumowanie.
  function undoFinish() {
    if (!undoSnapshot) return;
    if (!confirm("Cofnąć zakończenie treningu? Sesja zniknie z Historii, cele wrócą do poprzednich wartości."))
      return;
    store.undoFinishSession(undoSnapshot);
    setSummary(null);
    setUndoSnapshot(null);
    setSessionRecords([]);
    setSummarySession(null);
    if (state.settings.autoBackup && state.settings.gistToken) {
      // Chmura ma juz stan "po pomylce" z auto-backupu po finishSession -
      // odswiez ja, zeby nie zostala rozjechana z lokalnym stanem po cofnieciu.
      pendingBackup.current = true;
    }
  }

  // ── Podsumowanie po treningu ─────────────────────────────────────────────
  if (summary) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold">Podsumowanie treningu</h1>
        {summarySession && (() => {
          const duration = sessionDuration(summarySession);
          const volume = sessionVolume(state, summarySession);
          const density = duration ? Math.round(volume / duration) : null;
          return (
            <p className="text-sm text-muted-foreground">
              {duration !== null && `${duration} min · `}
              {fmtTonnage(volume)}
              {density !== null && ` · ${density} kg/min`}
            </p>
          );
        })()}
        {sessionRecords.length > 0 && (
          <Card className="border-amber-400/40 bg-amber-400/5">
            <CardHeader>
              <CardTitle className="text-amber-300">🏆 Rekordy tej sesji</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sessionRecords.map((r) => (
                <div key={r.exercise.id} className="flex items-center justify-between text-xs">
                  <span>{r.exercise.name}</span>
                  <span className="font-semibold text-amber-300">{fmtRecordHit(r.kind, Math.round(r.value * 10) / 10)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {summarySession?.mode === "deload" ? (
          // P2-8: deload nie zmienia celow - per-cwiczeniowe karty progresji
          // (ktore i tak liczylyby sie na lekkim ciezarze) byłyby mylace.
          // Jeden, jasny komunikat zamiast tego.
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-3">
              <p className="text-sm font-medium text-amber-300">Deload — cele bez zmian</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Wracasz do swoich ciężarów w przyszłym tygodniu — ten trening nie liczy się do progresji.
              </p>
            </CardContent>
          </Card>
        ) : (
          summary.map(({ exercise, result }) => (
            <Card key={exercise.id}>
              <CardContent className="flex items-start gap-3 p-3">
                <span
                  className={cn(
                    "mt-0.5 rounded-full p-1.5",
                    result.status === "up" && "bg-green-500/15 text-green-400",
                    result.status === "hold" && "bg-sky-500/15 text-sky-400",
                    result.status === "deload" && "bg-amber-500/15 text-amber-400"
                  )}
                >
                  {result.status === "up" ? (
                    <TrendingUp size={16} />
                  ) : result.status === "deload" ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <MoveRight size={16} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{exercise.name}</p>
                  <p className="text-xs text-muted-foreground">{result.message}</p>
                  {detectPlateau(state, exercise.id) && (
                    <p className="mt-1.5 rounded-md bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-300">
                      Zastój (3 treningi bez postępu). Opcje: mikro-skok +1,25 kg mimo braku
                      kompletu powtórzeń, LUB tydzień -30% ciężaru (deload), LUB zamiana
                      ćwiczenia na 4–6 tyg.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" onClick={() => setSummary(null)}>
            Zamknij
          </Button>
          {undoSnapshot && (
            <Button variant="ghost" size="lg" onClick={undoFinish}>
              Cofnij zakończenie
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Wybór dnia ───────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold">Cześć, {state.settings.name}! 💪</h1>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium">Cel tygodnia</p>
          <div className="mt-1.5 flex overflow-hidden rounded-md border border-border text-xs">
            {(["strength", "hypertrophy", "deload"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m !== mode) {
                    toast(
                      m === "deload"
                        ? "Tydzień deloadu"
                        : "Zmieniono cel tygodnia",
                      m === "deload"
                        ? "65% ciężaru, o jedną serię mniej — cele zostają zamrożone, progresja wraca w przyszłym tygodniu."
                        : "Pamiętaj też o przełączniku Cel: Siła/Hipertrofia w zakładce Progres."
                    );
                  }
                  store.updateSettings({ trainingMode: m });
                }}
                className={cn(
                  "flex-1 px-3 py-1.5 transition-colors",
                  mode === m ? "text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
                style={mode === m ? { backgroundColor: MODE_BADGE[m].color } : undefined}
              >
                {MODE_BADGE[m].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Przełączaj między tygodniami — periodyzacja falująca jest równie skuteczna jak sztywne bloki.
          </p>
        </div>
        {mode !== "deload" && (weeksSinceDeloadCount >= 6 || plateauCount >= 3) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
            {weeksSinceDeloadCount >= 6 && plateauCount >= 3
              ? `${weeksSinceDeloadCount} tygodni bez lżejszego tygodnia i zastój w ${plateauCount} ćwiczeniach — rozważ tydzień deloadu.`
              : weeksSinceDeloadCount >= 6
                ? `${weeksSinceDeloadCount} tygodni bez lżejszego tygodnia — rozważ tydzień deloadu.`
                : `Zastój w ${plateauCount} ćwiczeniach — rozważ tydzień deloadu.`}
          </div>
        )}
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium">Jak się dziś czujesz? (opcjonalnie)</p>
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Sen — 1 słabo, 5 świetnie</p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateReadiness({ sleep: n })}
                    className={cn(
                      "h-7 w-7 rounded-md border text-xs transition-colors",
                      readiness?.sleep === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Zakwasy — 1 mocne, 5 brak</p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateReadiness({ doms: n })}
                    className={cn(
                      "h-7 w-7 rounded-md border text-xs transition-colors",
                      readiness?.doms === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {readiness && (
              <button
                type="button"
                onClick={() => setReadiness(null)}
                className="text-[10px] text-muted-foreground underline underline-offset-2"
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Wybierz dzień treningowy:</p>
        {activeDays.map((day) => (
          <div key={day.id} className="space-y-2">
            <button
              type="button"
              onClick={() => startDay(day.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent",
                day.id !== nextDayId && "border-border"
              )}
              style={day.id === nextDayId ? { borderColor: day.accent ?? "#38bdf8" } : undefined}
            >
              <span
                className="h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: day.accent ?? "#38bdf8" }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="block font-semibold">{day.name}</span>
                  {day.id === nextDayId && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{
                        backgroundColor: `${day.accent ?? "#38bdf8"}33`,
                        color: day.accent ?? "#38bdf8",
                      }}
                    >
                      następny w rotacji
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {day.short} · {day.exerciseIds.length} ćwiczeń
                </span>
              </span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
            {day.optional && (
              <div className="ml-4 rounded-lg border border-dashed border-purple-500/40 bg-purple-500/5 p-3">
                {bonusSuggestion?.dayId === day.id ? (
                  <>
                    <p className="text-xs font-medium text-purple-300">Propozycja pod słabe partie tygodnia:</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {bonusSuggestion.exerciseIds
                        .map((id) => state.exercises.find((e) => e.id === id)?.name ?? id)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => startDay(day.id, bonusSuggestion.exerciseIds)}>
                        Rozpocznij z propozycją
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => generateBonusSuggestion(day)}>
                        Odśwież
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => generateBonusSuggestion(day)}>
                    Dobierz pod słabe partie
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Logger serii ─────────────────────────────────────────────────────────
  const day = state.days.find((d) => d.id === draft.dayId);
  const doneCount = draft.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalCount = draft.entries.reduce((n, e) => n + e.sets.length, 0);
  const volume = sessionVolume(state, {
    id: "draft",
    dayId: draft.dayId,
    date: draft.date,
    entries: draft.entries,
    completed: false,
  });

  return (
    <div className="pb-16">
      <div
        className="sticky top-0 z-10 border-b border-border bg-background/95 p-4 backdrop-blur"
        style={{
          // przykryj pasek statusu tłem nagłówka (body ma padding-top pod island)
          marginTop: "calc(env(safe-area-inset-top) * -1)",
          paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold">{day?.name ?? "Trening"}</h1>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${MODE_BADGE[draft.mode].color}33`,
                  color: MODE_BADGE[draft.mode].color,
                }}
              >
                {MODE_BADGE[draft.mode].label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {day?.short} · {doneCount}/{totalCount} serii · {fmtKg(volume)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={cancel} className="text-muted-foreground">
            <X size={15} /> Porzuć
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {draft.entries.map((entry, ei) => {
          const ex = state.exercises.find((e) => e.id === entry.exerciseId);
          if (!ex) return null;
          const hEx = exerciseForMode(ex, draft.mode);
          const unitLabel = hEx.isHold ? "s" : "powt.";
          const last = lastByExercise.get(ex.id) ?? null;
          const gymSuggestion = suggestedWeightForProfile(ex, entry.targetWeight, activeGymProfile);
          const warmupSteps = warmupPlan(ex, entry.targetWeight, warmupBar, warmupPlates);
          const swapCandidates = ex.primaryMuscle
            ? state.exercises.filter(
                (e) =>
                  !e.archived &&
                  e.primaryMuscle === ex.primaryMuscle &&
                  e.id !== ex.id &&
                  !draft.entries.some((en) => en.exerciseId === e.id)
              )
            : [];
          return (
            <Card key={entry.exerciseId}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{ex.name}</CardTitle>
                  {swapCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSwapIdx(swapIdx === ei ? null : ei)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Zamień ćwiczenie"
                    >
                      <Repeat size={15} />
                    </button>
                  )}
                </div>
                <CardDescription>
                  {entry.sets.length}×{hEx.repMin === hEx.repMax ? hEx.repMin : `${hEx.repMin}–${hEx.repMax}`}{" "}
                  {unitLabel} · cel {fmtKg(entry.targetWeight)}
                  {hEx.perHand && " (na rękę)"} · RIR {hEx.rir}
                </CardDescription>
                {gymSuggestion !== null && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-300">
                    <span>
                      {activeGymProfile!.name}: sugerowany {fmtKg(gymSuggestion)} (zamiast{" "}
                      {fmtKg(entry.targetWeight)})
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-semibold underline underline-offset-2"
                      onClick={() => applyGymSuggestion(ei, gymSuggestion)}
                    >
                      Użyj
                    </button>
                  </div>
                )}
                {swapIdx === ei && (
                  <div className="space-y-1 rounded-md border border-border p-2">
                    <p className="text-[11px] text-muted-foreground">
                      Zamień na (ta sama partia, tylko na ten trening):
                    </p>
                    {swapCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => swapExercise(ei, c.id)}
                        className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {last && (
                  <p className="text-xs text-muted-foreground">
                    Ostatnio ({fmtDateShort(last.date)}
                    {last.mode !== draft.mode ? ` (${MODE_BADGE[last.mode].short})` : ""}):{" "}
                    {last.sets
                      .map((s) => (hEx.isHold ? `${s.reps}s` : `${s.weight}×${s.reps}`))
                      .join(" · ")}
                  </p>
                )}
                {hEx.note && <p className="text-[11px] leading-snug text-amber-200/70">{hEx.note}</p>}
                {warmupSteps.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleWarmup(ei)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {openWarmups.has(ei) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Rozgrzewka ({warmupSteps.length})
                    </button>
                    {openWarmups.has(ei) && (
                      <div className="mt-1 space-y-1 rounded-md border border-border p-2">
                        {warmupSteps.map((s, si) => {
                          const plan = platePlan(s.weight, warmupBar, warmupPlates);
                          return (
                            <div key={si} className="flex items-center justify-between text-[11px]">
                              <span className="tabular-nums">
                                {fmtKg(s.weight)} × {s.reps}
                              </span>
                              <span className="text-muted-foreground">
                                {plan.perSide.length > 0 ? `Na stronę: ${plan.perSide.join("+")}` : "Sam gryf"}
                              </span>
                            </div>
                          );
                        })}
                        <p className="pt-0.5 text-[10px] text-muted-foreground">Nie loguje się do treningu.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-1.5">
                {entry.sets.map((set, si) => {
                  const best = personalBestsByExercise.get(ex.id);
                  const recordKind = best ? isSetRecord(ex, set, best) : null;
                  return (
                  <div
                    key={si}
                    className={cn(
                      "flex items-center gap-2 rounded-md",
                      recordKind && "ring-1 ring-amber-400/70"
                    )}
                  >
                    <span className="w-4 text-xs text-muted-foreground">{si + 1}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      className="h-9 w-20 text-center"
                      value={set.weight === 0 ? "" : set.weight}
                      placeholder="kg"
                      onChange={(e) => updateSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">kg ×</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-16 text-center"
                      value={set.reps === 0 ? "" : set.reps}
                      placeholder={unitLabel}
                      onChange={(e) => updateSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                    />
                    <span className="w-8 text-xs text-muted-foreground">{unitLabel}</span>
                    {recordKind && (
                      <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        PR
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => updateSet(ei, si, { done: !set.done })}
                      className={cn(
                        "ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                        set.done
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                      aria-label={set.done ? "Odznacz serię" : "Zalicz serię"}
                    >
                      <Check size={16} />
                    </button>
                    {si >= setsForMode(ex, draft.mode) && (
                      <button
                        type="button"
                        onClick={() => removeSet(ei, si)}
                        className="flex h-9 w-7 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label="Usuń serię"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                  );
                })}
                <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => addSet(ei)}>
                  <Plus size={14} /> Dodaj serię
                </Button>
              </CardContent>
            </Card>
          );
        })}

        <Button className="w-full" size="lg" onClick={finish}>
          Zakończ trening
        </Button>
      </div>

      <div
        className="fixed left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-1.5 shadow-lg backdrop-blur"
        style={{ bottom: "78px" }} // tuż nad paskiem nawigacji (pasek ma teraz +10px paddingu)
      >
        <RestTimer seconds={timerSeconds} sound={state.settings.sound} autostartKey={timerKey} />
      </div>
    </div>
  );
}
