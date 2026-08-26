export type Unit = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";

/** Cel tygodnia — decyduje o zakresie powtórzeń/RIR/ciężarze w loggerze (patrz logic.ts: exerciseForMode). */
export type TrainingMode = "strength" | "hypertrophy" | "deload";

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
  /**
   * Liczba serii roboczych per ćwiczenie TYLKO w tym dniu (klucz = `Exercise.id`).
   * Brak wpisu = `Exercise.targetSets`. Dzięki temu "Dodaj serię" w loggerze
   * zapisuje się do planu TEGO dnia, nie wszystkich dni z tym ćwiczeniem
   * (bonus dzieli z planem głównym wszystkie 6 pozycji).
   */
  setsOverride?: Record<string, number>;
  /** P7-3: siłownia, na której odbywa się ten dzień (klucz do `Settings.gymProfiles`).
   * Brak = domowa (`settings.barWeight`/`plates`/`dumbbells`). */
  gymProfileId?: string;
}

export interface SetLog {
  weight: number;
  reps: number;
  done: boolean;
  /** P4-4: RIR (powtórzenia w zapasie) zgłoszony po ostatniej serii roboczej
   * ćwiczenia — 0 (upadek) do 3 (3+ w zapasie). Opcjonalne: pominięcie = dzisiejsze
   * zachowanie progresji (patrz computeProgression). */
  rir?: number;
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
  /** Moment zakończenia (ISO) — `date` to moment STARTU. Brak = czas nieznany (stare sesje/historia startowa). */
  finishedAt?: string;
  /** P7-4: moment PIERWSZEJ zaliczonej serii — realny start treningu. `date` to
   * moment WEJŚCIA w dzień i bywa o godziny wcześniejszy (Kamil przegląda plan
   * z wyprzedzeniem). Brak = stara sesja / czas nieznany, `sessionDuration`
   * spada wtedy na `date` jak dawniej. NIGDY nie zastępuj `date` tym polem —
   * `date` jest kluczem sortowania Historii i oknem tygodnia/cyklu. */
  startedAt?: string;
  /** Check-in gotowości (opcjonalny, P2-4) — obie skale 1 (słabo) – 5 (świetnie/brak zakwasów). Każde pole niezależnie opcjonalne (P3-1). */
  readiness?: { sleep?: number; doms?: number };
  /** P7-3: siłownia, na której RZECZYWIŚCIE trenowano tę sesję — domyślnie
   * `day.gymProfileId`, ale Kamil może ją zmienić na czas treningu (przełącznik
   * w nagłówku). Brak = domowa. Adaptacja celu z §24.1 działa tylko, gdy to
   * pole zgadza się z siłownią dnia — inaczej korekta mówiłaby o obcym sprzęcie. */
  gymProfileId?: string;
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
  /** P7-3: dostępne hantle (ciężar NA RĘKĘ) tej siłowni, rosnąco. Pusto/brak =
   * brak modelu — progresja liczy się jak dawniej (targetWeight + increment). */
  dumbbells?: number[];
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
  /** Ręczne nadpisania zakresów serii/tydzień per partia (Progres → Objętość). Brak partii = domyślny zakres celu. */
  muscleRanges?: Partial<Record<Muscle, { min: number; max: number }>>;
  /** Układ loggera (P3-6): "list" (domyślnie, jak dziś) albo "focus" (jedno ćwiczenie na ekran). */
  loggerLayout?: "list" | "focus";
  /** P4-9: cel per ćwiczenie (ta sama jednostka co wykres — e1RM w kg, sekundy dla isHold). */
  liftGoals?: Record<string, number>;
  /** P4-5: czy proponować +1 serię/tydzień partiom poniżej minimum w mezocyklu hipertrofii. Domyślnie false. */
  volumeProgression?: boolean;
  /** P4-5: ISO data startu bieżącego mezocyklu (zerowana przy zakończeniu sesji w trybie deload). */
  mesoStartIso?: string;
  /** P7-3: drabinka hantli siłowni DOMOWEJ (odpowiednik `plates` dla sztangi). */
  dumbbells?: number[];
}

export interface AppState {
  version: number;
  /** Czy historia startowa (tygodnie 2–4 spoza apki) została już dołożona — jednorazowo. */
  historySeeded?: boolean;
  /** Czy cele zostały już dogonione do progresji wynikającej z historii sesji — jednorazowo. */
  historyTargetsSeeded?: boolean;
  /** P6-5: czy ćwiczeniom z seeda bez własnego `restSeconds` dolano wartosc z seeda — jednorazowo. */
  restSecondsBackfilled?: boolean;
  /** Czy RIR został przeliczony z jednolitego 2 na skalibrowany per typ ćwiczenia (seed.ts: defaultRir) — jednorazowo. */
  rirCalibrated?: boolean;
  /** Czy plan dostał już dosiew objętości (wariant B: suwnica + serie na biceps/triceps/łydki) — jednorazowo. */
  planVolumeBumpSeeded?: boolean;
  /** Czy cel RDL poprawiono z nieosiągalnych 22 kg na 22,5 (hantle na siłowni) — jednorazowo. */
  rdlTargetFixed?: boolean;
  /** P7-9: czy cel RDL w hyperTargets (nie tylko targets) poprawiono z 22 na
   * 22,5 — osobna flaga od rdlTargetFixed, bo dotyczy innego pola i musi
   * dostać własną szansę nawet na już zmigrowanym urządzeniu — jednorazowo. */
  rdlHyperTargetFixed?: boolean;
  /** P7-10: czy zakres planku poprawiono z 40==40 na 30-40 s — jednorazowo. */
  plankRangeSeeded?: boolean;
  /** P7-3: czy dosiano profil "My Fitness Place" + wed.gymProfileId + drabinkę
   * domową — jednorazowo. Usunięcie profilu/wyczyszczenie drabinki przez
   * użytkownika jest trwałe (flaga blokuje ponowny dosiew). */
  gymLaddersSeeded?: boolean;
  /** P7-3: czy istniejące cele hantlowe (targets I hyperTargets) dociągnięto
   * do drabinki ich dnia — jednorazowo. */
  dumbbellTargetsSnapped?: boolean;
  /** Zadanie 3: czy dni mon/wed/fri dostały już neutralne nazwy ("Trening 1/2/3"
   * zamiast Poniedziałek/Środa/Piątek) — jednorazowo, żeby nie nadpisywać
   * później ręcznej zmiany nazwy przez użytkownika w Planie. */
  neutralDayLabelsSeeded?: boolean;
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
