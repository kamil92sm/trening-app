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
  lastEntries,
  fmtLastEntries,
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
  deloadSets,
  DELOAD_LOAD_FACTOR,
  easyAtRirHigh,
  weeksSinceDeload,
  weeklyReport,
  weeklyReportDefaultExpanded,
  sessionsToCsv,
  mondayOf,
  failedAtRirZero,
  estimateGoalEta,
  mesocycleWeek,
  volumeProgressionSuggestions,
  plannedSets,
  exerciseForDay,
  prefillRepsForEntry,
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
import { serializeBackup } from "../src/lib/backup";
import { niceScale } from "../src/lib/scale";
import { GUIDES, guideFor } from "../src/lib/guide";
import {
  idleState,
  remainingMs,
  isRunning,
  isPaused,
  isFinished,
  isFreshlyFinished,
  startState,
  pauseState,
  resumeState,
  resetState,
  stopState,
  tick,
} from "../src/lib/rest-timer";

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

// Zadanie 1 (usuniecie animowanego ludzika): normalizeSettings usuwa
// historyczne settings.showExerciseAnim, nie rusza reszty ustawien.
{
  const settingsWithAnim = {
    name: "Kamil",
    barWeight: 20,
    plates: [25, 20],
    restSeconds: 90,
    sound: false,
    autoBackup: true,
    showExerciseAnim: false,
  };

  // Sciezka "aktualny schemat" (version === SCHEMA_VERSION).
  const rawCurrent = {
    version: SCHEMA_VERSION,
    exercises: SEED_EXERCISES,
    days: SEED_DAYS,
    targets: SEED_TARGETS,
    sessions: [],
    body: [],
    squash: [],
    settings: settingsWithAnim,
  };
  const migratedCurrent = migrateState(rawCurrent);
  check(
    "normalizeSettings: stary stan (aktualny schemat) z showExerciseAnim wczytuje sie bez bledu",
    migratedCurrent.settings.name === "Kamil"
  );
  check(
    "normalizeSettings: historyczne pole znika po migracji (aktualny schemat)",
    !("showExerciseAnim" in migratedCurrent.settings)
  );
  check(
    "normalizeSettings: pozostale ustawienia zachowane (aktualny schemat)",
    migratedCurrent.settings.sound === false &&
      migratedCurrent.settings.autoBackup === true &&
      migratedCurrent.settings.restSeconds === 90
  );

  // Sciezka "stara wersja" (version !== SCHEMA_VERSION).
  const rawOld = { version: 2, exercises: [], days: [], targets: {}, sessions: [], settings: settingsWithAnim };
  const migratedOld = migrateState(rawOld);
  check(
    "normalizeSettings: stary stan (stara wersja) z showExerciseAnim wczytuje sie bez bledu",
    migratedOld.settings.name === "Kamil"
  );
  check(
    "normalizeSettings: historyczne pole znika po migracji (stara wersja)",
    !("showExerciseAnim" in migratedOld.settings)
  );
  check(
    "normalizeSettings: pozostale ustawienia zachowane (stara wersja)",
    migratedOld.settings.sound === false && migratedOld.settings.autoBackup === true
  );

  // Idempotentnosc: kolejna migracja na juz-czystym stanie nic nie psuje.
  const migratedTwice = migrateState(migratedCurrent);
  check(
    "normalizeSettings: idempotentna - druga migracja nic nie zmienia",
    !("showExerciseAnim" in migratedTwice.settings) &&
      migratedTwice.settings.name === "Kamil" &&
      migratedTwice.settings.sound === false
  );
}

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

// Etap 4: lastEntries/fmtLastEntries - "Ostatnie" w uproszczonej karcie cwiczenia.
{
  const st3 = defaultState();
  st3.sessions.push(
    {
      id: "e1",
      dayId: "mon",
      date: "2026-07-07",
      completed: true,
      entries: [
        {
          exerciseId: "bench_bb",
          targetWeight: 60,
          sets: [
            { weight: 60, reps: 8, done: true },
            { weight: 60, reps: 7, done: true },
            { weight: 60, reps: 7, done: true },
          ],
        },
      ],
    },
    {
      id: "e2",
      dayId: "mon",
      date: "2026-07-14",
      completed: true,
      entries: [
        {
          exerciseId: "bench_bb",
          targetWeight: 60,
          sets: [
            { weight: 60, reps: 8, done: true },
            { weight: 60, reps: 8, done: true },
            { weight: 60, reps: 8, done: true },
          ],
        },
      ],
    },
    {
      id: "e3",
      dayId: "mon",
      date: "2026-07-21",
      completed: false, // nieukonczona sesja - MUSI byc pominieta
      entries: [{ exerciseId: "bench_bb", targetWeight: 62.5, sets: [{ weight: 62.5, reps: 8, done: true }] }],
    },
    {
      id: "e4",
      dayId: "mon",
      date: "2026-07-28",
      completed: true,
      entries: [
        {
          exerciseId: "bench_bb",
          targetWeight: 62.5,
          sets: [
            { weight: 62.5, reps: 8, done: true },
            { weight: 62.5, reps: 8, done: true },
            { weight: 62.5, reps: 7, done: true },
          ],
        },
      ],
    }
  );
  const three = lastEntries(st3, "bench_bb", 3);
  check("lastEntries: zwraca do 3, kolejnosc od najnowszej", three.map((e) => e.date).join(",") === "2026-07-28,2026-07-14,2026-07-07", three);
  check("lastEntries: pomija nieukonczona sesje (07-21)", !three.some((e) => e.date === "2026-07-21"), three);
  check("lastEntries: brak historii -> []", lastEntries(defaultState(), "bench_bb", 3).length === 0);
  check(
    "fmtLastEntries: format zwarty waga x powt/powt/powt, sesje oddzielone ' · '",
    fmtLastEntries(three, false) === "62,5×8/8/7 · 60×8/8/8 · 60×8/7/7",
    fmtLastEntries(three, false)
  );

  // Cwiczenie na czas (isHold, plank) - same sekundy, bez wagi.
  const stHold = defaultState();
  stHold.sessions.push({
    id: "h1",
    dayId: "wed",
    date: "2026-07-21",
    completed: true,
    entries: [
      {
        exerciseId: "plank",
        targetWeight: 10,
        sets: [
          { weight: 10, reps: 40, done: true },
          { weight: 10, reps: 38, done: true },
        ],
      },
    ],
  });
  const holdEntries = lastEntries(stHold, "plank", 3);
  check(
    "fmtLastEntries: isHold -> same sekundy, bez wagi",
    fmtLastEntries(holdEntries, true) === "40/38",
    fmtLastEntries(holdEntries, true)
  );

  // Hantle (perHand): weight w SetLog jest JUZ "na reke" - format nie mnozy.
  const stDb = defaultState();
  stDb.sessions.push({
    id: "d1",
    dayId: "fri",
    date: "2026-07-21",
    completed: true,
    entries: [
      {
        exerciseId: "bench_db",
        targetWeight: 17.5,
        sets: [
          { weight: 17.5, reps: 10, done: true },
          { weight: 17.5, reps: 9, done: true },
        ],
      },
    ],
  });
  const dbEntries = lastEntries(stDb, "bench_db", 3);
  check(
    "fmtLastEntries: hantle pokazuja wage NA REKE (bez mnozenia x2)",
    fmtLastEntries(dbEntries, false) === "17,5×10/9",
    fmtLastEntries(dbEntries, false)
  );
}

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

// P6-5: backfill restSeconds - mergeExerciseLibrary swiadomie NIE dolewa pol z
// seeda do istniejacych cwiczen usera, a restSeconds doszlo do seeda pozniej
// niz istniejace stany - te cwiczenia utkely bez niego na zawsze bez backfillu.
{
  const benchSeed = SEED_EXERCISES.find((e) => e.id === "bench_bb")!;
  const squatSeed = SEED_EXERCISES.find((e) => e.id === "squat")!;
  const { restSeconds: _benchRest, ...benchNoRest } = benchSeed;
  const { restSeconds: _squatRest, ...squatBase } = squatSeed;
  const customEx = { ...squatBase, id: "custom_ex_1", name: "Własne ćwiczenie" };

  const rawForBackfill = {
    version: SCHEMA_VERSION,
    exercises: [benchNoRest, { ...squatSeed, restSeconds: 999 }, customEx],
    days: SEED_DAYS,
    targets: SEED_TARGETS,
    sessions: [],
    body: [],
    squash: [],
    settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
  };
  const migBackfill = migrateState(rawForBackfill);
  check(
    "P6-5: backfill - cwiczenie z seeda BEZ wlasnego restSeconds dostaje wartosc z seeda",
    migBackfill.exercises.find((e) => e.id === "bench_bb")?.restSeconds === benchSeed.restSeconds,
    migBackfill.exercises.find((e) => e.id === "bench_bb")?.restSeconds
  );
  check(
    "P6-5: backfill - cwiczenie z seeda z WLASNA wartoscia restSeconds NIE nadpisane",
    migBackfill.exercises.find((e) => e.id === "squat")?.restSeconds === 999,
    migBackfill.exercises.find((e) => e.id === "squat")?.restSeconds
  );
  check(
    "P6-5: backfill - cwiczenie spoza seeda (wlasne uzytkownika) bez restSeconds - bez zmian",
    migBackfill.exercises.find((e) => e.id === "custom_ex_1")?.restSeconds === undefined
  );
  check("P6-5: flaga restSecondsBackfilled ustawiona po backfillu", migBackfill.restSecondsBackfilled === true);

  const rawAlreadyBackfilled = { ...rawForBackfill, restSecondsBackfilled: true };
  const migNoRebackfill = migrateState(rawAlreadyBackfilled);
  check(
    "P6-5: flaga restSecondsBackfilled=true -> backfill NIE uruchamia sie ponownie",
    migNoRebackfill.exercises.find((e) => e.id === "bench_bb")?.restSeconds === undefined
  );
}

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

