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
import { computeProgression } from "./logic";

export const SCHEMA_VERSION = 5;
export const STORAGE_KEY = "trening-app-v2";
export const OLD_STORAGE_KEY = "trening-app-v1";

/**
 * Ćwiczenia jednostawowe, które mimo wpisanej partii wspomagającej są izolacją
 * (rozpiętki „pracują" barkiem, uginanie nóg leżąc łydką itd.) — heurystyka
 * „brak partii wspomagającej = izolacja" sama by ich nie złapała.
 */
const ISOLATION_IDS = new Set([
  "fly_db", "fly_cable", "rear_delt_db", "rear_delt_machine",
  "shrug_db", "shrug_bb", "leg_curl_lying", "cable_kickback", "back_ext",
]);

/** Duże ruchy osiowe — najwyższy koszt zmęczenia i największa cena błędu technicznego. */
const HEAVY_AXIAL_IDS = new Set([
  "deadlift", "deadlift_sumo", "rack_pull", "squat", "front_squat", "good_morning", "rdl_bb",
]);

/**
 * Domyślny RIR (powtórzenia w zapasie) skalibrowany wg KOSZTU dojścia do granicy,
 * zamiast jednolitego RIR 2 dla wszystkiego.
 *
 * Podstawa: bliskość upadku jest ciągłym predyktorem hipertrofii (Robinson,
 * Pelland, Remmert i wsp. 2024, meta-regresja) — czyli bliżej granicy = więcej
 * bodźca. Ale koszt tej bliskości jest bardzo różny: seria wznosów bokiem do
 * granicy kosztuje niemal nic (zmęczenie lokalne, zerowe ryzyko), seria
 * przysiadów albo martwego ciągu kosztuje dużo (zmęczenie ogólnoustrojowe,
 * ryzyko techniczne). Stąd:
 *   izolacja jednostawowa → RIR 1  (bierz bodziec, jest tani)
 *   pozostałe złożone     → RIR 2  (jak dotąd)
 *   duże ruchy osiowe     → RIR 3  (margines bezpieczeństwa)
 * `isHold` (plank) ma własne RIR 0 podawane wprost — do granicy formy.
 */
