// Wspólny typ dla instrukcji "Jak wykonać?" — czyste dane (bez Reacta,
// testowalne bez DOM-u). Teksty NIE powielają `Exercise.note` (cue trenera
// "na ten tydzień", wyświetlany osobno w TrainScreen) — tu opisujemy sam ruch.
//
// Animowany ludzik SVG (P5-3a/P6-1) został CAŁKOWICIE usunięty (28.07.2026) —
// patrz src/lib/guide.ts. "Jak wykonać?" jest w 100% tekstowe.
export interface ExerciseGuide {
  /** 1-2 zdania: ustawienie przed pierwszym powtórzeniem. */
  setup: string[];
  /** 3-5 kroków samego powtórzenia (koncentryka + ekscentryka). */
  steps: string[];
  /** 2-3 typowe błędy ("czego NIE robić"). */
  mistakes: string[];
  /** Tylko tam, gdzie realne ryzyko (martwy, przysiad, OHP, wiosłowanie w opadzie itp.). */
  safety?: string;
}
