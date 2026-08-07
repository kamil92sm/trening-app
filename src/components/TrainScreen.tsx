import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Minus,
  Plus,
  TrendingUp,
  MoveRight,
  AlertTriangle,
  X,
  Repeat,
  Trash2,
} from "lucide-react";
import { useStore, type FinishSummary, type UndoSnapshot } from "@/lib/store";
import type { Exercise, ExerciseLog, Session, TrainingMode, WorkoutDay } from "@/lib/types";
import {
  fmtKg,
  fmtTonnage,
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
  lastEntries,
  fmtLastEntries,
  plannedSets,
  prefillRepsForEntry,
  type LastEntry,
  type PersonalBests,
} from "@/lib/logic";
import { gistBackup, GistApiError } from "@/lib/backup";
import { guideFor } from "@/lib/guide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RestTimer, MuscleTags, PlateBar } from "@/components/Gym";
import { cn, normalizeSearch } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { restTimer } from "@/hooks/use-rest-timer";

const DRAFT_KEY = "trening-app-draft";
const BONUS_SUGGESTION_KEY = "trening-app-bonus-suggestion";

interface Draft {
  dayId: string;
  date: string;
  entries: ExerciseLog[];
  mode: TrainingMode;
  /** Check-in gotowości (P2-4) — opcjonalny, wpisany PRZED startem dnia na ekranie wyboru. */
  readiness?: { sleep?: number; doms?: number };
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
// Baza to liczba serii z planu TEGO dnia (`day.setsOverride`), nie globalne
// `ex.targetSets` - seria dolozona przyciskiem "Dodaj serie" zostaje w planie.
function setsForMode(ex: Exercise, mode: TrainingMode, day?: WorkoutDay): number {
  const planned = plannedSets(day, ex);
  return mode === "deload" ? Math.max(2, planned - 1) : planned;
}

function fmtRecordHit(kind: RecordHit["kind"], value: number): string {
  if (kind === "hold") return `${value} s`;
  return kind === "e1rm" ? `e1RM ${fmtKg(value)}` : fmtKg(value);
}

// P3-1: pusty obiekt (obie skale nietkniete) -> undefined, nie zapisujemy smiecia do sesji.
function cleanReadiness(r: { sleep?: number; doms?: number } | null | undefined) {
  if (!r || (r.sleep === undefined && r.doms === undefined)) return undefined;
  return r;
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
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  // P3-8: filtr tekstowy w liscie kandydatow do zamiany (baza urosla do ~90 pozycji).
  const [swapSearch, setSwapSearch] = useState("");
  // Etap 4: JEDNO zwijane "Pomoc i szczegóły" per karta (rozgrzewka, talerze,
  // "Jak wykonać?", partie wspomagające, dłuższa uwaga techniczna) zamiast
  // czterech osobnych przełączników - domyślny widok karty ma pokazywać tylko
  // to, co potrzebne do wykonania serii. Stan NIE trafia do AppState (lokalny
  // UI, jak poprzednio) i nie zwija/rozwija się sam po zaliczeniu serii.
  const [openHelp, setOpenHelp] = useState<Set<number>>(new Set());
  // P2-4: check-in gotowosci - opcjonalny, wypelniany na ekranie wyboru dnia
  // PRZED startem; null = pominiety (brak kary, brak danych w sesji).
  const [readiness, setReadiness] = useState<{ sleep?: number; doms?: number } | null>(null);
  // P3-1: panel gotowosci domyslnie zwiniety - rozwijany recznie.
  const [readinessOpen, setReadinessOpen] = useState(false);
  // P3-6: tryb skupienia - indeks aktualnie widocznego cwiczenia. W stanie
  // (NIE w drafcie) - po restarcie apki w trakcie treningu wraca na pierwsze
  // cwiczenie z niezaliczona seria (albo ostatnie, gdy wszystko zaliczone).
  const [focusIdx, setFocusIdx] = useState(() => {
    const d = loadDraft();
    if (!d) return 0;
    const idx = d.entries.findIndex((e) => e.sets.some((s) => !s.done));
    return idx === -1 ? Math.max(0, d.entries.length - 1) : idx;
  });
  // P6-4: przejscie do kolejnego cwiczenia w trybie skupienia - NIGDY zaskakujace.
  // `autoAdvance` = WIDOCZNE odliczanie (deload / RIR juz odpowiedziane), z
  // mozliwoscia anulowania ("Zostań"); `quickAdvanceTimer` = krotkie, ciche
  // przejscie (~600ms) po JAWNYM potwierdzeniu (wybor RIR albo tap "Nastepne
  // cwiczenie") - bez UI do anulowania, bo to juz swiadoma decyzja.
  const [autoAdvance, setAutoAdvance] = useState<{ entryIdx: number; secondsLeft: number } | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelAutoAdvance() {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setAutoAdvance(null);
  }

  function tickAutoAdvance(entryIdx: number, secondsLeft: number) {
    if (secondsLeft <= 0) {
      autoAdvanceTimer.current = null;
      setAutoAdvance(null);
      setFocusIdx((cur) => (cur === entryIdx ? cur + 1 : cur));
      return;
    }
    setAutoAdvance({ entryIdx, secondsLeft });
    autoAdvanceTimer.current = setTimeout(() => tickAutoAdvance(entryIdx, secondsLeft - 1), 1000);
  }

  // P6-4 pkt 3+4: widoczne odliczanie 3s (bylo: slepy setTimeout 900ms) - dla
  // deloadu (bez pytania o RIR) i dla przypadku, gdy RIR jest juz odpowiedziane
  // (np. dodatkowa seria dolozona PO odpowiedzi na RIR).
  function scheduleVisibleAdvance(entryIdx: number) {
    if (quickAdvanceTimer.current) {
      clearTimeout(quickAdvanceTimer.current);
      quickAdvanceTimer.current = null;
    }
    cancelAutoAdvance();
    tickAutoAdvance(entryIdx, 3);
  }

  // P6-4 pkt 2: po wyborze RIR albo recznym tapie "Nastepne cwiczenie" -
  // krotkie przejscie bez widocznego odliczania (to juz swiadoma decyzja).
  function scheduleQuickAdvance(entryIdx: number) {
    cancelAutoAdvance();
    if (quickAdvanceTimer.current) clearTimeout(quickAdvanceTimer.current);
    quickAdvanceTimer.current = setTimeout(() => {
      quickAdvanceTimer.current = null;
      setFocusIdx((cur) => (cur === entryIdx ? cur + 1 : cur));
    }, 600);
  }

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      if (quickAdvanceTimer.current) clearTimeout(quickAdvanceTimer.current);
    };
  }, []);

  // P6-4 pkt 3: scroll to tez "interakcja z karta" - anuluje widoczne odliczanie.
  useEffect(() => {
    if (!autoAdvance) return;
    const cancel = () => cancelAutoAdvance();
    window.addEventListener("scroll", cancel, { passive: true });
    return () => window.removeEventListener("scroll", cancel);
  }, [autoAdvance]);

  const pendingBackup = useRef(false);
  const pendingBackupReminder = useRef(false);
  const hasDraft = draft !== null;

  // Mapa exId -> do 3 ostatnich ukończonych wpisów (Etap 4: "Ostatnie" pokazuje
  // kierunek, nie tylko punkt) — liczona tylko gdy zmieni się historia/plan,
  // nie per keystroke w loggerze.
  const lastByExercise = useMemo(() => {
    const map = new Map<string, LastEntry[]>();
    for (const ex of state.exercises) {
      const entries = lastEntries(state, ex.id, 3);
      if (entries.length > 0) map.set(ex.id, entries);
    }
    return map;
  }, [state.sessions, state.exercises]);

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
        if (err instanceof GistApiError && err.status === 401) {
          // Token odrzucony przez GitHub — wyczyść go i wyłącz auto-backup, żeby apka
          // nie próbowała bez końca wysyłać kolejnych nieudanych żądań (patrz Etap 1).
          store.updateSettings({ gistToken: undefined, autoBackup: false });
          toast("Auto-backup wyłączony", "GitHub odrzucił token — wklej nowy w Więcej → Chmura.");
        } else {
          toast("Auto-backup nieudany", err instanceof Error ? err.message : "Nieznany błąd");
        }
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
  // P3-6: uklad loggera - "list" (domyslnie, jak dzis) albo "focus" (jedno cwiczenie na ekran).
  const layout = state.settings.loggerLayout ?? "list";
  // P1-9/P3-5: rozgrzewka i talerze licza sie wzgledem AKTYWNEGO sprzetu (profil
  // siłowni, jesli ustawiony — spojnie z sugestiami FEAT-1), inaczej domowego
  // z ustawien.
  const activeBar = activeGymProfile?.barWeight ?? state.settings.barWeight;
  const activePlates = activeGymProfile?.plates ?? state.settings.plates;

  // Tryb skupienia: przy przejsciu na inne cwiczenie (auto-przejscie po zaliczeniu
  // ostatniej serii ALBO reczna nawigacja strzalkami/kropkami) timer przerwy ma
  // sie ZATRZYMAC i zresetowac do pelnej dlugosci NOWEGO cwiczenia - czas na
  // zmiane sprzetu/ciezaru to nie odpoczynek, wiec odliczanie nie ma lecieć w
  // tle podczas przejscia. Startuje na nowo dopiero gdy zaliczysz pierwsza serie
  // (albo recznie przez Start w panelu).
  useEffect(() => {
    if (!draft || layout !== "focus") return;
    const entry = draft.entries[focusIdx];
    const ex = entry ? state.exercises.find((e) => e.id === entry.exerciseId) : undefined;
    restTimer.stop(ex?.restSeconds ?? state.settings.restSeconds, ex?.name ?? null);
    // P6-4: kazde przejscie na inne cwiczenie (auto albo reczne) uniewaznia
    // ewentualne odliczanie/przejscie zaplanowane dla POPRZEDNIEGO cwiczenia.
    cancelAutoAdvance();
    if (quickAdvanceTimer.current) {
      clearTimeout(quickAdvanceTimer.current);
      quickAdvanceTimer.current = null;
    }
  }, [focusIdx, layout]);

  function toggleHelp(entryIdx: number) {
    setOpenHelp((prev) => {
      const next = new Set(prev);
      if (next.has(entryIdx)) next.delete(entryIdx);
      else next.add(entryIdx);
      return next;
    });
  }

  // P3-1: kazde pole niezalezne - klikniecie Snu NIE dotyka Zakwasow (byl bug:
  // dosypywalo domyslna trojke do drugiej skali). Toast tylko przy PRZEJSCIU
  // w stan niskiej gotowosci (nie przy kazdym kliknieciu, gdy juz tam bylismy).
  // Policzony PRZED setState — StrictMode (dev) wywoluje updatery dwa razy,
  // co podwoiloby toast (patrz finishSession).
  function updateReadiness(patch: Partial<{ sleep: number; doms: number }>) {
    const prev = readiness ?? {};
    const next = { ...prev, ...patch };
    const wasLow = (prev.sleep !== undefined && prev.sleep <= 2) ||
      (prev.sleep !== undefined && prev.doms !== undefined && prev.sleep + prev.doms <= 4);
    const isLow = (next.sleep !== undefined && next.sleep <= 2) ||
      (next.sleep !== undefined && next.doms !== undefined && next.sleep + next.doms <= 4);
    if (isLow && !wasLow) {
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
        const count = setsForMode(ex, mode, day);
        // Podwójna progresja: po skoku ciężaru prefill wraca na DÓŁ zakresu,
        // przy tym samym ciężarze podpowiada wynik z ostatniego treningu
        // (masz go pobić). Szczegóły: logic.ts → prefillRepsForEntry.
        const reps = prefillRepsForEntry(state, ex, hEx, target, count);
        return {
          exerciseId: exId,
          targetWeight: target,
          sets: reps.map((r) => ({ weight: target, reps: r, done: false })),
        };
      })
      .filter((e): e is ExerciseLog => e !== null);
    setDraft({ dayId, date: new Date().toISOString(), entries, mode, readiness: cleanReadiness(readiness) });
    setReadiness(null);
    setFocusIdx(0);
    // P6-2: timer przerwy zyje w stalym store'ze (poza Reactem), wiec nowy
    // trening ma wystartowac od czystego, zatrzymanego stanu - inaczej
    // odliczanie z POPRZEDNIEGO treningu w tej samej sesji (karta nie byla
    // przeladowana) leciałoby dalej / pigulka pokazywalaby stary czas.
    // P6-5: pokaz przerwe PIERWSZEGO cwiczenia (nie globalne settings.restSeconds)
    // juz teraz - inaczej przed pierwsza zaliczona seria timer klamie, pokazujac
    // wartosc, ktora nigdy nie bedzie realnie odliczana.
    const firstEx = entries[0] ? state.exercises.find((e) => e.id === entries[0].exerciseId) : undefined;
    restTimer.stop(firstEx?.restSeconds ?? state.settings.restSeconds, firstEx?.name ?? null);
  }

  function generateBonusSuggestion(day: WorkoutDay) {
    const picks = suggestBonusExercises(state, day.exerciseIds.length);
    setBonusSuggestion({
      dayId: day.id,
      exerciseIds: picks.map((e) => e.id),
      generatedAt: new Date().toISOString(),
    });
  }

  function updateSet(entryIdx: number, setIdx: number, patch: Partial<{ weight: number; reps: number; done: boolean; rir: number }>) {
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
      // P6-3: jesli to kliknięcie zaliczyło OSTATNIĄ nie odhaczoną serię całego
      // treningu - nie ma juz czego odpoczywac, tylko "Zakoncz trening". Liczone
      // z domkniecia `draft` sprzed setDraft() (ten sam wzorzec co `othersAlreadyDone`
      // nizej), rozszerzone na WSZYSTKIE wpisy, nie tylko biezace cwiczenie.
      const allEntriesDoneAfter =
        (draft?.entries ?? []).every((e, i) =>
          i === entryIdx ? e.sets.every((s, si) => si === setIdx || s.done) : e.sets.every((s) => s.done)
        );
      if (allEntriesDoneAfter) {
        restTimer.stop();
      } else {
        restTimer.start(ex?.restSeconds ?? state.settings.restSeconds, ex?.name ?? null);
      }

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

      // P6-4: tryb skupienia - gdy ten klik zaliczyl WSZYSTKIE serie biezacego
      // cwiczenia (nie tylko przy juz kompletnym; nie z ostatniego cwiczenia,
      // tam czeka "Zakoncz trening"). Auto-przejscie NIGDY nie jest zaskakujace:
      // deload (bez pytania o RIR) i przypadek, gdy RIR jest juz odpowiedziane
      // (np. dodatkowa seria dolozona PO odpowiedzi) dostaja WIDOCZNE odliczanie
      // 3s z "Zostań"; sila/hipertrofia z RIR jeszcze bez odpowiedzi NIE dostaja
      // zadnego auto-przejscia - czekamy na wybor RIR (nizej) albo reczny tap.
      const sets = draft?.entries[entryIdx]?.sets ?? [];
      const exerciseNowComplete = sets.length > 0 && sets.every((s, i) => i === setIdx || s.done);
      const totalEntries = draft?.entries.length ?? 0;
      const draftMode = draft?.mode;
      if (layout === "focus" && entryIdx === focusIdx && exerciseNowComplete && entryIdx < totalEntries - 1 && draftMode) {
        const lastWorkingIdx = ex
          ? setsForMode(ex, draftMode, state.days.find((d) => d.id === draft?.dayId)) - 1
          : -1;
        const rirAnswered = lastWorkingIdx >= 0 ? sets[lastWorkingIdx]?.rir !== undefined : false;
        if (draftMode === "deload" || rirAnswered) {
          scheduleVisibleAdvance(entryIdx);
        }
      }
    }

    // P6-4 pkt 2: wybor RIR (gdy cwiczenie jest juz kompletne) - krotkie, ciche
    // przejscie zamiast czekania na kolejny klik. Osobny warunek od `done`
    // powyzej - przyciski RIR wysylaja patch WYLACZNIE z polem `rir`.
    if (patch.rir !== undefined && layout === "focus" && entryIdx === focusIdx && draft?.mode !== "deload") {
      const sets = draft?.entries[entryIdx]?.sets ?? [];
      const allDone = sets.length > 0 && sets.every((s) => s.done);
      const totalEntries = draft?.entries.length ?? 0;
      if (allDone && entryIdx < totalEntries - 1) {
        scheduleQuickAdvance(entryIdx);
      }
    }
  }

  // P3-2: stepper +/- przy ciezarze. Synchronizuje INNE jeszcze niezaliczone
  // serie tego cwiczenia, ktore maja dokladnie ta sama wage co edytowana
  // seria PRZED zmiana - jesli Kamil wczesniej recznie rozjechal ciezar
  // konkretnej serii, ta seria przestaje sie synchronizowac (nie nadpisuje
  // sie juz nic). Zaliczonych serii nigdy nie dotyka. entry.targetWeight
  // (baza progresji) zostaje bez zmian - to tylko korekta wag serii w drafcie.
  function setWeightWithSync(entryIdx: number, setIdx: number, weight: number) {
    const w = Math.max(0, Math.round(weight * 100) / 100);
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const sets = next.entries[entryIdx].sets;
      const oldWeight = sets[setIdx].weight;
      if (!sets[setIdx].done) sets[setIdx].weight = w;
      for (let i = setIdx + 1; i < sets.length; i++) {
        if (!sets[i].done && sets[i].weight === oldWeight) sets[i].weight = w;
      }
      return next;
    });
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

    // Seria dołożona w loggerze zostaje w planie TEGO dnia na stałe — od
    // następnego tygodnia dzień startuje już z tą liczbą serii i tyle serii
    // musi trafić w górny limit, żeby ciężar wskoczył (podwójna progresja).
    // Liczone poza updaterem setDraft: ten musi zostać czysty (StrictMode
    // wywołuje go dwa razy w dev), a store.setDaySets to efekt uboczny.
    if (!draft || draft.mode === "deload") return; // deload celowo ma serię mniej — nie dotyka planu
    const entry = draft.entries[entryIdx];
    const ex = entry && state.exercises.find((e) => e.id === entry.exerciseId);
    const day = state.days.find((d) => d.id === draft.dayId);
    if (!ex || !day || !day.exerciseIds.includes(ex.id)) return; // podmienione ćwiczenie = tylko ta sesja
    const newCount = entry.sets.length + 1;
    if (newCount <= plannedSets(day, ex)) return;
    store.setDaySets(day.id, ex.id, newCount);
    toast(
      "Seria dodana do planu",
      `${ex.name}: od teraz ${newCount} serie w dniu „${day.name}". Zmienisz to w Planie.`
    );
  }

  // Usunięcie serii dotyczy TYLKO tej sesji — plan zostaje. Świadoma
  // asymetria względem addSet: gorszy dzień (zmęczenie, siłownia zamykana)
  // nie może po cichu okroić programu na stałe. Trwałe zmniejszenie liczby
  // serii robi się w Planie.
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
    const swapDay = state.days.find((d) => d.id === draft?.dayId);
    const count = setsForMode(newEx, mode, swapDay);
    const reps = prefillRepsForEntry(state, newEx, hEx, target, count); // ta sama reguła co przy starcie dnia
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.entries[entryIdx] = {
        exerciseId: newExId,
        targetWeight: target,
        sets: reps.map((r) => ({ weight: target, reps: r, done: false })),
      };
      return next;
    });
    setSwapIdx(null);
    setSwapSearch("");
  }

  function finish() {
    if (!draft) return;
    const anyDone = draft.entries.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !confirm("Żadna seria nie jest odhaczona. Zakończyć mimo to?")) return;
    // P6-3: koniec treningu = koniec odpoczywania - po tym punkcie funkcja
    // zawsze konczy trening (zaden dalszy early-return), wiec to bezpieczne
    // miejsce na bezwarunkowy stop() (dopiero PO ew. confirm() wyzej, zeby
    // odrzucenie dialogu nie ubijalo lecacej przerwy w trwajacym treningu).
    restTimer.stop();

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
    // P6-3: stop() dopiero PO potwierdzeniu - inaczej klikniecie "Porzuc" i
    // odrzucenie confirm() ("nie, jednak nie") ubijaloby lecaca przerwe mimo
    // ze trening tak naprawde trwa dalej.
    if (confirm("Porzucić ten trening? Wpisane serie przepadną.")) {
      restTimer.stop();
      setDraft(null);
    }
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
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div>
            <p className="text-xs font-medium">Tryb skupienia</p>
            <p className="text-[10px] text-muted-foreground">
              Jedno ćwiczenie na ekran zamiast listy ze scrollem.
            </p>
          </div>
          <Switch
            checked={layout === "focus"}
            onCheckedChange={(v) => store.updateSettings({ loggerLayout: v ? "focus" : "list" })}
          />
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
          <button
            type="button"
            onClick={() => setReadinessOpen((v) => !v)}
            className="flex w-full items-center gap-1 text-left text-xs font-medium"
          >
            {readinessOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {readiness?.sleep === undefined && readiness?.doms === undefined
              ? "Jak się dziś czujesz? (opcjonalnie)"
              : `Gotowość: sen ${readiness?.sleep ?? "—"} · zakwasy ${readiness?.doms ?? "—"}`}
          </button>
          {readinessOpen && (
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
          )}
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
  // P6-3: gdy WSZYSTKIE serie treningu sa zaliczone, nie ma juz czego odmierzac -
  // zamiast pigulki/panelu timera pokazujemy podpowiedz "zakoncz trening".
  const allSetsDone = totalCount > 0 && doneCount === totalCount;
  const volume = sessionVolume(state, {
    id: "draft",
    dayId: draft.dayId,
    date: draft.date,
    entries: draft.entries,
    completed: false,
  });

  // P3-6: karta jednego cwiczenia - funkcja (nie osobny plik/komponent), zeby
  // uzyskac pelne wspoldzielenie kodu miedzy ukladem "list" (scroll, wszystkie
  // karty) i "focus" (jedno cwiczenie na ekran) bez przekazywania dziesiatkow
  // propsow - obie sciezki renderu dziela to samo domkniecie (draft, timer,
  // swapIdx itd. zyja w TrainScreen). TS nie zweza `draft` przez granice
  // deklaracji funkcji (mimo ze `draft` jest const) - stad lokalny guard.
  function renderExerciseCard(ei: number) {
    if (!draft) return null;
    const entry = draft.entries[ei];
    const ex = state.exercises.find((e) => e.id === entry.exerciseId);
    if (!ex) return null;
    const hEx = exerciseForMode(ex, draft.mode);
          const guide = guideFor(ex);
          const unitLabel = hEx.isHold ? "s" : "powt.";
          const lastFew = lastByExercise.get(ex.id) ?? [];
          const gymSuggestion = suggestedWeightForProfile(ex, entry.targetWeight, activeGymProfile);
          const warmupSteps = warmupPlan(ex, entry.targetWeight, activeBar, activePlates);
          // P3-5: cwiczenie sztangowe -> ciezar PIERWSZEJ niezaliczonej serii (a nie
          // entry.targetWeight, ktory po korekcie steperem moze juz nie byc prawda);
          // gdy wszystkie zaliczone, ostatnia seria.
          const plateWeight =
            ex.unit === "barbell"
              ? entry.sets.find((s) => !s.done)?.weight ?? entry.sets[entry.sets.length - 1]?.weight ?? entry.targetWeight
              : null;
          const platePlanForEntry = plateWeight !== null ? platePlan(plateWeight, activeBar, activePlates) : null;
          // Etap 4: czy jest COKOLWIEK do pokazania pod "Pomoc i szczegóły" - bez
          // tego pusty, klikalny nagłówek wisiałby na każdej karcie bez powodu.
          const hasHelp =
            (ex.secondaryMuscles?.length ?? 0) > 0 ||
            !!hEx.note ||
            warmupSteps.length > 0 ||
            !!platePlanForEntry ||
            !!guide;
          // P3-8: baza urosla do ~90 pozycji - swapPool to PELNA lista kandydatow
          // (decyduje o widocznosci przycisku Zamien), swapCandidates to ta sama
          // lista po filtrze tekstowym (swapSearch) i posortowana: historia
          // Kamila najpierw, potem alfabetycznie.
          const swapPool = ex.primaryMuscle
            ? state.exercises.filter(
                (e) =>
                  !e.archived &&
                  e.primaryMuscle === ex.primaryMuscle &&
                  e.id !== ex.id &&
                  !draft.entries.some((en) => en.exerciseId === e.id)
              )
            : [];
          const swapCandidates = swapPool
            .filter((e) => !swapSearch || normalizeSearch(e.name).includes(normalizeSearch(swapSearch)))
            .sort((a, b) => {
              const ha = lastByExercise.has(a.id) ? 0 : 1;
              const hb = lastByExercise.has(b.id) ? 0 : 1;
              return ha - hb || a.name.localeCompare(b.name, "pl");
            });
          return (
            <Card key={entry.exerciseId}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{ex.name}</CardTitle>
                  {swapPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSwapIdx(swapIdx === ei ? null : ei);
                        setSwapSearch("");
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Zamień ćwiczenie"
                    >
                      <Repeat size={15} />
                    </button>
                  )}
                </div>
                <MuscleTags exercise={ex} only="primary" />
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
                    <Input
                      autoFocus
                      value={swapSearch}
                      onChange={(e) => setSwapSearch(e.target.value)}
                      placeholder="Szukaj ćwiczenia…"
                      className="h-8 text-xs"
                    />
                    <div className="max-h-64 space-y-0.5 overflow-y-auto">
                      {swapCandidates.length === 0 ? (
                        <p className="p-2 text-center text-[11px] text-muted-foreground">Brak wyników</p>
                      ) : (
                        swapCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => swapExercise(ei, c.id)}
                            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                          >
                            {c.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                {lastFew.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ostatnie: {fmtLastEntries(lastFew, hEx.isHold)}
                  </p>
                )}
                {hasHelp && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleHelp(ei)}
                      className="flex min-h-11 w-full items-center gap-1 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      aria-expanded={openHelp.has(ei)}
                      aria-label="Pomoc i szczegóły"
                    >
                      {openHelp.has(ei) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Pomoc i szczegóły
                    </button>
                    {openHelp.has(ei) && (
                      <div className="mt-1 space-y-2 rounded-md border border-border p-2">
                        <MuscleTags exercise={ex} only="secondary" />
                        {hEx.note && (
                          <p className="text-[11px] leading-snug text-amber-200/70">{hEx.note}</p>
                        )}
                        {warmupSteps.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium text-foreground/80">
                              Rozgrzewka ({warmupSteps.length})
                            </p>
                            <div className="mt-1 space-y-1">
                              {warmupSteps.map((s, si) => {
                                const plan = platePlan(s.weight, activeBar, activePlates);
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
                          </div>
                        )}
                        {platePlanForEntry && (
                          <div>
                            <p className="text-[11px] font-medium text-foreground/80">
                              {platePlanForEntry.ok ? (
                                <>
                                  Talerze ·{" "}
                                  {platePlanForEntry.perSide.length > 0
                                    ? `${platePlanForEntry.perSide.join(" + ")} na stronę`
                                    : "sam gryf"}
                                </>
                              ) : (
                                <span className="text-amber-400">
                                  Talerze ·{" "}
                                  {platePlanForEntry.leftover > 0
                                    ? `brakuje ${fmtKg(platePlanForEntry.leftover)}`
                                    : "cel lżejszy niż gryf"}
                                </span>
                              )}
                            </p>
                            <div className="mt-1">
                              <PlateBar target={plateWeight!} barWeight={activeBar} plates={activePlates} compact />
                            </div>
                          </div>
                        )}
                        {guide && (
                          <div>
                            <p className="text-[11px] font-medium text-foreground/80">Jak wykonać?</p>
                            {/* Zadanie 1: w 100% tekstowa — bez animowanego ludzika, tekst
                                zajmuje pełną szerokość karty (bez pustej kolumny po jego lewej). */}
                            <div className="mt-1 space-y-1.5 text-[11px] leading-snug text-muted-foreground">
                              <div>
                                <p className="font-medium text-foreground/80">Ustawienie</p>
                                {guide.setup.map((s, si) => (
                                  <p key={si}>{s}</p>
                                ))}
                              </div>
                              <div>
                                <p className="font-medium text-foreground/80">Ruch</p>
                                <ol className="list-decimal space-y-0.5 pl-4">
                                  {guide.steps.map((s, si) => (
                                    <li key={si}>{s}</li>
                                  ))}
                                </ol>
                              </div>
                              <div>
                                <p className="font-medium text-foreground/80">Najczęstsze błędy</p>
                                <ul className="list-disc space-y-0.5 pl-4">
                                  {guide.mistakes.map((s, si) => (
                                    <li key={si}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                              {guide.safety && <p className="text-amber-300">{guide.safety}</p>}
                              <p className="text-[10px] text-muted-foreground/70">
                                Skrót techniczny — nie zastąpi trenera.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-1.5">
                {entry.sets.map((set, si) => {
                  const best = personalBestsByExercise.get(ex.id);
                  const recordKind = best ? isSetRecord(ex, set, best) : null;
                  // P4-4: pytamy o RIR TYLKO po ostatniej serii ROBOCZEJ (nie po
                  // każdej, nie po dodatkowych seriach z "Dodaj serię") i tylko
                  // gdy progresja w ogóle liczy się w tym trybie (deload - nie).
                  const isLastWorkingSet = si === setsForMode(ex, draft.mode, day) - 1;
                  return (
                  <div key={si}>
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-md",
                      recordKind && "ring-1 ring-amber-400/70"
                    )}
                  >
                    <span className="w-4 shrink-0 text-xs text-muted-foreground">{si + 1}</span>
                    <button
                      type="button"
                      disabled={set.done}
                      onClick={() => setWeightWithSync(ei, si, set.weight - hEx.increment)}
                      className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground active:bg-accent disabled:opacity-30"
                      aria-label="Zmniejsz ciężar"
                    >
                      <Minus size={14} />
                    </button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      className="h-9 w-16 px-1 text-center"
                      value={set.weight === 0 ? "" : set.weight}
                      placeholder="kg"
                      onChange={(e) => updateSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      disabled={set.done}
                      onClick={() => setWeightWithSync(ei, si, set.weight + hEx.increment)}
                      className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground active:bg-accent disabled:opacity-30"
                      aria-label="Zwiększ ciężar"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">×</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-14 px-1 text-center"
                      value={set.reps === 0 ? "" : set.reps}
                      placeholder={unitLabel}
                      onChange={(e) => updateSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                    />
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
                    {si >= setsForMode(ex, draft.mode, day) && (
                      <button
                        type="button"
                        onClick={() => removeSet(ei, si)}
                        className="flex h-9 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label="Usuń serię"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {isLastWorkingSet && set.done && draft.mode !== "deload" && (
                    <div className="ml-5 flex flex-col gap-1 pb-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Ile zostało w baku (RIR)?</span>
                      <div className="flex gap-1.5">
                        {([0, 1, 2, 3] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => updateSet(ei, si, { rir: set.rir === n ? undefined : n })}
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                              set.rir === n
                                ? "border-primary bg-primary/20 text-primary"
                                : "border-border text-muted-foreground hover:bg-accent"
                            )}
                            aria-label={n === 0 ? "RIR 0 - upadek" : n === 3 ? "RIR 3 lub więcej" : `RIR ${n}`}
                          >
                            {n === 3 ? "3+" : n}
                          </button>
                        ))}
                      </div>
                    </div>
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
  }

  if (layout === "focus") {
    // ── Tryb skupienia (P3-6): jedno ćwiczenie na ekran ─────────────────────
    // P6-4: pasek "Ćwiczenie zrobione" - widoczny gdy WSZYSTKIE serie biezacego
    // cwiczenia sa zaliczone i jest jeszcze cos, do czego przejsc.
    const focusEntry = draft.entries[focusIdx];
    const currentExerciseDone = !!focusEntry && focusEntry.sets.length > 0 && focusEntry.sets.every((s) => s.done);
    const isLastFocusEntry = focusIdx >= draft.entries.length - 1;
    return (
      <div className="pb-16">
        <div
          className="sticky top-0 z-10 border-b border-border bg-background/95 p-4 backdrop-blur"
          style={{
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
                {day?.short} · ĆW. {focusIdx + 1}/{draft.entries.length}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={cancel} className="text-muted-foreground">
              <X size={15} /> Porzuć
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {/* P6-4: kazda interakcja z karta (pole, +/-) anuluje widoczne
              odliczanie do nastepnego cwiczenia - "capture", zeby zlapac
              klikniecie zanim zrobi cokolwiek innego. */}
          <div onPointerDownCapture={() => autoAdvance && cancelAutoAdvance()}>
            {renderExerciseCard(focusIdx)}
          </div>
          {currentExerciseDone && !isLastFocusEntry && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3">
              <p className="text-sm font-medium text-green-400">Ćwiczenie zrobione</p>
              {autoAdvance ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Następne ćwiczenie za {autoAdvance.secondsLeft}…
                  </p>
                  <Button variant="ghost" size="sm" onClick={cancelAutoAdvance}>
                    Zostań
                  </Button>
                </div>
              ) : (
                <Button className="mt-2 w-full" onClick={() => scheduleQuickAdvance(focusIdx)}>
                  Następne ćwiczenie <ChevronRight size={16} />
                </Button>
              )}
            </div>
          )}
          <div className="rounded-lg border border-border bg-card p-3">
            {/* P6-3: po ostatniej serii calego treningu nie ma juz czego
                odmierzac - podpowiedz zamiast (juz zatrzymanego) panelu. */}
            {allSetsDone ? (
              <p className="text-center text-sm font-medium text-green-400">
                Wszystko zrobione — zakończ trening
              </p>
            ) : (
              <RestTimer variant="panel" />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={focusIdx === 0}
              onClick={() => setFocusIdx((i) => Math.max(0, i - 1))}
              aria-label="Poprzednie ćwiczenie"
            >
              <ChevronLeft size={18} />
            </Button>
            <div className="flex gap-1.5">
              {draft.entries.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFocusIdx(i)}
                  className={cn("h-2 w-2 rounded-full transition-colors", i === focusIdx ? "bg-primary" : "bg-muted")}
                  aria-label={`Ćwiczenie ${i + 1}`}
                />
              ))}
            </div>
            {focusIdx < draft.entries.length - 1 ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFocusIdx((i) => Math.min(draft.entries.length - 1, i + 1))}
                aria-label="Następne ćwiczenie"
              >
                <ChevronRight size={18} />
              </Button>
            ) : (
              <Button size="sm" onClick={finish}>
                Zakończ trening
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Tryb listy (domyślny) ──────────────────────────────────────────────────
  // pb-36 (nie pb-16): w tym trybie floatuje lokalna pigułka timera nad dolną
  // nawigacją (bottom: 78px + własna wysokość) - bez większego marginesu
  // zasłaniałaby "Zakończ trening" albo ostatnią serię przy krótszej liście
  // ćwiczeń (patrz P6 Etap 2).
  return (
    <div className="pb-36">
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
        {draft.entries.map((_, ei) => renderExerciseCard(ei))}

        <Button className="w-full" size="lg" onClick={finish}>
          Zakończ trening
        </Button>
      </div>
      {/* Pigulka timera - lokalnie na TEJ zakladce, ZAWSZE gdy trwa trening
          (rowniez w spoczynku, przed pierwsza seria - P6-5: ma pokazywac
          przerwe PIERWSZEGO cwiczenia, nie znikac do momentu pierwszego
          klikniecia). Poza zakladka Trening przejmuje ja globalny
          GlobalRestPill w App.tsx (widoczny tylko gdy realnie cos sie dzieje -
          patrz useShowRestPill), zeby nie dublowac pigulek gdy jestes tutaj.
          P6-3: gdy WSZYSTKIE serie sa zaliczone, timer jest juz zatrzymany
          (updateSet) - w tym samym miejscu podpowiedz zamiast pigulki. */}
      {allSetsDone ? (
        <div
          className="fixed left-1/2 z-20 -translate-x-1/2 rounded-full border border-green-500/40 bg-card/95 px-4 py-1.5 text-xs font-medium text-green-400 shadow-lg backdrop-blur"
          style={{ bottom: "78px" }}
        >
          Wszystko zrobione — zakończ trening
        </div>
      ) : (
        // Tylko pozycjonowanie - wygląd pigułki należy WYŁĄCZNIE do RestTimer
        // variant="pill" (patrz komentarz w Gym.tsx, P6 Etap 2).
        <div className="fixed left-1/2 z-20 -translate-x-1/2" style={{ bottom: "78px" }}>
          <RestTimer variant="pill" />
        </div>
      )}
    </div>
  );
}