function defaultRir(id: string, isHold: boolean, secondaryMuscles: Muscle[]): number {
  if (isHold) return 0;
  if (HEAVY_AXIAL_IDS.has(id)) return 3;
  if (ISOLATION_IDS.has(id) || secondaryMuscles.length === 0) return 1;
  return 2;
}

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
  rir: defaultRir(id, extra.isHold ?? false, secondaryMuscles),
  primaryMuscle,
  secondaryMuscles,
  ...extra, // jawny `rir` w extra nadal wygrywa
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

  // ── P3-8: rozszerzona biblioteka cwiczen (do podmian, POZA planem 3-dniowym) ──

  // KLATKA
  ex("bench_incline_bb", "Wyciskanie sztangi skos góra", "Klatka", "barbell", 6, 10, 3, 2.5, "Klatka", ["Triceps", "Barki"], {
    note: "Skos 30–45°. Sztanga schodzi do górnej części klatki, nie do szyi.",
    restSeconds: 150,
  }),
  ex("dip_chest", "Dipy na poręczach (tułów w przód)", "Klatka", "bodyweight", 6, 12, 3, 2.5, "Klatka", ["Triceps", "Barki"], {
    note: "Pochyl tułów do przodu, łokcie na zewnątrz — mocniej klatka niż triceps.",
    restSeconds: 120,
  }),
  ex("pushup", "Pompki", "Klatka", "bodyweight", 10, 20, 3, 2.5, "Klatka", ["Triceps", "Barki"], {
    note: "Ciało w jednej linii, pełny zakres — łokcie w dół, nie na boki.",
    restSeconds: 90,
  }),
  ex("fly_db", "Rozpiętki hantlami", "Klatka", "dumbbell", 10, 15, 3, 1, "Klatka", ["Barki"], {
    note: "Lekkie zgięcie łokci przez cały ruch. Rozciągnięcie na dole, bez odbicia.",
    restSeconds: 90,
  }),
  ex("fly_cable", "Rozpiętki na wyciągu (brama)", "Klatka", "cable", 10, 15, 3, 2.5, "Klatka", ["Barki"], {
    note: "Łuk ruchu do środka, ściśnij klatkę na końcu.",
    restSeconds: 90,
  }),
  ex("press_machine", "Wyciskanie na maszynie", "Klatka", "machine", 8, 12, 3, 2.5, "Klatka", ["Triceps", "Barki"], {
    note: "Ustaw siedzisko tak, by uchwyty były na wysokości klatki.",
    restSeconds: 120,
  }),
  ex("pullover_db", "Pullover hantlem", "Klatka", "dumbbell", 10, 12, 3, 2, "Klatka", ["Plecy"], {
    perHand: false,
    note: "Jeden hantel oburącz, biodra nisko. Rozciąga klatkę i najszersze.",
    restSeconds: 90,
  }),

  // PLECY
  ex("pullup", "Podciąganie nachwytem", "Plecy", "bodyweight", 4, 10, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Pełny zakres — od wyprostu ramion do brody nad drążkiem.",
    restSeconds: 150,
  }),
  ex("chinup", "Podciąganie podchwytem", "Plecy", "bodyweight", 5, 10, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Węższy chwyt, dłonie do siebie — mocniej biceps niż nachwyt.",
    restSeconds: 150,
  }),
  ex("pulldown_neutral", "Ściąganie drążka chwytem neutralnym", "Plecy", "machine", 8, 12, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Uchwyty równoległe — łagodniejsze dla barków niż nachwyt szeroki.",
    restSeconds: 120,
  }),
  ex("row_cable", "Wiosłowanie na wyciągu siedząc", "Plecy", "cable", 8, 12, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Plecy proste, ciągnij do brzucha, łopatki ściągnięte na końcu.",
    restSeconds: 120,
  }),
  ex("row_tbar", "Wiosłowanie T-bar", "Plecy", "barbell", 8, 10, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Tułów pod kątem ok. 45°, ciągnij do mostka.",
    restSeconds: 150,
  }),
  ex("row_machine", "Wiosłowanie na maszynie", "Plecy", "machine", 8, 12, 3, 2.5, "Plecy", ["Biceps"], {
    note: "Klatka oparta o poduszkę, ciągnij łokciami do tyłu.",
    restSeconds: 120,
  }),
  ex("row_db_bent", "Wiosłowanie hantlami w opadzie", "Plecy", "dumbbell", 8, 12, 3, 2, "Plecy", ["Biceps"], {
    note: "Plecy proste, opad w biodrach. Ciągnij oboma hantlami razem.",
    restSeconds: 120,
  }),
  ex("rack_pull", "Martwy ciąg z podstawek", "Plecy", "barbell", 5, 8, 3, 5, "Plecy", ["Tył uda", "Pośladki"], {
    note: "Sztanga od wysokości kolan — mniejszy zakres, większy ciężar niż MC klasyczny.",
    restSeconds: 180,
  }),
  ex("pulldown_straight", "Ściąganie prostymi ramionami (wyciąg)", "Plecy", "cable", 12, 15, 3, 2.5, "Plecy", [], {
    note: "Ramiona proste, ruch tylko w barkach — izolacja najszerszych.",
    restSeconds: 90,
  }),
  ex("shrug_db", "Szrugsy z hantlami", "Plecy", "dumbbell", 10, 15, 3, 2, "Plecy", ["Barki"], {
    note: "Unoś barki prosto w górę, bez kręcenia ramionami.",
    restSeconds: 90,
  }),
  ex("back_ext", "Hiperekstensje (wyprosty tułowia)", "Plecy", "bodyweight", 10, 15, 3, 2.5, "Tył uda", ["Plecy", "Pośladki"], {
    note: "Prosty kręgosłup, ruch z bioder — nie przeprostowuj na górze.",
    restSeconds: 90,
  }),

  // BARKI
  ex("ohp_db", "Wyciskanie hantli nad głowę", "Barki", "dumbbell", 8, 12, 3, 2, "Barki", ["Triceps"], {
    note: "Stabilny tors, hantle nad głową w linii uszu.",
    restSeconds: 120,
  }),
  ex("arnold_press", "Wyciskanie Arnolda", "Barki", "dumbbell", 8, 12, 3, 2, "Barki", ["Triceps"], {
    note: "Rotacja nadgarstków od dłoni do siebie na starcie do na zewnątrz na górze.",
    restSeconds: 120,
  }),
  ex("lateral_cable", "Wznosy bokiem na wyciągu", "Barki", "cable", 12, 15, 3, 2.5, "Barki", [], {
    note: "Stały opór przez cały zakres — inaczej niż hantle. Bez zarzucania.",
    restSeconds: 90,
  }),
  ex("rear_delt_db", "Odwrotne rozpiętki hantlami", "Barki", "dumbbell", 12, 15, 3, 1, "Barki", ["Plecy"], {
    note: "Opad w biodrach, łokcie lekko ugięte — prowadź w tył, nie w górę.",
    restSeconds: 90,
  }),
  ex("rear_delt_machine", "Odwrotny butterfly (maszyna)", "Barki", "machine", 12, 15, 3, 2.5, "Barki", ["Plecy"], {
    note: "Klatka oparta, ramiona prowadzą ruch w tył na wysokości barków.",
    restSeconds: 90,
  }),
  ex("upright_row", "Podciąganie sztangi wzdłuż tułowia", "Barki", "barbell", 10, 12, 3, 2.5, "Barki", ["Biceps"], {
    note: "Łokcie wyżej niż nadgarstki, sztanga blisko ciała.",
    restSeconds: 90,
  }),
  ex("front_raise_db", "Wznosy przodem hantli", "Barki", "dumbbell", 10, 15, 2, 1, "Barki", [], {
    note: "Unoś do wysokości oczu, bez bujania tułowiem.",
    restSeconds: 90,
  }),
  ex("shrug_bb", "Szrugsy ze sztangą", "Barki", "barbell", 10, 15, 3, 2.5, "Plecy", ["Barki"], {
    note: "Chwyt na szerokość barków, unoś barki prosto w górę.",
    restSeconds: 90,
  }),

  // NOGI (czworogłowe / złożone)
  ex("front_squat", "Przysiad przedni", "Nogi", "barbell", 5, 8, 3, 2.5, "Nogi", ["Pośladki", "Brzuch"], {
    note: "Sztanga na barkach przednich, łokcie wysoko — tors pionowo.",
    restSeconds: 180,
  }),
  ex("goblet_squat", "Przysiad goblet", "Nogi", "dumbbell", 8, 12, 3, 2, "Nogi", ["Pośladki"], {
    perHand: false,
    note: "Hantel trzymany oburącz przy klatce. Głęboki przysiad, łokcie między kolanami.",
    restSeconds: 120,
  }),
  ex("leg_press", "Suwnica (wypychanie nogami)", "Nogi", "machine", 8, 12, 3, 5, "Nogi", ["Pośladki"], {
    note: "Stopy na szerokość barków, nie blokuj kolan na górze.",
    restSeconds: 150,
  }),
  ex("hack_squat", "Hack squat (maszyna)", "Nogi", "machine", 8, 12, 3, 5, "Nogi", ["Pośladki"], {
    note: "Plecy przyklejone do oparcia, głęboki zakres.",
    restSeconds: 150,
  }),
  ex("leg_ext", "Prostowanie nóg (maszyna)", "Nogi", "machine", 12, 15, 3, 2.5, "Nogi", [], {
    note: "Pauza na górze, kontrolowany powrót — izolacja czworogłowych.",
    restSeconds: 90,
  }),
  ex("bulgarian_split", "Przysiad bułgarski", "Nogi", "dumbbell", 8, 12, 3, 2, "Nogi", ["Pośladki"], {
    note: "Tylna stopa na podwyższeniu, ciężar na przedniej nodze.",
    restSeconds: 120,
  }),
  ex("step_up", "Wejścia na skrzynię", "Nogi", "dumbbell", 10, 12, 3, 2, "Nogi", ["Pośladki"], {
    note: "Cały ciężar na nodze wchodzącej, nie odbijaj się drugą nogą.",
    restSeconds: 120,
  }),

  // NOGI (tył uda / biodra)
  ex("leg_curl_lying", "Uginanie nóg leżąc", "Nogi", "machine", 10, 12, 3, 2.5, "Tył uda", ["Łydki"], {
    note: "Biodra przyklejone do ławki, pełny zakres bez odbicia.",
    restSeconds: 90,
  }),
  ex("leg_curl_seated", "Uginanie nóg siedząc", "Nogi", "machine", 10, 15, 3, 2.5, "Tył uda", [], {
    note: "Pauza w dolnej pozycji zgięcia, kontrolowany powrót.",
    restSeconds: 90,
  }),
  ex("nordic_curl", "Nordic curl", "Nogi", "bodyweight", 5, 8, 3, 2.5, "Tył uda", ["Pośladki"], {
    note: "Kostki zablokowane, opadaj powoli do przodu — hamuj tyłem uda.",
    restSeconds: 120,
  }),
  ex("good_morning", "Dzień dobry (good morning)", "Nogi", "barbell", 8, 12, 3, 2.5, "Tył uda", ["Plecy", "Pośladki"], {
    note: "Lekkie zgięcie kolan, opad w biodrach z prostym kręgosłupem.",
    restSeconds: 150,
  }),
  ex("rdl_bb", "RDL ze sztangą", "Nogi", "barbell", 6, 10, 3, 2.5, "Tył uda", ["Pośladki", "Plecy"], {
    note: "Sztanga blisko nóg, biodra w tył, kolana prawie proste.",
    restSeconds: 150,
  }),
  ex("deadlift_sumo", "Martwy ciąg sumo", "Nogi", "barbell", 5, 6, 2, 2.5, "Tył uda", ["Nogi", "Plecy", "Pośladki"], {
    note: "Szeroki rozstaw stóp, kolana w linii palców — krótsza droga sztangi niż klasyk.",
    restSeconds: 180,
  }),
  ex("kb_swing", "Swing kettlebell", "Nogi", "dumbbell", 12, 20, 3, 4, "Pośladki", ["Tył uda"], {
    perHand: false,
    note: "Ruch z bioder (hip hinge), nie z rąk — kettlebell/hantel oburącz.",
    restSeconds: 90,
  }),

  // POŚLADKI
  ex("hipthrust_machine", "Hip thrust na maszynie", "Pośladki", "machine", 8, 12, 3, 5, "Pośladki", ["Tył uda"], {
    note: "Pełne wypchnięcie bioder, pauza na górze.",
    restSeconds: 150,
  }),
  ex("glute_bridge", "Wyciskanie bioder z podłogi (sztanga)", "Pośladki", "barbell", 10, 15, 3, 2.5, "Pośladki", ["Tył uda"], {
    note: "Barki na podłodze (nie na ławce) — krótszy zakres niż hip thrust.",
    restSeconds: 90,
  }),
  ex("cable_kickback", "Odwodzenie nogi w tył (wyciąg)", "Pośladki", "cable", 12, 15, 3, 2.5, "Pośladki", ["Tył uda"], {
    note: "Lekkie pochylenie tułowia, prowadź nogę w tył i górę bez bujania.",
    restSeconds: 90,
  }),
  ex("abduction_machine", "Odwodzenie nóg (maszyna)", "Pośladki", "machine", 12, 20, 3, 2.5, "Pośladki", [], {
    note: "Tors nieruchomy, odwodzenie tylko w biodrach.",
    restSeconds: 90,
  }),

  // ŁYDKI
  ex("calf_press", "Wspięcia na palce na suwnicy", "Łydki", "machine", 10, 15, 3, 5, "Łydki", [], {
    note: "Pełny zakres na suwnicy, pauza w górnej pozycji.",
    restSeconds: 90,
  }),

  // BICEPS
  ex("curl_db", "Uginanie hantli stojąc", "Biceps", "dumbbell", 10, 12, 3, 1, "Biceps", [], {
    note: "Łokcie przy tułowiu, bez bujania ciałem.",
    restSeconds: 90,
  }),
  ex("curl_incline_db", "Uginanie hantli na skosie", "Biceps", "dumbbell", 10, 12, 3, 1, "Biceps", [], {
    note: "Siedzisko na skosie, ramiona z tyłu — pełne rozciągnięcie bicepsa.",
    restSeconds: 90,
  }),
  ex("curl_preacher", "Uginanie na modlitewniku", "Biceps", "barbell", 10, 12, 3, 1.25, "Biceps", [], {
    note: "Pachy oparte na poduszce — eliminuje bujanie, izolacja bicepsa.",
    restSeconds: 90,
  }),
  ex("curl_cable", "Uginanie na wyciągu", "Biceps", "cable", 10, 15, 3, 2.5, "Biceps", [], {
    note: "Stały opór przez cały zakres, łokcie nieruchome.",
    restSeconds: 90,
  }),
  ex("curl_concentration", "Uginanie w podporze (koncentracja)", "Biceps", "dumbbell", 10, 12, 2, 1, "Biceps", [], {
    note: "Łokieć oparty o wewnętrzną stronę uda — pełna izolacja.",
    restSeconds: 90,
  }),
  ex("curl_reverse", "Uginanie nachwytem (przedramiona)", "Biceps", "barbell", 10, 15, 2, 1.25, "Biceps", [], {
    note: "Chwyt grzbietem dłoni do góry — mocniej przedramiona i brachioradialis.",
    restSeconds: 90,
  }),

  // TRICEPS
  ex("bench_close_bb", "Wyciskanie sztangi wąsko", "Triceps", "barbell", 6, 10, 3, 2.5, "Triceps", ["Klatka", "Barki"], {
    note: "Chwyt na szerokość barków, łokcie blisko tułowia.",
    restSeconds: 150,
  }),
  ex("dip_triceps", "Dipy na poręczach (tułów pionowo)", "Triceps", "bodyweight", 6, 12, 3, 2.5, "Triceps", ["Klatka", "Barki"], {
    note: "Tors pionowo, łokcie blisko ciała — mocniej triceps niż klatka.",
    restSeconds: 120,
  }),
  ex("dip_bench", "Pompki na ławce", "Triceps", "bodyweight", 10, 15, 3, 2.5, "Triceps", ["Klatka"], {
    note: "Dłonie na krawędzi ławki za sobą, biodra blisko ławki.",
    restSeconds: 90,
  }),
  ex("pushdown_rope", "Prostowanie ramion z liną", "Triceps", "cable", 10, 15, 3, 2.5, "Triceps", [], {
    note: "Rozchyl końce liny na dole, łokcie przy tułowiu.",
    restSeconds: 90,
  }),
  ex("overhead_ext_cable", "Wyciskanie francuskie na wyciągu zza głowy", "Triceps", "cable", 10, 12, 3, 2.5, "Triceps", [], {
    note: "Łokcie wysoko i nieruchomo, ruch tylko w przedramionach.",
    restSeconds: 90,
  }),
  ex("skullcrusher_db", "Wyciskanie francuskie hantlami leżąc", "Triceps", "dumbbell", 10, 12, 3, 1, "Triceps", [], {
    note: "Łokcie stabilne nad klatką, hantle schodzą przy skroniach.",
    restSeconds: 90,
  }),
  ex("kickback_db", "Prostowanie ramienia w opadzie", "Triceps", "dumbbell", 12, 15, 2, 1, "Triceps", [], {
    note: "Ramię równolegle do podłogi, prostuj tylko przedramię.",
    restSeconds: 90,
  }),

  // BRZUCH
  ex("hanging_leg_raise", "Unoszenie nóg w zwisie", "Brzuch", "bodyweight", 8, 15, 3, 2.5, "Brzuch", [], {
    note: "Unoś nogi kontrolowanym ruchem, bez huśtania się na drążku.",
    restSeconds: 90,
  }),
  ex("leg_raise_lying", "Unoszenie nóg leżąc", "Brzuch", "bodyweight", 12, 20, 3, 2.5, "Brzuch", [], {
    note: "Dolny plecy przyklejone do podłogi przez cały ruch.",
    restSeconds: 90,
  }),
  ex("ab_wheel", "Kółko do brzucha (rollout)", "Brzuch", "bodyweight", 8, 15, 3, 2.5, "Brzuch", ["Plecy"], {
    note: "Wyjeżdżaj tak daleko, jak utrzymasz spięty brzuch bez zapadania pleców.",
    restSeconds: 90,
  }),
  ex("woodchop_cable", "Drwal na wyciągu", "Brzuch", "cable", 12, 15, 3, 2.5, "Brzuch", [], {
    note: "Ruch po przekątnej od góry do dołu (i odwrotnie), rotacja z bioder.",
    restSeconds: 90,
  }),
  ex("russian_twist", "Rosyjskie skręty", "Brzuch", "dumbbell", 15, 20, 3, 2, "Brzuch", [], {
    perHand: false,
    note: "Tułów odchylony, stopy nad podłogą (opcjonalnie) — skręty z biodrami stabilnymi.",
    restSeconds: 90,
  }),
  ex("dead_bug", "Dead bug", "Brzuch", "bodyweight", 10, 15, 3, 2.5, "Brzuch", [], {
    note: "Dolny plecy przyklejony do maty przez cały ruch, wolne tempo.",
    restSeconds: 90,
  }),
  ex("hollow_hold", "Hollow hold", "Brzuch", "bodyweight", 30, 30, 3, 5, "Brzuch", [], {
    isHold: true,
    rir: 0,
    note: "Dolny plecy przyklejony do podłogi, ręce i nogi uniesione — napięty brzuch.",
    restSeconds: 60,
  }),
  ex("pallof_press", "Pallof press (antyrotacja)", "Brzuch", "cable", 10, 12, 3, 2.5, "Brzuch", [], {
    note: "Wypychaj ramiona przed siebie, opieraj się rotacji tułowia.",
    restSeconds: 90,
  }),

  // INNE
  ex("farmer_walk", "Spacer farmera", "Inne", "dumbbell", 40, 40, 3, 2, "Plecy", ["Brzuch", "Barki"], {
    isHold: true,
    rir: 0,
    note: "Barki w tył, brzuch spięty — idź krótkim, szybkim krokiem.",
    restSeconds: 90,
  }),
];

