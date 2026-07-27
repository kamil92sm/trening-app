// Testy silnika — czysta logika, bez przeglądarki.
// Uruchamianie: npm test  (esbuild -> node)
import {
  computeProgression,
  setVolume,
  e1rm,
  platePlan,
  weeklyMuscleVolume,
  actualWeeklyMuscleVolume,
  actualVolumeWindow,
  muscleRangesFor,
  lastEntry,
  personalBests,
  isSetRecord,
  detectPlateau,
  achievableWeights,
  nearestAchievable,
  snapToStep,
  suggestedWeightForProfile,
  warmupPlan,
  sessionDuration,
  nextDaySuggestion,
  weeklyAdherence,
  strengthRatios,
  suggestBonusExercises,
  projectHistory,
  exerciseForMode,
  weightForReps,
  hyperTargetFor,
  targetForMode,
  deloadTargetFor,
  weeksSinceDeload,
  type HistoryPoint,
} from "../src/lib/logic";
import {
  defaultState,
  SEED_EXERCISES,
  SEED_DAYS,
  SEED_TARGETS,
  migrateState,
  computeRestoredDayPlan,
  mergeExerciseLibrary,
  SCHEMA_VERSION,
} from "../src/lib/seed";
import type { Session } from "../src/lib/types";
import { validateBackup } from "../src/lib/validate";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  OK  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
}

const bench = SEED_EXERCISES.find((e) => e.id === "bench_bb")!;
const lateral = SEED_EXERCISES.find((e) => e.id === "lateral")!;
const plank = SEED_EXERCISES.find((e) => e.id === "plank")!;

// Progresja
const up = computeProgression(bench, 45, [
  { weight: 45, reps: 8, done: true },
  { weight: 45, reps: 8, done: true },
  { weight: 45, reps: 8, done: true },
]);
check("3x8 na max -> +2.5 kg", up.status === "up" && up.nextWeight === 47.5, up);

const hold = computeProgression(bench, 45, [
  { weight: 45, reps: 8, done: true },
  { weight: 45, reps: 6, done: true },
  { weight: 45, reps: 6, done: true },
]);
check("8/6/6 -> hold", hold.status === "hold" && hold.nextWeight === 45, hold);

const deload = computeProgression(bench, 45, [
  { weight: 45, reps: 5, done: true },
  { weight: 45, reps: 4, done: true },
  { weight: 45, reps: 3, done: true },
]);
check("2x ponizej min -> deload", deload.status === "deload" && deload.nextWeight === 45, deload);

const plankUp = computeProgression(plank, 10, [
  { weight: 10, reps: 40, done: true },
  { weight: 10, reps: 40, done: true },
  { weight: 10, reps: 40, done: true },
  { weight: 10, reps: 40, done: true },
]);
check("plank 4x40s -> +5 kg", plankUp.status === "up" && plankUp.nextWeight === 15, plankUp);

// Tonaż i e1RM
check("hantle tonaz x2", setVolume(lateral, { weight: 9, reps: 12, done: true }) === 216);
check("sztanga tonaz x1", setVolume(bench, { weight: 45, reps: 8, done: true }) === 360);
check("niezaznaczona = 0", setVolume(bench, { weight: 45, reps: 8, done: false }) === 0);
check("hold = 0", setVolume(plank, { weight: 10, reps: 40, done: true }) === 0);
check("e1rm 100x10 = 133.3", Math.abs(e1rm(100, 10) - 133.333) < 0.01);
check("e1rm 1 powt = ciezar", e1rm(100, 1) === 100);

