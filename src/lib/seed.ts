import type {
  AppState,
  Category,
  Exercise,
  Muscle,
  Session,
  Settings,
  Unit,
  WorkoutDay,
} from "./types";
import { HISTORICAL_SESSIONS } from "./history-seed";

export const SCHEMA_VERSION = 5;
export const STORAGE_KEY = "trening-app-v2";
export const OLD_STORAGE_KEY = "trening-app-v1";

const ex = (
  id: string,
  name: string,
  category: Category,
  unit: Unit,
  repMin: number,
  repMax: number,
  targetSets: number,
  increment: number,
  primaryMuscle: Muscle,
  secondaryMuscles: Muscle[] = [],
  extra: Partial<Exercise> = {}
): Exercise => ({
  id,
  name,
  category,
  unit,
  perHand: unit === "dumbbell",
  isHold: false,
  repMin,
  repMax,
  targetSets,
  increment,
  rir: 2,
  primaryMuscle,
  secondaryMuscles,
  ...extra,
});

export const SEED_EXERCISES: Exercise[] = [
  // PONIEDZIAŁEK — Góra + Pośladki
  ex("bench_bb", "Wyciskanie sztangi płasko", "Klatka", "barbell", 5, 8, 3, 2.5, "Klatka", ["Triceps", "Barki"], {
    note: "Trzymaj sztangę nisko na dłoni, nadgarstek prosto. Chwyt „buldoga”.",
    restSeconds: 150,
  }),
  ex("hipthrust", "Hip Thrust ze sztangą", "Pośladki", "barbell", 8, 12, 3, 2.5, "Pośladki", ["Tył uda"], {
    note: "Stopy dalej od pośladków (90° w kolanie), pełne wypchnięcie bioder w górę.",
    restSeconds: 150,
  }),
  ex("row_bb", "Wiosłowanie sztangą", "Plecy", "barbell", 6, 8, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Ciągnij sztangę do pępka, łopatki ściągnięte.",
    restSeconds: 150,
  }),
  ex("lateral", "Wznosy bokiem hantli", "Barki", "dumbbell", 12, 15, 3, 1, "Barki", [], {
    note: "Czyste powtórzenia bez zarzucania ciałem. Prowadź łokciem.",
    restSeconds: 90,
  }),
  ex("curl_bb", "Uginanie bicepsa (sztanga)", "Biceps", "barbell", 10, 12, 2, 1.25, "Biceps", [], {
    note: "2 serie chronią łokcie. Bez bujania — pełna kontrola.",
    restSeconds: 90,
  }),
  ex("crunch", "Allahy (brzuch)", "Brzuch", "cable", 10, 15, 3, 2.5, "Brzuch", [], {
    note: "Technika ponad ciężar — spinaj brzuch, nie ciągnij ramionami.",
    restSeconds: 90,
  }),
  // ŚRODA — Ciężki Dół + Klatka Skos
  ex("squat", "Przysiad ze sztangą", "Nogi", "barbell", 5, 8, 3, 2.5, "Nogi", ["Pośladki"], {
    note: "Głębokość, kolana na zewnątrz. Zjedz węgle przed treningiem.",
    restSeconds: 180,
  }),
  ex("deadlift", "Martwy ciąg klasyczny", "Plecy", "barbell", 5, 6, 2, 2.5, "Tył uda", ["Plecy", "Pośladki"], {
    note: "UWAGA NA PLECY. Nie walcz o 7. Perfekcyjna technika, spięty, twardy brzuch.",
    restSeconds: 180,
  }),
  ex("incline_db", "Wyciskanie hantli skos", "Klatka", "dumbbell", 8, 12, 3, 2, "Klatka", ["Triceps", "Barki"], {
    note: "Rozciągaj klatkę na dole, pełny zakres.",
    restSeconds: 120,
  }),
  ex("lunges", "Zakroki z hantlami", "Nogi", "dumbbell", 10, 12, 3, 2, "Nogi", ["Pośladki"], {
    note: "Popracuj nad balansem, dobij powtórzenia równo na każdą nogę.",
    restSeconds: 120,
  }),
  ex("calf", "Wspięcia na palce", "Łydki", "machine", 10, 15, 3, 2.5, "Łydki", [], {
    note: "Pełny zakres, pauza w górze. Możesz wydłużyć przerwę do 1–1,5 min.",
    restSeconds: 90,
  }),
  ex("plank", "Plank (deska)", "Brzuch", "bodyweight", 40, 40, 4, 5, "Brzuch", [], {
    isHold: true,
    rir: 0,
    note: "Spinaj pośladki, to betonuje całą sylwetkę. Krótsze serie zamiast wydłużania.",
    restSeconds: 60,
  }),
  // PIĄTEK — Góra II + Tył Ud
  ex("ohp", "Wyciskanie żołnierskie (OHP)", "Barki", "barbell", 6, 8, 3, 2.5, "Barki", ["Triceps"], {
    note: "Pośladki w twardym spięciu — stabilizacja przy wyciskaniu nad głowę.",
    restSeconds: 150,
  }),
  ex("pulldown", "Ściąganie drążka", "Plecy", "machine", 8, 10, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Inicjuj ruch od ściągnięcia łopatek w dół.",
    restSeconds: 120,
  }),
  ex("rdl", "RDL z hantlami", "Pośladki", "dumbbell", 8, 12, 3, 2, "Tył uda", ["Pośladki"], {
    note: "Chwyt limituje — kup paski treningowe, to „Game Changer”. Schodź nisko.",
    restSeconds: 150,
  }),
  ex("bench_db", "Wyciskanie hantli płasko", "Klatka", "dumbbell", 8, 12, 3, 2, "Klatka", ["Triceps", "Barki"], {
    note: "Stabilizuj nadgarstki, schodź hantlami nisko. (LUB 18 kg jeśli brak 17,5)",
    restSeconds: 120,
  }),
  ex("row_db", "Wiosłowanie hantlem", "Plecy", "dumbbell", 10, 12, 2, 2, "Plecy", ["Biceps"], {
    note: "Wyrównujesz siłę L/P. Prowadź łokieć do biodra. Ciężar = jeden hantel.",
    restSeconds: 90,
  }),
  ex("french", "Francuz (triceps)", "Triceps", "barbell", 10, 12, 2, 2.5, "Triceps", [], {
    note: "Łokcie prosto w sufit, nie rozjeżdżają się. Pracują tylko przedramiona.",
    restSeconds: 90,
  }),
  // BONUS 2.0 — ćwiczenia uzupełniające, nieobecne w planie 3-dniowym
  ex("face_pull", "Face pull (wyciąg)", "Barki", "cable", 12, 15, 3, 2.5, "Barki", [], {
    note: "Tylny aktyw barku i rotatory zewnętrzne — antidotum na wyciskania. Łokcie wysoko, ściągaj do twarzy.",
    restSeconds: 90,
  }),
  ex("hammer_curl", "Uginanie młotkowe hantli", "Biceps", "dumbbell", 10, 12, 2, 1, "Biceps", [], {
    note: "Brachialis i przedramię — grubość ramienia, mocniejszy chwyt (pomoże w MC i RDL).",
    restSeconds: 90,
  }),
  ex("pushdown", "Prostowanie ramion na wyciągu", "Triceps", "cable", 10, 12, 2, 2.5, "Triceps", [], {
    note: "Łokcie przyklejone do boków. Inny kąt niż francuz.",
    restSeconds: 90,
  }),
  ex("calf_seated", "Wspięcia na palce siedząc", "Łydki", "machine", 12, 20, 3, 2.5, "Łydki", [], {
    note: "Płaszczkowaty (kolano zgięte) — inna głowa niż wspięcia stojąc. Pauza w górze.",
    restSeconds: 90,
  }),
  ex("side_plank", "Plank bokiem", "Brzuch", "bodyweight", 30, 30, 3, 2.5, "Brzuch", [], {
    isHold: true,
    rir: 0,
    note: "Na stronę. Skosy + QL — core w płaszczyźnie, której deska nie łapie.",
    restSeconds: 60,
  }),
];