// Zadanie 3: neutralne nazwy dni "Trening 1/2/3" zamiast Poniedzialek/Sroda/Piatek.
{
  const freshDays = defaultState().days;
  check(
    "SEED_DAYS/defaultState: swiezy stan ma nazwy Trening 1/2/3",
    freshDays.find((d) => d.id === "mon")!.name === "Trening 1" &&
      freshDays.find((d) => d.id === "wed")!.name === "Trening 2" &&
      freshDays.find((d) => d.id === "fri")!.name === "Trening 3",
    freshDays.map((d) => `${d.id}:${d.name}`)
  );
  check(
    "SEED_DAYS: dayId pozostaja mon/wed/fri/bonus (historia sie nie psuje)",
    freshDays.map((d) => d.id).join(",") === "mon,wed,fri,bonus",
    freshDays.map((d) => d.id)
  );

  // Stary stan (sprzed zmiany) - stare nazwy, wlasna sesja historyczna na dayId "mon".
  const oldRaw = {
    version: SCHEMA_VERSION,
    exercises: SEED_EXERCISES,
    days: [
      { id: "mon", name: "Poniedziałek", short: "Góra + Pośladki", accent: "#ef4444", exerciseIds: ["bench_bb", "hipthrust", "row_bb", "lateral", "curl_bb", "crunch"] },
      { id: "wed", name: "Środa", short: "Ciężki Dół + Klatka Skos", accent: "#3b82f6", exerciseIds: ["squat", "deadlift", "incline_db", "lunges", "calf", "plank"] },
      { id: "fri", name: "Piątek", short: "Góra II + Tył Ud", accent: "#eab308", exerciseIds: ["ohp", "pulldown", "rdl", "bench_db", "row_db", "french"] },
      { id: "bonus", name: "Bonus", short: "Uzupełnienie: tył barków, ramiona, łydki, core", accent: "#a855f7", optional: true, active: false, exerciseIds: ["face_pull", "hammer_curl", "pushdown", "calf_seated", "side_plank"] },
    ],
    targets: SEED_TARGETS,
    sessions: [{ id: "hist1", dayId: "mon", date: "2026-07-06", completed: true, entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }] }],
    body: [],
    squash: [],
    settings: { name: "Kamil", barWeight: 20, plates: [25], restSeconds: 90, sound: false },
  };
  const migratedOld = migrateState(oldRaw);
  const migMon = migratedOld.days.find((d) => d.id === "mon")!;
  const migWed = migratedOld.days.find((d) => d.id === "wed")!;
  const migFri = migratedOld.days.find((d) => d.id === "fri")!;
  check(
    "migracja: stary stan z Poniedzialek/Sroda/Piatek zostaje jednorazowo zaktualizowany",
    migMon.name === "Trening 1" && migWed.name === "Trening 2" && migFri.name === "Trening 3",
    { migMon, migWed, migFri }
  );
  check(
    "migracja: short/exerciseIds/accent NIE ruszone przy zmianie name",
    migMon.short === "Góra + Pośladki" &&
      migMon.exerciseIds.join(",") === "bench_bb,hipthrust,row_bb,lateral,curl_bb,crunch" &&
      migMon.accent === "#ef4444",
    migMon
  );
  check("migracja: flaga neutralDayLabelsSeeded ustawiona", migratedOld.neutralDayLabelsSeeded === true);
  check(
    "migracja: sesja historyczna nadal znajduje wlasciwy dzien (dayId mon niezmieniony)",
    migratedOld.sessions.some((s) => s.id === "hist1" && s.dayId === "mon"),
    migratedOld.sessions
  );

  // Druga migracja (flaga juz true) NIE nadpisuje reczne zmienionej nazwy.
  const customized = { ...migratedOld, days: migratedOld.days.map((d) => (d.id === "mon" ? { ...d, name: "Mój dzień push" } : d)) };
  const migratedTwice = migrateState(customized);
  check(
    "migracja: drugie uruchomienie NIE nadpisuje recznie zmienionej nazwy",
    migratedTwice.days.find((d) => d.id === "mon")!.name === "Mój dzień push",
    migratedTwice.days.find((d) => d.id === "mon")
  );

  // resetAll (symulowane) - defaultState + flagi jednorazowych dosiewow.
  const resetState = { ...defaultState(), historySeeded: true, historyTargetsSeeded: true, restSecondsBackfilled: true, neutralDayLabelsSeeded: true };
  check(
    "resetAll: swiezy stan ma nowe nazwy I ustawiona flage (bez ponownej migracji przy kolejnym wczytaniu)",
    resetState.days.find((d) => d.id === "mon")!.name === "Trening 1" && resetState.neutralDayLabelsSeeded === true,
    resetState.days.find((d) => d.id === "mon")
  );
}

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
  "weeklyAdherence: dzien bonusowy liczy sie osobno, NIE podbija done/planned",
  bonusWeek.done === 0 && bonusWeek.planned === 3 && bonusWeek.bonusDone === 1,
  bonusWeek
);
const emptyWeek = adherence.find((w) => w.week === "2026-06-29");
check(
  "weeklyAdherence: pusty tydzien -> done 0 i bonusDone 0",
  emptyWeek !== undefined && emptyWeek.done === 0 && emptyWeek.bonusDone === 0,
  emptyWeek
);

// Zadanie 4: powtórzenie tego samego dnia nie może udawać realizacji kolejnego
// treningu, a dwa bonusy nadal dają jedną fioletową kropkę.
const stAdhDuplicates = defaultState();
stAdhDuplicates.sessions.push(
  { id: "dup-main-1", dayId: "mon", date: "2026-07-20", completed: true, entries: [] },
  { id: "dup-main-2", dayId: "mon", date: "2026-07-21", completed: true, entries: [] },
  { id: "dup-bonus-1", dayId: "bonus", date: "2026-07-22", completed: true, entries: [] },
  { id: "dup-bonus-2", dayId: "bonus", date: "2026-07-23", completed: true, entries: [] }
);
const duplicateWeek = weeklyAdherence(stAdhDuplicates, 1, "2026-07-26")[0];
check(
  "weeklyAdherence: dwa razy ten sam glowny dzien liczy sie raz",
  duplicateWeek.done === 1 && duplicateWeek.planned === 3,
  duplicateWeek
);
check(
  "weeklyAdherence: dwa razy ten sam bonus daje jedna kropke",
  duplicateWeek.bonusDone === 1,
  duplicateWeek
);

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

// P5-2: przycinanie kropek projekcji do przyszlosci
const projFuture = projectHistory(trendHistory, 3, "2026-07-30"); // 10 dni po ostatniej sesji, odstep 7 dni
check(
  "projectHistory: wszystkie kropki >= now, pierwsza = ostatnia sesja + 14 dni (k=1 wypadl w przeszlosci)",
  projFuture.length === 3 &&
    projFuture.every((p) => new Date(p.date).getTime() >= new Date("2026-07-30").getTime()) &&
    projFuture[0].date.slice(0, 10) === "2026-08-03",
  projFuture
);
check(
  "projectHistory: e1rm pierwszej zwroconej kropki = last.e1rm + slope*2 (spojnosc k i daty)",
  projFuture[0].e1rm === 120,
  projFuture[0]
);
const projToday = projectHistory(trendHistory, 3, "2026-07-20"); // ostatnia sesja = "dzis"
check(
  "projectHistory: historia konczaca sie dzisiaj -> identycznie jak bez nowIso",
  JSON.stringify(projToday) === JSON.stringify(proj),
  projToday
);

// P4-9: cel + ETA z nachylenia regresji (ta sama co projectHistory)
const etaReachable = estimateGoalEta(trendHistory, 125);
check(
  "estimateGoalEta: trend +5/tydzien, cel 125 (ostatni 110) -> ~3 tygodnie",
  etaReachable.reachable && !etaReachable.alreadyReached && etaReachable.weeks === 3,
  etaReachable
);
check(
  "estimateGoalEta: ETA data = 3 tygodnie po ostatnim punkcie (2026-08-10)",
  etaReachable.etaIso !== null && etaReachable.etaIso.slice(0, 10) === "2026-08-10",
  etaReachable.etaIso
);

const etaAlready = estimateGoalEta(trendHistory, 105);
check(
  "estimateGoalEta: cel juz ponizej ostatniego wyniku -> alreadyReached",
  etaAlready.alreadyReached && etaAlready.reachable && etaAlready.weeks === 0 && etaAlready.etaIso === "2026-07-20",
  etaAlready
);

const flatHistory: HistoryPoint[] = [
  { date: "2026-07-06", e1rm: 100, topWeight: 90, topReps: 5 },
  { date: "2026-07-13", e1rm: 100, topWeight: 90, topReps: 5 },
  { date: "2026-07-20", e1rm: 100, topWeight: 90, topReps: 5 },
];
check(
  "estimateGoalEta: trend plaski -> nieosiagalny, bez zmyslonej daty",
  estimateGoalEta(flatHistory, 120).reachable === false && estimateGoalEta(flatHistory, 120).etaIso === null,
  estimateGoalEta(flatHistory, 120)
);

const decliningHistory: HistoryPoint[] = [
  { date: "2026-07-06", e1rm: 100, topWeight: 90, topReps: 5 },
  { date: "2026-07-13", e1rm: 95, topWeight: 85, topReps: 5 },
  { date: "2026-07-20", e1rm: 90, topWeight: 80, topReps: 5 },
];
check(
  "estimateGoalEta: trend spadkowy -> nieosiagalny",
  estimateGoalEta(decliningHistory, 120).reachable === false,
  estimateGoalEta(decliningHistory, 120)
);

