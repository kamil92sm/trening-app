// Historia startowa — 3 tygodnie treningów zalogowanych poza aplikacją
// (tygodnie 2–4 po przerwie, 6–24 lipca 2026). Wstrzykiwana JEDNORAZOWO
// przy migracji ze starej wersji schematu (patrz mergeHistoricalSessions
// w seed.ts). Ciężary hantli = na jedną rękę (konwencja apki), plank: reps
// to sekundy, weight to dodatkowe obciążenie.
import type { ExerciseLog, Session, SetLog } from "./types";

const s = (weight: number, reps: number): SetLog => ({ weight, reps, done: true });

type EntrySpec = [exerciseId: string, targetWeight: number, sets: SetLog[], note?: string];

function sesja(id: string, dayId: string, day: string, entries: EntrySpec[]): Session {
  return {
    id,
    dayId,
    date: `${day}T18:00:00`,
    completed: true,
    entries: entries.map(([exerciseId, targetWeight, sets, note]): ExerciseLog => ({
      exerciseId,
      targetWeight,
      sets,
      ...(note ? { note } : {}),
    })),
  };
}

export const HISTORICAL_SESSIONS: Session[] = [
  // ── Tydzień 2 ──────────────────────────────────────────────────────────
  sesja("hist-w2-mon", "mon", "2026-07-06", [
    ["bench_bb", 45, [s(45, 6), s(42.5, 8), s(42.5, 7)], "45 kg za ciężko (6 powt.) — redukcja na 42,5"],
    ["hipthrust", 50, [s(50, 12), s(50, 12), s(50, 12)], "Ostatnia seria mega piekła"],
    ["row_bb", 55, [s(55, 8), s(55, 8), s(55, 8)], "Trzecia odczuwalna"],
    ["lateral", 9, [s(9, 12), s(9, 12), s(9, 12)], "Ciężko, ledwo"],
    ["curl_bb", 17.5, [s(17.5, 12), s(17.5, 10)]],
    ["crunch", 40, [s(40, 15), s(37.5, 15), s(37.5, 12)], "40 kg za ciężko — zmniejszenie na 37,5"],
  ]),
  sesja("hist-w2-wed", "wed", "2026-07-08", [
    ["squat", 60, [s(60, 8), s(60, 8), s(60, 8)], "Trzecia odczuwalna"],
    ["deadlift", 70, [s(70, 7), s(70, 7)], "Spoko, na luzie"],
    ["incline_db", 15, [s(15, 12), s(15, 12), s(15, 10)], "Ledwo"],
    ["lunges", 12.5, [s(12.5, 12), s(12.5, 12), s(12.5, 12)], "Na każdą nogę"],
    ["calf", 40, [s(40, 15), s(40, 15), s(40, 15)], "Piekło na końcu"],
    ["plank", 5, [s(5, 40), s(5, 40), s(5, 40), s(5, 40)], "Trzęsło w czwartej serii"],
  ]),
  sesja("hist-w2-fri", "fri", "2026-07-10", [
    ["ohp", 27.5, [s(27.5, 8), s(27.5, 8), s(27.5, 7)], "Ciężej w 2. i 3. serii"],
    ["pulldown", 40, [s(40, 10), s(40, 10), s(40, 10)], "Już czuć"],
    ["rdl", 15, [s(15, 10), s(15, 10), s(15, 10)], "Spoko"],
    ["bench_db", 15, [s(15, 12), s(15, 12), s(15, 9)], "Trzecia ciężko"],
    ["row_db", 17.5, [s(17.5, 12), s(17.5, 12)], "Lewa ręka słabsza pod koniec 2. serii"],
    ["french", 17.5, [s(17.5, 10), s(17.5, 10)], "Spoko"],
  ]),

  // ── Tydzień 3 ──────────────────────────────────────────────────────────
  sesja("hist-w3-mon", "mon", "2026-07-13", [
    ["bench_bb", 42.5, [s(42.5, 8), s(42.5, 8), s(42.5, 8)], "Ósme ledwo, ból nadgarstka"],
    ["hipthrust", 52.5, [s(52.5, 12), s(52.5, 12), s(52.5, 12)], "Weszło gładko"],
    ["row_bb", 57.5, [s(57.5, 8), s(57.5, 8), s(57.5, 8)], "Druga i trzecia ciężko"],
    ["lateral", 9, [s(9, 15), s(9, 15), s(9, 12)], "Brakło 3 w ostatniej"],
    ["curl_bb", 17.5, [s(17.5, 12), s(17.5, 12)], "Ostatnie powt. mega ciężko"],
    ["crunch", 37.5, [s(37.5, 15), s(37.5, 15), s(37.5, 13)], "Pod koniec ciężko"],
  ]),
  sesja("hist-w3-wed", "wed", "2026-07-15", [
    ["squat", 62.5, [s(62.5, 8), s(62.5, 8), s(62.5, 8)], "Druga i trzecia ciężko"],
    ["deadlift", 75, [s(75, 7), s(75, 7)], "Spoko"],
    ["incline_db", 16, [s(16, 12), s(16, 11), s(16, 9)], "Walka z powtórzeniami"],
    ["lunges", 16, [s(16, 10), s(14, 10), s(14, 10)], "16 kg zbyt ciężko — zejście na 14"],
    ["calf", 45, [s(45, 15), s(45, 15), s(45, 13)], "Brak siły z bólu"],
    ["plank", 5, [s(5, 40), s(5, 40), s(5, 40), s(5, 40)], "Trzęsło i bolało w ostatnich 10 s"],
  ]),
  sesja("hist-w3-fri", "fri", "2026-07-17", [
    ["ohp", 27.5, [s(27.5, 8), s(27.5, 6), s(27.5, 8)], "Druga ciężko"],
    ["pulldown", 52.5, [s(52.5, 10), s(52.5, 10), s(52.5, 8)], "Ostatnia seria niepełna, ręce bolały"],
    ["rdl", 22, [s(22, 12), s(22, 10), s(22, 11)], "Ból dłoni, w 3. serii hantle wypadły z rąk"],
    ["bench_db", 18, [s(18, 12), s(18, 12), s(18, 10)], "Dwie ostatnie ledwo, mniejsza stabilność w 3. serii"],
    ["row_db", 20, [s(20, 12), s(20, 8)], "Druga seria zbyt ciężka na 12"],
    ["french", 25, [s(25, 12), s(25, 10)], "25 kg, bo brakowało mniejszego ciężaru"],
  ]),

  // ── Tydzień 4 ──────────────────────────────────────────────────────────
  sesja("hist-w4-mon", "mon", "2026-07-20", [
    ["bench_bb", 42.5, [s(42.5, 8), s(42.5, 8), s(42.5, 8)], "Spoko, bez bólu nadgarstka"],
    ["hipthrust", 55, [s(55, 12), s(55, 12), s(55, 12)], "Bez uwag, gładko"],
    ["row_bb", 60, [s(60, 8), s(60, 8), s(60, 8)]],
    ["lateral", 9, [s(9, 15), s(9, 15), s(9, 10)], "Rest-pause w 2. serii (12+3), brak tchu"],
    ["curl_bb", 17.5, [s(17.5, 12), s(17.5, 11)], "Jednego zabrakło"],
    ["crunch", 37.5, [s(37.5, 15), s(37.5, 15), s(37.5, 12)], "Ciężko przez brak tchu"],
  ]),
  sesja("hist-w4-wed", "wed", "2026-07-22", [
    ["squat", 65, [s(65, 8), s(65, 8), s(65, 7)], "Ostatnia seria niedomknięta"],
    ["deadlift", 77.5, [s(77.5, 7), s(77.5, 7)], "Zrobione, ale odczuwalny ból pleców"],
    ["incline_db", 16, [s(16, 12), s(16, 10), s(16, 8)], "Gorszy dzień — brak snu/jedzenia"],
    ["lunges", 14, [s(14, 12), s(14, 10), s(14, 10)]],
    ["calf", 45, [s(45, 15), s(45, 15), s(45, 13)], "Piecze mega"],
    ["plank", 5, [s(5, 40), s(5, 40), s(5, 40), s(5, 40)], "Poszło spoko"],
  ]),
  sesja("hist-w4-fri", "fri", "2026-07-24", [
    ["ohp", 30, [s(30, 8), s(30, 8), s(30, 8)], "Zrobione"],
    ["pulldown", 50, [s(50, 10), s(50, 10), s(50, 9)], "Brakło 1 powt."],
    ["rdl", 20, [s(20, 12), s(20, 12), s(20, 12)], "Ciężko utrzymać w dłoniach na końcu"],
    ["bench_db", 15, [s(15, 12), s(15, 12), s(15, 12)], "Zejście na 15 kg dla stabilizacji nadgarstków, 100%"],
    ["row_db", 20, [s(20, 12), s(20, 10)], "Lewa ręka nadal limituje"],
    ["french", 22.5, [s(22.5, 12), s(22.5, 10)], "Spoko"],
  ]),
];
