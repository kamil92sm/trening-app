// Testy silnika — czysta logika, bez przeglądarki.
// Uruchamianie: npm test  (esbuild -> node)
import { computeProgression, setVolume, e1rm, platePlan, weeklyMuscleVolume, lastEntry } from "../src/lib/logic";
import { defaultState, SEED_EXERCISES, SEED_DAYS, migrateState, SCHEMA_VERSION } from "../src/lib/seed";

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
check("migracja: sesje zachowane", mig.sessions.length === 1);
check("migracja: waga zachowana", mig.body.length === 1 && mig.body[0].weight === 80);
check("migracja: squash zachowany", mig.squash.length === 1);
check("migracja: settings zachowane", mig.settings.restSeconds === 90 && mig.settings.sound === false);

const cur = defaultState();
cur.targets["bench_bb"] = 50;
cur.sessions.push({ id: "x", dayId: "mon", date: "2026-07-20", entries: [], completed: true });
const same = migrateState(JSON.parse(JSON.stringify(cur)));
check("ta sama wersja: target uzytkownika zostaje", same.targets["bench_bb"] === 50);
check("ta sama wersja: sesje zostaja", same.sessions.length === 1);

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
check("migracja v2->v3: version = 3", migV3.version === SCHEMA_VERSION, migV3.version);
check("migracja v2->v3: bench_bb target zachowany (50)", migV3.targets["bench_bb"] === 50, migV3.targets["bench_bb"]);
check("migracja v2->v3: squat target zachowany (70)", migV3.targets["squat"] === 70, migV3.targets["squat"]);
check(
  "migracja v2->v3: nowe cwiczenia bonusowe maja cel z seeda (brak w starych danych)",
  migV3.targets["face_pull"] === 20,
  migV3.targets["face_pull"]
);
check("migracja v2->v3: sesje zachowane", migV3.sessions.length === 1);

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

console.log(failures === 0 ? "\nWSZYSTKIE TESTY OK" : `\n${failures} TESTOW PADLO`);
process.exit(failures === 0 ? 0 : 1);