check(
  "estimateGoalEta: <2 punkty historii -> nieosiagalny",
  estimateGoalEta([trendHistory[0]], 120).reachable === false
);

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
  "exerciseForMode: lateral 12-15 -> zakres bez zmian, izolacja o krok blizej granicy (1 -> 0)",
  lateralHyper.repMin === 12 && lateralHyper.repMax === 15 && lateralHyper.rir === 0,
  lateralHyper
);
// Hipertrofia to KROK od bazy tego cwiczenia, nie sztywne RIR 1: duze ruchy
// osiowe musza zachowac swoj margines (3 -> 2), inaczej przysiad schodzilby
// na serie po 12 powtorzen o wlos od upadku.
const squatEx = SEED_EXERCISES.find((e) => e.id === "squat")!;
const squatHyper = exerciseForMode(squatEx, "hypertrophy");
check(
  "exerciseForMode: przysiad zachowuje margines w hipertrofii (RIR 3 -> 2, zakres 8-12)",
  squatHyper.rir === 2 && squatHyper.repMin === 8 && squatHyper.repMax === 12,
  squatHyper
);
check(
  "exerciseForMode: compound bez zmian wzgledem poprzedniej reguly (bench 2 -> 1)",
  exerciseForMode(bench, "hypertrophy").rir === 1
);
check(
  "exerciseForMode: deload ma sufit RIR 4 (licznik w loggerze konczy sie na 3+)",
  exerciseForMode(squatEx, "deload").rir === 4 && exerciseForMode(bench, "deload").rir === 4,
  [exerciseForMode(squatEx, "deload").rir, exerciseForMode(bench, "deload").rir]
);
check(
  "exerciseForMode: deload izolacji nie przekracza sufitu (1 -> 3)",
  exerciseForMode(lateral, "deload").rir === 3
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
// Deload tnie OBJETOSC, nie intensywnosc: ~90% ciezaru (45 -> 40) i polowa serii.
check(
  "deloadTargetFor: 90% celu silowego zaokraglone do increment (45 -> 40)",
  deloadTargetFor(defaultState(), bench) === 40,
  deloadTargetFor(defaultState(), bench)
);
const stDeloadHyper = defaultState();
stDeloadHyper.hyperTargets = { bench_bb: 99 };
check(
  "deloadTargetFor: baza ZAWSZE targets (sila), nawet gdy jest hyperTargets",
  deloadTargetFor(stDeloadHyper, bench) === 40,
  deloadTargetFor(stDeloadHyper, bench)
);
check("targetForMode: deload -> deloadTargetFor", targetForMode(defaultState(), bench, "deload") === 40);
check("deloadSets: 3 serie -> 2", deloadSets(3) === 2);
check("deloadSets: 2 serie -> 1", deloadSets(2) === 1);
check("deloadSets: 4 serie -> 2 (-50%)", deloadSets(4) === 2);
check("deloadSets: nigdy ponizej 1", deloadSets(1) === 1);
check("DELOAD_LOAD_FACTOR: intensywnosc zostaje wysoko", DELOAD_LOAD_FACTOR === 0.9);
// Zaokraglenie W DOL: przy zgrubnym kroku zaokraglenie do najbliższego wracalo
// na 100% celu i tydzien deloadu wcale nie schodzil z ciezaru.
const stCoarse = defaultState();
stCoarse.targets = { ...stCoarse.targets, fly_cable: 10 };
const flyCable = SEED_EXERCISES.find((e) => e.id === "fly_cable")!;
check(
  "deloadTargetFor: cel 10 kg przy kroku 2,5 schodzi na 7,5 (nie zostaje na 10)",
  deloadTargetFor(stCoarse, flyCable) === 7.5,
  deloadTargetFor(stCoarse, flyCable)
);
{
  const stAll = migrateState(null);
  const overshoot = stAll.exercises.filter((e) => {
    const target = stAll.targets[e.id] ?? 0;
    return !e.isHold && target > 0 && deloadTargetFor(stAll, e) > target * DELOAD_LOAD_FACTOR + 1e-9;
  });
  check("deloadTargetFor: ZADNE cwiczenie nie przekracza 90% celu", overshoot.length === 0, overshoot.map((e) => e.name));
}
check(
  "deloadTargetFor: isHold zostawia obciazenie (deload robi polowa serii)",
  deloadTargetFor(defaultState(), plank) === (defaultState().targets.plank ?? 0),
  deloadTargetFor(defaultState(), plank)
);

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

// P4-5: progresja objetosci w mezocyklu
check("mesocycleWeek: sam start -> tydzien 1", mesocycleWeek("2026-06-15", "2026-06-15") === 1);
check(
  "mesocycleWeek: 14 dni pozniej -> tydzien 3",
  mesocycleWeek("2026-06-15", "2026-06-29") === 3,
  mesocycleWeek("2026-06-15", "2026-06-29")
);

const stVolOff = defaultState();
check(
  "volumeProgressionSuggestions: wylaczone (brak flagi) -> []",
  volumeProgressionSuggestions(stVolOff, "2026-06-29").length === 0
);

const stVolStrength = defaultState();
stVolStrength.settings.volumeProgression = true;
stVolStrength.settings.mesoStartIso = "2026-06-15";
stVolStrength.settings.trainingMode = "strength";
check(
  "volumeProgressionSuggestions: tryb sila (nie hipertrofia) -> []",
  volumeProgressionSuggestions(stVolStrength, "2026-06-29").length === 0
);

const stVolNoMeso = defaultState();
stVolNoMeso.settings.volumeProgression = true;
stVolNoMeso.settings.trainingMode = "hypertrophy";
check(
  "volumeProgressionSuggestions: brak mesoStartIso -> []",
  volumeProgressionSuggestions(stVolNoMeso, "2026-06-29").length === 0
);

const stVolWeek1 = defaultState();
stVolWeek1.settings.volumeProgression = true;
stVolWeek1.settings.trainingMode = "hypertrophy";
stVolWeek1.settings.mesoStartIso = "2026-06-15";
check(
  "volumeProgressionSuggestions: tydzien 1 (0 narosnietych tygodni) -> []",
  volumeProgressionSuggestions(stVolWeek1, "2026-06-15").length === 0
);

const stVolWeek3 = defaultState();
stVolWeek3.settings.volumeProgression = true;
stVolWeek3.settings.trainingMode = "hypertrophy";
stVolWeek3.settings.mesoStartIso = "2026-06-15";
const week3 = volumeProgressionSuggestions(stVolWeek3, "2026-06-29");
const chestWeek3 = week3.find((s) => s.muscle === "Klatka");
check(
  "volumeProgressionSuggestions: tydzien 3, Klatka 9 -> +2 (11 serii)",
  !!chestWeek3 && chestWeek3.proposedAdd === 2 && chestWeek3.newTotal === 11,
  chestWeek3
);

const stVolFar = defaultState();
stVolFar.settings.volumeProgression = true;
stVolFar.settings.trainingMode = "hypertrophy";
stVolFar.settings.mesoStartIso = "2026-06-15";
const farSuggestions = volumeProgressionSuggestions(stVolFar, "2027-06-15");
const chestFar = farSuggestions.find((s) => s.muscle === "Klatka");
check(
  "volumeProgressionSuggestions: nigdy powyzej max (Klatka max 20)",
  !!chestFar && chestFar.newTotal === 20 && chestFar.proposedAdd === 11,
  chestFar
);

const stVolInRange = defaultState();
stVolInRange.settings.volumeProgression = true;
stVolInRange.settings.trainingMode = "hypertrophy";
stVolInRange.settings.mesoStartIso = "2026-06-15";
stVolInRange.settings.muscleRanges = { Klatka: { min: 5, max: 20 } };
const inRangeSuggestions = volumeProgressionSuggestions(stVolInRange, "2026-06-29");
check(
  "volumeProgressionSuggestions: partia juz w zakresie -> znika z listy",
  !inRangeSuggestions.some((s) => s.muscle === "Klatka"),
  inRangeSuggestions
);

// P5-1: skala osi Y ("nice numbers")
const scale5562 = niceScale(55, 62.9);
check(
  "niceScale(55, 62.9): min<=55, max>=62.9, step z {1,2,2.5,5}x10^n, ticki wielokrotnosciami kroku",
  scale5562.min <= 55 &&
    scale5562.max >= 62.9 &&
    [1, 2, 2.5, 5].includes(scale5562.step) &&
    scale5562.ticks.every((t) => Math.abs(t / scale5562.step - Math.round(t / scale5562.step)) < 1e-6),
  scale5562
);

const scaleFlat = niceScale(50, 50);
const flatLabels = new Set(scaleFlat.ticks.map((t) => t.toFixed(scaleFlat.decimals)));
check(
  "niceScale(50, 50): plaska seria -> >=2 ticki, wszystkie podpisy rozne",
  scaleFlat.ticks.length >= 2 && flatLabels.size === scaleFlat.ticks.length,
  scaleFlat
);

const scaleZero = niceScale(0, 0);
check("niceScale(0, 0): nie wybucha, step > 0", scaleZero.step > 0, scaleZero);

const scaleNegPos = niceScale(-1.2, 0.8, 4, 0.5);
check(
  "niceScale(-1.2, 0.8): 0 wsrod tickow",
  scaleNegPos.ticks.some((t) => Math.abs(t) < 1e-9),
  scaleNegPos
);

const scaleNaN = niceScale(NaN, 5);
check("niceScale(NaN, 5): fallback, bez wyjatku", scaleNaN.step > 0 && scaleNaN.ticks.length >= 2, scaleNaN);

// Zadanie 1 (usuniecie animowanego ludzika): guideFor() dziala WYLACZNIE na
// tekscie - bez importu modulu animacji (ktory juz nie istnieje w repo).
// Kazdy bezposredni wpis w GUIDES ma tekst (>=3 kroki, >=2 bledy) i ZADNEGO
// pola pattern/loadOverride.
let guideCoverageOk = true;
let guideCoverageDetail = "";
for (const [exId, guide] of Object.entries(GUIDES)) {
  const ex = SEED_EXERCISES.find((e) => e.id === exId);
  if (!ex) {
    guideCoverageOk = false;
    guideCoverageDetail = `GUIDES ma wpis dla nieistniejacego cwiczenia ${exId}`;
    break;
  }
  const resolved = guideFor(ex);
  const noAnimFields = !("pattern" in (resolved ?? {})) && !("loadOverride" in (resolved ?? {}));
  if (!resolved || !noAnimFields || resolved.steps.length < 3 || resolved.mistakes.length < 2) {
    guideCoverageOk = false;
    guideCoverageDetail = `${exId}: resolved=${!!resolved} noAnimFields=${noAnimFields} steps=${resolved?.steps.length} mistakes=${resolved?.mistakes.length}`;
    break;
  }
}
check(
  "guideFor: kazdy wpis w GUIDES ma tekst (>=3 kroki, >=2 bledy) i bez pattern/loadOverride (ludzik usuniety)",
  guideCoverageOk,
  guideCoverageDetail
);

const syntheticChestExercise = {
  id: "__synthetic_chest__",
  name: "Testowe cwiczenie klatki",
  category: "Klatka" as const,
  unit: "machine" as const,
  perHand: false,
  isHold: false,
  repMin: 8,
  repMax: 12,
  targetSets: 3,
  increment: 2.5,
  rir: 2,
  primaryMuscle: "Klatka" as const,
  secondaryMuscles: [],
};
const fallbackGuide = guideFor(syntheticChestExercise);
check(
  "guideFor: cwiczenie spoza GUIDES z primaryMuscle Klatka -> fallback tekstowy",
  fallbackGuide !== null && fallbackGuide.steps.length >= 3,
  fallbackGuide
);

const noMuscleExercise = { ...syntheticChestExercise, id: "__synthetic_no_muscle__", primaryMuscle: undefined };
check(
  "guideFor: brak primaryMuscle i brak wpisu w GUIDES -> null (bez wyjatku)",
  guideFor(noMuscleExercise) === null
);

// Zadanie 2: bezposrednia instrukcja tekstowa dla wszystkich 90 cwiczen z seeda.
check("SEED_EXERCISES: liczba cwiczen wynosi 90", SEED_EXERCISES.length === 90, SEED_EXERCISES.length);

let allSeedHaveDirectGuide = true;
let missingDirectGuide = "";
for (const ex of SEED_EXERCISES) {
  const direct = GUIDES[ex.id];
  if (
    !direct ||
    direct.setup.length < 1 ||
    direct.steps.length < 3 ||
    direct.mistakes.length < 2 ||
    direct.setup.some((s) => !s.trim()) ||
    direct.steps.some((s) => !s.trim()) ||
    direct.mistakes.some((s) => !s.trim())
  ) {
    allSeedHaveDirectGuide = false;
    missingDirectGuide = `${ex.id} (${ex.name}): direct=${!!direct} setup=${direct?.setup.length} steps=${direct?.steps.length} mistakes=${direct?.mistakes.length}`;
    break;
  }
}
check(
  "GUIDES: kazde SEED_EXERCISES.id ma bezposredni wpis (setup>=1, steps>=3, mistakes>=2, bez pustego tekstu)",
  allSeedHaveDirectGuide,
  missingDirectGuide
);

// Zadne dwa rozne cwiczenia nie dostaja przez przypadek TEJ SAMEJ referencji
// obiektu (np. przez `const shared = {...}; a: shared, b: shared`).
const guideRefs = new Map<object, string[]>();
for (const [exId, guide] of Object.entries(GUIDES)) {
  const owners = guideRefs.get(guide) ?? [];
  owners.push(exId);
  guideRefs.set(guide, owners);
}
const sharedRefs = [...guideRefs.values()].filter((owners) => owners.length > 1);
check(
  "GUIDES: zadne dwa cwiczenia nie dziela tej samej referencji obiektu guide",
  sharedRefs.length === 0,
  sharedRefs
);

// Fallback (tylko cwiczenia uzytkownika spoza seeda) zalezy od kategorii,
// jednostki sprzetu i isHold - nie jeden ogolny tekst dla wszystkich.
const userBarbell = { ...syntheticChestExercise, id: "__u_barbell__", unit: "barbell" as const, category: "Nogi" as const, primaryMuscle: "Nogi" as const };
const userMachine = { ...syntheticChestExercise, id: "__u_machine__", unit: "machine" as const, category: "Plecy" as const, primaryMuscle: "Plecy" as const };
const userHold = { ...syntheticChestExercise, id: "__u_hold__", unit: "bodyweight" as const, isHold: true, category: "Brzuch" as const, primaryMuscle: "Brzuch" as const };
const gBarbell = guideFor(userBarbell)!;
const gMachine = guideFor(userMachine)!;
const gHold = guideFor(userHold)!;
check(
  "fallback: rozny sprzet (barbell vs machine) daje rozny tekst ustawienia",
  gBarbell.setup[0] !== gMachine.setup[0],
  { gBarbell, gMachine }
);
check(
  "fallback: rozna kategoria daje rozny cue w krokach",
  gBarbell.steps.join("|") !== gMachine.steps.join("|"),
  { gBarbell, gMachine }
);
check(
  "fallback: isHold dostaje instrukcje na czas (utrzymanie), nie klasyczne powtorzenie",
  gHold.steps.some((s) => s.toLowerCase().includes("czas") || s.toLowerCase().includes("utrzym")),
  gHold
);
check(
  "fallback: nie jest porada medyczna, ale przy bolu sugeruje przerwanie (nie przepychanie)",
  !!gBarbell.safety && gBarbell.safety.toLowerCase().includes("przerw"),
  gBarbell.safety
);

// Cwiczenie bez primaryMuscle/kategorii nietypowej nie wybucha (juz sprawdzone
// wyzej dla braku primaryMuscle - tu dodatkowo isHold + brak muscle razem).
const noMuscleHold = { ...noMuscleExercise, isHold: true };
check("guideFor: brak partii + isHold -> null, bez wyjatku", guideFor(noMuscleHold) === null);

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

// P4-4: RIR ostatniej serii steruje progresja (podwojny skok / ostrzezenie / deload)
const benchExRir = defaultState().exercises.find((e) => e.id === "bench_bb")!;
const lateralExRir = defaultState().exercises.find((e) => e.id === "lateral")!;
const deadliftExRir = defaultState().exercises.find((e) => e.id === "deadlift")!;

const benchCompleteSets = [
  { weight: 45, reps: 8, done: true },
  { weight: 45, reps: 8, done: true },
  { weight: 45, reps: 8, done: true },
];
check(
  "P4-4: komplet + RIR 3 na wyciskaniu (45 kg, krok 2,5) -> 50 kg (podwojny skok)",
  computeProgression(benchExRir, 45, benchCompleteSets, 3).nextWeight === 50,
  computeProgression(benchExRir, 45, benchCompleteSets, 3)
);

const lateralCompleteSets = [
  { weight: 9, reps: 15, done: true },
  { weight: 9, reps: 15, done: true },
  { weight: 9, reps: 15, done: true },
];
check(
  "P4-4: komplet + RIR 3 na wznosach bokiem (9 kg, krok 1, limit 15%) -> 10 kg, NIE 11",
  computeProgression(lateralExRir, 9, lateralCompleteSets, 3).nextWeight === 10,
  computeProgression(lateralExRir, 9, lateralCompleteSets, 3)
);

const deadliftCompleteSets = [
  { weight: 77.5, reps: 6, done: true },
  { weight: 77.5, reps: 6, done: true },
];
check(
  "P4-4: komplet + RIR 3 na martwym ciagu -> pojedynczy krok (wyjatek bezpieczenstwa)",
  computeProgression(deadliftExRir, 77.5, deadliftCompleteSets, 3).nextWeight === 80,
  computeProgression(deadliftExRir, 77.5, deadliftCompleteSets, 3)
);

const benchRir1 = computeProgression(benchExRir, 45, benchCompleteSets, 1);
check(
  "P4-4: komplet + RIR 1 -> pojedynczy krok + ostrzezenie 'Blisko upadku'",
  benchRir1.nextWeight === 47.5 && benchRir1.message.includes("Blisko upadku"),
  benchRir1
);

const benchNoRir = computeProgression(benchExRir, 45, benchCompleteSets);
check(
  "P4-4: komplet bez RIR -> identycznie jak przed zmiana (regresja)",
  benchNoRir.nextWeight === 47.5 &&
    benchNoRir.message === "Wszystkie serie po 8 powt. — nowy ciężar 47.5 kg, wracasz do 5 powt.",
  benchNoRir
);

const benchIncompleteSets = [
  { weight: 45, reps: 6, done: true, rir: 0 },
  { weight: 45, reps: 6, done: true, rir: 0 },
  { weight: 45, reps: 6, done: true, rir: 0 },
];
check(
  "P4-4: brak kompletu + RIR 0 dwa razy z rzedu -> sygnal deloadu",
  computeProgression(benchExRir, 45, benchIncompleteSets, 0, true).status === "deload",
  computeProgression(benchExRir, 45, benchIncompleteSets, 0, true)
);
check(
  "P4-4: brak kompletu + RIR 0, ale POPRZEDNIA sesja bez fail -> zwykly 'hold', nie deload",
  computeProgression(benchExRir, 45, benchIncompleteSets, 0, false).status === "hold",
  computeProgression(benchExRir, 45, benchIncompleteSets, 0, false)
);

check(
  "failedAtRirZero: komplet powtorzen (sukces) -> false niezaleznie od RIR",
  failedAtRirZero(benchExRir, benchCompleteSets.map((s) => ({ ...s, rir: 0 }))) === false
);
check(
  "failedAtRirZero: niekomplet + ostatnia seria RIR 0 -> true",
  failedAtRirZero(benchExRir, benchIncompleteSets) === true
);
check(
  "failedAtRirZero: niekomplet + ostatnia seria RIR 2 -> false",
  failedAtRirZero(benchExRir, [
    { weight: 45, reps: 6, done: true, rir: 2 },
    { weight: 45, reps: 6, done: true, rir: 2 },
    { weight: 45, reps: 6, done: true, rir: 2 },
  ]) === false
);
check("failedAtRirZero: brak zaliczonych serii -> false", failedAtRirZero(benchExRir, []) === false);

// P6-2: timer przerwy - stan liczony z zegara sciennego (endsAt - now), nie
// przez dekrementacje. Testy symuluja "skok zegara" (apka w tle) przekazujac
// odlegle `now`, bez zadnego prawdziwego uplywu czasu/setIntervala.
check(
  "P6-2: remainingMs po skoku zegara o 5 min (symulacja tla) = 0",
  remainingMs(startState(120, 1_000), 1_000 + 5 * 60_000) === 0
);
{
  const started = startState(100, 0);
  const paused = pauseState(started, 30_000); // pauza po 30s -> zostalo 70s
  const resumed = resumeState(paused, 90_000); // wznowienie 60s pozniej (podczas pauzy)
  check(
    "P6-2: pauza/wznowienie nie gubi i nie dodaje czasu",
    remainingMs(resumed, 90_000) === 70_000,
    { paused, resumed }
  );
  check(
    "P6-2: pauza w polowie odliczania -> isPaused true, isRunning false",
    isPaused(paused) === true && isRunning(paused) === false
  );
}
check(
  "P6-2: startState dwa razy pod rzad resetuje do pelnej dlugosci",
  remainingMs(startState(100, 20_000), 20_000) === 100_000
);
{
  const s = startState(90, 1_000);
  const roundTripped = JSON.parse(JSON.stringify(s));
  check(
    "P6-2: stan odczytany z JSON-a (persystencja) daje ten sam wynik",
    remainingMs(roundTripped, 31_000) === remainingMs(s, 31_000)
  );
}
{
  const running = startState(60, 0);
  const justEnded = tick(running, 60_000); // dokladnie w momencie konca
  check("P6-2: tick w momencie konca -> isFinished", isFinished(justEnded) === true);
  check("P6-2: tick w momencie konca -> remainingMs 0", remainingMs(justEnded, 60_000) === 0);
  check(
    "P6-2: tick zapamietuje PRAWDZIWY moment konca (endsAt), nie 'now' pollu",
    justEnded.lastEndedAt === 60_000
  );
  const stillRunning = tick(running, 30_000);
  check("P6-2: tick przed koncem -> bez zmian (ta sama referencja)", stillRunning === running);

  const staleTick = tick(startState(60, 0), 5 * 60_000); // poll przyszedl 5 min pozno (apka w tle)
  check(
    "P6-2: tick spozniony o 5 min - lastEndedAt to moment konca, nie moment pollu",
    staleTick.lastEndedAt === 60_000
  );
}
check(
  "P6-2: idleState - remainingMs pokazuje pelna dlugosc, nikt nie startowal",
  remainingMs(idleState(150), 999_999) === 150_000 && !isRunning(idleState(150)) && !isFinished(idleState(150))
);
{
  const finished = tick(startState(60, 0), 60_000);
  check("P6-2: isFreshlyFinished tuz po zakonczeniu (staleMs 2s) -> true", isFreshlyFinished(finished, 60_500, 2_000));
  check(
    "P6-2: isFreshlyFinished po 11 min (staleMs 10 min) -> false",
    isFreshlyFinished(finished, 60_000 + 11 * 60_000, 10 * 60_000) === false
  );
  const resetAgain = resetState(finished);
  check(
    "P6-2: resetState po zakonczeniu -> z powrotem idle pelnej dlugosci",
    remainingMs(resetAgain, 999_999) === 60_000 && !isFinished(resetAgain)
  );
  const stopped = stopState(finished);
  check(
    "P6-2: stopState po zakonczeniu -> z powrotem idle pelnej dlugosci",
    remainingMs(stopped, 999_999) === 60_000 && !isFinished(stopped)
  );
}

// Etap 1 (bezpieczeństwo): token nigdy nie może trafić do serializowanego backupu.
{
  const SECRET = "github_pat_TEST_SECRET";
  const stWithToken = defaultState();
  stWithToken.settings.gistToken = SECRET;
  stWithToken.settings.gistId = "abc123";

  const before = JSON.stringify(stWithToken);
  const serialized = serializeBackup(stWithToken);
  const after = JSON.stringify(stWithToken);

  check("Etap1: serializeBackup nie zawiera gistToken", !serialized.includes("gistToken"));
  check("Etap1: serializeBackup nie zawiera wartości tokenu", !serialized.includes(SECRET));
  check("Etap1: serializeBackup nie mutuje przekazanego state", before === after);

  const parsedBack = JSON.parse(serialized);
  check("Etap1: serializeBackup zachowuje resztę ustawień", parsedBack.settings.gistId === "abc123");
  check(
    "Etap1: serializeBackup zachowuje ćwiczenia/dni/cele/historię",
    Array.isArray(parsedBack.exercises) &&
      parsedBack.exercises.length === stWithToken.exercises.length &&
      Array.isArray(parsedBack.days) &&
      parsedBack.days.length === stWithToken.days.length &&
      JSON.stringify(parsedBack.targets) === JSON.stringify(stWithToken.targets) &&
      Array.isArray(parsedBack.sessions) &&
      parsedBack.sessions.length === stWithToken.sessions.length
  );

  const prettySerialized = serializeBackup(stWithToken, true);
  check("Etap1: eksport plikowy (pretty) też nie zawiera tokenu", !prettySerialized.includes(SECRET));
}

// Etap 1: import starego backupu z tokenem musi go zignorować, zachowując token lokalny.
{
  const legacyExport = defaultState();
  legacyExport.settings.gistToken = "github_pat_FROM_OLD_FILE";
  const legacyJson = JSON.stringify(legacyExport); // stary format sprzed fixu, token w pliku

  const parsed = JSON.parse(legacyJson);
  const err = validateBackup(parsed);
  check("Etap1: legacy backup z tokenem nadal przechodzi walidację kształtu", err === null, err);

  // Symulacja store.importJson(): migrateState + nadpisanie tokenu lokalnym (patrz store.tsx).
  const localToken = "github_pat_LOCAL_CURRENT";
  const migratedImport = migrateState(parsed);
  migratedImport.settings.gistToken = localToken;
  check(
    "Etap1: import ignoruje token z pliku i zachowuje lokalny",
    migratedImport.settings.gistToken === localToken
  );
}

// Etap 5: raport tygodniowy "Ten tydzien" - jedna karta, cztery liczby, jedna rekomendacja.
{
  const NOW = "2026-08-03T10:00:00.000Z"; // dowolny punkt odniesienia, nie zalezny od "dzis"
  const monday = mondayOf(NOW);

  // Pusty tydzien: 0 sesji, brak tonazu, brak porownania, rekomendacja "domknij regularnosc".
  const empty = weeklyReport(defaultState(), NOW);
  check("weeklyReport: pusty tydzien - 0 z zaplanowanych (3 dni glowne)", empty.sessionsDone === 0 && empty.sessionsPlanned === 3, empty);
  check("weeklyReport: pusty tydzien - tonaz 0", empty.tonnageCurrent === 0, empty);
  check("weeklyReport: pusty tydzien - brak porownania (null, nie Infinity/NaN)", empty.tonnagePrevious === null && empty.tonnageChangePct === null, empty);
  check("weeklyReport: pusty tydzien - rekomendacja adherence (0<3)", empty.recommendation === "adherence", empty.recommendation);

  // Pelne 3/3: trzy ukonczone sesje w TYM tygodniu, po jednej na kazdy dzien glowny.
  const stFull = defaultState();
  const mainDays = stFull.days.filter((d) => !d.optional);
  stFull.sessions.push(
    ...mainDays.map((d, i) => ({
      id: `full-${i}`,
      dayId: d.id,
      date: monday,
      completed: true,
      entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }],
    }))
  );
  const full = weeklyReport(stFull, NOW);
  check("weeklyReport: pelne 3/3 - sessionsDone === sessionsPlanned", full.sessionsDone === 3 && full.sessionsPlanned === 3, full);
  check("weeklyReport: pelne 3/3 - adherence NIE jest juz problemem", full.recommendation !== "adherence", full.recommendation);

  // Brak poprzedniego tygodnia: sesje SA w tym tygodniu, ale zero w poprzednim.
  const stNoPrev = defaultState();
  stNoPrev.sessions.push({
    id: "np1",
    dayId: mainDays[0].id,
    date: monday,
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }],
  });
  const noPrev = weeklyReport(stNoPrev, NOW);
  check("weeklyReport: brak poprzedniego tygodnia - tonaz biezacy > 0", noPrev.tonnageCurrent > 0, noPrev);
  check("weeklyReport: brak poprzedniego tygodnia - brak porownania", noPrev.tonnagePrevious === null && noPrev.tonnageChangePct === null, noPrev);

  // Granica poniedzialek/niedziela: sesja w niedziele (koniec POPRZEDNIEGO tygodnia)
  // i sesja w poniedzialek (poczatek TEGO tygodnia) NIE moga wpasc do tego samego kubelka.
  const sundayBefore = new Date(monday + "T12:00:00");
  sundayBefore.setDate(sundayBefore.getDate() - 1);
  const sundayStr = sundayBefore.toISOString().slice(0, 10);
  const stBoundary = defaultState();
  stBoundary.sessions.push(
    { id: "b-sun", dayId: mainDays[0].id, date: sundayStr, completed: true, entries: [{ exerciseId: "bench_bb", targetWeight: 40, sets: [{ weight: 40, reps: 10, done: true }] }] },
    { id: "b-mon", dayId: mainDays[0].id, date: monday, completed: true, entries: [{ exerciseId: "bench_bb", targetWeight: 50, sets: [{ weight: 50, reps: 10, done: true }] }] }
  );
  const boundary = weeklyReport(stBoundary, NOW);
  check("weeklyReport: granica pn/nd - niedziela liczy sie do POPRZEDNIEGO tygodnia", boundary.tonnagePrevious === 400, boundary);
  check("weeklyReport: granica pn/nd - poniedzialek liczy sie do TEGO tygodnia", boundary.tonnageCurrent === 500, boundary);

  // Sesja bonusowa NIE zwiększa liczby wymaganych dni i nie udaje realizacji
  // dnia głównego — jest raportowana osobno.
  const stBonus = defaultState();
  stBonus.sessions.push({
    id: "bonus1",
    dayId: "bonus",
    date: monday,
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }],
  });
  const bonusReport = weeklyReport(stBonus, NOW);
  check("weeklyReport: sesja bonusowa - planned zostaje 3 (nie 4)", bonusReport.sessionsPlanned === 3, bonusReport);
  check(
    "weeklyReport: sam bonus - done zostaje 0, sessionsBonus wynosi 1",
    bonusReport.sessionsDone === 0 && bonusReport.sessionsBonus === 1,
    bonusReport
  );
  check(
    "weeklyReport: sam bonus NIE maskuje braku planu",
    bonusReport.recommendation === "adherence",
    bonusReport.recommendation
  );

  // Pełne 3/3 + bonus: raport nie może modelować tego jako „4 z 3”.
  const stFullBonus = structuredClone(stFull);
  stFullBonus.sessions.push({
    id: "bonus-full",
    dayId: "bonus",
    date: monday,
    completed: true,
    entries: [],
  });
  const fullBonusReport = weeklyReport(stFullBonus, NOW);
  check(
    "weeklyReport: 3 glowne + bonus -> 3 z 3 oraz osobny bonus",
    fullBonusReport.sessionsDone === 3 &&
      fullBonusReport.sessionsPlanned === 3 &&
      fullBonusReport.sessionsBonus === 1,
    fullBonusReport
  );

  // Plateau >=3 cwiczenia -> rekomendacja deload (najwyzszy priorytet).
  const stPlateau = defaultState();
  const plateauExIds = ["bench_bb", "squat", "row_bb"];
  const plateauDates = ["2026-06-01", "2026-06-08", "2026-06-15"];
  for (const exId of plateauExIds) {
    for (const date of plateauDates) {
      stPlateau.sessions.push({
        id: `plat-${exId}-${date}`,
        dayId: mainDays[0].id,
        date,
        completed: true,
        entries: [{ exerciseId: exId, targetWeight: 50, sets: [{ weight: 50, reps: 6, done: true }] }],
      });
    }
  }
  const plateauReport = weeklyReport(stPlateau, NOW);
  check("weeklyReport: 3 cwiczenia w zastoju wykryte", plateauReport.strengthPlateaued === 3, plateauReport.strengthPlateaued);
  check("weeklyReport: rekomendacja deload ma priorytet nad reszta", plateauReport.recommendation === "deload", plateauReport.recommendation);

  // Niski wolumen (>=2 partie ponizej zakresu w oknie "Wykonane 7 dni") -> "bonus",
  // gdy adherence pelne i brak plateau. Stan minimalny: JEDEN dzien, JEDNO cwiczenie -
  // pozostale partie z definicji maja 0 serii w oknie, wiec sa "low".
  const stLowVol = defaultState();
  stLowVol.days = [{ id: "solo", name: "Solo", short: "Solo", exerciseIds: ["bench_bb"] }];
  stLowVol.sessions.push({
    id: "lv1",
    dayId: "solo",
    date: monday,
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }],
  });
  const lowVolReport = weeklyReport(stLowVol, NOW);
  check("weeklyReport: niski wolumen - co najmniej 2 partie ponizej zakresu", lowVolReport.lowVolumeMuscles >= 2, lowVolReport.lowVolumeMuscles);
  check("weeklyReport: rekomendacja bonus (pelne adherence, bez plateau, niski wolumen)", lowVolReport.recommendation === "bonus", lowVolReport.recommendation);

  // Domyslne rozwiniecie karty: niedziela/poniedzialek TAK, reszta tygodnia NIE.
  // Uzywamy tej samej techniki co wyzej (mondayOf) zeby nie zgadywac dnia tygodnia recznie.
  const mondayExpanded = weeklyReportDefaultExpanded(monday + "T10:00:00.000Z");
  check("weeklyReportDefaultExpanded: poniedzialek -> rozwinieta", mondayExpanded === true);
  const sundayExpanded = weeklyReportDefaultExpanded(sundayStr + "T10:00:00.000Z");
  check("weeklyReportDefaultExpanded: niedziela -> rozwinieta", sundayExpanded === true);
  const tuesday = new Date(monday + "T12:00:00");
  tuesday.setDate(tuesday.getDate() + 1);
  const tuesdayExpanded = weeklyReportDefaultExpanded(tuesday.toISOString());
  check("weeklyReportDefaultExpanded: wtorek -> zwinieta", tuesdayExpanded === false);
}