export const SEED_DAYS: WorkoutDay[] = [
  {
    id: "mon",
    name: "Poniedziałek",
    short: "Góra + Pośladki",
    accent: "#ef4444",
    exerciseIds: ["bench_bb", "hipthrust", "row_bb", "lateral", "curl_bb", "crunch"],
  },
  {
    id: "wed",
    name: "Środa",
    short: "Ciężki Dół + Klatka Skos",
    accent: "#3b82f6",
    exerciseIds: ["squat", "deadlift", "incline_db", "lunges", "calf", "plank"],
  },
  {
    id: "fri",
    name: "Piątek",
    short: "Góra II + Tył Ud",
    accent: "#eab308",
    exerciseIds: ["ohp", "pulldown", "rdl", "bench_db", "row_db", "french"],
  },
  {
    id: "bonus",
    name: "Bonus",
    short: "Uzupełnienie: tył barków, ramiona, łydki, core",
    accent: "#a855f7",
    optional: true,
    active: false,
    exerciseIds: ["face_pull", "hammer_curl", "pushdown", "calf_seated", "side_plank"],
  },
];

export const SEED_TARGETS: Record<string, number> = {
  bench_bb: 45,
  hipthrust: 57.5,
  row_bb: 60,
  lateral: 9,
  curl_bb: 17.5,
  crunch: 37.5,
  squat: 65,
  deadlift: 77.5,
  incline_db: 16,
  lunges: 14,
  calf: 45,
  plank: 10,
  ohp: 32.5,
  pulldown: 50,
  rdl: 22,
  bench_db: 17.5,
  row_db: 20,
  french: 22.5,
  face_pull: 20,
  hammer_curl: 10,
  pushdown: 20,
  calf_seated: 30,
  side_plank: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  name: "Kamil",
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  restSeconds: 120,
  sound: true,
  autoBackup: false,
};

