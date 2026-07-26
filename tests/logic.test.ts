// Testy silnika — czysta logika, bez przeglądarki.
// Uruchamianie: npm test  (esbuild -> node)
import {
  computeProgression,
  setVolume,
  e1rm,
  platePlan,
  weeklyMuscleVolume,
  actualWeeklyMuscleVolume,
  lastEntry,
  detectPlateau,
  achievableWeights,
  nearestAchievable,
  snapToStep,
  suggestedWeightForProfile,
  suggestBonusExercises,
  projectHistory,
  exerciseForMode,
  weightForReps,
  hyperTargetFor,
  targetForMode,
  type HistoryPoint,
} from "../src/lib/logic";
import {
  defaultState,
  SEED_EXERCISES,
  SEED_DAYS,
  SEED_TARGETS,
  migrateState,
  computeRestoredDayPlan,
  SCHEMA_VERSION,
} from "../src/lib/seed";
import type { Session } from "../src/lib/types";

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

// INFO-1b: cel objetosci (sila/hipertrofia) zmienia progi statusu
const volHiper = weeklyMuscleVolume(defaultState(), "hypertrophy").find((v) => v.muscle === "Klatka")!;
check("weeklyMuscleVolume: Klatka 9 serii + cel hipertrofia -> low", volHiper.status === "low", volHiper);
const volSila = weeklyMuscleVolume(defaultState(), "strength").find((v) => v.muscle === "Klatka")!;
check("weeklyMuscleVolume: Klatka 9 serii + cel sila -> ok", volSila.status === "ok", volSila);

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
const bonusPool = suggestBonusExercises(stBonus, 10, "2026-07-26");
const mainIds = new Set(SEED_DAYS.filter((d) => !d.optional).flatMap((d) => d.exerciseIds));
check(
  "suggestBonusExercises: dobija do puli poza dniami głownymi, bez duplikatow (5 cwiczen bonus 2.0)",
  bonusPool.length === 5 && new Set(bonusPool.map((e) => e.id)).size === 5,
  bonusPool.map((e) => e.id)
);
check(
  "suggestBonusExercises: zaden pick nie pochodzi z dnia głownego",
  bonusPool.every((e) => !mainIds.has(e.id)),
  bonusPool.map((e) => e.id)
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

console.log(failures === 0 ? "\nWSZYSTKIE TESTY OK" : `\n${failures} TESTOW PADLO`);
process.exit(failures === 0 ? 0 : 1);
