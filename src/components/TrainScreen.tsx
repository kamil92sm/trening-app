import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  TrendingUp,
  MoveRight,
  AlertTriangle,
  X,
  Repeat,
} from "lucide-react";
import { useStore, type FinishSummary } from "@/lib/store";
import type { ExerciseLog, TrainingMode, WorkoutDay } from "@/lib/types";
import {
  fmtKg,
  fmtDateShort,
  sessionVolume,
  detectPlateau,
  suggestedWeightForProfile,
  suggestBonusExercises,
  exerciseForMode,
  targetForMode,
  type LastEntry,
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

export function TrainScreen() {
  const store = useStore();
  const { state } = store;
  const [draft, setDraft] = useState<Draft | null>(loadDraft);
  const [bonusSuggestion, setBonusSuggestion] = useState<BonusSuggestion | null>(loadBonusSuggestion);
  const [summary, setSummary] = useState<FinishSummary[] | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(state.settings.restSeconds);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
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
  const activeGymProfile = (state.settings.gymProfiles ?? []).find(
    (p) => p.id === state.settings.activeGymProfileId
  ) ?? null;
  const mode: TrainingMode = state.settings.trainingMode ?? "strength";

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
          sets: Array.from({ length: ex.targetSets }, () => ({
            weight: target,
            // Prefill górnym limitem zakresu (dla trybu tygodnia) — dążymy do
            // maksimum powtórzeń, więc częściej trafisz od razu.
            reps: hEx.repMax,
            done: false,
          })),
        };
      })
      .filter((e): e is ExerciseLog => e !== null);
    setDraft({ dayId, date: new Date().toISOString(), entries, mode });
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
        sets: Array.from({ length: newEx.targetSets }, () => ({
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
    const results = store.finishSession({
      dayId: draft.dayId,
      date: draft.date,
      entries: draft.entries,
      mode: draft.mode,
    });
    setSummary(results);
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

  // ── Podsumowanie po treningu ─────────────────────────────────────────────
  if (summary) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold">Podsumowanie treningu</h1>
        {summary.map(({ exercise, result }) => (
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
        ))}
        <Button className="w-full" size="lg" onClick={() => setSummary(null)}>
          Zamknij
        </Button>
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
            {(["strength", "hypertrophy"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m !== mode) {
                    toast(
                      "Zmieniono cel tygodnia",
                      "Pamiętaj też o przełączniku Cel: Siła/Hipertrofia w zakładce Progres."
                    );
                  }
                  store.updateSettings({ trainingMode: m });
                }}
                className={cn(
                  "flex-1 px-3 py-1.5 transition-colors",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {m === "strength" ? "Siła" : "Hipertrofia"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Przełączaj między tygodniami — periodyzacja falująca jest równie skuteczna jak sztywne bloki.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Wybierz dzień treningowy:</p>
        {activeDays.map((day) => (
          <div key={day.id} className="space-y-2">
            <button
              type="button"
              onClick={() => startDay(day.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <span
                className="h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: day.accent ?? "#38bdf8" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{day.name}</span>
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
                  backgroundColor: draft.mode === "hypertrophy" ? "#a855f733" : "#38bdf833",
                  color: draft.mode === "hypertrophy" ? "#a855f7" : "#38bdf8",
                }}
              >
                {draft.mode === "hypertrophy" ? "Hipertrofia" : "Siła"}
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
                  {hEx.targetSets}×{hEx.repMin === hEx.repMax ? hEx.repMin : `${hEx.repMin}–${hEx.repMax}`}{" "}
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
                    {last.mode !== draft.mode ? (last.mode === "strength" ? " (siła)" : " (hip.)") : ""}):{" "}
                    {last.sets
                      .map((s) => (hEx.isHold ? `${s.reps}s` : `${s.weight}×${s.reps}`))
                      .join(" · ")}
                  </p>
                )}
                {hEx.note && <p className="text-[11px] leading-snug text-amber-200/70">{hEx.note}</p>}
              </CardHeader>
              <CardContent className="space-y-1.5">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
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
                    <button
                      type="button"
                      onClick={() => updateSet(ei, si, { done: !set.done })}
                      className={cn(
                        "ml-auto flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                        set.done
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                      aria-label={set.done ? "Odznacz serię" : "Zalicz serię"}
                    >
                      <Check size={16} />
                    </button>
                    {si >= ex.targetSets && (
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
                ))}
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