// Talerze
const p = platePlan(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
check("100 kg = 25+15 na strone", p.ok && p.perSide.join("+") === "25+15", p);
const p2 = platePlan(46, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
check("46 kg nieskladalne", !p2.ok && p2.leftover === 1, p2);

// Objętość
const st = defaultState();
const vols = weeklyMuscleVolume(st);
check("Klatka 9 serii (3 dni)", vols.find((v) => v.muscle === "Klatka")!.direct === 9);
const calf1 = vols.find((v) => v.muscle === "Łydki")!.sets;
st.days.find((d) => d.id === "bonus")!.active = true;
const calf2 = weeklyMuscleVolume(st).find((v) => v.muscle === "Łydki")!.sets;
check("bonus wlaczony zwieksza Łydki", calf2 > calf1, { calf1, calf2 });

// Migracja
const old = {
  version: 1,
  sessions: [{ id: "s1", dayId: "mon", date: "2026-07-01", entries: [], completed: true }],
  body: [{ date: "2026-07-01", weight: 80 }],
  squash: [{ id: "q1", date: "2026-07-02", minutes: 60, intensity: 4 }],
  settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
};
const mig = migrateState(old);
check("migracja: version aktualna", mig.version === SCHEMA_VERSION);
check(
  "migracja: sesja uzytkownika zachowana (+9 historycznych)",
  mig.sessions.some((s) => s.id === "s1") && mig.sessions.length === 10,
  mig.sessions.length
);
check("migracja: waga zachowana", mig.body.length === 1 && mig.body[0].weight === 80);
check("migracja: squash zachowany", mig.squash.length === 1);
check("migracja: settings zachowane", mig.settings.restSeconds === 90 && mig.settings.sound === false);

const cur = defaultState();
cur.targets["bench_bb"] = 50;
cur.sessions.push({ id: "x", dayId: "mon", date: "2026-07-20", entries: [], completed: true });
const same = migrateState(JSON.parse(JSON.stringify(cur)));
check("ta sama wersja: target uzytkownika zostaje", same.targets["bench_bb"] === 50);
// Brak flagi historySeeded -> dosiew historii; wpis "x" z 2026-07-20 (mon)
// blokuje hist-w4-mon z tego samego dnia, wiec 1 wlasna + 8 wstrzyknietych.
check(
  "ta sama wersja: sesja zostaje + dosiew historii z dedupem",
  same.sessions.some((s) => s.id === "x") && !same.sessions.some((s) => s.id === "hist-w4-mon") && same.sessions.length === 9,
  same.sessions.length
);

// P0-1: Dzień bonusowy 2.0 — ćwiczenia uzupełniające
const bonusDay = SEED_DAYS.find((d) => d.id === "bonus")!;
const bonusIds = ["face_pull", "hammer_curl", "pushdown", "calf_seated", "side_plank"];
check(
  "bonus 2.0: 5 nowych cwiczen uzupelniajacych",
  bonusDay.exerciseIds.length === 5 && bonusDay.exerciseIds.every((id) => bonusIds.includes(id)),
  bonusDay.exerciseIds
);
check(
  "bonus 2.0: stare cwiczenia usuniete z bonusu",
  !bonusDay.exerciseIds.some((id) => ["lateral", "curl_bb", "french", "calf", "crunch", "row_db"].includes(id)),
  bonusDay.exerciseIds
);

const st2 = defaultState();
const barkiOff = weeklyMuscleVolume(st2).find((v) => v.muscle === "Barki")!.sets;
st2.days.find((d) => d.id === "bonus")!.active = true;
const barkiOn = weeklyMuscleVolume(st2).find((v) => v.muscle === "Barki")!.sets;
check("bonus 2.0: objetosc Barki rosnie po wlaczeniu bonusu", barkiOn > barkiOff, { barkiOff, barkiOn });

// P0-1: migracja v2 -> v3 zachowuje wypracowane targety dla znanych ID
const oldV2 = {
  version: 2,
  targets: { bench_bb: 50, squat: 70 },
  sessions: [{ id: "s1", dayId: "mon", date: "2026-07-01", entries: [], completed: true }],
  body: [],
  squash: [],
  settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
};
const migV3 = migrateState(oldV2);
check("migracja v2->v3: version aktualna", migV3.version === SCHEMA_VERSION, migV3.version);
check("migracja v2->v3: bench_bb target zachowany (50)", migV3.targets["bench_bb"] === 50, migV3.targets["bench_bb"]);
check("migracja v2->v3: squat target zachowany (70)", migV3.targets["squat"] === 70, migV3.targets["squat"]);
check(
  "migracja v2->v3: nowe cwiczenia bonusowe maja cel z seeda (brak w starych danych)",
  migV3.targets["face_pull"] === 20,
  migV3.targets["face_pull"]
);
check(
  "migracja v2->v3: sesja uzytkownika zachowana",
  migV3.sessions.some((s) => s.id === "s1"),
  migV3.sessions.length
);

// P0-4: "Ostatnio" w loggerze
const stLast = defaultState();
stLast.sessions.push(
  {
    id: "l1",
    dayId: "mon",
    date: "2026-07-14",
    completed: true,
    entries: [
      {
        exerciseId: "bench_bb",
        targetWeight: 45,
        sets: [
          { weight: 45, reps: 8, done: true },
          { weight: 45, reps: 7, done: true },
          { weight: 45, reps: 6, done: false },
        ],
      },
    ],
  },
  {
    id: "l2",
    dayId: "mon",
    date: "2026-07-21",
    completed: true,
    entries: [
      {
        exerciseId: "bench_bb",
        targetWeight: 47.5,
        sets: [
          { weight: 47.5, reps: 5, done: true },
          { weight: 47.5, reps: 4, done: true },
        ],
      },
    ],
  }
);
const last = lastEntry(stLast, "bench_bb");
check("lastEntry: najnowsza sesja wygrywa", last?.date === "2026-07-21", last);
check("lastEntry: pomija nieukonczone serie", last?.sets.length === 2, last);
check("lastEntry: brak historii -> null", lastEntry(defaultState(), "bench_bb") === null);

// P1-8: Rekord (PR) na zywo
const stPB = defaultState();
stPB.sessions.push(
  {
    id: "pb1",
    dayId: "mon",
    date: "2026-07-14",
    completed: true,
    entries: [
      {
        exerciseId: "bench_bb",
        targetWeight: 40,
        sets: [
          { weight: 50, reps: 5, done: false }, // niezaliczona - pomijana
          { weight: 40, reps: 8, done: true },
        ],
      },
    ],
  },
  {
    id: "pb2",
    dayId: "mon",
    date: "2026-07-21",
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 6, done: true }] }],
  },
  {
    id: "pb3",
    dayId: "mon",
    date: "2026-07-23",
    completed: false, // nieukonczona sesja - pomijana w calosci
    entries: [{ exerciseId: "bench_bb", targetWeight: 100, sets: [{ weight: 100, reps: 10, done: true }] }],
  }
);
const pb = personalBests(stPB, "bench_bb");
check("personalBests: pomija niezaliczone serie (max 45, nie 50)", pb.weight === 45, pb);
check("personalBests: pomija sesje nieukonczone (nie 100)", pb.weight === 45, pb);
check("personalBests: e1rm liczony z zaliczonych serii (45x6 -> 54)", Math.abs(pb.e1rm - 54) < 0.01, pb);
const pbExcl = personalBests(stPB, "bench_bb", "pb2");
check(
  "personalBests: excludeSessionId pomija wskazana sesje (zostaje tylko 40x8)",
  pbExcl.weight === 40 && Math.abs(pbExcl.e1rm - 40 * (1 + 8 / 30)) < 0.01,
  pbExcl
);
check("personalBests: brak historii -> same zera", (() => {
  const z = personalBests(defaultState(), "bench_bb");
  return z.weight === 0 && z.e1rm === 0 && z.holdSeconds === 0;
})());

const pbBest = { weight: 45, e1rm: 54, holdSeconds: 0 };
check(
  "isSetRecord: ciezszy ciezar -> weight (priorytet nad e1rm mimo ze oba pobite)",
  isSetRecord(bench, { weight: 47.5, reps: 5, done: true }, pbBest) === "weight"
);
check(
  "isSetRecord: ten sam ciezar, wiecej powtorzen (wyzszy e1rm) -> e1rm",
  isSetRecord(bench, { weight: 45, reps: 10, done: true }, pbBest) === "e1rm"
);
check(
  "isSetRecord: nie bije ani ciezaru ani e1rm -> null",
  isSetRecord(bench, { weight: 40, reps: 5, done: true }, pbBest) === null
);
check(
  "isSetRecord: niezaliczona seria -> null",
  isSetRecord(bench, { weight: 100, reps: 10, done: false }, pbBest) === null
);
check(
  "isSetRecord: brak historii (best zerowy) -> null",
  isSetRecord(bench, { weight: 20, reps: 5, done: true }, { weight: 0, e1rm: 0, holdSeconds: 0 }) === null
);
const holdBest = { weight: 0, e1rm: 0, holdSeconds: 30 };
check(
  "isSetRecord: hold - wiecej sekund niz rekord -> hold",
  isSetRecord(plank, { weight: 10, reps: 35, done: true }, holdBest) === "hold"
);
check(
  "isSetRecord: hold - tyle samo sekund co rekord -> null",
  isSetRecord(plank, { weight: 10, reps: 30, done: true }, holdBest) === null
);
check(
  "isSetRecord: hold bez historii -> null",
  isSetRecord(plank, { weight: 10, reps: 40, done: true }, { weight: 0, e1rm: 0, holdSeconds: 0 }) === null
);

// P1-1: Plateau breaker
function sessionAt(date: string, weight: number, reps: number): Session {
  return {
    id: `p-${date}`,
    dayId: "mon",
    date,
    completed: true,
    entries: [
      {
        exerciseId: "bench_bb",
        targetWeight: weight,
        sets: [{ weight, reps, done: true }],
      },
    ],
  };
}

const stPlateau = defaultState();
stPlateau.sessions.push(
  sessionAt("2026-06-01", 45, 8),
  sessionAt("2026-06-08", 45, 8),
  sessionAt("2026-06-15", 45, 8)
);
check("detectPlateau: 3x ten sam wynik -> zastoj", detectPlateau(stPlateau, "bench_bb") === true);

