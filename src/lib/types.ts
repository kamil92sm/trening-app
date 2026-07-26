export type Unit = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";

/** Cel tygodnia — decyduje o zakresie powtórzeń/RIR/ciężarze w loggerze (patrz logic.ts: exerciseForMode). */
export type TrainingMode = "strength" | "hypertrophy";

export type Category =
  | "Klatka"
  | "Plecy"
  | "Barki"
  | "Nogi"
  | "Pośladki"
  | "Łydki"
  | "Biceps"
  | "Triceps"
  | "Brzuch"
  | "Inne";

export type Muscle =
  | "Klatka"
  | "Plecy"
  | "Barki"
  | "Nogi"
  | "Pośladki"
  | "Tył uda"
  | "Łydki"
  | "Biceps"
  | "Triceps"
  | "Brzuch";

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  /** Hantle: ciężar na jedną rękę, tonaż x2 */
  perHand: boolean;
  /** Ćwiczenie na czas (plank) — reps oznaczają sekundy */
  isHold: boolean;
  repMin: number;
  repMax: number;
  targetSets: number;
  increment: number;
  rir: number;
  primaryMuscle?: Muscle;
  secondaryMuscles?: Muscle[];
  note?: string;
  archived?: boolean;
  /** Przerwa po serii tego ćwiczenia (s). Brak = użyj settings.restSeconds. */
  restSeconds?: number;
}

export interface WorkoutDay {
  id: string;
  name: string;
  short: string;
  exerciseIds: string[];
  /** Dzień bonusowy — liczy się tylko gdy active */
  optional?: boolean;
  active?: boolean;
  accent?: string;
}

export interface SetLog {
  weight: number;
  reps: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  targetWeight: number;
  sets: SetLog[];
  note?: string;
}

export interface Session {
  id: string;
  dayId: string;
  date: string; // ISO
  entries: ExerciseLog[];
  completed: boolean;
  /** Cel tygodnia, w którym zalogowano trening. Brak = "strength" (stare sesje sprzed tej funkcji). */
  mode?: TrainingMode;
}

export interface BodyEntry {
  date: string; // YYYY-MM-DD
  weight: number;
  /** Obwód pasa w cm (opcjonalny) */
  waist?: number;
}

export interface SquashEntry {
  id: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  intensity: number; // 1-5
}

export interface GymProfile {
  id: string;
  name: string;
  barWeight: number;
  plates: number[];
  /** Krok dostępnych obciążeń dla sprzętu bez talerzy (hantle/maszyny/wyciągi), w kg. */
  weightStep?: number;
}

export interface Settings {
  name: string;
  barWeight: number;
  plates: number[];
  restSeconds: number;
  sound: boolean;
  /** GitHub Personal Access Token (scope: gist) do auto-backupu. Żyje tylko w localStorage. */
  gistToken?: string;
  /** ID gista używanego jako backup (tworzony przy pierwszym backupie). */
  gistId?: string;
  /** Czy robić backup do gista automatycznie po każdym zakończonym treningu. */
  autoBackup?: boolean;
  /** ISO data ostatniego udanego backupu do chmury. */
  lastBackup?: string;
  /** Dodatkowe siłownie (inny gryf/talerze/krok) — poza domową (barWeight/plates powyżej). */
  gymProfiles?: GymProfile[];
  /** ID aktywnego profilu z gymProfiles; brak/undefined = siłownia domowa. */
  activeGymProfileId?: string;
  /** Cel objętości — decyduje o zakresach serii/partię w Progresie. Brak = hipertrofia (domyślnie). */
  volumeGoal?: "strength" | "hypertrophy";
  /** Cel bieżącego tygodnia (Trening → ekran wyboru dnia). Brak = "strength" (plan trenera 1:1). */
  trainingMode?: TrainingMode;
}

export interface AppState {
  version: number;
  /** Czy historia startowa (tygodnie 2–4 spoza apki) została już dołożona — jednorazowo. */
  historySeeded?: boolean;
  /** Czy cele zostały już dogonione do progresji wynikającej z historii sesji — jednorazowo. */
  historyTargetsSeeded?: boolean;
  exercises: Exercise[];
  days: WorkoutDay[];
  targets: Record<string, number>;
  /** Cele trybu hipertrofii — OSOBNE od `targets` (siła), żeby tryby nie psuły sobie progresji. */
  hyperTargets?: Record<string, number>;
  sessions: Session[];
  body: BodyEntry[];
  squash: SquashEntry[];
  settings: Settings;
}