export const SEED_DAYS: WorkoutDay[] = [
  {
    id: "mon",
    name: "Trening 1",
    short: "Góra + Pośladki",
    accent: "#ef4444",
    exerciseIds: ["bench_bb", "hipthrust", "row_bb", "lateral", "curl_bb", "crunch"],
    setsOverride: { curl_bb: 3 },
  },
  {
    id: "wed",
    name: "Trening 2",
    short: "Ciężki Dół + Klatka Skos",
    accent: "#3b82f6",
    // Suwnica trzecia w kolejce: czworogłowe dostają objętość jeszcze na
    // świeżo, a maszyna jest bezpieczna po ciężkim przysiadzie i martwym.
    exerciseIds: ["squat", "deadlift", "leg_press", "incline_db", "lunges", "calf", "plank"],
    setsOverride: { calf: 4 },
  },
  {
    id: "fri",
    name: "Trening 3",
    short: "Góra II + Tył Ud",
    accent: "#eab308",
    exerciseIds: ["ohp", "pulldown", "rdl", "bench_db", "row_db", "french"],
    setsOverride: { french: 3 },
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
  rdl: 22.5, // hantle 22,5 kg - 22 nie ma na siłowni Kamila (§24)
  bench_db: 17.5,
  row_db: 20,
  french: 22.5,
  face_pull: 20,
  hammer_curl: 10,
  pushdown: 20,
  calf_seated: 30,
  side_plank: 0,
  // P3-8: rozszerzona biblioteka cwiczen
  bench_incline_bb: 35,
  dip_chest: 0,
  pushup: 0,
  fly_db: 10,
  fly_cable: 10,
  press_machine: 40,
  pullover_db: 20,
  pullup: 0,
  chinup: 0,
  pulldown_neutral: 45,
  row_cable: 45,
  row_tbar: 40,
  row_machine: 40,
  row_db_bent: 16,
  rack_pull: 80,
  pulldown_straight: 25,
  shrug_db: 22,
  back_ext: 0,
  ohp_db: 14,
  arnold_press: 12,
  lateral_cable: 7.5,
  rear_delt_db: 7,
  rear_delt_machine: 25,
  upright_row: 25,
  front_raise_db: 8,
  shrug_bb: 60,
  front_squat: 40,
  goblet_squat: 20,
  leg_press: 120,
  hack_squat: 60,
  leg_ext: 35,
  bulgarian_split: 12,
  step_up: 12,
  leg_curl_lying: 30,
  leg_curl_seated: 35,
  nordic_curl: 0,
  good_morning: 30,
  rdl_bb: 60,
  deadlift_sumo: 70,
  kb_swing: 16,
  hipthrust_machine: 60,
  glute_bridge: 40,
  cable_kickback: 10,
  abduction_machine: 35,
  calf_press: 80,
  curl_db: 10,
  curl_incline_db: 8,
  curl_preacher: 15,
  curl_cable: 20,
  curl_concentration: 8,
  curl_reverse: 15,
  bench_close_bb: 35,
  dip_triceps: 0,
  dip_bench: 0,
  pushdown_rope: 20,
  overhead_ext_cable: 20,
  skullcrusher_db: 10,
  kickback_db: 6,
  hanging_leg_raise: 0,
  leg_raise_lying: 0,
  ab_wheel: 0,
  woodchop_cable: 15,
  russian_twist: 10,
  dead_bug: 0,
  hollow_hold: 0,
  pallof_press: 10,
  farmer_walk: 24,
};

export const DEFAULT_SETTINGS: Settings = {
  name: "Kamil",
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  restSeconds: 120,
  sound: true,
  autoBackup: false,
  loggerLayout: "list",
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
 * duplikatami).
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
 * Merguje bazę ćwiczeń użytkownika z seedem (P3-8): ćwiczenie o ID istniejącym
 * u użytkownika ZOSTAJE jego wersją w całości (zakresy, increment, note,
 * archived, restSeconds — nic nie "dolewamy" z seeda); ćwiczenie z seeda o ID,
 * którego user nie ma, dochodzi (structuredClone); ćwiczenia stworzone przez
 * użytkownika (ID spoza seeda) zostają nietknięte. Kolejność: najpierw user
 * w jego kolejności, potem nowe z seeda — stabilnie, bez sortowania.
 *
 * Bez tego samo dopisanie pozycji do SEED_EXERCISES nie dotarłoby do istniejącego
 * stanu — `migrateState` w ścieżce "aktualny schemat" przykrywa seed tablicą
 * `old.exercises` w całości (patrz niżej). Operacja jest idempotentna i
 * samonaprawiająca, więc NIE wymaga bumpa SCHEMA_VERSION.
 */
export function mergeExerciseLibrary(userExercises: Exercise[]): Exercise[] {
  const userIds = new Set(userExercises.map((e) => e.id));
  const merged = [...userExercises];
  for (const seedEx of SEED_EXERCISES) {
    if (!userIds.has(seedEx.id)) merged.push(structuredClone(seedEx));
  }
  return merged;
}

/**
 * Zadanie 1 (usunięcie animowanego ludzika): stare dane użytkownika mogą
 * nadal mieć `settings.showExerciseAnim` — pole nie istnieje już w typie
 * `Settings`, ale obiekt z localStorage jest w runtime nietypowany, więc
 * `{ ...DEFAULT_SETTINGS, ...(old.settings ?? {}) }` przepuściłoby je dalej.
 * Idempotentna (kolejne wywołanie na już czystym obiekcie nic nie zmienia,
 * `"showExerciseAnim" in settings` jest `false`) i NIE rusza żadnego innego pola.
 */
function normalizeSettings(settings: Settings): Settings {
  if (!("showExerciseAnim" in settings)) return settings;
  const clean = { ...settings } as Settings & { showExerciseAnim?: unknown };
  delete clean.showExerciseAnim;
  return clean;
}

/**
 * Migracja: przy zmianie wersji schematu podmienia plan (days/targets)
 * na aktualny seed, ale ZACHOWUJE sessions, body, squash, settings oraz bazę
 * ćwiczeń użytkownika (merge z seedem, patrz mergeExerciseLibrary).
 */
export function migrateState(raw: unknown): AppState {
  const fresh = defaultState();
  if (!raw || typeof raw !== "object") return applyOneTimeSeeds(fresh);
  const old = raw as Partial<AppState>;

  if (old.version === SCHEMA_VERSION && Array.isArray(old.exercises) && Array.isArray(old.days)) {
    // Aktualny schemat — dołóż tylko ewentualne braki w settings + nowe
    // ćwiczenia z seeda, których user jeszcze nie ma (P3-8).
    return applyOneTimeSeeds({
      ...fresh,
      ...old,
      version: SCHEMA_VERSION,
      exercises: mergeExerciseLibrary(old.exercises as Exercise[]),
      settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...(old.settings ?? {}) }),
      targets: { ...fresh.targets, ...(old.targets ?? {}) },
    } as AppState);
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

  return applyOneTimeSeeds({
    ...fresh,
    exercises: Array.isArray(old.exercises) ? mergeExerciseLibrary(old.exercises as Exercise[]) : fresh.exercises,
    targets,
    sessions: Array.isArray(old.sessions) ? old.sessions : [],
    body: Array.isArray(old.body) ? old.body : [],
    squash: Array.isArray(old.squash) ? old.squash : [],
    settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...(old.settings ?? {}) }),
  });
}

