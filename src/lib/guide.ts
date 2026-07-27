// P5-3a: instrukcje "Jak wykonać?" — czyste dane (bez Reacta, testowalne bez
// DOM-u). Teksty NIE powielają `Exercise.note` (cue trenera "na ten tydzień",
// wyświetlany osobno w TrainScreen) — tu opisujemy sam ruch.
import type { Exercise, Muscle } from "./types";
import type { MovePatternId } from "./anim-poses";

export interface ExerciseGuide {
  pattern: MovePatternId;
  /** 1-2 zdania: ustawienie przed pierwszym powtórzeniem. */
  setup: string[];
  /** 3-5 kroków samego powtórzenia (koncentryka + ekscentryka). */
  steps: string[];
  /** 2-3 typowe błędy ("czego NIE robić"). */
  mistakes: string[];
  /** Tylko tam, gdzie realne ryzyko (martwy, przysiad, OHP, wiosłowanie w opadzie). */
  safety?: string;
}

/**
 * Etap 3a: ~15 pozycji z trzech dni planu (§6 CLAUDE.md) — mapowane na 6
 * wzorców już dostępnych w `MOVE_PATTERNS`. Część mapowań to celowe PROXY
 * (np. `incline_db`/`hipthrust`/`pulldown` na wzorce wizualnie najbliższe
 * dostępnym 6, nie idealne) — dokładniejsze/dedykowane wzorce (incline_press,
 * pulldown, lateral_raise…) dochodzą w etapie 3b razem z resztą 90 ćwiczeń.
 */
