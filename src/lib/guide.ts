// Publiczne API dla instrukcji "Jak wykonać?" — dane per ćwiczenie żyją w
// src/lib/guides/ (rozbite po partii mięśniowej, Zadanie 2), tu tylko
// re-eksport typu/mapy + guideFor() z fallbackiem dla ćwiczeń użytkownika.
//
// Historia: animowany ludzik SVG (P5-3a/P6-1) został CAŁKOWICIE usunięty
// (28.07.2026, Zadanie 1) — mimo poprawki fazowania koszt utrzymania
// dedykowanego wzorca ruchu na KAŻDE z 90 ćwiczeń i ryzyko pokazania złego
// ruchu przewyższały wartość wizualną. "Jak wykonać?" jest teraz w 100%
// tekstowe, z bezpośrednią instrukcją dla wszystkich 90 ćwiczeń z seeda.
import type { Category, Exercise, Unit } from "./types";
import type { ExerciseGuide } from "./guides/types";
import { GUIDES } from "./guides/index";

export type { ExerciseGuide } from "./guides/types";
export { GUIDES };

// ── Fallback dla ćwiczeń użytkownika (spoza SEED_EXERCISES) ────────────────
// KAŻDE ćwiczenie z seeda ma bezpośredni wpis w GUIDES (patrz src/lib/guides/
// oraz test pokrycia w tests/logic.test.ts) — ten fallback dotyczy WYŁĄCZNIE
// ćwiczeń dodanych ręcznie w Planie, o których nie wiemy nic poza
// kategorią/jednostką sprzętu/isHold. To NIE jest porada medyczna — przy
// bólu (nie zwykłym zmęczeniu mięśnia) instrukcja mówi wprost: przerwij.

const EQUIPMENT_SETUP: Record<Unit, string> = {
  barbell: "Ustaw sztangę i chwyt tak, by od pierwszego powtórzenia kontrolować cały zakres ruchu.",
  dumbbell: "Dobierz hantle, które pozwolą utrzymać kontrolę przez cały zakres ruchu.",
  machine: "Ustaw siedzisko/oparcie maszyny pod swoją sylwetkę, zanim zaczniesz serię.",
  cable: "Ustaw wysokość wyciągu i chwyt uchwytu odpowiednie dla tego ruchu.",
  bodyweight: "Ustaw pozycję ciała tak, by kontrolować cały zakres ruchu masą własną.",
};

const CATEGORY_CUE: Record<Category, string> = {
  Klatka: "Prowadź łopatki ściągnięte, ruch kontrolowany od pierwszego do ostatniego powtórzenia.",
  Plecy: "Inicjuj ruch ściągnięciem łopatek, nie samymi rękami.",
  Barki: "Unikaj bujania tułowiem — izoluj ruch w barku.",
  Nogi: "Kolana podążają za kierunkiem stóp przez cały ruch.",
  Pośladki: "Spinaj pośladki w najmocniejszym punkcie ruchu.",
  Łydki: "Pełny zakres — od pełnego rozciągnięcia do pełnego wspięcia.",
  Biceps: "Łokcie nieruchome, blisko tułowia przez cały ruch.",
  Triceps: "Łokcie nieruchome, ruch tylko w przedramieniu.",
  Brzuch: "Spinaj brzuch przez cały ruch, bez szarpania.",
  Inne: "Utrzymuj stabilną, kontrolowaną technikę przez cały ruch.",
};

/**
 * Fallback zależny od `category`/`unit`/`isHold` (Zasady zadania: nie jeden
 * ogólny tekst dla wszystkich). `isHold` dostaje instrukcję "na czas"
 * (wejście w pozycję + utrzymanie + oddech) zamiast klasycznej
 * koncentryki/ekscentryki pojedynczego powtórzenia.
 */
function fallbackGuideFor(ex: Exercise): ExerciseGuide {
  const equipmentSetup = EQUIPMENT_SETUP[ex.unit];
  const categoryCue = CATEGORY_CUE[ex.category] ?? CATEGORY_CUE.Inne;
  const safety = "Ból (nie zwykłe zmęczenie mięśnia) to sygnał, żeby przerwać ćwiczenie, nie przepychać powtórzenie.";

  if (ex.isHold) {
    return {
      setup: [equipmentSetup],
      steps: [
        "Wejdź w pozycję i spnij pracujące mięśnie, zanim zacznie lecieć czas.",
        categoryCue,
        "Oddychaj spokojnie, utrzymując napięcie przez cały czas trwania serii.",
      ],
      mistakes: ["Tracenie napięcia w połowie czasu trwania serii.", "Zbyt długi czas kosztem poprawnej pozycji."],
      safety,
    };
  }

  return {
    setup: [equipmentSetup],
    steps: [
      "Wykonaj ruch płynnie, bez szarpania, w pełnym dostępnym zakresie.",
      categoryCue,
      "Wróć do pozycji startowej pod kontrolą, bez odbicia.",
    ],
    mistakes: ["Zbyt duży ciężar kosztem techniki.", "Urywanie zakresu ruchu."],
    safety,
  };
}

/** `id` -> `GUIDES` bezpośrednio (wszystkie 90 ćwiczeń z seeda); brak wpisu
 * ale jest `primaryMuscle` (ćwiczenie użytkownika) -> fallback zależny od
 * kategorii/sprzętu/isHold; brak obu -> `null`. */
export function guideFor(ex: Exercise): ExerciseGuide | null {
  const direct = GUIDES[ex.id];
  if (direct) return direct;
  if (!ex.primaryMuscle) return null;
  return fallbackGuideFor(ex);
}
