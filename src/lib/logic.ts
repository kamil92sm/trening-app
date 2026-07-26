import type {
  AppState,
  Exercise,
  ExerciseLog,
  GymProfile,
  Muscle,
  Session,
  SetLog,
  TrainingMode,
} from "./types";

// ── Objętość per partia ────────────────────────────────────────────────────

export const MUSCLES: Muscle[] = [
  "Klatka",
  "Plecy",
  "Barki",
  "Nogi",
  "Pośladki",
  "Tył uda",
  "Łydki",
  "Biceps",
  "Triceps",
  "Brzuch",
];

export type VolumeGoal = "strength" | "hypertrophy";

/** Zakresy hipertroficzne (domyślne) — jak dotąd. */
export const MUSCLE_RANGES_HYPERTROPHY: Record<Muscle, { min: number; max: number }> = {
  Klatka: { min: 10, max: 20 },
  Plecy: { min: 10, max: 20 },
  Barki: { min: 10, max: 20 },
  Nogi: { min: 10, max: 20 },
  Pośladki: { min: 10, max: 20 },
  "Tył uda": { min: 8, max: 16 },
  Łydki: { min: 8, max: 16 },
  Biceps: { min: 8, max: 16 },
  Triceps: { min: 8, max: 16 },
  Brzuch: { min: 8, max: 16 },
};

/**
 * Zakresy pod cel siłowy — niższe, bo program siłowy (mało powtórzeń, ciężkie
 * wielostawowe) potrzebuje mniej serii/tydzień niż hipertrofia. Nie są dobrane
 * tak, żeby "na siłę" wszystko świeciło się zielono — partie z realnie niskim
 * bezpośrednim udziałem (np. ramiona/łydki bez włączonego dnia bonusowego)
 * nadal pokażą "poniżej optimum", zgodnie z uczciwym framowaniem apki.
 */
export const MUSCLE_RANGES_STRENGTH: Record<Muscle, { min: number; max: number }> = {
  Klatka: { min: 5, max: 12 },
  Plecy: { min: 5, max: 12 },
  Barki: { min: 5, max: 12 },
  Nogi: { min: 5, max: 12 },
  Pośladki: { min: 5, max: 12 },
  "Tył uda": { min: 5, max: 10 },
  Łydki: { min: 5, max: 10 },
  Biceps: { min: 5, max: 10 },
  Triceps: { min: 5, max: 10 },
  Brzuch: { min: 5, max: 10 },
};

/** Zachowane dla wstecznej zgodności — zakresy hipertroficzne (domyślny cel). */
export const MUSCLE_RANGES = MUSCLE_RANGES_HYPERTROPHY;

/**
 * Zakresy dla celu, z opcjonalnym ręcznym nadpisaniem per partia (P1-5,
 * `settings.muscleRanges`). Brak partii w `overrides` = zakres domyślny celu.
 */
export function muscleRangesFor(
  goal: VolumeGoal,
  overrides?: Partial<Record<Muscle, { min: number; max: number }>>
): Record<Muscle, { min: number; max: number }> {
  const base = goal === "strength" ? MUSCLE_RANGES_STRENGTH : MUSCLE_RANGES_HYPERTROPHY;
  if (!overrides) return base;
  const merged = { ...base };
  for (const m of MUSCLES) {
    if (overrides[m]) merged[m] = overrides[m]!;
  }
  return merged;
}

// P3-7: kolor per partia - jedno zrodlo prawdy uzywane w Treningu i Planie
// (tagi partii przy cwiczeniu) oraz w trybie skupienia. Dobrane tak, zeby
// sasiadujace partie sie nie zlewaly na ciemnym tle.
export const MUSCLE_COLORS: Record<Muscle, string> = {
  Klatka: "#ef4444",
  Plecy: "#3b82f6",
  Barki: "#f59e0b",
  Nogi: "#22c55e",
  Pośladki: "#ec4899",
  "Tył uda": "#14b8a6",
  Łydki: "#84cc16",
  Biceps: "#a855f7",
  Triceps: "#f97316",
  Brzuch: "#eab308",
};

export type VolumeStatus = "low" | "ok" | "high" | "veryhigh";

export const STATUS_COLORS: Record<VolumeStatus, string> = {
  low: "#f59e0b",
  ok: "#22c55e",
  high: "#38bdf8",
  veryhigh: "#f43f5e",
};

export const STATUS_LABELS: Record<VolumeStatus, string> = {
  low: "poniżej optimum",
  ok: "w zakresie",
  high: "wysoko",
  veryhigh: "bardzo wysoko",
};

export interface MuscleVolume {
  muscle: Muscle;
  sets: number;
  direct: number;
  tonnage: number;
  status: VolumeStatus;
}