const stProgress = defaultState();
stProgress.sessions.push(
  sessionAt("2026-06-01", 45, 6),
  sessionAt("2026-06-08", 45, 7),
  sessionAt("2026-06-15", 45, 8)
);
check("detectPlateau: rosnace powtorzenia -> brak zastoju", detectPlateau(stProgress, "bench_bb") === false);

const stFew = defaultState();
stFew.sessions.push(sessionAt("2026-06-01", 45, 8), sessionAt("2026-06-08", 45, 8));
check("detectPlateau: <3 treningi -> brak zastoju", detectPlateau(stFew, "bench_bb") === false);

// detectPlateau: plank (isHold, repMin==repMax) NIE jest zastojem, choc wynik staly
const stPlank = defaultState();
for (const d of ["2026-06-01", "2026-06-08", "2026-06-15"]) {
  stPlank.sessions.push({
    id: `pk-${d}`,
    dayId: "wed",
    date: d,
    completed: true,
    entries: [{ exerciseId: "plank", targetWeight: 5, sets: [{ weight: 5, reps: 40, done: true }] }],
  });
}
check("detectPlateau: plank (isHold) nie jest zastojem", detectPlateau(stPlank, "plank") === false);

// P1-2: obwod pasa - migracja zachowuje waist w body
const oldWithWaist = {
  version: 3,
  targets: {},
  sessions: [],
  body: [{ date: "2026-07-01", weight: 80, waist: 90 }],
  squash: [],
  settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
};
const migWaist = migrateState(oldWithWaist);
check("migracja v3->v4: version aktualna", migWaist.version === SCHEMA_VERSION, migWaist.version);
check("migracja v3->v4: waist zachowany", migWaist.body[0]?.waist === 90, migWaist.body[0]);

// Historia startowa: migracja v4 -> v5 wstrzykuje 9 sesji z tygodni 2-4
const oldV4 = {
  version: 4,
  targets: { bench_bb: 45 },
  sessions: [],
  body: [],
  squash: [],
  settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
};
const migV5 = migrateState(oldV4);
check("historia startowa: 9 sesji po migracji v4->v5", migV5.sessions.length === 9, migV5.sessions.length);
check(
  "historia startowa: sesje posortowane rosnaco po dacie",
  migV5.sessions.every((s, i, arr) => i === 0 || arr[i - 1].date.localeCompare(s.date) <= 0)
);
const w4fri = migV5.sessions.find((s) => s.id === "hist-w4-fri");
check(
  "historia startowa: OHP tydz.4 = 30 kg 3x8",
  w4fri?.entries.find((e) => e.exerciseId === "ohp")?.sets.every((x) => x.weight === 30 && x.reps === 8 && x.done) === true,
  w4fri?.entries.find((e) => e.exerciseId === "ohp")
);

// BUG-1: cele dogonione do progresji z historii (bez wyjatku dla martwego ciagu)
check(
  "BUG-1: cel row_bb dogoniony do 62,5 (60x8x8x8 trafilo gorny zakres)",
  migV5.targets["row_bb"] === 62.5,
  migV5.targets["row_bb"]
);
check(
  "BUG-1: cel deadlift dogoniony do 80 (77,5x7x7 bez wyjatku dla martwego)",
  migV5.targets["deadlift"] === 80,
  migV5.targets["deadlift"]
);
check(
  "BUG-1: cel bench_db NIE obnizony (zostaje 17,5 mimo ze czysta progresja dalaby 17)",
  migV5.targets["bench_db"] === 17.5,
  migV5.targets["bench_db"]
);
check("BUG-1: flaga historyTargetsSeeded ustawiona po dogonieniu", migV5.historyTargetsSeeded === true);

// Dedup: wlasny wpis uzytkownika z tego samego dnia blokuje wstrzykniecie duplikatu
const oldV4dup = {
  ...oldV4,
  sessions: [{ id: "moj", dayId: "mon", date: "2026-07-20T10:00:00", entries: [], completed: true }],
};
const migDup = migrateState(oldV4dup);
check(
  "historia startowa: dedup po dayId+dacie (1 wlasna + 8 wstrzyknietych)",
  migDup.sessions.length === 9 && migDup.sessions.some((s) => s.id === "moj") && !migDup.sessions.some((s) => s.id === "hist-w4-mon"),
  migDup.sessions.map((s) => s.id)
);

// Swiezy start v5 bez flagi (np. przypieta apka z osobnym localStorage) -> historia dolozona
const freshV5 = JSON.parse(JSON.stringify(defaultState()));
const migFresh = migrateState(freshV5);
check(
  "historia startowa: swiezy stan v5 bez flagi dostaje 9 sesji + flage",
  migFresh.sessions.length === 9 && migFresh.historySeeded === true,
  { sesje: migFresh.sessions.length, flaga: migFresh.historySeeded }
);

// Flaga ustawiona -> usuniecie sesji z historii jest trwale (brak ponownego dosiewu)
const afterDelete = JSON.parse(JSON.stringify(migFresh));
afterDelete.sessions = afterDelete.sessions.filter((s: { id: string }) => s.id !== "hist-w2-mon");
const migAfterDelete = migrateState(afterDelete);
check(
  "historia startowa: z flaga usunieta sesja NIE wraca",
  migAfterDelete.sessions.length === 8 && !migAfterDelete.sessions.some((s) => s.id === "hist-w2-mon"),
  migAfterDelete.sessions.length
);

// FEAT-1: profile silowni (inny sprzet na wyjezdzie)
check(
  "achievableWeights: gryf 20 + talerze [25,10] -> [20,40,70,90]",
  JSON.stringify(achievableWeights(20, [25, 10])) === JSON.stringify([20, 40, 70, 90]),
  achievableWeights(20, [25, 10])
);
check("nearestAchievable: 65 -> 70 (blizej niz 40)", nearestAchievable(65, 20, [25, 10]) === 70);
check("snapToStep: 17,5 krok 2 -> 18", snapToStep(17.5, 2) === 18);
check("snapToStep: krok 0 -> bez zmian", snapToStep(17.5, 0) === 17.5);

const altGym = { id: "alt", name: "Inna silownia", barWeight: 20, plates: [20, 15, 10, 5], weightStep: 2 };
check(
  "suggestedWeightForProfile: sztanga -> najblizszy osiagalny z talerzy profilu (47,5 -> 50)",
  suggestedWeightForProfile(bench, 47.5, altGym) === 50,
  suggestedWeightForProfile(bench, 47.5, altGym)
);
check(
  "suggestedWeightForProfile: hantle -> krok profilu (9 kg krok 2 -> 10)",
  suggestedWeightForProfile(lateral, 9, altGym) === 10,
  suggestedWeightForProfile(lateral, 9, altGym)
);
check(
  "suggestedWeightForProfile: brak aktywnego profilu -> null",
  suggestedWeightForProfile(bench, 45, null) === null
);
check(
  "suggestedWeightForProfile: cel juz osiagalny -> null (brak sugestii)",
  suggestedWeightForProfile(bench, 40, altGym) === null,
  suggestedWeightForProfile(bench, 40, altGym)
);