// Etap 6: eksport historii do CSV.
{
  const stCsv = defaultState();
  stCsv.settings.gistToken = "github_pat_TEST_SECRET";
  stCsv.settings.gistId = "abc123secret";
  stCsv.sessions.push(
    {
      id: "csv1",
      dayId: "mon",
      date: "2026-07-06T10:00:00.000Z",
      completed: true,
      mode: "hypertrophy",
      entries: [
        {
          exerciseId: "bench_bb",
          targetWeight: 45,
          sets: [
            { weight: 45, reps: 8, done: true, rir: 2 },
            { weight: 45, reps: 7, done: false }, // niezaliczona - MUSI byc pominieta
            { weight: 45, reps: 6, done: true },
          ],
        },
        {
          exerciseId: "bench_db",
          targetWeight: 17.5,
          sets: [{ weight: 17.5, reps: 10, done: true }],
        },
      ],
    },
    {
      id: "csv2",
      dayId: "wed",
      date: "2026-07-08",
      completed: false, // nieukonczona sesja - MUSI byc pominieta w calosci
      entries: [{ exerciseId: "squat", targetWeight: 60, sets: [{ weight: 60, reps: 5, done: true }] }],
    }
  );
  const before = JSON.stringify(stCsv);
  const csv = sessionsToCsv(stCsv);
  const after = JSON.stringify(stCsv);
  check("sessionsToCsv: nie mutuje przekazanego state", before === after);
  check("sessionsToCsv: zaczyna sie od BOM (UTF-8)", csv.charCodeAt(0) === 0xfeff);
  const body = csv.slice(1); // bez BOM, zeby latwo porownywac tekst
  const lines = body.split("\r\n"); // [naglowek, wiersz1, wiersz2, wiersz3]
  check("sessionsToCsv: naglowek uzywa srednika jako separatora", lines[0].startsWith("data;dzień;tryb;"), lines[0]);
  check("sessionsToCsv: naglowek ma wszystkie 9 kolumn", lines[0].split(";").length === 9, lines[0]);
  check("sessionsToCsv: pomija niezaliczona serie (3 wiersze danych, nie 4)", lines.length === 4, lines);
  check(
    "sessionsToCsv: pomija CALA nieukonczona sesje (squat sie nie pojawia)",
    !body.includes("squat") && !body.includes("Przysiad"),
    body
  );
  check("sessionsToCsv: tryb po polsku (Hipertrofia)", lines[1].includes(";Hipertrofia;") && lines[2].includes(";Hipertrofia;"), lines);
  check(
    "sessionsToCsv: hantle - ciezar NA REKE w kolumnie ciezar_kg (17,5, nie 35)",
    lines[3].includes(";17,5;"),
    lines[3]
  );
  check("sessionsToCsv: hantle - tonaz_kg liczony x2 (17,5*10*2=350)", lines[3].trim().endsWith(";350"), lines[3]);
  check("sessionsToCsv: RIR obecny gdy zapisany (2)", lines[1].includes(";2;"), lines[1]);
  check(
    "sessionsToCsv: numer_serii zachowuje POZYCJE w sesji (1 i 3, seria 2 pominieta)",
    lines[1].split(";")[4] === "1" && lines[2].split(";")[4] === "3",
    lines
  );
  check(
    "sessionsToCsv: bez tokenu/Gist ID/innych ustawien w pliku",
    !body.includes("github_pat_TEST_SECRET") && !body.includes("abc123secret") && !body.includes("gistToken"),
    body
  );

  // Escapowanie: cwiczenie z separatorem/cudzyslowem w nazwie musi trafic w cudzyslow.
  const stEscape = defaultState();
  stEscape.days = [{ id: "d", name: "Dzień; specjalny \"X\"", short: "D", exerciseIds: ["bench_bb"] }];
  stEscape.sessions.push({
    id: "esc1",
    dayId: "d",
    date: "2026-07-06",
    completed: true,
    entries: [{ exerciseId: "bench_bb", targetWeight: 45, sets: [{ weight: 45, reps: 8, done: true }] }],
  });
  const csvEscaped = sessionsToCsv(stEscape);
  check(
    "sessionsToCsv: pole z separatorem/cudzyslowem w cudzyslowie, wewnetrzny cudzyslow podwojony",
    csvEscaped.includes('"Dzień; specjalny ""X"""'),
    csvEscaped
  );

  check("sessionsToCsv: pusta historia -> tylko naglowek", sessionsToCsv(defaultState()).slice(1).split("\r\n").length === 1);
}