function volumeStatus(
  sets: number,
  muscle: Muscle,
  goal: VolumeGoal = "hypertrophy",
  overrides?: Partial<Record<Muscle, { min: number; max: number }>>
): VolumeStatus {
  const r = muscleRangesFor(goal, overrides)[muscle];
  if (sets < r.min) return "low";
  if (sets <= r.max) return "ok";
  if (sets <= 1.3 * r.max) return "high";
  return "veryhigh";
}

/**
 * Serie robocze / tydzień per partia — Z PLANU (ile jest ZAPLANOWANE, nie ile
 * faktycznie wykonano). Partia główna = 1 seria, wspomagająca = 1/2. Liczy z
 * aktywnych dni (dzień optional tylko gdy active); każdy dzień = 1x/tydzień.
 * `goal` decyduje o progach statusu (patrz MUSCLE_RANGES_STRENGTH/_HYPERTROPHY).
 */
export function weeklyMuscleVolume(state: AppState, goal: VolumeGoal = "hypertrophy"): MuscleVolume[] {
  const acc = new Map<Muscle, { sets: number; direct: number; tonnage: number }>();
  for (const m of MUSCLES) acc.set(m, { sets: 0, direct: 0, tonnage: 0 });

  for (const day of state.days) {
    if (day.optional && !day.active) continue;
    for (const exId of day.exerciseIds) {
      const ex = state.exercises.find((e) => e.id === exId);
      if (!ex || ex.archived) continue;
      const sets = ex.targetSets;
      const target = state.targets[ex.id] ?? 0;
      const avgReps = (ex.repMin + ex.repMax) / 2;
      const tonnage = ex.isHold ? 0 : target * avgReps * sets * (ex.perHand ? 2 : 1);
      if (ex.primaryMuscle) {
        const a = acc.get(ex.primaryMuscle)!;
        a.sets += sets;
        a.direct += sets;
        a.tonnage += tonnage;
      }
      for (const m of ex.secondaryMuscles ?? []) {
        const a = acc.get(m)!;
        a.sets += sets * 0.5;
      }
    }
  }

  return MUSCLES.map((muscle) => {
    const a = acc.get(muscle)!;
    return {
      muscle,
      sets: +a.sets.toFixed(1),
      direct: a.direct,
      tonnage: Math.round(a.tonnage),
      status: volumeStatus(a.sets, muscle, goal, state.settings.muscleRanges),
    };
  });
}

/**
 * Granice okna "ostatnie 7 dni" (dziś + 6 wstecz) jako klucze YYYY-MM-DD z
 * KOMPONENTÓW LOKALNYCH (nie `toISOString()` = UTC) — inaczej po północy
 * czasu lokalnego w strefie o ujemnym przesunięciu okno mogłoby zjechać
 * o dobę względem `session.date` (który bywa zapisany bez strefy, patrz
 * historia startowa vs. `new Date().toISOString()` w drafcie). Wspólne dla
 * `actualWeeklyMuscleVolume` i `actualVolumeWindow`, żeby nie rozjechały się
 * w przyszłości.
 */
function volumeWindowBounds(nowIso?: string): { cutoffStr: string; nowStr: string } {
  const now = nowIso ? new Date(nowIso) : new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 6);
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { cutoffStr: key(cutoff), nowStr: key(now) };
}

/**
 * Serie robocze W OSTATNICH 7 DNIACH — z faktycznie zalogowanych (ukończonych)
 * sesji, nie z planu. Ta sama waga partia główna/wspomagająca jak wyżej.
 * `nowIso` opcjonalny (testowalność) — domyślnie bieżąca data urządzenia.
 */
export function actualWeeklyMuscleVolume(
  state: AppState,
  goal: VolumeGoal = "hypertrophy",
  nowIso?: string
): MuscleVolume[] {
  const acc = new Map<Muscle, { sets: number; direct: number; tonnage: number }>();
  for (const m of MUSCLES) acc.set(m, { sets: 0, direct: 0, tonnage: 0 });

  const { cutoffStr, nowStr } = volumeWindowBounds(nowIso);

  for (const session of state.sessions) {
    if (!session.completed) continue;
    const d = session.date.slice(0, 10);
    if (d < cutoffStr || d > nowStr) continue;
    for (const entry of session.entries) {
      const ex = state.exercises.find((e) => e.id === entry.exerciseId);
      if (!ex || ex.archived) continue;
      const doneSets = entry.sets.filter((s) => s.done).length;
      if (doneSets === 0) continue;
      const tonnage = entryVolume(ex, entry);
      if (ex.primaryMuscle) {
        const a = acc.get(ex.primaryMuscle)!;
        a.sets += doneSets;
        a.direct += doneSets;
        a.tonnage += tonnage;
      }
      for (const m of ex.secondaryMuscles ?? []) {
        const a = acc.get(m)!;
        a.sets += doneSets * 0.5;
      }
    }
  }

  return MUSCLES.map((muscle) => {
    const a = acc.get(muscle)!;
    return {
      muscle,
      sets: +a.sets.toFixed(1),
      direct: a.direct,
      tonnage: Math.round(a.tonnage),
      status: volumeStatus(a.sets, muscle, goal, state.settings.muscleRanges),
    };
  });
}