// P1-9: serie rozgrzewkowe (ramp-up)
const homePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
const warmup100 = warmupPlan(bench, 100, 20, homePlates);
check(
  "warmupPlan: monotonicznie rosnacy",
  warmup100.every((s, i) => i === 0 || s.weight > warmup100[i - 1].weight),
  warmup100
);
check("warmupPlan: ostatni krok < ciezar roboczy", warmup100[warmup100.length - 1].weight < 100, warmup100);
check(
  "warmupPlan: wszystkie ciezary osiagalne z talerzy (gryf 20)",
  warmup100.every((s) => achievableWeights(20, homePlates).includes(s.weight)),
  warmup100
);
check("warmupPlan: sam gryf (workWeight <= bar) -> []", warmupPlan(bench, 20, 20, homePlates).length === 0);
check("warmupPlan: cwiczenie nie-sztangowe -> []", warmupPlan(lateral, 20, 20, homePlates).length === 0);
check("warmupPlan: isHold -> []", warmupPlan(plank, 40, 20, homePlates).length === 0);
const warmup30 = warmupPlan(bench, 30, 20, homePlates);
check(
  "warmupPlan: lekki ciezar (30 kg) - brak duplikatow wag",
  new Set(warmup30.map((s) => s.weight)).size === warmup30.length,
  warmup30
);

// P1-10: czas trwania treningu
function mkSessionAt(date: string, finishedAt?: string): Session {
  return { id: "dur", dayId: "mon", date, completed: true, entries: [], finishedAt };
}
check(
  "sessionDuration: liczy minuty (58 min)",
  sessionDuration(mkSessionAt("2026-07-26T10:00:00.000Z", "2026-07-26T10:58:00.000Z")) === 58
);
check(
  "sessionDuration: brak finishedAt -> null",
  sessionDuration(mkSessionAt("2026-07-26T10:00:00.000Z")) === null
);
check(
  "sessionDuration: 5h -> null (za dlugo, apka zostawiona otwarta)",
  sessionDuration(mkSessionAt("2026-07-26T10:00:00.000Z", "2026-07-26T15:00:00.000Z")) === null
);
check(
  "sessionDuration: finishedAt przed date -> null",
  sessionDuration(mkSessionAt("2026-07-26T10:00:00.000Z", "2026-07-26T09:00:00.000Z")) === null
);

// P2-10: podpowiedz nastepnego dnia w rotacji
check("nextDaySuggestion: brak historii -> pierwszy dzien (mon)", nextDaySuggestion(defaultState()) === "mon");
const stRotMon = defaultState();
stRotMon.sessions.push({ id: "r1", dayId: "mon", date: "2026-07-20", completed: true, entries: [] });
check("nextDaySuggestion: po mon -> wed", nextDaySuggestion(stRotMon) === "wed");
const stRotFri = defaultState();
stRotFri.sessions.push({ id: "r1", dayId: "fri", date: "2026-07-24", completed: true, entries: [] });
check("nextDaySuggestion: po fri -> mon (zawijanie)", nextDaySuggestion(stRotFri) === "mon");
const stRotBonus = defaultState();
stRotBonus.sessions.push(
  { id: "r1", dayId: "mon", date: "2026-07-20", completed: true, entries: [] },
  { id: "r2", dayId: "bonus", date: "2026-07-22", completed: true, entries: [] }
);
check(
  "nextDaySuggestion: sesja bonusowa (pozniejsza) nie resetuje rotacji -> nadal wed",
  nextDaySuggestion(stRotBonus) === "wed",
  nextDaySuggestion(stRotBonus)
);

// P2-11: kalendarz konsekwencji (8 tygodni)
const stAdh = defaultState();
stAdh.sessions.push(
  { id: "a1", dayId: "mon", date: "2026-07-20", completed: true, entries: [] },
  { id: "a2", dayId: "wed", date: "2026-07-22", completed: true, entries: [] },
  { id: "a3", dayId: "fri", date: "2026-07-24", completed: true, entries: [] },
  { id: "a4", dayId: "bonus", date: "2026-07-08", completed: true, entries: [] }
);
const adherence = weeklyAdherence(stAdh, 8, "2026-07-26");
check("weeklyAdherence: okno = dokladnie 8 tygodni", adherence.length === 8, adherence.length);
check(
  "weeklyAdherence: ostatni element = tydzien zawierajacy nowIso",
  adherence[adherence.length - 1].week === "2026-07-20",
  adherence[adherence.length - 1]
);
const fullWeek = adherence.find((w) => w.week === "2026-07-20")!;
check(
  "weeklyAdherence: tydzien z 3/3 sesji -> done === planned",
  fullWeek.done === 3 && fullWeek.planned === 3,
  fullWeek
);
const bonusWeek = adherence.find((w) => w.week === "2026-07-06")!;
check(
  "weeklyAdherence: dzien bonusowy liczy sie do done, NIE podbija planned",
  bonusWeek.done === 1 && bonusWeek.planned === 3,
  bonusWeek
);
const emptyWeek = adherence.find((w) => w.week === "2026-06-29");
check("weeklyAdherence: pusty tydzien -> done 0", emptyWeek !== undefined && emptyWeek.done === 0, emptyWeek);

// P2-12: standardy silowe wzgledem masy ciala
check("strengthRatios: brak wpisu wagi -> pusty wynik", strengthRatios(defaultState()).length === 0);

const stRatiosBoundary = defaultState();
stRatiosBoundary.body.push({ date: "2026-07-20", weight: 80 });
stRatiosBoundary.sessions.push({
  id: "sr1",
  dayId: "mon",
  date: "2026-07-20",
  completed: true,
  entries: [{ exerciseId: "bench_bb", targetWeight: 80, sets: [{ weight: 80, reps: 1, done: true }] }],
});
const boundaryRatio = strengthRatios(stRatiosBoundary).find((r) => r.exId === "bench_bb")!;
check(
  "strengthRatios: e1RM dokladnie 1.0x masy -> srednizaawansowany (nie poczatkujacy)",
  boundaryRatio.level === "średniozaawansowany" && boundaryRatio.ratio === 1,
  boundaryRatio
);
check(
  "strengthRatios: cwiczenie bez historii (ohp) pominiete, nie w liscie",
  strengthRatios(stRatiosBoundary).find((r) => r.exId === "ohp") === undefined
);

// e1RM = MAKSIMUM z calej historii, nie tylko najnowsza sesja
const stRatiosMax = defaultState();
stRatiosMax.body.push({ date: "2026-07-20", weight: 80 });
stRatiosMax.sessions.push(
  {
    id: "srA",
    dayId: "mon",
    date: "2026-07-06",
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 100, sets: [{ weight: 100, reps: 1, done: true }] }],
  },
  {
    id: "srB",
    dayId: "mon",
    date: "2026-07-20",
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 60, sets: [{ weight: 60, reps: 1, done: true }] }],
  }
);
const maxRatio = strengthRatios(stRatiosMax).find((r) => r.exId === "bench_bb")!;
check(
  "strengthRatios: bierze MAKSIMUM z historii (100/80=1.25 zaawansowany), nie ostatnia sesje (60/80=0.75)",
  maxRatio.ratio === 1.25 && maxRatio.level === "zaawansowany",
  maxRatio
);

