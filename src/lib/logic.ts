import type {
  AppState,
  Exercise,
  ExerciseLog,
  Muscle,
  Session,
  SetLog,
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

export const MUSCLE_RANGES: Record<Muscle, { min: number; max: number }> = {
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

function volumeStatus(sets: number, muscle: Muscle): VolumeStatus {
  const r = MUSCLE_RANGES[muscle];
  if (sets < r.min) return "low";
  if (sets <= r.max) return "ok";
  if (sets <= 1.3 * r.max) return "high";
  return "veryhigh";
}

/**
 * Serie robocze / tydzień per partia. Partia główna = 1 seria, wspomagająca = 1/2.
 * Liczy z aktywnych dni (dzień optional tylko gdy active); każdy dzień = 1x/tydzień.
 */
export function weeklyMuscleVolume(state: AppState): MuscleVolume[] {
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
      status: volumeStatus(a.sets, muscle),
    };
  });
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

// ── Formatery ──────────────────────────────────────────────────────────────

export function fmtKg(x: number): string {
  return `${(+x.toFixed(2)).toString().replace(".", ",")} kg`;
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