/**
 * Kontekst okna "Wykonane (7 dni)" — do wyjaśnienia w UI (P3-3) dlaczego
 * "Plan" i "Wykonane" czasem pokazują identyczne liczby: to zbieżność
 * danych (okno akurat trafiło po jednym kompletnym treningu na dzień
 * planu), nie błąd. Liczba ukończonych sesji w oknie + zakres dat.
 */
export function actualVolumeWindow(
  state: AppState,
  nowIso?: string
): { sessions: number; fromIso: string; toIso: string } {
  const { cutoffStr, nowStr } = volumeWindowBounds(nowIso);
  const count = state.sessions.filter((s) => {
    if (!s.completed) return false;
    const d = s.date.slice(0, 10);
    return d >= cutoffStr && d <= nowStr;
  }).length;
  return { sessions: count, fromIso: cutoffStr, toIso: nowStr };
}

/**
 * Dobiera ćwiczenia na dzień bonusowy pod partie z największym deficytem
 * objętości W TYM TYGODNIU — na podstawie faktycznie ukończonych sesji
 * (`actualWeeklyMuscleVolume`), nie z planu. Bonus robi się na końcu tygodnia
 * (po Pon/Śr/Pt), więc liczy się realny wynik tygodnia, nie teoretyczny plan
 * (który jest statyczny i zawsze wskaże te same partie). Pomija ćwiczenia już
 * obecne w aktywnych dniach GŁÓWNYCH (nie dubluje ruchów, które i tak są w
 * tygodniu) i zarchiwizowane. Wynik ma znaczenie tylko jako propozycja do
 * drafta sesji (patrz TrainScreen) — nie rusza planu ani progresji.
 */
export function suggestBonusExercises(state: AppState, count: number, nowIso?: string): Exercise[] {
  const goal = state.settings.volumeGoal ?? "hypertrophy";
  const ranges = muscleRangesFor(goal, state.settings.muscleRanges);
  const deficits = actualWeeklyMuscleVolume(state, goal, nowIso)
    .filter((v) => v.status === "low")
    .sort((a, b) => a.sets - ranges[a.muscle].min - (b.sets - ranges[b.muscle].min));

  const mainExerciseIds = new Set(state.days.filter((d) => !d.optional).flatMap((d) => d.exerciseIds));
  const pool = state.exercises.filter((e) => !e.archived && !mainExerciseIds.has(e.id));

  const picked: Exercise[] = [];
  const usedIds = new Set<string>();

  for (const { muscle } of deficits) {
    if (picked.length >= count) break;
    const candidate = pool.find((e) => e.primaryMuscle === muscle && !usedIds.has(e.id));
    if (candidate) {
      picked.push(candidate);
      usedIds.add(candidate.id);
    }
  }

  // Dobij do count, gdy deficytowych partii jest mniej niż miejsc w bonusie.
  for (const e of pool) {
    if (picked.length >= count) break;
    if (usedIds.has(e.id) || !e.primaryMuscle) continue;
    picked.push(e);
    usedIds.add(e.id);
  }

  return picked;
}

// ── Podwójna progresja ─────────────────────────────────────────────────────

export type ProgressionStatus = "up" | "hold" | "deload";

export interface ProgressionResult {
  status: ProgressionStatus;
  nextWeight: number;
  message: string;
}

const round25 = (x: number) => Math.round(x * 100) / 100;

/**
 * Ciężar rośnie o increment dopiero, gdy WSZYSTKIE serie robocze (targetSets)
 * osiągną repMax. Jeśli >=2 serie poniżej repMin -> sygnał deloadu, ciężar zostaje.
 * Dla isHold (plank) próg to sekundy, progresja dokłada obciążenie.
 */
export function computeProgression(
  ex: Exercise,
  targetWeight: number,
  sets: SetLog[]
): ProgressionResult {
  const done = sets.filter((s) => s.done);
  const unitWord = ex.isHold ? "s" : "powt.";

  if (done.length === 0) {
    return {
      status: "hold",
      nextWeight: targetWeight,
      message: "Brak zaliczonych serii — cel bez zmian.",
    };
  }

  const working = done.slice(0, ex.targetSets);
  const allAtTop =
    working.length >= ex.targetSets && working.every((s) => s.reps >= ex.repMax);
  const belowMin = working.filter((s) => s.reps < ex.repMin).length;

  if (allAtTop) {
    const next = round25(targetWeight + ex.increment);
    return {
      status: "up",
      nextWeight: next,
      message: ex.isHold
        ? `Wszystkie serie po ${ex.repMax} ${unitWord} — dokładasz obciążenie: ${next} kg.`
        : `Wszystkie serie po ${ex.repMax} ${unitWord} — nowy ciężar ${next} kg, wracasz do ${ex.repMin} ${unitWord}`,
    };
  }

  if (belowMin >= 2) {
    return {
      status: "deload",
      nextWeight: targetWeight,
      message: `Spadek formy (${belowMin} serie poniżej ${ex.repMin} ${unitWord}) — odbuduj powtórzenia na tym ciężarze.`,
    };
  }

  return {
    status: "hold",
    nextWeight: targetWeight,
    message: `Ciężar zostaje — walcz, aż wszystkie serie osiągną ${ex.repMax} ${unitWord}`,
  };
}