// INFO-1a: druga metryka objetosci - faktycznie wykonane serie z ostatnich 7 dni
const stActual = defaultState();
stActual.sessions.push(
  {
    id: "a1",
    dayId: "mon",
    date: "2026-07-24",
    completed: true,
    entries: [
      {
        exerciseId: "bench_bb",
        targetWeight: 45,
        sets: [
          { weight: 45, reps: 8, done: true },
          { weight: 45, reps: 8, done: true },
          { weight: 45, reps: 8, done: true },
        ],
      },
    ],
  },
  {
    id: "a2",
    dayId: "mon",
    date: "2026-07-10",
    completed: true,
    entries: [
      { exerciseId: "bench_bb", targetWeight: 42.5, sets: [{ weight: 42.5, reps: 8, done: true }] },
    ],
  }
);
const actual = actualWeeklyMuscleVolume(stActual, "hypertrophy", "2026-07-26");
check(
  "actualWeeklyMuscleVolume: liczy tylko sesje z ostatnich 7 dni (poza-oknem pominieta)",
  actual.find((v) => v.muscle === "Klatka")!.sets === 3,
  actual.find((v) => v.muscle === "Klatka")
);
check(
  "actualWeeklyMuscleVolume: partia wspomagajaca liczy 0.5x (Triceps z bench_bb)",
  actual.find((v) => v.muscle === "Triceps")!.sets === 1.5,
  actual.find((v) => v.muscle === "Triceps")
);
check(
  "actualWeeklyMuscleVolume: brak logow w oknie -> 0 (Nogi)",
  actual.find((v) => v.muscle === "Nogi")!.sets === 0
);

// P3-3: sesja z niepelna liczba zaliczonych serii -> wykonane < plan dla tej partii
const stPartial = defaultState();
stPartial.sessions.push({
  id: "p1",
  dayId: "mon",
  date: "2026-07-24",
  completed: true,
  entries: [
    {
      exerciseId: "bench_bb",
      targetWeight: 45,
      sets: [
        { weight: 45, reps: 8, done: true },
        { weight: 45, reps: 8, done: true },
        { weight: 45, reps: 8, done: false }, // niezaliczona - nie liczy sie
      ],
    },
  ],
});
const partialActual = actualWeeklyMuscleVolume(stPartial, "hypertrophy", "2026-07-26");
const partialPlanned = weeklyMuscleVolume(stPartial, "hypertrophy");
check(
  "P3-3: wykonane (2 serie) < plan (3 serie) dla Klatki",
  partialActual.find((v) => v.muscle === "Klatka")!.sets < partialPlanned.find((v) => v.muscle === "Klatka")!.sets,
  partialActual.find((v) => v.muscle === "Klatka")
);

// P3-3: sesja spoza okna (8 dni wstecz od nowIso) - juz pokryte przez "poza-oknem
// pominieta" wyzej (a2, 2026-07-10 vs nowIso 2026-07-26), dodatkowy test na granicy:
const stEdge = defaultState();
stEdge.sessions.push({
  id: "edge1",
  dayId: "mon",
  date: "2026-07-18", // 8 dni przed 2026-07-26 -> poza oknem (okno: 20-26 lipca)
  completed: true,
  entries: [
    { exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] },
  ],
});
const edgeActual = actualWeeklyMuscleVolume(stEdge, "hypertrophy", "2026-07-26");
check(
  "P3-3: sesja 8 dni wstecz jest POZA oknem 7 dni",
  edgeActual.find((v) => v.muscle === "Klatka")!.sets === 0,
  edgeActual.find((v) => v.muscle === "Klatka")
);

// P3-3: actualVolumeWindow na historii startowej (migrateState dosiewa 3 tyg. historii)
const stHistory = migrateState(defaultState());
const window = actualVolumeWindow(stHistory, "2026-07-26");
check(
  "actualVolumeWindow: historia startowa, nowIso=2026-07-26 -> 3 sesje, okno 20-26 lipca",
  window.sessions === 3 && window.fromIso === "2026-07-20" && window.toIso === "2026-07-26",
  window
);
const windowEmpty = actualVolumeWindow(defaultState(), "2026-07-26");
check(
  "actualVolumeWindow: brak sesji -> 0",
  windowEmpty.sessions === 0 && windowEmpty.fromIso === "2026-07-20" && windowEmpty.toIso === "2026-07-26",
  windowEmpty
);

// INFO-1b: cel objetosci (sila/hipertrofia) zmienia progi statusu
const volHiper = weeklyMuscleVolume(defaultState(), "hypertrophy").find((v) => v.muscle === "Klatka")!;
check("weeklyMuscleVolume: Klatka 9 serii + cel hipertrofia -> low", volHiper.status === "low", volHiper);
const volSila = weeklyMuscleVolume(defaultState(), "strength").find((v) => v.muscle === "Klatka")!;
check("weeklyMuscleVolume: Klatka 9 serii + cel sila -> ok", volSila.status === "ok", volSila);

// P1-5: reczne nadpisanie zakresow (muscleRangesFor + weeklyMuscleVolume)
const rangesDefault = muscleRangesFor("hypertrophy");
check("muscleRangesFor: bez overrides -> zakres domyslny", rangesDefault.Klatka.min === 10, rangesDefault.Klatka);
const rangesOverride = muscleRangesFor("hypertrophy", { Klatka: { min: 5, max: 9 } });
check(
  "muscleRangesFor: override zmienia tylko wskazana partie",
  rangesOverride.Klatka.min === 5 && rangesOverride.Klatka.max === 9 && rangesOverride.Plecy.min === 10,
  rangesOverride
);
const stRangeOverride = defaultState();
stRangeOverride.settings.muscleRanges = { Klatka: { min: 5, max: 9 } };
const volOverride = weeklyMuscleVolume(stRangeOverride, "hypertrophy").find((v) => v.muscle === "Klatka")!;
check(
  "weeklyMuscleVolume: override obniza prog -> Klatka 9 serii -> ok (zamiast low)",
  volOverride.status === "ok",
  volOverride
);