/**
 * Jednorazowe dołożenie historii startowej — działa dla KAŻDEGO stanu bez
 * flagi `historySeeded`: migracji ze starej wersji, świeżego startu (np.
 * apka przypięta do ekranu początkowego ma OSOBNY localStorage niż Safari
 * i startuje od zera) i stanu bieżącej wersji. Po dołożeniu flaga blokuje
 * ponowne wstrzykiwanie, więc ręczne usunięcie sesji z historii jest trwałe.
 */
function seedHistoryOnce(state: AppState): AppState {
  if (state.historySeeded) return state;
  return { ...state, historySeeded: true, sessions: mergeHistoricalSessions(state.sessions) };
}

/**
 * Dogania cele (`targets`) do progresji wynikającej z najświeższej zalogowanej
 * sesji per ćwiczenie — potrzebne, bo historia startowa (mergeHistoricalSessions)
 * wstrzykuje gotowe Session[] z pominięciem finishSession(), więc nigdy nie
 * przeliczała targets. Reguła: podnieś cel TYLKO gdy computeProgression daje
 * wynik WYŻSZY niż obecny — nigdy nie obniża ręcznie ustawionych/zaokrąglonych
 * celów (np. bench_db 17,5 kg zostaje, mimo że czysta progresja z kroku 2 kg
 * dałaby 17). Bez wyjątków dla konkretnych ćwiczeń (dot. też martwego ciągu).
 */