// ── Tonaż i e1RM ───────────────────────────────────────────────────────────

export function setVolume(ex: Exercise, s: SetLog): number {
  if (!s.done || ex.isHold) return 0;
  return s.weight * s.reps * (ex.perHand ? 2 : 1);
}

export function entryVolume(ex: Exercise, entry: ExerciseLog): number {
  return entry.sets.reduce((sum, s) => sum + setVolume(ex, s), 0);
}

export function sessionVolume(state: AppState, session: Session): number {
  return session.entries.reduce((sum, entry) => {
    const ex = state.exercises.find((e) => e.id === entry.exerciseId);
    return ex ? sum + entryVolume(ex, entry) : sum;
  }, 0);
}

/**
 * Czas trwania treningu w minutach (`finishedAt` - `date`). `null`, gdy
 * `finishedAt` nieznane (stare sesje, historia startowa) ALBO wynik > 240 min
 * (apka zostawiona otwarta na noc — lepiej "czas nieznany" niż bzdura).
 */
export function sessionDuration(session: Session): number | null {
  if (!session.finishedAt) return null;
  const minutes = (new Date(session.finishedAt).getTime() - new Date(session.date).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return null;
  return Math.round(minutes);
}

/** Epley; 1 powtórzenie = ciężar */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Najlepsze e1RM z wpisu (0 gdy brak zaliczonych serii lub hold) */
export function bestE1rm(ex: Exercise, entry: ExerciseLog): number {
  if (ex.isHold) return 0;
  let best = 0;
  for (const s of entry.sets) {
    if (!s.done) continue;
    best = Math.max(best, e1rm(s.weight, s.reps));
  }
  return best;
}

export interface PersonalBests {
  weight: number;
  e1rm: number;
  holdSeconds: number;
}

/**
 * Rekordy życia dla ćwiczenia — maksimum po WSZYSTKICH ukończonych sesjach
 * (tylko zaliczone serie). Dla `isHold` liczy się `holdSeconds` (reps to
 * sekundy); dla reszty `weight` i `e1rm` (Epley). `excludeSessionId` pomija
 * jedną sesję (np. właśnie zakończoną) — pozwala policzyć "rekord SPRZED tej
 * sesji" do podsumowania treningu.
 */
export function personalBests(state: AppState, exId: string, excludeSessionId?: string): PersonalBests {
  const ex = state.exercises.find((e) => e.id === exId);
  const best: PersonalBests = { weight: 0, e1rm: 0, holdSeconds: 0 };
  if (!ex) return best;
  for (const session of state.sessions) {
    if (!session.completed || session.id === excludeSessionId) continue;
    const entry = session.entries.find((e) => e.exerciseId === exId);
    if (!entry) continue;
    for (const set of entry.sets) {
      if (!set.done) continue;
      if (ex.isHold) {
        best.holdSeconds = Math.max(best.holdSeconds, set.reps);
      } else {
        best.weight = Math.max(best.weight, set.weight);
        best.e1rm = Math.max(best.e1rm, e1rm(set.weight, set.reps));
      }
    }
  }
  return best;
}

/**
 * Czy pojedyncza seria bije rekord życia. Brak historii (rekord zerowy) ->
 * `null` — pierwszy trening ćwiczenia NIE jest "rekordem" przy każdej serii.
 * Priorytet, gdy pobite oba warunki: `weight` > `e1rm` (cięższy ciężar to
 * mocniejszy komunikat niż szacunek).
 */
export function isSetRecord(ex: Exercise, set: SetLog, best: PersonalBests): "weight" | "e1rm" | "hold" | null {
  if (!set.done) return null;
  if (ex.isHold) {
    if (best.holdSeconds === 0) return null;
    return set.reps > best.holdSeconds ? "hold" : null;
  }
  if (best.weight === 0 && best.e1rm === 0) return null;
  if (set.weight > best.weight) return "weight";
  if (e1rm(set.weight, set.reps) > best.e1rm) return "e1rm";
  return null;
}

export interface HistoryPoint {
  date: string;
  e1rm: number;
  topWeight: number;
  topReps: number;
}

/** Historia ćwiczenia po sesjach (rosnąco po dacie) */
export function exerciseHistory(state: AppState, exId: string): HistoryPoint[] {
  const ex = state.exercises.find((e) => e.id === exId);
  if (!ex) return [];
  const points: HistoryPoint[] = [];
  for (const session of [...state.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const entry = session.entries.find((e) => e.exerciseId === exId);
    if (!entry) continue;
    const done = entry.sets.filter((s) => s.done);
    if (done.length === 0) continue;
    const top = done.reduce((a, b) =>
      ex.isHold ? (b.reps > a.reps ? b : a) : e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a
    );
    points.push({
      date: session.date,
      e1rm: ex.isHold ? top.reps : Math.round(e1rm(top.weight, top.reps) * 10) / 10,
      topWeight: top.weight,
      topReps: top.reps,
    });
  }
  return points;
}

export type StrengthLevel = "początkujący" | "średniozaawansowany" | "zaawansowany";

export interface StrengthRatio {
  exId: string;
  name: string;
  /** Najlepsze e1RM z całej historii ÷ najnowsza waga ciała. */
  ratio: number;
  level: StrengthLevel;
  /** Progi × masy ciała (orientacyjne) — środkowy i górny sterują `level`, dolny tylko dla kontekstu w UI. */
  thresholds: [number, number, number];
}

/**
 * Orientacyjne standardy siłowe × masa ciała (P2-12), mężczyźni bez sprzętu
 * wspomagającego — z ogólnie dostępnych tabel siłowych, NIE naukowa norma.
 * Środkowy próg = wejście w „średniozaawansowany", górny = „zaawansowany"
 * (dokładnie na progu -> wyższy poziom); dolny próg pokazywany w UI jako
 * punkt odniesienia, nie steruje klasyfikacją.
 */
const STRENGTH_STANDARDS: Record<string, [number, number, number]> = {
  bench_bb: [0.75, 1.0, 1.25],
  squat: [1.0, 1.25, 1.5],
  deadlift: [1.25, 1.5, 1.75],
  ohp: [0.45, 0.6, 0.75],
};

/**
 * Zestawia najlepsze e1RM (cała historia) z najnowszą wagą ciała dla kluczowych
 * ćwiczeń wielostawowych. Pusta lista, gdy brak wpisu wagi (nie zgaduj masy
 * ciała) — poszczególne ćwiczenia bez historii są po prostu pomijane.
 */
export function strengthRatios(state: AppState): StrengthRatio[] {
  const bodyweight = [...state.body].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;
  if (!bodyweight) return [];

  const out: StrengthRatio[] = [];
  for (const [exId, thresholds] of Object.entries(STRENGTH_STANDARDS)) {
    const ex = state.exercises.find((e) => e.id === exId);
    if (!ex) continue;
    const history = exerciseHistory(state, exId);
    if (history.length === 0) continue;
    const bestE1rm = Math.max(...history.map((h) => h.e1rm));
    const ratio = bestE1rm / bodyweight;
    const [, mid, high] = thresholds;
    const level: StrengthLevel = ratio >= high ? "zaawansowany" : ratio >= mid ? "średniozaawansowany" : "początkujący";
    out.push({ exId, name: ex.name, ratio: Math.round(ratio * 100) / 100, level, thresholds });
  }
  return out;
}

// ── Tryb treningu (Siła / Hipertrofia / Deload) ────────────────────────────
// Podstawa naukowa i uzasadnienie każdej decyzji: POMYSLY.md P0-5 (Siła/Hipertrofia), P2-8 (Deload).

/**
 * Widok ćwiczenia pod cel tygodnia — hipertrofia i deload są POCHODNE z planu
 * (seed.ts pozostaje źródłem prawdy trybu siłowego), liczone w locie.
 * `targetSets`/`increment`/`restSeconds` NIGDY nie są zmieniane (objętość i
 * przerwy zostają — patrz uzasadnienie naukowe pkt 3–4 w POMYSLY.md).
 */
export function exerciseForMode(ex: Exercise, mode: TrainingMode): Exercise {
  if (mode === "strength") return ex;
  if (mode === "deload") {
    // Zakres powtórzeń zostaje bazowy (siłowy) — schodzisz z CIĘŻAREM, nie
    // z powtórzeniami: objętość spada przez ciężar (65%) i serię mniej,
    // nie przez bicie rekordów w powtórzeniach na lekkim ciężarze.
    return { ...ex, rir: ex.rir + 2 };
  }
  if (ex.isHold) return ex;
  if (ex.id === "deadlift") {
    // Wyjątek bezpieczeństwa: klasyczny MC nie schodzi na wysokie powtórzenia
    // blisko upadku — nota "UWAGA NA PLECY" w seedzie zostaje aktualna.
    return { ...ex, repMin: 6, repMax: 8, rir: 2 };
  }
  if (ex.repMax <= 8) {
    return { ...ex, repMin: 8, repMax: 12, rir: 1 };
  }
  return { ...ex, rir: 1 };
}

/** Odwrócony wzór Epleya — ciężar, przy którym `reps` powtórzeń zostawia ~`rir` w zapasie. */
export function weightForReps(e1: number, reps: number, rir: number): number {
  return e1 / (1 + (reps + rir) / 30);
}

/**
 * Cel hipertrofii dla ćwiczenia. Kolejność: (1) już wypracowana progresja w
 * `hyperTargets`; (2) jeśli tryb hipertrofii NIE zmienia zakresu (bazowy
 * `repMax > 8`) → ten sam cel co siła (różnica tylko w RIR); (3) konwersja
 * z ciężkiego zakresu przez e1RM (z historii albo, przy jej braku, z
 * bieżącego celu siłowego) — patrz POMYSLY.md P0-5 pkt 2, sanity-check na
 * realnych danych.
 */
export function hyperTargetFor(state: AppState, ex: Exercise): number {
  if (state.hyperTargets?.[ex.id] !== undefined) return state.hyperTargets[ex.id];
  const target = state.targets[ex.id] ?? 0;
  if (ex.repMax > 8) return target;
  const history = exerciseHistory(state, ex.id);
  const e1 = history.length > 0
    ? history[history.length - 1].e1rm
    : target * (1 + (ex.repMin + ex.rir) / 30);
  const hEx = exerciseForMode(ex, "hypertrophy");
  const w = weightForReps(e1, hEx.repMin, hEx.rir);
  const inc = ex.increment > 0 ? ex.increment : 0.5;
  return Math.round(w / inc) * inc;
}

/**
 * Cel deloadu — 65% celu SIŁOWEGO (zawsze `targets`, nawet gdy poprzedni
 * tydzień był hipertroficzny — deload jest odpoczynkiem od obu trybów, nie
 * kontynuacją żadnego z nich), zaokrąglone do `increment` ćwiczenia.
 */
export function deloadTargetFor(state: AppState, ex: Exercise): number {
  const strengthTarget = state.targets[ex.id] ?? 0;
  const inc = ex.increment > 0 ? ex.increment : 0.5;
  return Math.round((strengthTarget * 0.65) / inc) * inc;
}

/** Cel dla trybu bieżącego tygodnia — `targets` (siła), `deloadTargetFor` (deload) albo `hyperTargetFor` (hipertrofia). */
export function targetForMode(state: AppState, ex: Exercise, mode: TrainingMode): number {
  if (mode === "strength") return state.targets[ex.id] ?? 0;
  if (mode === "deload") return deloadTargetFor(state, ex);
  return hyperTargetFor(state, ex);
}

/**
 * Liczba PEŁNYCH tygodni (wg poniedziałków) od ostatniej ukończonej sesji
 * w trybie deload; brak takiej sesji w historii → liczy od pierwszej
 * ukończonej sesji w ogóle (żeby świeży użytkownik bez historii deloadu nie
 * dostał fałszywie wysokiej liczby). Brak jakiejkolwiek historii → 0 (za mało
 * danych na sugestię — `detectPlateau` i tak wymaga min. 3 sesji na ćwiczenie).
 */
export function weeksSinceDeload(state: AppState, nowIso?: string): number {
  const completed = [...state.sessions].filter((s) => s.completed).sort((a, b) => a.date.localeCompare(b.date));
  if (completed.length === 0) return 0;
  const lastDeload = [...completed].reverse().find((s) => s.mode === "deload");
  const referenceDate = lastDeload?.date ?? completed[0].date;
  const refMonday = new Date(mondayOf(referenceDate) + "T12:00:00").getTime();
  const nowMonday = new Date(mondayOf(nowIso ?? new Date().toISOString()) + "T12:00:00").getTime();
  return Math.max(0, Math.floor((nowMonday - refMonday) / (7 * 86400000)));
}

/**
 * Przerywana projekcja `count` kolejnych wystąpień ćwiczenia — regresja
 * liniowa (metoda najmniejszych kwadratów) e1RM po ostatnich punktach
 * historii, ekstrapolowana z odstępem = średni odstęp między sesjami tego
 * ćwiczenia. To SZACUNEK przy założeniu utrzymania dotychczasowego tempa —
 * nie predykcja. Przy zastoju/spadku forma trendu to odzwierciedla (płasko/w
 * dół), zgodnie z uczciwym framowaniem apki — nie podkręcamy sztucznie w górę.
 * `topWeight`/`topReps` w wyniku są nieużywane (0) — projekcja liczy się tylko
 * po `e1rm`.
 */
export function projectHistory(history: HistoryPoint[], count = 3): HistoryPoint[] {
  if (history.length < 2) return [];
  const n = history.length;
  const recent = history.slice(-Math.min(6, n));
  const m = recent.length;

  const xMean = (m - 1) / 2;
  const yMean = recent.reduce((s, p) => s + p.e1rm, 0) / m;
  let num = 0;
  let den = 0;
  recent.forEach((p, i) => {
    num += (i - xMean) * (p.e1rm - yMean);
    den += (i - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;

  const firstTime = new Date(history[0].date).getTime();
  const lastPoint = history[n - 1];
  const lastTime = new Date(lastPoint.date).getTime();
  const avgIntervalMs = n > 1 ? (lastTime - firstTime) / (n - 1) : 7 * 86400000;

  const out: HistoryPoint[] = [];
  for (let i = 1; i <= count; i++) {
    const e1 = Math.max(0, Math.round((lastPoint.e1rm + slope * i) * 10) / 10);
    out.push({
      date: new Date(lastTime + avgIntervalMs * i).toISOString(),
      e1rm: e1,
      topWeight: 0,
      topReps: 0,
    });
  }
  return out;
}

export interface LastEntry {
  date: string;
  sets: SetLog[];
}

/** Ostatnia ukończona sesja zawierająca dane ćwiczenie (tylko zaliczone serie) */
export function lastEntry(state: AppState, exId: string): LastEntry | null {
  const sorted = [...state.sessions]
    .filter((s) => s.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sorted) {
    const entry = session.entries.find((e) => e.exerciseId === exId);
    if (!entry) continue;
    const done = entry.sets.filter((s) => s.done);
    if (done.length === 0) continue;
    return { date: session.date, sets: done };
  }
  return null;
}

/**
 * Zastój: 3 ostatnie treningi tego ćwiczenia mają ten sam topWeight
 * i e1RM w widełkach ±1%. Sugestia, nie automat — decyzję podejmuje trenujący.
 */
export function detectPlateau(state: AppState, exId: string): boolean {
  const ex = state.exercises.find((e) => e.id === exId);
  // Ćwiczenia na czas (plank) oraz o stałym celu (repMin==repMax) z definicji
  // "stoją" na tym samym wyniku, gdy progresują poprawnie — to nie jest zastój.
  if (!ex || ex.isHold || ex.repMin === ex.repMax) return false;
  const history = exerciseHistory(state, exId);
  if (history.length < 3) return false;
  const [a, b, c] = history.slice(-3);
  if (a.topWeight !== b.topWeight || b.topWeight !== c.topWeight) return false;
  const es = [a.e1rm, b.e1rm, c.e1rm];
  const maxE = Math.max(...es);
  const minE = Math.min(...es);
  if (maxE === 0) return false;
  return (maxE - minE) / maxE <= 0.01;
}

// ── Kalkulator talerzy ─────────────────────────────────────────────────────

export interface PlatePlan {
  ok: boolean;
  perSide: number[];
  leftover: number;
}

/** Układ talerzy na JEDNĄ stronę sztangi */
export function platePlan(target: number, bar: number, plates: number[]): PlatePlan {
  const perSideWeight = (target - bar) / 2;
  if (perSideWeight < 0) return { ok: false, perSide: [], leftover: perSideWeight * 2 };
  let rest = perSideWeight;
  const out: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (rest >= p - 1e-9) {
      out.push(p);
      rest = Math.round((rest - p) * 1000) / 1000;
    }
  }
  return { ok: Math.abs(rest) < 1e-9, perSide: out, leftover: Math.round(rest * 2 * 1000) / 1000 };
}

// ── Profile siłowni (inny sprzęt na wyjeździe) ─────────────────────────────

/** Wszystkie osiągalne ciężary całkowite dla danego gryfu i zestawu talerzy. */
export function achievableWeights(bar: number, plates: number[]): number[] {
  const perSideSums = new Set<number>([0]);
  for (const p of plates) {
    for (const s of Array.from(perSideSums)) {
      perSideSums.add(Math.round((s + p) * 1000) / 1000);
    }
  }
  return Array.from(perSideSums)
    .map((s) => Math.round((bar + 2 * s) * 1000) / 1000)
    .sort((a, b) => a - b);
}

/** Najbliższy osiągalny (talerzami) ciężar do celu. */
export function nearestAchievable(target: number, bar: number, plates: number[]): number {
  const list = achievableWeights(bar, plates);
  if (list.length === 0) return target;
  return list.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best));
}

/** Zaokrąglenie do najbliższej wielokrotności kroku (sprzęt bez talerzy — hantle/maszyny). */
export function snapToStep(target: number, step: number): number {
  if (step <= 0) return target;
  return Math.round(target / step) * step;
}

/**
 * Sugerowany ciężar na dziś dla ćwiczenia w AKTYWNYM profilu siłowni (inny
 * sprzęt niż domowy) — null gdy brak aktywnego profilu albo sugestia == cel.
 * Sztanga: dokładny dobór z talerzy profilu. Reszta sprzętu: krok profilu
 * (jeśli podany) — to przybliżenie, bo maszyny/wyciągi w różnych klubach mają
 * różne skoki stosu, których apka nie modeluje per-siłownia.
 */
export function suggestedWeightForProfile(
  ex: Exercise,
  target: number,
  profile: GymProfile | null
): number | null {
  if (!profile) return null;
  let suggested: number;
  if (ex.unit === "barbell") {
    suggested = nearestAchievable(target, profile.barWeight, profile.plates);
  } else if (profile.weightStep) {
    suggested = snapToStep(target, profile.weightStep);
  } else {
    return null;
  }
  return Math.abs(suggested - target) > 1e-9 ? suggested : null;
}

export interface WarmupStep {
  weight: number;
  reps: number;
}

/**
 * Rampa rozgrzewkowa do ciężaru roboczego — tylko dla sztangi (dla hantli/maszyn
 * ramp jest trywialny i zaśmiecałby UI, świadome ograniczenie v1). Kroki: pusty
 * gryf ×8 (pomijany, gdy gryf ≥ połowa ciężaru roboczego — wtedy jest za blisko
 * celu, żeby miał sens), potem 50%/70%/85% ×5/3/2, każdy dobrany do najbliższego
 * OSIĄGALNEGO ciężaru z podanych talerzy. Nigdy nie osiąga ani nie przekracza
 * ciężaru roboczego; kroki, które przy lekkich ciężarach wypadłyby takie same
 * (albo cofnęłyby się przez zaokrąglenie), są odrzucane — wynik jest zawsze
 * ściśle rosnący.
 */
export function warmupPlan(ex: Exercise, workWeight: number, bar: number, plates: number[]): WarmupStep[] {
  if (ex.unit !== "barbell" || ex.isHold || workWeight <= bar) return [];

  const candidates: WarmupStep[] = [];
  if (bar < 0.5 * workWeight) candidates.push({ weight: bar, reps: 8 });
  for (const [pct, reps] of [[0.5, 5], [0.7, 3], [0.85, 2]] as const) {
    candidates.push({ weight: nearestAchievable(pct * workWeight, bar, plates), reps });
  }

  const steps: WarmupStep[] = [];
  for (const c of candidates) {
    if (c.weight >= workWeight) continue;
    const prev = steps[steps.length - 1];
    if (prev && c.weight <= prev.weight) continue;
    steps.push(c);
  }
  return steps;
}

// ── Formatery ──────────────────────────────────────────────────────────────

export function fmtKg(x: number): string {
  return `${(+x.toFixed(2)).toString().replace(".", ",")} kg`;
}

/** Tonaż z przejściem na tony powyżej 1000 kg (P1-6/P1-10) — używane zamiast `fmtKg`, gdy liczba może być duża. */
export function fmtTonnage(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

/** Poniedziałek tygodnia danej daty (klucz do grupowania tygodniowego) */
export function mondayOf(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

export interface WeekAdherence {
  /** ISO daty poniedziałku tego tygodnia (klucz). */
  week: string;
  /** Wszystkie ukończone sesje w tym tygodniu, WŁĄCZNIE z dniem bonusowym. */
  done: number;
  /** Stała liczba dni GŁÓWNYCH (nie-opcjonalnych) w planie — bonus jej nie podbija. */
  planned: number;
}

/**
 * Konsekwencja treningowa (P2-11) — ostatnie `weeks` tygodni (domyślnie 8),
 * chronologicznie rosnąco, kończąc na tygodniu zawierającym `nowIso` (domyślnie
 * dziś). `planned` to zawsze liczba dni głównych planu (dzień bonusowy liczy
 * się do `done`, ale nigdy nie podbija `planned` — inaczej włączenie bonusu
 * fałszywie poprawiałoby statystykę za tygodnie sprzed jego włączenia).
 */
export function weeklyAdherence(state: AppState, weeks = 8, nowIso?: string): WeekAdherence[] {
  const planned = state.days.filter((d) => !d.optional).length;
  const thisMonday = mondayOf(nowIso ?? new Date().toISOString());
  const base = new Date(thisMonday + "T12:00:00");

  const weekKeys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    weekKeys.push(d.toISOString().slice(0, 10));
  }

  return weekKeys.map((week) => ({
    week,
    done: state.sessions.filter((s) => s.completed && mondayOf(s.date) === week).length,
    planned,
  }));
}

/**
 * Podpowiedź kolejnego dnia w rotacji planu (P2-10) — id dnia z `state.days`,
 * NIE bonusowego. Bierze ostatnią ukończoną sesję spośród dni głównych
 * (sesja z dnia bonusowego jest pomijana — nie resetuje rotacji) i zwraca
 * następny dzień w kolejności planu, z zawijaniem (ostatni → pierwszy). Brak
 * takiej historii → pierwszy dzień główny. `null` tylko gdy plan nie ma
 * żadnego dnia głównego (nie powinno się zdarzyć w praktyce).
 */
export function nextDaySuggestion(state: AppState): string | null {
  const rotation = state.days.filter((d) => !d.optional);
  if (rotation.length === 0) return null;
  const last = [...state.sessions]
    .filter((s) => s.completed && rotation.some((d) => d.id === s.dayId))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return rotation[0].id;
  const idx = rotation.findIndex((d) => d.id === last.dayId);
  return rotation[(idx + 1) % rotation.length].id;
}