// P2-7: sugestia bonusu pod deficyt objetosci (actualWeeklyMuscleVolume, nie plan)
const stBonus = defaultState();
stBonus.sessions.push({
  id: "bonus-week",
  dayId: "mon",
  date: "2026-07-24",
  completed: true,
  entries: [
    { exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }, { weight: 45, reps: 8, done: true }, { weight: 45, reps: 8, done: true }] },
    { exerciseId: "row_bb", targetWeight: 60, sets: [{ weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }] },
    { exerciseId: "lateral", targetWeight: 9, sets: [{ weight: 9, reps: 12, done: true }, { weight: 9, reps: 12, done: true }, { weight: 9, reps: 12, done: true }] },
    { exerciseId: "squat", targetWeight: 65, sets: [{ weight: 65, reps: 8, done: true }, { weight: 65, reps: 8, done: true }, { weight: 65, reps: 8, done: true }] },
    { exerciseId: "hipthrust", targetWeight: 57.5, sets: [{ weight: 57.5, reps: 12, done: true }, { weight: 57.5, reps: 12, done: true }, { weight: 57.5, reps: 12, done: true }] },
    { exerciseId: "deadlift", targetWeight: 77.5, sets: [{ weight: 77.5, reps: 6, done: true }, { weight: 77.5, reps: 6, done: true }, { weight: 77.5, reps: 6, done: true }] },
    { exerciseId: "curl_bb", targetWeight: 17.5, sets: [{ weight: 17.5, reps: 12, done: true }, { weight: 17.5, reps: 12, done: true }, { weight: 17.5, reps: 12, done: true }] },
    { exerciseId: "french", targetWeight: 22.5, sets: [{ weight: 22.5, reps: 12, done: true }, { weight: 22.5, reps: 12, done: true }, { weight: 22.5, reps: 12, done: true }] },
    { exerciseId: "crunch", targetWeight: 37.5, sets: [{ weight: 37.5, reps: 15, done: true }, { weight: 37.5, reps: 15, done: true }, { weight: 37.5, reps: 15, done: true }] },
  ],
  // Łydki celowo pominięte -> najwiekszy deficyt w tygodniu (0 serii)
});
const bonusPick = suggestBonusExercises(stBonus, 1, "2026-07-26");
check(
  "suggestBonusExercises: Łydki najwiekszy deficyt -> sugeruje cwiczenie na łydki",
  bonusPick.length === 1 && bonusPick[0].primaryMuscle === "Łydki",
  bonusPick
);
check(
  "suggestBonusExercises: nie dubluje cwiczenia juz obecnego w dniu głownym (calf, nie calf_seated)",
  bonusPick[0]?.id === "calf_seated",
  bonusPick
);
// P3-8: baza urosla do ~90 pozycji - pula poza dniami glownymi jest teraz duza
// (5 bonus 2.0 + 67 nowych), wiec count=10 dobija sie w calosci, bez dupli.
const bonusPool = suggestBonusExercises(stBonus, 10, "2026-07-26");
const mainIds = new Set(SEED_DAYS.filter((d) => !d.optional).flatMap((d) => d.exerciseIds));
check(
  "suggestBonusExercises: dobija do puli poza dniami głownymi, bez duplikatow (10 z rozszerzonej bazy)",
  bonusPool.length === 10 && new Set(bonusPool.map((e) => e.id)).size === 10,
  bonusPool.map((e) => e.id)
);
check(
  "suggestBonusExercises: zaden pick nie pochodzi z dnia głownego",
  bonusPool.every((e) => !mainIds.has(e.id)),
  bonusPool.map((e) => e.id)
);

// P3-8: ranking kandydatow w obrebie tej samej deficytowej partii - historia
// Kamila (lateral_cable) wygrywa z cwiczeniem nigdy niewykonanym (arnold_press).
const stRank = defaultState();
stRank.sessions.push({
  id: "rank-week",
  dayId: "mon",
  date: "2026-07-24",
  completed: true,
  entries: [
    { exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }, { weight: 45, reps: 8, done: true }, { weight: 45, reps: 8, done: true }] },
    { exerciseId: "row_bb", targetWeight: 60, sets: [{ weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }] },
    { exerciseId: "curl_bb", targetWeight: 17.5, sets: [{ weight: 17.5, reps: 12, done: true }, { weight: 17.5, reps: 12, done: true }] },
    { exerciseId: "crunch", targetWeight: 37.5, sets: [{ weight: 37.5, reps: 15, done: true }, { weight: 37.5, reps: 15, done: true }, { weight: 37.5, reps: 15, done: true }] },
    // "lateral" (dzien glowny, Barki) celowo pominiete -> deficyt na Barki;
    // "lateral_cable" (spoza planu, tez Barki) zalogowane -> jest juz w historii.
    { exerciseId: "lateral_cable", targetWeight: 7.5, sets: [{ weight: 7.5, reps: 15, done: true }, { weight: 7.5, reps: 15, done: true }, { weight: 7.5, reps: 15, done: true }] },
  ],
});
// count=30 (nie 1) - w tym scenariuszu prawie kazda partia jest deficytowa
// (zalogowano tylko 5 cwiczen), wiec przy count=1 wygralby inny, wiekszy
// deficyt niz Barki, a przy count=10 (jeden pick/partie) arnold_press
// jeszcze by sie nie pojawil. Sprawdzamy KOLEJNOSC w wyniku: lateral_cable
// (historia) przed arnold_press (nigdy niewykonane) dla tej samej partii (Barki).
const rankPick = suggestBonusExercises(stRank, 30, "2026-07-26");
const lateralCableIdx = rankPick.findIndex((e) => e.id === "lateral_cable");
const arnoldPressIdx = rankPick.findIndex((e) => e.id === "arnold_press");
check(
  "suggestBonusExercises: ranking - cwiczenie z historii (lateral_cable) wygrywa z nigdy niewykonanym (arnold_press) dla tej samej partii",
  lateralCableIdx !== -1 && arnoldPressIdx !== -1 && lateralCableIdx < arnoldPressIdx,
  rankPick.map((e) => e.id)
);

// FEAT-2: projekcja trendu na wykresie postepu
const trendHistory: HistoryPoint[] = [
  { date: "2026-07-06", e1rm: 100, topWeight: 90, topReps: 5 },
  { date: "2026-07-13", e1rm: 105, topWeight: 95, topReps: 5 },
  { date: "2026-07-20", e1rm: 110, topWeight: 100, topReps: 5 },
];
const proj = projectHistory(trendHistory, 3);
check("projectHistory: 3 punkty projekcji", proj.length === 3, proj);
check(
  "projectHistory: ekstrapoluje trend +5/tydzien",
  proj[0].e1rm === 115 && proj[1].e1rm === 120 && proj[2].e1rm === 125,
  proj
);
check(
  "projectHistory: odstep = sredni odstep historii (7 dni)",
  proj[0].date.slice(0, 10) === "2026-07-27",
  proj[0].date
);
check("projectHistory: <2 punkty historii -> brak projekcji", projectHistory([trendHistory[0]], 3).length === 0);

// P0-5: tryb treningu Sila/Hipertrofia
const deadliftEx = SEED_EXERCISES.find((e) => e.id === "deadlift")!;
const hipthrust = SEED_EXERCISES.find((e) => e.id === "hipthrust")!;