// ── Serie robocze per dzien (day.setsOverride) ─────────────────────────────
{
  const curl = SEED_EXERCISES.find((e) => e.id === "curl_bb")!;
  const mon = SEED_DAYS.find((d) => d.id === "mon")!;

  check("plannedSets: brak override -> targetSets z bazy", plannedSets(mon, bench) === bench.targetSets);
  check("plannedSets: seed moze niesc wlasne nadpisanie dnia (mon: curl_bb 3)", plannedSets(mon, curl) === 3);
  check("plannedSets: brak dnia -> targetSets z bazy", plannedSets(undefined, curl) === curl.targetSets);

  const dayWith = { ...mon, setsOverride: { curl_bb: 4 } };
  check("plannedSets: override dnia wygrywa", plannedSets(dayWith, curl) === 4);
  check("plannedSets: override nie przecieka na inne cwiczenie", plannedSets(dayWith, bench) === bench.targetSets);
  const bonus = SEED_DAYS.find((d) => d.id === "bonus")!;
  check("plannedSets: override jest PER DZIEN (bonus nietkniety)", plannedSets(bonus, curl) === curl.targetSets);

  check("exerciseForDay: podmienia targetSets", exerciseForDay(curl, dayWith).targetSets === 4);
  check("exerciseForDay: bez override zwraca ten sam obiekt", exerciseForDay(bench, mon) === bench);

  // Dolozona seria realnie podnosi prog podwojnej progresji: 3x12 przy planie
  // 4 serii to juz NIE komplet, dopiero 4x12 podnosi ciezar.
  const curl4 = exerciseForDay(curl, dayWith);
  const three = computeProgression(curl4, 17.5, [
    { weight: 17.5, reps: 12, done: true },
    { weight: 17.5, reps: 12, done: true },
    { weight: 17.5, reps: 12, done: true },
  ]);
  check("4 serie w planie: 3x12 -> hold (nie komplet)", three.status === "hold", three);
  const four = computeProgression(curl4, 17.5, [
    { weight: 17.5, reps: 12, done: true },
    { weight: 17.5, reps: 12, done: true },
    { weight: 17.5, reps: 12, done: true },
    { weight: 17.5, reps: 12, done: true },
  ]);
  check("4 serie w planie: 4x12 -> +1.25 kg", four.status === "up" && four.nextWeight === 18.75, four);

  // Objetosc tygodniowa liczy z planu DNIA, nie z globalnego targetSets.
  const stSets = defaultState();
  const bicepsBefore = weeklyMuscleVolume(stSets).find((v) => v.muscle === "Biceps")!.direct;
  stSets.days.find((d) => d.id === "mon")!.setsOverride = { curl_bb: 5 };
  const bicepsAfter = weeklyMuscleVolume(stSets).find((v) => v.muscle === "Biceps")!.direct;
  check("weeklyMuscleVolume: override dnia dolicza serie", bicepsAfter === bicepsBefore + 2, {
    bicepsBefore,
    bicepsAfter,
  });
}