export const GUIDES: Record<string, ExerciseGuide> = {
  bench_bb: {
    pattern: "bench_press",
    setup: ["Połóż się na ławce, stopy płasko na podłodze, łopatki ściągnięte i oparte."],
    steps: [
      "Zdejmij sztangę, opuszczaj ją kontrolowanie do dolnej części klatki.",
      "Dotknij klatki lekko, bez odbicia.",
      "Wypchnij sztangę w górę po tym samym torze, aż ramiona się wyprostują.",
    ],
    mistakes: ["Odbijanie sztangi od klatki.", "Unoszenie bioder z ławki.", "Rozjeżdżające się łokcie na bok."],
  },
  bench_db: {
    pattern: "bench_press",
    setup: ["Usiądź z hantlami na udach, połóż się, wprowadzając je nad barki."],
    steps: [
      "Opuszczaj hantle po łuku do wysokości klatki.",
      "Rozciągnij klatkę na dole, bez odbicia.",
      "Wyciśnij hantle w górę, zbliżając je nad klatką.",
    ],
    mistakes: ["Zbyt niskie schodzenie kosztem barków.", "Stukanie hantlami o siebie zamiast kontroli."],
  },
  incline_db: {
    pattern: "bench_press",
    setup: ["Ustaw ławkę na skos 30-45°, hantle startowo nad barkami."],
    steps: [
      "Opuszczaj hantle do górnej części klatki.",
      "Rozciągnij na dole, bez odbicia.",
      "Wyciśnij hantle w górę i lekko do środka.",
    ],
    mistakes: ["Zbyt duży kąt ławki (przechodzi w wyciskanie barków).", "Urywanie zakresu ruchu."],
  },
  squat: {
    pattern: "squat",
    setup: ["Sztanga na górnej części pleców, stopy na szerokość barków, lekko na zewnątrz."],
    steps: [
      "Nabierz powietrza, spnij brzuch.",
      "Zejdź w dół, prowadząc kolanami zgodnie z kierunkiem stóp.",
      "Zejdź do pełnej głębokości, zachowując proste plecy.",
      "Wstań, wypychając podłogę stopami.",
    ],
    mistakes: ["Zaokrąglanie dolnego odcinka pleców.", "Kolana zapadające się do środka.", "Podnoszenie pięt."],
    safety: "Nie walcz o powtórzenie kosztem techniki — przy wątpliwościach zejdź z ciężaru.",
  },
  lunges: {
    pattern: "squat",
    setup: ["Stań prosto, hantle po bokach, wzrok przed siebie."],
    steps: [
      "Zrób krok do przodu (lub w tył), opuszczając biodra pionowo w dół.",
      "Zejdź, aż tylne kolano zbliży się do podłogi.",
      "Wypchnij się z powrotem do pozycji startowej przez przednią stopę.",
    ],
    mistakes: ["Zbyt krótki krok — kolano wychodzi przed palce.", "Chwiejny balans z powodu zbyt wąskiego stawiania stóp."],
  },
  deadlift: {
    pattern: "hinge",
    setup: ["Sztanga nad środkiem stóp, chwyt tuż za kolanami, plecy proste, biodra wyżej niż w przysiadzie."],
    steps: [
      "Nabierz powietrza, spnij cały tułów.",
      "Wypchnij podłogę stopami, prowadząc sztangę blisko goleni.",
      "Wyprostuj biodra na górze, bez przeprostu w plecach.",
      "Opuszczaj sztangę tym samym torem, zawiasując w biodrach.",
    ],
    mistakes: ["Zaokrąglanie pleców przy podłodze.", "Szarpanie sztangi zamiast płynnego wypchnięcia.", "Sztanga oddalająca się od nóg."],
    safety: "UWAGA NA PLECY — przy pierwszym sygnale zaokrąglenia przerwij serię, to nie jest powtórzenie warte ryzyka.",
  },
  rdl: {
    pattern: "hinge",
    setup: ["Hantle/sztanga przy udach, lekko ugięte kolana, plecy proste."],
    steps: [
      "Zawiasuj w biodrach, odsuwając je do tyłu.",
      "Schodź, prowadząc ciężar blisko nóg, aż poczujesz rozciągnięcie tylnej części uda.",
      "Wróć, wypychając biodra do przodu.",
    ],
    mistakes: ["Zginanie kolan zamiast pracy w biodrach.", "Zaokrąglanie pleców na dole."],
    safety: "Schodź tylko do granicy, w której plecy zostają proste — dalej to już zaokrąglenie, nie zakres ruchu.",
  },
  hipthrust: {
    pattern: "hinge",
    setup: ["Oprzyj górną część pleców o ławkę, sztanga nad biodrami, stopy płasko."],
    steps: [
      "Wypchnij biodra w górę, aż tułów i uda utworzą linię prostą.",
      "Spnij pośladki na górze przez chwilę.",
      "Opuść biodra kontrolowanie, bez odbicia od podłogi.",
    ],
    mistakes: ["Przeprost w dolnym odcinku pleców na górze ruchu.", "Zbyt płytki zakres."],
  },
  row_bb: {
    pattern: "row_bent",
    setup: ["Opad tułowia ok. 45°, kolana lekko ugięte, sztanga chwytem nadgarstek prosto."],
    steps: [
      "Ciągnij sztangę do pępka, prowadząc łokciami blisko tułowia.",
      "Ściągnij łopatki na szczycie ruchu.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Prostowanie się przy każdym powtórzeniu (bujanie).", "Ciągnięcie samymi rękami bez pracy łopatek."],
    safety: "Utrzymuj stały kąt opadu tułowia — jego zmiana w trakcie serii to najczęstsza droga do bólu pleców.",
  },
  row_db: {
    pattern: "row_bent",
    setup: ["Oprzyj kolano i dłoń o ławkę, plecy równolegle do podłogi, hantel w drugiej ręce."],
    steps: [
      "Ciągnij hantel do biodra, prowadząc łokieć blisko tułowia.",
      "Ściągnij łopatkę na szczycie.",
      "Opuść hantel kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Skręcanie tułowia zamiast pracy ramienia.", "Zbyt szybkie opuszczanie ciężaru."],
  },
  pulldown: {
    pattern: "row_bent",
    setup: ["Usiądź, uda zablokowane pod wałkiem, chwyt szerszy niż barki."],
    steps: [
      "Ściągnij drążek do górnej części klatki, prowadząc łokciami w dół.",
      "Spnij plecy na dole ruchu.",
      "Wypuść drążek kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Odchylanie się mocno do tyłu i ciągnięcie masą ciała.", "Ciągnięcie za głowę zamiast przed nią."],
  },
  ohp: {
    pattern: "press_overhead",
    setup: ["Sztanga na wysokości obojczyków, chwyt nieco szerszy niż barki, pośladki i brzuch spięte."],
    steps: [
      "Wypchnij sztangę pionowo w górę, przesuwając głowę lekko do tyłu w połowie ruchu.",
      "Zablokuj ręce na górze, sztanga nad środkiem stopy.",
      "Opuść sztangę kontrolowanie do wysokości obojczyków.",
    ],
    mistakes: ["Nadmierne odchylanie się do tyłu.", "Wypychanie samymi barkami bez stabilizacji tułowia."],
    safety: "Trzymaj spięty brzuch i pośladki przez cały ruch — to chroni odcinek lędźwiowy przy wypychaniu nad głowę.",
  },
  lateral: {
    pattern: "press_overhead",
    setup: ["Stań prosto, hantle po bokach, lekko ugięte łokcie."],
    steps: [
      "Unieś hantle bokiem do wysokości barków, prowadząc łokciem.",
      "Zatrzymaj na chwilę na szczycie.",
      "Opuść hantle kontrolowanie, bez bujania ciałem.",
    ],
    mistakes: ["Zarzucanie ciężaru pędem tułowia.", "Unoszenie zbyt wysoko kosztem barku."],
  },
  face_pull: {
    pattern: "press_overhead",
    setup: ["Wyciąg na wysokości twarzy, chwyt liny, lekki odkrok do tyłu."],
    steps: [
      "Ciągnij linę do twarzy, rozciągając ją na końcu ruchu.",
      "Łokcie prowadź wysoko, na wysokości barków.",
      "Wróć kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Ciągnięcie nisko, do klatki zamiast do twarzy.", "Zbyt duży ciężar kosztem zakresu ruchu."],
  },
  curl_bb: {
    pattern: "curl",
    setup: ["Stań prosto, sztanga chwytem podchwytem, łokcie blisko tułowia."],
    steps: [
      "Uginaj ramiona, unosząc sztangę bez ruchu w barkach.",
      "Spnij biceps na szczycie.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Bujanie tułowiem, żeby „pomóc” sztandze.", "Wysuwanie łokci do przodu w trakcie ruchu."],
  },
  french: {
    pattern: "curl",
    setup: ["Sztanga/hantle nad klatką przy wyprostowanych ramionach, łokcie skierowane w sufit."],
    steps: [
      "Ugnij łokcie, opuszczając ciężar w stronę czoła.",
      "Zatrzymaj łokcie w miejscu przez cały ruch.",
      "Wyprostuj ramiona, pracują tylko przedramiona.",
    ],
    mistakes: ["Rozjeżdżające się łokcie na boki.", "Zbyt duży ciężar kosztem zakresu ruchu."],
  },
};