const benchHyper = exerciseForMode(bench, "hypertrophy");
check(
  "exerciseForMode: bench 5-8 RIR2 -> 8-12 RIR1 (hipertrofia)",
  benchHyper.repMin === 8 && benchHyper.repMax === 12 && benchHyper.rir === 1,
  benchHyper
);
const deadliftHyper = exerciseForMode(deadliftEx, "hypertrophy");
check(
  "exerciseForMode: deadlift -> wyjatek 6-8 RIR2 (bezpieczenstwo pleców)",
  deadliftHyper.repMin === 6 && deadliftHyper.repMax === 8 && deadliftHyper.rir === 2,
  deadliftHyper
);
const lateralHyper = exerciseForMode(lateral, "hypertrophy");
check(
  "exerciseForMode: lateral 12-15 -> zakres bez zmian + RIR1",
  lateralHyper.repMin === 12 && lateralHyper.repMax === 15 && lateralHyper.rir === 1,
  lateralHyper
);
const plankHyper = exerciseForMode(plank, "hypertrophy");
check(
  "exerciseForMode: plank (isHold) -> identyczny w hipertrofii",
  plankHyper.repMin === plank.repMin && plankHyper.repMax === plank.repMax && plankHyper.rir === plank.rir,
  plankHyper
);
check("exerciseForMode: mode sila -> identyczny (ta sama referencja)", exerciseForMode(bench, "strength") === bench);

check(
  "weightForReps: e1=130, 8 powt., RIR1 -> 100 kg",
  Math.abs(weightForReps(130, 8, 1) - 100) < 1e-9,
  weightForReps(130, 8, 1)
);

const stHyperA = defaultState();
stHyperA.sessions.push({
  id: "h1",
  dayId: "mon",
  date: "2026-07-20",
  completed: true,
  entries: [{ exerciseId: "bench_bb", targetWeight: 100, sets: [{ weight: 100, reps: 8, done: true }] }],
});
const hyperA = hyperTargetFor(stHyperA, bench);
check(
  "hyperTargetFor: z historii (100x8 -> e1 126,7 -> ~97,5 przy inc 2,5)",
  Math.abs(hyperA - 97.5) < 1e-9,
  hyperA
);

const stHyperB = defaultState();
const hyperB = hyperTargetFor(stHyperB, bench);
check(
  "hyperTargetFor: fallback bez historii (target 45 -> ~42,5)",
  Math.abs(hyperB - 42.5) < 1e-9,
  hyperB
);

const stHyperC = defaultState();
stHyperC.hyperTargets = { bench_bb: 99 };
check("hyperTargetFor: hyperTargets ma pierwszenstwo", hyperTargetFor(stHyperC, bench) === 99);

const stHyperD = defaultState();
check(
  "hyperTargetFor: cwiczenie juz 8-12 -> cel == targets (bez konwersji)",
  hyperTargetFor(stHyperD, hipthrust) === stHyperD.targets["hipthrust"],
  hyperTargetFor(stHyperD, hipthrust)
);

check(
  "targetForMode: sila -> targets[id]",
  targetForMode(defaultState(), bench, "strength") === defaultState().targets["bench_bb"]
);
check(
  "targetForMode: hipertrofia -> hyperTargetFor",
  Math.abs(targetForMode(stHyperB, bench, "hypertrophy") - 42.5) < 1e-9
);

// P2-8: tryb DELOAD
const benchDeload = exerciseForMode(bench, "deload");
check(
  "exerciseForMode: deload nie rusza zakresu, RIR +2",
  benchDeload.repMin === bench.repMin && benchDeload.repMax === bench.repMax && benchDeload.rir === bench.rir + 2,
  benchDeload
);
const plankDeload = exerciseForMode(plank, "deload");
check(
  "exerciseForMode: deload dziala tez dla isHold (zakres/sekundy bez zmian, RIR +2)",
  plankDeload.repMin === plank.repMin && plankDeload.repMax === plank.repMax && plankDeload.rir === plank.rir + 2,
  plankDeload
);
check(
  "deloadTargetFor: 65% celu silowego zaokraglone do increment (45 -> 30)",
  deloadTargetFor(defaultState(), bench) === 30,
  deloadTargetFor(defaultState(), bench)
);
const stDeloadHyper = defaultState();
stDeloadHyper.hyperTargets = { bench_bb: 99 };
check(
  "deloadTargetFor: baza ZAWSZE targets (sila), nawet gdy jest hyperTargets",
  deloadTargetFor(stDeloadHyper, bench) === 30,
  deloadTargetFor(stDeloadHyper, bench)
);
check("targetForMode: deload -> deloadTargetFor", targetForMode(defaultState(), bench, "deload") === 30);

check("weeksSinceDeload: brak historii -> 0", weeksSinceDeload(defaultState()) === 0);
const stWeeksA = defaultState();
stWeeksA.sessions.push({ id: "w1", dayId: "mon", date: "2026-06-15", completed: true, entries: [] });
check(
  "weeksSinceDeload: brak sesji deload -> liczy od pierwszej sesji w historii (6 tygodni)",
  weeksSinceDeload(stWeeksA, "2026-07-27") === 6,
  weeksSinceDeload(stWeeksA, "2026-07-27")
);
const stWeeksB = defaultState();
stWeeksB.sessions.push(
  { id: "w1", dayId: "mon", date: "2026-06-15", completed: true, entries: [] },
  { id: "w2", dayId: "wed", date: "2026-07-13", completed: true, entries: [], mode: "deload" }
);
check(
  "weeksSinceDeload: liczy od OSTATNIEJ sesji deload, nie od pierwszej sesji w ogole (2 tygodnie)",
  weeksSinceDeload(stWeeksB, "2026-07-27") === 2,
  weeksSinceDeload(stWeeksB, "2026-07-27")
);

// P0-7: przywroc standardowy plan dnia
const stRestore = defaultState();
stRestore.exercises = stRestore.exercises.filter((e) => e.id !== "crunch");
stRestore.days = stRestore.days.map((d) =>
  d.id === "mon" ? { ...d, exerciseIds: d.exerciseIds.filter((id) => id !== "crunch") } : d
);
stRestore.targets["bench_bb"] = 55; // symuluje wypracowana progresje
const restored = computeRestoredDayPlan(stRestore, "mon");
check(
  "computeRestoredDayPlan: przywraca usuniete cwiczenie do exercises",
  restored.exercises.some((e) => e.id === "crunch")
);
check(
  "computeRestoredDayPlan: przywraca exerciseIds dnia (crunch z powrotem)",
  restored.days.find((d) => d.id === "mon")!.exerciseIds.includes("crunch")
);
check(
  "computeRestoredDayPlan: cel istniejacego bench_bb NIE wraca do seeda (zostaje 55)",
  restored.targets["bench_bb"] === 55,
  restored.targets["bench_bb"]
);
check(
  "computeRestoredDayPlan: przywrocone crunch dostaje cel z SEED_TARGETS",
  restored.targets["crunch"] === SEED_TARGETS["crunch"],
  restored.targets["crunch"]
);

const stArchived = defaultState();
stArchived.exercises = stArchived.exercises.map((e) => (e.id === "crunch" ? { ...e, archived: true } : e));
const restoredArchived = computeRestoredDayPlan(stArchived, "mon");
const crunchAfter = restoredArchived.exercises.filter((e) => e.id === "crunch");
check(
  "computeRestoredDayPlan: zarchiwizowane cwiczenie odarchiwizowane, nie zdublowane",
  crunchAfter.length === 1 && crunchAfter[0].archived === false,
  crunchAfter
);