function catchUpTargetsFromHistory(state: AppState): AppState {
  const targets = { ...state.targets };
  const sorted = [...state.sessions]
    .filter((s) => s.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const exercise of state.exercises) {
    for (const session of sorted) {
      const entry = session.entries.find((e) => e.exerciseId === exercise.id);
      if (!entry || !entry.sets.some((s) => s.done)) continue;
      const result = computeProgression(exercise, entry.targetWeight, entry.sets);
      if (result.nextWeight > (targets[exercise.id] ?? 0)) {
        targets[exercise.id] = result.nextWeight;
      }
      break;
    }
  }
  return { ...state, targets };
}

function catchUpTargetsOnce(state: AppState): AppState {
  if (state.historyTargetsSeeded) return state;
  return { ...catchUpTargetsFromHistory(state), historyTargetsSeeded: true };
}

/**
 * P6-5: `restSeconds` (przerwa per ćwiczenie) doszło do `Exercise` już PO tym,
 * jak wielu użytkowników miało swój stan zapisany — `mergeExerciseLibrary`
 * świadomie nie dolewa pól z seeda do istniejących ćwiczeń (ochrona ręcznych
 * edycji Plan → Przerwa), więc te ćwiczenia utknęły bez `restSeconds` na
 * zawsze i timer przed pierwszą serią zawsze pokazywał globalne 120 s.
 * Backfill jednorazowy: dla ćwiczenia o ID istniejącym w SEED_EXERCISES BEZ
 * własnego `restSeconds` — kopiuje wartość z seeda. Nie dotyka ćwiczeń
 * spoza seeda (własnych użytkownika) ani tych, które już mają swoją wartość
 * (także `restSeconds: 0`, gdyby ktoś świadomie tak ustawił — `!== undefined`).
 */