// ── detectPlateau: koniec falszywych alarmow ───────────────────────────────
{
  const curlSession = (id: string, date: string, reps: number[], mode?: Session["mode"]): Session => ({
    id,
    dayId: "mon",
    date,
    completed: true,
    mode,
    entries: [
      {
        exerciseId: "curl_bb",
        targetWeight: 17.5,
        sets: reps.map((r) => ({ weight: 17.5, reps: r, done: true })),
      },
    ],
  });

  // Zgloszenie Kamila: 12/12 domyka podwojna progresje (ciezar rosnie w nastepnym
  // treningu), a apka i tak pisala "zastoj" - bo patrzyla wylacznie na e1RM
  // najlepszej serii, ktore przy 12 powtorzeniach nie drgnelo.
  const stTop = defaultState();
  stTop.sessions = [
    curlSession("c1", "2026-07-01", [12, 11]),
    curlSession("c2", "2026-07-08", [12, 11]),
    curlSession("c3", "2026-07-15", [12, 12]),
  ];
  check("detectPlateau: komplet powtorzen w ostatnim treningu to NIE zastoj", !detectPlateau(stTop, "curl_bb"));

  // Powtorzenia rosna w seriach roboczych (22 -> 22 -> 23) mimo tego samego
  // szczytu 12 - to progres, nie zastoj.
  const stReps = defaultState();
  stReps.sessions = [
    curlSession("r1", "2026-07-01", [12, 10]),
    curlSession("r2", "2026-07-08", [12, 10]),
    curlSession("r3", "2026-07-15", [12, 11]),
  ];
  check("detectPlateau: przyrost powtorzen to NIE zastoj", !detectPlateau(stReps, "curl_bb"));

  // Realny zastoj: ten sam ciezar, te same powtorzenia, trzeci raz z rzedu.
  const stFlat = defaultState();
  stFlat.sessions = [
    curlSession("f1", "2026-07-01", [12, 10]),
    curlSession("f2", "2026-07-08", [12, 10]),
    curlSession("f3", "2026-07-15", [12, 10]),
  ];
  check("detectPlateau: 3x identyczny wynik -> zastoj", detectPlateau(stFlat, "curl_bb"));

  // Tydzien deloadu w oknie to celowo lzejszy tydzien, nie brak postepu.
  const stDeload = defaultState();
  stDeload.sessions = [
    curlSession("d1", "2026-07-01", [12, 10]),
    curlSession("d2", "2026-07-08", [12, 10], "deload"),
    curlSession("d3", "2026-07-15", [12, 10]),
  ];
  check("detectPlateau: deload w oknie -> brak zastoju", !detectPlateau(stDeload, "curl_bb"));

  const stShort = defaultState();
  stShort.sessions = [curlSession("s1", "2026-07-01", [12, 10]), curlSession("s2", "2026-07-08", [12, 10])];
  check("detectPlateau: 2 treningi to za malo danych", !detectPlateau(stShort, "curl_bb"));
}