/**
 * Fallback po `primaryMuscle`, gdy ćwiczenie (np. dodane ręcznie przez
 * użytkownika) nie ma wpisu w `GUIDES`. Celowo obejmuje TYLKO partie, dla
 * których jeden z 6 wzorców etapu 3a jest sensownym przybliżeniem — Łydki i
 * Brzuch czekają na `calf_raise`/`crunch`/`plank` w etapie 3b (do tego czasu
 * `guideFor` zwraca `null`, UI po prostu nie pokazuje przycisku).
 */
const FALLBACK_PATTERN_BY_MUSCLE: Partial<Record<Muscle, MovePatternId>> = {
  Klatka: "bench_press",
  Plecy: "row_bent",
  Barki: "press_overhead",
  Nogi: "squat",
  Pośladki: "hinge",
  "Tył uda": "hinge",
  Biceps: "curl",
  Triceps: "bench_press",
};

const FALLBACK_GUIDE_TEXT: Omit<ExerciseGuide, "pattern"> = {
  setup: ["Ustaw ciężar tak, by kontrolować cały zakres ruchu od pierwszego powtórzenia."],
  steps: [
    "Wykonaj ruch płynnie, bez szarpania.",
    "Zatrzymaj się na chwilę w pozycji największego naprężenia.",
    "Wróć do pozycji startowej pod kontrolą, bez odbicia.",
  ],
  mistakes: ["Zbyt duży ciężar kosztem techniki.", "Urywanie zakresu ruchu."],
};

/** `id` -> `GUIDES`, fallback -> wzorzec z `primaryMuscle`, brak dopasowania -> `null`. */
export function guideFor(ex: Exercise): ExerciseGuide | null {
  const direct = GUIDES[ex.id];
  if (direct) return direct;
  if (!ex.primaryMuscle) return null;
  const pattern = FALLBACK_PATTERN_BY_MUSCLE[ex.primaryMuscle];
  if (!pattern) return null;
  return { pattern, ...FALLBACK_GUIDE_TEXT };
}