function backfillRestSecondsFromSeed(state: AppState): AppState {
  const seedById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
  const exercises = state.exercises.map((ex) => {
    if (ex.restSeconds !== undefined) return ex;
    const seedEx = seedById.get(ex.id);
    if (!seedEx || seedEx.restSeconds === undefined) return ex;
    return { ...ex, restSeconds: seedEx.restSeconds };
  });
  return { ...state, exercises };
}

function backfillRestSecondsOnce(state: AppState): AppState {
  if (state.restSecondsBackfilled) return state;
  return { ...backfillRestSecondsFromSeed(state), restSecondsBackfilled: true };
}

/**
 * Kalibracja RIR (patrz `defaultRir`): do tej pory KAŻDE ćwiczenie miało
 * jednolite `rir: 2`, więc stan zapisany u użytkownika też. `mergeExerciseLibrary`
 * świadomie nie dolewa pól z seeda do istniejących ćwiczeń, więc bez backfillu
 * nowe wartości nigdy by tam nie dotarły.
 *
 * Rusza WYŁĄCZNIE ćwiczenia, które mają dziś dokładnie starą wartość domyślną
 * (`rir === 2`) i których ID istnieje w seedzie z INNĄ wartością. Ćwiczenia
 * z ręcznie ustawionym 0/1/3 i te spoza seeda zostają nietknięte. Świadome
 * ograniczenie: jeśli ktoś ręcznie wpisał 2 tam, gdzie seed daje 1, ta zmiana
 * to nadpisze — nie da się odróżnić „wybrałem 2" od „tak było domyślnie".
 */