// ── prefillRepsForEntry: podwojna progresja w loggerze ─────────────────────
{
  const curl = SEED_EXERCISES.find((e) => e.id === "curl_bb")!; // 10-12 powt., 2 serie
  const curlSession = (id: string, date: string, weight: number, reps: number[], mode?: Session["mode"]): Session => ({
    id,
    dayId: "mon",
    date,
    completed: true,
    mode,
    entries: [
      {
        exerciseId: "curl_bb",
        targetWeight: weight,
        sets: reps.map((r) => ({ weight, reps: r, done: true })),
      },
    ],
  });

  check(
    "prefill: brak historii -> dol zakresu",
    JSON.stringify(prefillRepsForEntry(defaultState(), curl, curl, 17.5, 2)) === JSON.stringify([10, 10])
  );

  // Sedno zgloszenia: po skoku ciezaru logger NIE moze podstawiac repMax.
  const stUp = defaultState();
  stUp.sessions = [curlSession("u1", "2026-07-08", 17.5, [12, 12])];
  check(
    "prefill: po skoku ciezaru wracasz na DOL zakresu",
    JSON.stringify(prefillRepsForEntry(stUp, curl, curl, 18.75, 2)) === JSON.stringify([10, 10]),
    prefillRepsForEntry(stUp, curl, curl, 18.75, 2)
  );

  const stSame = defaultState();
  stSame.sessions = [curlSession("h1", "2026-07-08", 17.5, [12, 11])];
  check(
    "prefill: ten sam ciezar -> wynik z ostatniego treningu (masz go pobic)",
    JSON.stringify(prefillRepsForEntry(stSame, curl, curl, 17.5, 2)) === JSON.stringify([12, 11]),
    prefillRepsForEntry(stSame, curl, curl, 17.5, 2)
  );

  check(
    "prefill: wiecej serii niz w historii -> ostatnia znana wartosc",
    JSON.stringify(prefillRepsForEntry(stSame, curl, curl, 17.5, 3)) === JSON.stringify([12, 11, 11])
  );

  // Zmiana trybu tygodnia przycina wynik do zakresu NOWEGO trybu.
  const stClamp = defaultState();
  stClamp.sessions = [
    {
      id: "cl1",
      dayId: "mon",
      date: "2026-07-08",
      completed: true,
      mode: "hypertrophy",
      entries: [
        {
          exerciseId: "bench_bb",
          targetWeight: 45,
          sets: [
            { weight: 45, reps: 12, done: true },
            { weight: 45, reps: 12, done: true },
            { weight: 45, reps: 12, done: true },
          ],
        },
      ],
    },
  ];
  check(
    "prefill: powrot na sile przycina 12 powt. do repMax=8",
    JSON.stringify(prefillRepsForEntry(stClamp, bench, bench, 45, 3)) === JSON.stringify([8, 8, 8]),
    prefillRepsForEntry(stClamp, bench, bench, 45, 3)
  );

  // Tydzien deloadu (65% ciezaru) nie moze udawac, ze ciezar wlasnie wskoczyl.
  const stAfterDeload = defaultState();
  stAfterDeload.sessions = [
    curlSession("ad1", "2026-07-01", 17.5, [12, 11]),
    curlSession("ad2", "2026-07-08", 11.25, [12, 12], "deload"),
  ];
  check(
    "prefill: deload pomijany jako punkt odniesienia",
    JSON.stringify(prefillRepsForEntry(stAfterDeload, curl, curl, 17.5, 2)) === JSON.stringify([12, 11]),
    prefillRepsForEntry(stAfterDeload, curl, curl, 17.5, 2)
  );
}