/** Partia domyślna dla ćwiczeń użytkownika bez primaryMuscle */
export const CATEGORY_TO_MUSCLE: Partial<Record<Category, Muscle>> = {
  Klatka: "Klatka",
  Plecy: "Plecy",
  Barki: "Barki",
  Nogi: "Nogi",
  Pośladki: "Pośladki",
  Łydki: "Łydki",
  Biceps: "Biceps",
  Triceps: "Triceps",
  Brzuch: "Brzuch",
};

export function defaultState(): AppState {
  return {
    version: SCHEMA_VERSION,
    exercises: structuredClone(SEED_EXERCISES),
    days: structuredClone(SEED_DAYS),
    targets: { ...SEED_TARGETS },
    sessions: [],
    body: [],
    squash: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Dokłada historię startową (treningi z tygodni 2–4 logowane poza apką) do
 * istniejących sesji. Pomija sesję, jeśli już jest (to samo id) ALBO jeśli
 * użytkownik ma własny wpis z tego samego dnia i dnia planu (ochrona przed
 * duplikatami). Wywoływana tylko przy migracji ze starej wersji — po niej
 * usunięcie sesji z historii jest trwałe.
 */
export function mergeHistoricalSessions(existing: Session[]): Session[] {
  const merged = [...existing];
  for (const h of HISTORICAL_SESSIONS) {
    const dup = existing.some(
      (s) => s.id === h.id || (s.dayId === h.dayId && s.date.slice(0, 10) === h.date.slice(0, 10))
    );
    if (!dup) merged.push(structuredClone(h));
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Migracja: przy zmianie wersji schematu podmienia plan (exercises/days/targets)
 * na aktualny seed, ale ZACHOWUJE sessions, body, squash i settings.
 */
export function migrateState(raw: unknown): AppState {
  const fresh = defaultState();
  if (!raw || typeof raw !== "object") return fresh;
  const old = raw as Partial<AppState>;

  if (old.version === SCHEMA_VERSION && Array.isArray(old.exercises) && Array.isArray(old.days)) {
    // Aktualny schemat — dołóż tylko ewentualne braki w settings.
    return {
      ...fresh,
      ...old,
      version: SCHEMA_VERSION,
      settings: { ...DEFAULT_SETTINGS, ...(old.settings ?? {}) },
      targets: { ...fresh.targets, ...(old.targets ?? {}) },
    } as AppState;
  }

  // Stara wersja: nowy plan + zachowana historia. Cele (targets) użytkownika
  // zachowujemy dla ID ćwiczeń, które nadal istnieją w nowym seedzie — inaczej
  // progresja wypracowana przez tygodnie treningów wróciłaby do wartości startowych.
  const oldTargets =
    old.targets && typeof old.targets === "object" ? (old.targets as Record<string, unknown>) : {};
  const targets: Record<string, number> = { ...fresh.targets };
  for (const id of Object.keys(targets)) {
    const v = oldTargets[id];
    if (typeof v === "number") targets[id] = v;
  }

  return {
    ...fresh,
    targets,
    // Przy migracji dokładamy też historię startową (tygodnie 2–4 spoza apki).
    sessions: mergeHistoricalSessions(Array.isArray(old.sessions) ? old.sessions : []),
    body: Array.isArray(old.body) ? old.body : [],
    squash: Array.isArray(old.squash) ? old.squash : [],
    settings: { ...DEFAULT_SETTINGS, ...(old.settings ?? {}) },
  };
}