function calibrateRirFromSeed(state: AppState): AppState {
  const seedById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
  const exercises = state.exercises.map((ex) => {
    if (ex.rir !== 2) return ex;
    const seedEx = seedById.get(ex.id);
    if (!seedEx || seedEx.rir === 2) return ex;
    return { ...ex, rir: seedEx.rir };
  });
  return { ...state, exercises };
}

function calibrateRirOnce(state: AppState): AppState {
  if (state.rirCalibrated) return state;
  return { ...calibrateRirFromSeed(state), rirCalibrated: true };
}

/**
 * §24: cel RDL z hantlami 22 → 22,5 kg. Na siłowni Kamila nie ma hantli 22 kg,
 * więc zaplanowany cel był fizycznie nieosiągalny i po każdym treningu wracał
 * (od teraz `loggedWorkingWeight` sam by go dogonił, ale dopiero po pierwszej
 * ukończonej sesji — ta poprawka oszczędza ten jeden trening tarcia).
 *
 * Rusza WYŁĄCZNIE cel równy dokładnie starej wartości z seeda (22) — jeśli
 * progresja zdążyła go już podnieść albo Kamil ustawił własny, zostaje.
 */
function fixRdlTarget(state: AppState): AppState {
  if (state.targets.rdl !== 22) return state;
  return { ...state, targets: { ...state.targets, rdl: 22.5 } };
}

function fixRdlTargetOnce(state: AppState): AppState {
  if (state.rdlTargetFixed) return state;
  return { ...fixRdlTarget(state), rdlTargetFixed: true };
}

/**
 * Wariant B (§19): dołożenie objętości partiom, które w planie 3-dniowym miały
 * jej realnie za mało — Nogi 6 serii/tydz. przy 1×/tydz. (zero udziału
 * pomocniczego: martwy/RDL/hip thrust nie trenują czworogłowych), Biceps
 * i Triceps po 2 serie bezpośrednie, Łydki 3.
 *
 * `migrateState` w ścieżce „aktualny schemat" przykrywa seed tablicą
 * `old.days` (§13), więc sama zmiana `SEED_DAYS` nie dotarłaby do zapisanego
 * stanu — stąd ten jednorazowy dosiew (flaga `planVolumeBumpSeeded`).
 * Idempotentny i zachowawczy: dokłada ćwiczenie tylko gdy go w dniu NIE MA,
 * a liczbę serii podnosi tylko gdy jest niższa niż docelowa (ręczne
 * zwiększenie przez użytkownika zostaje). Późniejsze usunięcie suwnicy z dnia
 * jest trwałe — flaga nie pozwoli dołożyć jej drugi raz.
 */
const PLAN_VOLUME_BUMP: { dayId: string; addAfter?: string; addExerciseId?: string; sets?: Record<string, number> }[] = [
  { dayId: "wed", addAfter: "deadlift", addExerciseId: "leg_press", sets: { calf: 4 } },
  { dayId: "mon", sets: { curl_bb: 3 } },
  { dayId: "fri", sets: { french: 3 } },
];

