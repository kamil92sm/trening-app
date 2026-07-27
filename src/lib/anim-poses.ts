// P5-3a: model animowanego ludzika SVG (widok z boku), generowanego z kątów w
// stawach — bez GIF/wideo (budżet jednoplikowego bundla, patrz POMYSLY.md P5-3).
// Zero importu Reacta — czysty moduł danych, testowalny bez DOM-u/JSX (pułapka 2 z P5).
//
// Każdy segment to linia z (0,0) do (0, len) — czyli W DÓŁ — obracana przez CSS
// (`rotate(a)`, dodatnie `a` = zgodnie z ruchem wskazówek zegara). Hierarchia:
// root (biodro, translate+rotate całej sylwetki) -> [udo -> podudzie -> stopa],
// [tors -> [szyja+głowa], [ramię -> przedramię -> dłoń(+sprzęt)]].

export interface Pose {
  rootX: number;
  rootY: number;
  rootRot: number;
  torso: number;
  neck: number;
  shoulder: number;
  elbow: number;
  hip: number;
  knee: number;
  ankle: number;
}

export type Load = "none" | "barbell" | "dumbbell" | "cable" | "bar-back" | "bar-hip";
export type Decor = "floor" | "bench-flat" | "bench-incline" | "rack" | "pulley-high" | "pulley-low" | "mat";

export type MovePatternId =
  | "bench_press"
  | "incline_press"
  | "fly"
  | "dip"
  | "pushup"
  | "row_bent"
  | "pulldown"
  | "pullup"
  | "row_seated"
  | "shrug"
  | "squat"
  | "hinge"
  | "lunge"
  | "leg_press"
  | "leg_curl"
  | "calf_raise"
  | "press_overhead"
  | "lateral_raise"
  | "face_pull"
  | "curl"
  | "triceps_ext"
  | "crunch"
  | "plank";

export interface MovePattern {
  id: MovePatternId;
  label: string;
  load: Load;
  decor: Decor[];
  /** Pozycja startowa (rozciągnięcie / góra ruchu). */
  a: Pose;
  /** Pozycja końcowa (skurcz / dół ruchu). */
  b: Pose;
  durationMs?: number;
}

/**
 * Etap 3a: 6 wzorców pokrywających plan 3-dniowy (§6 CLAUDE.md) — reszta
 * (~16 pozostałych `MovePatternId`) dochodzi w etapie 3b. Celowo `Partial` (nie
 * pełny `Record`) — brakujący wzorzec ma się objawić jako `undefined` (i UI po
 * prostu nie pokaże animacji), a nie jako błąd kompilacji w tym etapie.
 */
export const MOVE_PATTERNS: Partial<Record<MovePatternId, MovePattern>> = {
  bench_press: {
    id: "bench_press",
    label: "Wyciskanie leżąc",
    load: "barbell",
    decor: ["bench-flat", "floor"],
    // leżenie: cała sylwetka obrócona o 90°, ruch tylko w barku i łokciu
    a: { rootX: 46, rootY: 62, rootRot: 90, torso: 0, neck: -8, shoulder: -80, elbow: 75, hip: 55, knee: -80, ankle: 20 },
    b: { rootX: 46, rootY: 62, rootRot: 90, torso: 0, neck: -8, shoulder: -95, elbow: 5, hip: 55, knee: -80, ankle: 20 },
    durationMs: 2400,
  },
  squat: {
    id: "squat",
    label: "Przysiad",
    load: "bar-back",
    decor: ["floor"],
    // stojąc: rootRot 0 (nogi domyślnie w dół), tors ~180 (w górę) + drobne odchylenia to lean.
    a: { rootX: 60, rootY: 66, rootRot: 0, torso: 174, neck: 6, shoulder: 8, elbow: -100, hip: 2, knee: -4, ankle: 78 },
    b: { rootX: 60, rootY: 78, rootRot: 0, torso: 152, neck: 10, shoulder: 8, elbow: -100, hip: 46, knee: -92, ankle: 68 },
    durationMs: 2600,
  },
  hinge: {
    id: "hinge",
    label: "Hinge (martwy ciąg / RDL)",
    load: "barbell",
    decor: ["floor"],
    // Ramiona trzymają sztangę wiszącą pionowo (grawitacja) niezależnie od kąta
    // torsu — dlatego "shoulder" kompensuje torso tak, by suma zawsze ~= 0..10.
    a: { rootX: 60, rootY: 64, rootRot: 0, torso: 174, neck: 8, shoulder: -170, elbow: 0, hip: 0, knee: -6, ankle: 82 },
    b: { rootX: 60, rootY: 64, rootRot: 0, torso: 110, neck: 30, shoulder: -104, elbow: 0, hip: 30, knee: -18, ankle: 90 },
    durationMs: 2600,
  },
  row_bent: {
    id: "row_bent",
    label: "Wiosłowanie w opadzie",
    load: "barbell",
    decor: ["floor"],
    // Start: ramie proste, sztanga zwisajaca pionowo (total ~= 0). Koniec:
    // lokiec cofniety i zgiety, ciagnie sztange do brzucha.
    a: { rootX: 56, rootY: 64, rootRot: 0, torso: 120, neck: 20, shoulder: -120, elbow: 0, hip: 24, knee: -14, ankle: 86 },
    b: { rootX: 56, rootY: 64, rootRot: 0, torso: 120, neck: 20, shoulder: -160, elbow: 100, hip: 24, knee: -14, ankle: 86 },
    durationMs: 2000,
  },
  press_overhead: {
    id: "press_overhead",
    label: "Wyciskanie nad głowę",
    load: "barbell",
    decor: ["floor"],
    // Start: sztanga przy barkach (ramie w poziomie, przedramie w gore do dloni
    // przy uchu). Koniec: reka zablokowana prosto nad glowa (total ~= 180).
    a: { rootX: 60, rootY: 66, rootRot: 0, torso: 178, neck: 6, shoulder: -90, elbow: 80, hip: 0, knee: 0, ankle: 80 },
    b: { rootX: 60, rootY: 66, rootRot: 0, torso: 178, neck: 6, shoulder: 0, elbow: 0, hip: 0, knee: 0, ankle: 80 },
    durationMs: 2200,
  },
  curl: {
    id: "curl",
    label: "Uginanie ramion",
    load: "barbell",
    decor: ["floor"],
    // Ramie gorne przy tulowiu przez caly ruch (total ~= 0, w dol); przedramie
    // startuje w linii z ramieniem (wyprostowane), na koniec zgina sie w gore.
    a: { rootX: 60, rootY: 66, rootRot: 0, torso: 180, neck: 6, shoulder: -170, elbow: 0, hip: 0, knee: 0, ankle: 80 },
    b: { rootX: 60, rootY: 66, rootRot: 0, torso: 180, neck: 6, shoulder: -170, elbow: 150, hip: 0, knee: 0, ankle: 80 },
    durationMs: 1800,
  },
};