const stNoSeedDay = defaultState();
const untouched = computeRestoredDayPlan(stNoSeedDay, "nieistniejacy-dzien");
check("computeRestoredDayPlan: dzien spoza seeda -> stan bez zmian", untouched === stNoSeedDay);

// P3-8: merge biblioteki cwiczen - user zmodyfikowal bench_bb (repMax 10) i ma
// wlasne cwiczenie ("moje_cw") spoza seeda -> oba zostaja, brakujace z seeda dochodza.
const userExercisesForMerge = SEED_EXERCISES.map((e) =>
  e.id === "bench_bb" ? { ...e, repMax: 10 } : e
).concat([
  {
    id: "moje_cw",
    name: "Moje cwiczenie",
    category: "Inne",
    unit: "machine",
    perHand: false,
    isHold: false,
    repMin: 8,
    repMax: 12,
    targetSets: 3,
    increment: 2.5,
    rir: 2,
  },
]);
// symulacja: user NIE ma jeszcze nowych P3-8 cwiczen (usuwamy je z jego listy)
const oldSeedIds = new Set(SEED_EXERCISES.map((e) => e.id));
const userWithoutNewLibrary = userExercisesForMerge.filter(
  (e) => e.id === "moje_cw" || oldSeedIds.has(e.id)
);
const mergedLibrary = mergeExerciseLibrary(userWithoutNewLibrary);
check(
  "mergeExerciseLibrary: wlasne cwiczenie uzytkownika zostaje",
  mergedLibrary.some((e) => e.id === "moje_cw")
);
check(
  "mergeExerciseLibrary: zmodyfikowany bench_bb (repMax 10) NIE wraca do seeda",
  mergedLibrary.find((e) => e.id === "bench_bb")?.repMax === 10
);
check(
  "mergeExerciseLibrary: nowe cwiczenia z seeda (P3-8) doszly",
  mergedLibrary.some((e) => e.id === "arnold_press") && mergedLibrary.some((e) => e.id === "leg_curl_lying")
);
check(
  "mergeExerciseLibrary: total = user + brakujace z seeda, bez duplikatow",
  mergedLibrary.length === SEED_EXERCISES.length + 1 &&
    new Set(mergedLibrary.map((e) => e.id)).size === mergedLibrary.length
);
const stMigrated = migrateState({
  version: SCHEMA_VERSION,
  exercises: userWithoutNewLibrary,
  days: SEED_DAYS,
  targets: SEED_TARGETS,
  sessions: [],
  body: [],
  squash: [],
  settings: {},
});
check(
  "migrateState: nowe cwiczenia P3-8 dostaly cel z SEED_TARGETS po migracji",
  stMigrated.targets.arnold_press === SEED_TARGETS.arnold_press
);
check(
  "migrateState: objetosc tygodniowa bez zmian (nowe cwiczenia poza aktywnymi dniami)",
  weeklyMuscleVolume(stMigrated, "hypertrophy").find((v) => v.muscle === "Klatka")!.sets ===
    weeklyMuscleVolume(defaultState(), "hypertrophy").find((v) => v.muscle === "Klatka")!.sets
);

// P1-11: walidacja pliku backupu
check("validateBackup: poprawny defaultState() -> null", validateBackup(defaultState()) === null);
check("validateBackup: {} -> komunikat", typeof validateBackup({}) === "string");
check("validateBackup: null -> komunikat", typeof validateBackup(null) === "string");
check(
  "validateBackup: obcy JSON z polem sessions ale bez exercises/settings -> komunikat",
  typeof validateBackup({ sessions: [] }) === "string"
);
const stBadSession = defaultState();
// @ts-expect-error - celowo niepoprawny ksztalt sesji (brak entries) do testu walidacji
stBadSession.sessions = [{ id: "x", dayId: "mon", date: "2026-01-01" }];
check("validateBackup: sesja bez entries -> komunikat", typeof validateBackup(stBadSession) === "string", validateBackup(stBadSession));
check(
  "validateBackup: cwiczenie bez id/name -> komunikat",
  typeof validateBackup({ ...defaultState(), exercises: [{ foo: "bar" }] }) === "string"
);

// P4-3: "0 kg" w widoku Wykonane rozroznione od "nic nie robiles" - holdSets/zeroLoadSets
const stHoldOnly = defaultState();
stHoldOnly.sessions.push({
  id: "hold1",
  dayId: "wed",
  date: "2026-07-24",
  completed: true,
  entries: [
    {
      exerciseId: "plank",
      targetWeight: 10,
      sets: [
        { weight: 10, reps: 40, done: true },
        { weight: 10, reps: 40, done: true },
      ],
    },
  ],
});
const holdActual = actualWeeklyMuscleVolume(stHoldOnly, "hypertrophy", "2026-07-26").find((v) => v.muscle === "Brzuch")!;
check(
  "P4-3: sama deska (isHold) -> tonnage 0, holdSets = zaliczone serie",
  holdActual.tonnage === 0 && holdActual.holdSets === 2 && holdActual.zeroLoadSets === 0,
  holdActual
);

const stZeroLoad = defaultState();
stZeroLoad.sessions.push({
  id: "zero1",
  dayId: "mon",
  date: "2026-07-24",
  completed: true,
  entries: [
    {
      exerciseId: "hanging_leg_raise",
      targetWeight: 0,
      sets: [
        { weight: 0, reps: 12, done: true },
        { weight: 0, reps: 12, done: true },
      ],
    },
  ],
});
const zeroActual = actualWeeklyMuscleVolume(stZeroLoad, "hypertrophy", "2026-07-26").find((v) => v.muscle === "Brzuch")!;
check(
  "P4-3: cwiczenie bodyweight z 0 kg -> tonnage 0, zeroLoadSets = zaliczone serie",
  zeroActual.tonnage === 0 && zeroActual.zeroLoadSets === 2 && zeroActual.holdSets === 0,
  zeroActual
);

const normalActual = actualWeeklyMuscleVolume(stActual, "hypertrophy", "2026-07-26").find((v) => v.muscle === "Klatka")!;
check(
  "P4-3: zwykle cwiczenie z tonazem -> holdSets i zeroLoadSets oba 0",
  normalActual.tonnage > 0 && normalActual.holdSets === 0 && normalActual.zeroLoadSets === 0,
  normalActual
);

const plankPlanned = weeklyMuscleVolume(defaultState(), "hypertrophy").find((v) => v.muscle === "Brzuch")!;
check(
  "P4-3: weeklyMuscleVolume (plan) - deska w srode dokladana do holdSets",
  plankPlanned.holdSets === 4,
  plankPlanned
);

console.log(failures === 0 ? "\nWSZYSTKIE TESTY OK" : `\n${failures} TESTOW PADLO`);
process.exit(failures === 0 ? 0 : 1);