function applyPlanVolumeBump(state: AppState): AppState {
  const exercises = state.exercises.map((e) => ({ ...e }));
  const targets = { ...state.targets };

  const days = state.days.map((day) => {
    const plan = PLAN_VOLUME_BUMP.find((p) => p.dayId === day.id);
    if (!plan) return day;
    let exerciseIds = [...day.exerciseIds];

    if (plan.addExerciseId && !exerciseIds.includes(plan.addExerciseId)) {
      const seedEx = SEED_EXERCISES.find((e) => e.id === plan.addExerciseId);
      if (seedEx) {
        if (!exercises.some((e) => e.id === seedEx.id)) exercises.push(structuredClone(seedEx));
        const own = exercises.find((e) => e.id === seedEx.id)!;
        own.archived = false;
        if (targets[seedEx.id] === undefined) targets[seedEx.id] = SEED_TARGETS[seedEx.id] ?? 0;
        const at = plan.addAfter ? exerciseIds.indexOf(plan.addAfter) : -1;
        if (at >= 0) exerciseIds.splice(at + 1, 0, seedEx.id);
        else exerciseIds.push(seedEx.id);
      }
    }

    const setsOverride = { ...(day.setsOverride ?? {}) };
    for (const [exId, want] of Object.entries(plan.sets ?? {})) {
      if (!exerciseIds.includes(exId)) continue;
      const base = exercises.find((e) => e.id === exId)?.targetSets ?? want;
      const current = setsOverride[exId] ?? base;
      if (current < want) setsOverride[exId] = want;
    }

    const next: WorkoutDay = { ...day, exerciseIds };
    if (Object.keys(setsOverride).length > 0) next.setsOverride = setsOverride;
    return next;
  });

  return { ...state, days, exercises, targets };
}

function applyPlanVolumeBumpOnce(state: AppState): AppState {
  if (state.planVolumeBumpSeeded) return state;
  return { ...applyPlanVolumeBump(state), planVolumeBumpSeeded: true };
}

/**
 * Zadanie 3: nazwy dni "Poniedziałek/Środa/Piątek" sugerowały sztywny
 * kalendarz, którego apka nie wymaga — to tylko zwyczajowy rytm Kamila.
 * Jednorazowo nadpisuje `name` dni `mon`/`wed`/`fri` na neutralne
 * "Trening 1/2/3" z aktualnego `SEED_DAYS`, zachowując WSZYSTKO inne
 * (`short`, `exerciseIds`, `active`, `optional`, `accent`). `id` BEZ ZMIAN —
 * historia/rotacja/cele są z nimi powiązane przez `dayId`.
 */
function neutralizeDayLabels(state: AppState): AppState {
  const NEUTRAL_IDS = new Set(["mon", "wed", "fri"]);
  const seedNameById = new Map(SEED_DAYS.map((d) => [d.id, d.name]));
  const days = state.days.map((d) => {
    if (!NEUTRAL_IDS.has(d.id)) return d;
    const neutralName = seedNameById.get(d.id);
    return neutralName ? { ...d, name: neutralName } : d;
  });
  return { ...state, days };
}

function neutralizeDayLabelsOnce(state: AppState): AppState {
  if (state.neutralDayLabelsSeeded) return state;
  return { ...neutralizeDayLabels(state), neutralDayLabelsSeeded: true };
}

function applyOneTimeSeeds(state: AppState): AppState {
  // Kolejność ma znaczenie tylko tam, gdzie jeden dosiew czyta wynik drugiego
  // (catchUpTargets po seedHistory). Reszta jest niezależna.
  let s = neutralizeDayLabelsOnce(state);
  s = seedHistoryOnce(s);
  s = catchUpTargetsOnce(s);
  s = backfillRestSecondsOnce(s);
  s = calibrateRirOnce(s);
  s = applyPlanVolumeBumpOnce(s);
  s = fixRdlTargetOnce(s);
  return s;
}

/**
 * Przywraca oryginalny skład dnia z seeda (P0-7): brakujące ćwiczenia dokłada
 * z powrotem (z celem z `SEED_TARGETS`), zarchiwizowane odarchiwizuje BEZ
 * dotykania ich celu/parametrów, `day.exerciseIds` resetuje do kolejności
 * z seeda. `targets` ISTNIEJĄCYCH ćwiczeń (wypracowana progresja) — nietknięte.
 * Dzień spoza `SEED_DAYS` (stworzony przez użytkownika) → stan bez zmian.
 */
export function computeRestoredDayPlan(state: AppState, dayId: string): AppState {
  const seedDay = SEED_DAYS.find((d) => d.id === dayId);
  if (!seedDay) return state;

  const exercises = state.exercises.map((e) => ({ ...e }));
  const targets = { ...state.targets };
  for (const exId of seedDay.exerciseIds) {
    const existing = exercises.find((e) => e.id === exId);
    if (!existing) {
      const seedEx = SEED_EXERCISES.find((e) => e.id === exId);
      if (seedEx) {
        exercises.push(structuredClone(seedEx));
        targets[exId] = SEED_TARGETS[exId] ?? 0;
      }
    } else if (existing.archived) {
      existing.archived = false;
    }
  }

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d;
    // Liczba serii to część PLANU dnia, więc wraca do wartości z seeda razem
    // ze składem ćwiczeń (inaczej „przywróć plan" zostawiałoby ręczne 7 serii
    // przysiadu w odtworzonym dniu). `targets` to co innego — wypracowana
    // progresja, celowo nietknięta.
    const next: WorkoutDay = { ...d, exerciseIds: [...seedDay.exerciseIds] };
    if (seedDay.setsOverride) next.setsOverride = { ...seedDay.setsOverride };
    else delete next.setsOverride;
    return next;
  });
  return { ...state, exercises, days, targets };
}