// ── Autoregulacja z zalogowanego RIR ───────────────────────────────────────
{
  const curl = SEED_EXERCISES.find((e) => e.id === "curl_bb")!; // 10-12 powt., 2 serie

  // easyAtRirHigh: 3+ w zapasie i zakres NIEdomkniety = ciezar za lekki.
  check(
    "easyAtRirHigh: 10/10 przy RIR 3 -> ciezar za lekki",
    easyAtRirHigh(curl, [
      { weight: 17.5, reps: 10, done: true },
      { weight: 17.5, reps: 10, done: true, rir: 3 },
    ])
  );
  check(
    "easyAtRirHigh: komplet powtorzen NIGDY nie jest 'za lekki' (progresja i tak podniesie)",
    !easyAtRirHigh(curl, [
      { weight: 17.5, reps: 12, done: true },
      { weight: 17.5, reps: 12, done: true, rir: 3 },
    ])
  );
  check(
    "easyAtRirHigh: RIR 2 to nie sygnal",
    !easyAtRirHigh(curl, [
      { weight: 17.5, reps: 10, done: true },
      { weight: 17.5, reps: 10, done: true, rir: 2 },
    ])
  );
  check(
    "easyAtRirHigh: brak zapisanego RIR -> brak sygnalu",
    !easyAtRirHigh(curl, [
      { weight: 17.5, reps: 10, done: true },
      { weight: 17.5, reps: 10, done: true },
    ])
  );

  // computeProgression: dwa treningi z rzedu 3+ w zapasie bez kompletu.
  const easySets = [
    { weight: 17.5, reps: 10, done: true },
    { weight: 17.5, reps: 10, done: true, rir: 3 },
  ];
  const twice = computeProgression(curl, 17.5, easySets, 3, false, true);
  check(
    "computeProgression: 2x RIR 3+ bez kompletu -> nazywa rzecz po imieniu",
    twice.status === "hold" && twice.nextWeight === 17.5 && /za lekki/.test(twice.message),
    twice
  );
  const once = computeProgression(curl, 17.5, easySets, 3, false, false);
  check(
    "computeProgression: pojedynczy latwy trening -> zwykle 'walcz'",
    once.status === "hold" && /walcz/.test(once.message),
    once
  );
  // Komplet powtorzen ma pierwszenstwo - to i tak podnosi ciezar.
  const topWithRir3 = computeProgression(
    curl,
    17.5,
    [
      { weight: 17.5, reps: 12, done: true },
      { weight: 17.5, reps: 12, done: true, rir: 3 },
    ],
    3,
    false,
    true
  );
  check("computeProgression: komplet + RIR 3 -> podwojny skok, nie ostrzezenie", topWithRir3.status === "up", topWithRir3);

  // Prefill celuje o jedno powtorzenie wyzej, gdy zostawiles 3+ w zapasie.
  const stEasy = defaultState();
  stEasy.sessions = [
    {
      id: "e1", dayId: "mon", date: "2026-07-08", completed: true, mode: "strength",
      entries: [{ exerciseId: "curl_bb", targetWeight: 17.5, sets: [
        { weight: 17.5, reps: 10, done: true },
        { weight: 17.5, reps: 10, done: true, rir: 3 },
      ] }],
    },
  ];
  check(
    "prefill: RIR 3 w zapasie -> celuj o jedno powtorzenie wyzej",
    JSON.stringify(prefillRepsForEntry(stEasy, curl, curl, 17.5, 2)) === JSON.stringify([11, 11]),
    prefillRepsForEntry(stEasy, curl, curl, 17.5, 2)
  );
}

// ── Objętość = serie ROBOCZE (hard sets), nie serie w ogóle ────────────────
{
  const stHard = defaultState();
  const nowIso = "2026-07-10T12:00:00.000Z";
  stHard.sessions = [
    {
      id: "hs1", dayId: "mon", date: "2026-07-09T18:00:00.000Z", completed: true, mode: "strength",
      entries: [{ exerciseId: "curl_bb", targetWeight: 17.5, sets: [
        { weight: 17.5, reps: 12, done: true },  // robocza
        { weight: 17.5, reps: 10, done: true },  // robocza (repMin=10)
        { weight: 17.5, reps: 4, done: true },   // urwana - NIE liczy sie
      ] }],
    },
  ];
  const biceps = actualWeeklyMuscleVolume(stHard, "hypertrophy", nowIso).find((v) => v.muscle === "Biceps")!;
  check(
    "actualWeeklyMuscleVolume: seria urwana ponizej repMin nie liczy sie do objetosci",
    biceps.direct === 2,
    biceps
  );
}

// ── Kalibracja RIR wg kosztu dojścia do granicy ────────────────────────────
{
  const rirOf = (id: string) => SEED_EXERCISES.find((e) => e.id === id)!.rir;
  check("RIR: izolacja blisko granicy (wznosy bokiem = 1)", rirOf("lateral") === 1, rirOf("lateral"));
  check("RIR: izolacja blisko granicy (uginanie bicepsa = 1)", rirOf("curl_bb") === 1, rirOf("curl_bb"));
  check("RIR: rozpietki to izolacja mimo partii wspomagajacej (= 1)", rirOf("fly_db") === 1, rirOf("fly_db"));
  check("RIR: uginanie nog lezac to izolacja (= 1)", rirOf("leg_curl_lying") === 1, rirOf("leg_curl_lying"));
  check("RIR: zwykly compound bez zmian (wyciskanie plasko = 2)", rirOf("bench_bb") === 2, rirOf("bench_bb"));
  check("RIR: duzy ruch osiowy z marginesem (martwy ciag = 3)", rirOf("deadlift") === 3, rirOf("deadlift"));
  check("RIR: duzy ruch osiowy z marginesem (przysiad = 3)", rirOf("squat") === 3, rirOf("squat"));
  check("RIR: plank zostaje na 0 (do granicy formy)", rirOf("plank") === 0, rirOf("plank"));

  // Backfill: stary stan ma jednolite rir=2 i musi dostac nowe wartosci.
  const stale = defaultState();
  stale.exercises = stale.exercises.map((e) => ({ ...e, rir: 2 }));
  stale.rirCalibrated = undefined;
  const migrated = migrateState({ ...stale, version: SCHEMA_VERSION });
  const mRir = (id: string) => migrated.exercises.find((e) => e.id === id)!.rir;
  check("backfill RIR: jednolite 2 -> skalibrowane (lateral 1, deadlift 3)", mRir("lateral") === 1 && mRir("deadlift") === 3, {
    lateral: mRir("lateral"),
    deadlift: mRir("deadlift"),
  });
  check("backfill RIR: flaga ustawiona po przeliczeniu", migrated.rirCalibrated === true);

  // Recznie ustawione RIR (inne niz stare domyslne 2) zostaja nietkniete.
  const manual = defaultState();
  manual.exercises = manual.exercises.map((e) => (e.id === "lateral" ? { ...e, rir: 0 } : e));
  manual.rirCalibrated = undefined;
  const migratedManual = migrateState({ ...manual, version: SCHEMA_VERSION });
  check(
    "backfill RIR: recznie ustawione 0 zostaje",
    migratedManual.exercises.find((e) => e.id === "lateral")!.rir === 0
  );
}

// ── Wariant B: dosiew objętości do planu ───────────────────────────────────
{
  const st = defaultState();
  const vol = weeklyMuscleVolume(st, "hypertrophy");
  const direct = (m: string) => vol.find((v) => v.muscle === m)!.direct;

  check("plan B: Nogi 6 -> 9 serii (suwnica w Treningu 2)", direct("Nogi") === 9, direct("Nogi"));
  check("plan B: Biceps 2 -> 3 serie bezposrednie", direct("Biceps") === 3, direct("Biceps"));
  check("plan B: Triceps 2 -> 3 serie bezposrednie", direct("Triceps") === 3, direct("Triceps"));
  check("plan B: Łydki 3 -> 4 serie", direct("Łydki") === 4, direct("Łydki"));
  check(
    "plan B: suwnica stoi po martwym ciagu (jeszcze na swiezo)",
    SEED_DAYS.find((d) => d.id === "wed")!.exerciseIds.join(",") ===
      "squat,deadlift,leg_press,incline_db,lunges,calf,plank"
  );
  check("plan B: partie spoza wariantu bez zmian (Klatka 9)", direct("Klatka") === 9, direct("Klatka"));

  // Migracja do ISTNIEJACEGO stanu (bez niej zmiana SEED_DAYS nie dotarlaby - §13).
  const oldState = defaultState();
  oldState.days = oldState.days.map((d) =>
    d.id === "wed"
      ? { ...d, exerciseIds: ["squat", "deadlift", "incline_db", "lunges", "calf", "plank"], setsOverride: undefined }
      : { ...d, setsOverride: undefined }
  );
  oldState.planVolumeBumpSeeded = undefined;
  const m = migrateState({ ...oldState, version: SCHEMA_VERSION });
  const wed = m.days.find((d) => d.id === "wed")!;
  check("migracja B: suwnica dolozona po martwym ciagu", wed.exerciseIds[2] === "leg_press", wed.exerciseIds);
  check("migracja B: cel suwnicy z SEED_TARGETS", m.targets.leg_press === SEED_TARGETS.leg_press);
  check("migracja B: serie lydek 3 -> 4", wed.setsOverride?.calf === 4, wed.setsOverride);
  check("migracja B: serie bicepsa 2 -> 3", m.days.find((d) => d.id === "mon")!.setsOverride?.curl_bb === 3);
  check("migracja B: serie tricepsa 2 -> 3", m.days.find((d) => d.id === "fri")!.setsOverride?.french === 3);
  check("migracja B: flaga ustawiona", m.planVolumeBumpSeeded === true);
  check(
    "migracja B: objetosc po migracji zgodna z seedem",
    weeklyMuscleVolume(m, "hypertrophy").find((v) => v.muscle === "Nogi")!.direct === 9
  );

  // Idempotencja + poszanowanie decyzji uzytkownika.
  const twice = migrateState({ ...m, version: SCHEMA_VERSION });
  check(
    "migracja B: druga migracja nie dokłada suwnicy po raz drugi",
    twice.days.find((d) => d.id === "wed")!.exerciseIds.filter((id) => id === "leg_press").length === 1
  );
  const userHigher = defaultState();
  userHigher.days = userHigher.days.map((d) =>
    d.id === "mon" ? { ...d, setsOverride: { curl_bb: 5 } } : d
  );
  userHigher.planVolumeBumpSeeded = undefined;
  const kept = migrateState({ ...userHigher, version: SCHEMA_VERSION });
  check(
    "migracja B: wyzsza wartosc uzytkownika NIE jest obnizana do 3",
    kept.days.find((d) => d.id === "mon")!.setsOverride?.curl_bb === 5
  );
  const removed = defaultState();
  removed.days = removed.days.map((d) =>
    d.id === "wed" ? { ...d, exerciseIds: d.exerciseIds.filter((id) => id !== "leg_press") } : d
  );
  removed.planVolumeBumpSeeded = true; // dosiew juz byl - usuniecie jest decyzja uzytkownika
  const stillRemoved = migrateState({ ...removed, version: SCHEMA_VERSION });
  check(
    "migracja B: usuniecie suwnicy po dosiewie jest trwale",
    !stillRemoved.days.find((d) => d.id === "wed")!.exerciseIds.includes("leg_press")
  );
}

console.log(failures === 0 ? "\nWSZYSTKIE TESTY OK" : `\n${failures} TESTOW PADLO`);
process.exit(failures === 0 ? 0 : 1);
