import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppState,
  BodyEntry,
  Exercise,
  GymProfile,
  Session,
  Settings,
  SquashEntry,
  WorkoutDay,
} from "./types";
import {
  CATEGORY_TO_MUSCLE,
  computeRestoredDayPlan,
  defaultState,
  migrateState,
  OLD_STORAGE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "./seed";
import {
  computeProgression,
  dumbbellLadder,
  easyAtRirHigh,
  exerciseForDay,
  exerciseForMode,
  modeBeforeDeload,
  failedAtRirZero,
  gymForDay,
  hypertrophyKeepsRange,
  loggedWorkingWeight,
  weightVsReference,
  type ProgressionResult,
} from "./logic";
import { serializeBackup } from "./backup";
import { validateBackup } from "./validate";
import { uid } from "./utils";

export interface FinishSummary {
  exercise: Exercise;
  result: ProgressionResult;
}

/** P8-5: cel przeliczony po edycji treningu w Historii — do komunikatu dla użytkownika. */
export interface TargetChange {
  exercise: Exercise;
  from: number;
  to: number;
  /** Zapisany do `hyperTargets` (ćwiczenie z własnym celem hipertrofii), nie do `targets`. */
  hyper: boolean;
}

/** Snapshot celów SPRZED zapisu sesji — pozwala cofnąć finishSession (P2-9). */
export interface UndoSnapshot {
  sessionId: string;
  targets: Record<string, number>;
  hyperTargets: Record<string, number>;
  /** P4-5: mesoStartIso SPRZED zapisu — deload go zeruje, undo musi to cofnąć. */
  mesoStartIso?: string;
}

export interface FinishResult {
  summaries: FinishSummary[];
  undo: UndoSnapshot;
}

/** Jeden slot, nadpisywany przed każdym importem/resetem — ratunek po pomyłce, nie drugi backup. */
export const AUTO_BACKUP_KEY = "trening-app-backup-auto";

export interface AutoBackupSnapshot {
  savedAt: string;
  state: AppState;
}

function saveAutoBackupSnapshot(current: AppState) {
  try {
    const snapshot: AutoBackupSnapshot = { savedAt: new Date().toISOString(), state: current };
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage pełny/niedostępny — nie blokuj importu/resetu z tego powodu
  }
}

export function readAutoBackupSnapshot(): AutoBackupSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as AutoBackupSnapshot) : null;
  } catch {
    return null;
  }
}

interface Store {
  state: AppState;
  setDayActive(dayId: string, active: boolean): void;
  /** Serie robocze ćwiczenia w TYM dniu planu (`day.setsOverride`); wartość == `ex.targetSets` czyści nadpisanie. */
  setDaySets(dayId: string, exerciseId: string, sets: number): void;
  setTarget(exerciseId: string, weight: number): void;
  finishSession(session: Omit<Session, "id" | "completed">): FinishResult;
  undoFinishSession(undo: UndoSnapshot): void;
  deleteSession(sessionId: string): void;
  /** Zwraca cele przeliczone po edycji (P8-5) — puste, gdy nic się nie zmieniło. */
  updateSession(session: Session): TargetChange[];
  addBody(entry: BodyEntry): void;
  removeBody(date: string): void;
  addSquash(entry: Omit<SquashEntry, "id">): void;
  removeSquash(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  addExercise(exercise: Exercise, target: number): void;
  updateExercise(exercise: Exercise): void;
  setArchived(exerciseId: string, archived: boolean): void;
  updateDay(day: WorkoutDay): void;
  restoreDayPlan(dayId: string): void;
  addGymProfile(profile: GymProfile): void;
  updateGymProfile(profile: GymProfile): void;
  deleteGymProfile(id: string): void;
  setActiveGymProfile(id: string | null): void;
  exportJson(): string;
  importJson(json: string): string | null;
  resetAll(): void;
  restoreAutoBackup(): string | null;
}

const StoreContext = createContext<Store | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === SCHEMA_VERSION && !oldRaw) return migrateState(parsed);
      const migrated = migrateState(parsed);
      localStorage.removeItem(OLD_STORAGE_KEY);
      return migrated;
    }
    if (oldRaw) {
      const migrated = migrateState(JSON.parse(oldRaw));
      localStorage.removeItem(OLD_STORAGE_KEY);
      return migrated;
    }
  } catch {
    // uszkodzone dane -> świeży start
  }
  return migrateState(null);
}

/**
 * Progresja WSZYSTKICH ćwiczeń jednej sesji — dokładnie ta sama matematyka,
 * której `finishSession` używa w momencie zakończenia treningu.
 *
 * P8-5: wydzielone z `finishSession`, żeby `updateSession` (edycja treningu
 * w Historii) mogło ją PRZELICZYĆ, zamiast zostawiać cele policzone ze starych,
 * poprawionych potem liczb.
 *
 * KONTRAKT: `state.sessions` NIE MOŻE zawierać liczonej sesji — "poprzednia
 * sesja" (autoregulacja RIR) i punkt odniesienia ciężaru (`weightVsReference`)
 * są czytane właśnie z `state.sessions`. `finishSession` spełnia to naturalnie
 * (sesja nie jest jeszcze zapisana), `updateSession` musi ją wyfiltrować.
 */
export function sessionProgressionSummaries(
  state: AppState,
  sessionData: Omit<Session, "id" | "completed">
): FinishSummary[] {
  const mode = sessionData.mode ?? "strength";
  // P4-4: sesje ukończone wcześniej niż ta bieżąca, najnowsza pierwsza -
  // do wykrycia "dwa treningi z rzędu RIR 0 bez kompletu" per ćwiczenie.
  const priorSessions = [...state.sessions].filter((s) => s.completed).sort((a, b) => b.date.localeCompare(a.date));
  const summaries: FinishSummary[] = [];
  const sessionDay = state.days.find((d) => d.id === sessionData.dayId);
  // P7-3: drabinka hantli siłowni PRZYPISANEJ DO DNIA (nie ad hoc wybranej
  // na ten trening) — progresja i `targets` mają reprezentować "normalny"
  // sprzęt tego dnia, niezależnie od tego, gdzie akurat ćwiczono raz.
  const dayGymProfile = gymForDay(state, sessionDay);
  const ladder = dumbbellLadder(state, dayGymProfile);
  // Cel ma się DOSTOSOWAĆ do ciężaru, który realnie poszedł (zgłoszenie
  // Kamila: na siłowni są hantle 22,5 a nie 22 — korekta w loggerze znaczy
  // "innego po prostu nie ma"). WYJĄTEK: siłownia SESJI różni się od
  // siłowni DNIA — czyli Kamil ręcznie przełączył się na inną niż zwykle
  // (ad hoc, np. wyjazd). Wtedy korekta mówi o TAMTYM sprzęcie, a nie
  // o docelowym ciężarze — przeniesienie jej do `targets` zepsułoby
  // progresję po powrocie (FEAT-1, §12; P7-3 doprecyzowanie: siłownia
  // przypisana do dnia to normalny sprzęt tego dnia, więc adaptacja MA
  // działać tam, gdzie kiedyś działała `!activeGymProfileId`).
  const sessionGymId = sessionData.gymProfileId ?? sessionDay?.gymProfileId;
  const adaptTargetToLoggedWeight = sessionGymId === sessionDay?.gymProfileId;
  for (const entry of sessionData.entries) {
    const ex = state.exercises.find((e) => e.id === entry.exerciseId);
    if (!ex) continue;
    // Progresja liczona na ćwiczeniu przeliczonym pod tryb tygodnia (zakres
    // powtórzeń) ORAZ pod liczbę serii roboczych z planu TEGO dnia
    // (`day.setsOverride` — seria dołożona w loggerze zostaje w planie),
    // ale zapisywana pod ID oryginalnego ćwiczenia.
    // P9-3: dla sesji deloadowej zakres powtórzeń liczy się w trybie, z którego
    // wtedy schodził (wariant A). W deloadzie progresja i tak nie zapisuje celów,
    // ale `modeEx` steruje też liczbą serii roboczych i treścią komunikatu.
    const modeEx = exerciseForDay(
      exerciseForMode(ex, mode, mode === "deload" ? modeBeforeDeload(state, sessionData.date) : "strength"),
      sessionDay
    );
    const working = entry.sets.filter((s) => s.done).slice(0, modeEx.targetSets);
    const lastRir = working.length > 0 ? working[working.length - 1].rir : undefined;
    // `null` = serie robocze NIE poszły na jednym ciężarze (niezależnie
    // od obcej siłowni — liczone RAZ, dalej gate'owane osobno per użycie).
    const loggedWeightRaw = loggedWorkingWeight(entry, modeEx.targetSets);
    const loggedWeight = adaptTargetToLoggedWeight ? loggedWeightRaw : null;
    const progressionBase = loggedWeight ?? entry.targetWeight;
    // P7-5: serie poszły na różnych ciężarach I najcięższa zaliczona
    // przewyższa stary cel z planu (`progressionBase` wtedy jest tym
    // NIEAKTUALNYM celem, nie tym co realnie poszło). Wyłączone na obcej
    // siłowni — jak cała adaptacja z §24.1, korekta mówiłaby o TAMTYM
    // sprzęcie. `computeProgression` samo pilnuje, żeby "nowy ciężar"
    // nigdy nie był ≤ temu, co dziś podniesiono (zgłoszenie Kamila,
    // screen 6-7: uginanie bicepsa 16,25→17,5 w trakcie, podsumowanie
    // ogłosiło "nowy ciężar 17,5" — czyli to, co już zrobił).
    const heaviestDone = working.length > 0 ? Math.max(...working.map((s) => s.weight)) : 0;
    const mixedWorkingWeights =
      adaptTargetToLoggedWeight && loggedWeightRaw === null && heaviestDone > entry.targetWeight + 1e-9
        ? heaviestDone
        : undefined;
    // P4-4: poprzednia sesja liczona w JEJ WŁASNYM trybie tygodnia (repMax/
    // targetSets różnią się między Siła/Hipertrofia) - inaczej "sukces" z
    // zeszłego tygodnia mógłby wyglądać jak fail przez sam próg zakresu.
    const prevSession = priorSessions.find((s) => s.entries.some((e) => e.exerciseId === ex.id && e.sets.some((st) => st.done)));
    const prevEntry = prevSession?.entries.find((e) => e.exerciseId === ex.id);
    const prevPlanEx =
      prevSession && prevEntry
        ? exerciseForDay(
            exerciseForMode(ex, prevSession.mode ?? "strength"),
            state.days.find((d) => d.id === prevSession.dayId)
          )
        : null;
    const priorSessionFailedWithRir0 =
      prevPlanEx && prevEntry ? failedAtRirZero(prevPlanEx, prevEntry.sets) : false;
    // Druga strona autoregulacji: poprzedni trening skończony z 3+ w zapasie
    // i bez kompletu powtórzeń = ciężar za lekki (patrz easyAtRirHigh).
    const priorSessionEasyAtRir3 =
      prevPlanEx && prevEntry ? easyAtRirHigh(prevPlanEx, prevEntry.sets) : false;
    // P7-10: ciężar właśnie wskoczył (progressionBase wyższy niż na sesji
    // referencyjnej, POZA deloadem) -> "2+ serie poniżej minimum" to
    // oczekiwany skutek udanej progresji, nie spadek formy. Ten sam
    // helper co P7-1 (weightVsReference), więc "dziś powinien wskoczyć"
    // w karcie i "Spadek formy" w podsumowaniu nigdy sobie nie zaprzeczą.
    const weightJustIncreased =
      weightVsReference(state, ex.id, progressionBase)?.relation === "up";
    summaries.push({
      exercise: ex,
      result: computeProgression(
        modeEx,
        progressionBase,
        entry.sets,
        lastRir,
        priorSessionFailedWithRir0,
        priorSessionEasyAtRir3,
        weightJustIncreased,
        mixedWorkingWeights,
        ladder
      ),
    });
  }
  return summaries;
}

/**
 * P8-5: cele przeliczone po EDYCJI treningu w Historii (`updateSession`).
 * Czysta funkcja — nic nie zapisuje, zwraca listę zmian do zastosowania
 * i pokazania użytkownikowi.
 *
 * Przelicza WYŁĄCZNIE ćwiczenia, dla których edytowana sesja jest NAJŚWIEŻSZA.
 * Jeśli po niej był kolejny trening tego ćwiczenia, to on wyznaczył obecny cel
 * i poprawka sprzed dwóch tygodni nie ma prawa go nadpisać (pełne odtwarzanie
 * historii w przód świadomie NIE jest robione — cele niosą też ręczne korekty
 * z Planu i dosiewy migracji, więc "przeliczenie wszystkiego od zera" umiałoby
 * wyzerować rzeczy, których żadna sesja nie tłumaczy).
 *
 * Tydzień deloadu i sesja nieukończona nie ruszają celów (§18.1).
 */
export function recomputeTargetsForEditedSession(state: AppState, session: Session): TargetChange[] {
  const mode = session.mode ?? "strength";
  if (!session.completed || mode === "deload") return [];
  // Stan "jak w momencie kończenia tego treningu": bez samej sesji i bez
  // wszystkiego, co wydarzyło się po niej (kontrakt sessionProgressionSummaries
  // + uczciwy punkt odniesienia dla `weightVsReference`).
  const before: AppState = {
    ...state,
    sessions: state.sessions.filter((s) => s.id !== session.id && s.date < session.date),
  };
  const isNewestFor = (exId: string) =>
    !state.sessions.some(
      (s) =>
        s.completed &&
        s.id !== session.id &&
        s.date > session.date &&
        s.entries.some((e) => e.exerciseId === exId && e.sets.some((st) => st.done))
    );
  const changes: TargetChange[] = [];
  for (const summary of sessionProgressionSummaries(before, session)) {
    const id = summary.exercise.id;
    if (!isNewestFor(id)) continue;
    const hyper = mode === "hypertrophy" && !hypertrophyKeepsRange(summary.exercise);
    const from = (hyper ? state.hyperTargets?.[id] : state.targets[id]) ?? 0;
    if (Math.abs(from - summary.result.nextWeight) < 1e-9) continue;
    changes.push({ exercise: summary.exercise, from, to: summary.result.nextWeight, hyper });
  }
  return changes;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // brak miejsca / tryb prywatny — trudno, dane zostają w pamięci
    }
  }, [state]);

  const store = useMemo<Store>(() => {
    const mutate = (fn: (draft: AppState) => AppState) =>
      setState((prev) => fn(structuredClone(prev)));

    return {
      state,

      setDayActive(dayId, active) {
        mutate((d) => {
          const day = d.days.find((x) => x.id === dayId);
          if (day) day.active = active;
          return d;
        });
      },

      setDaySets(dayId, exerciseId, sets) {
        mutate((d) => {
          const day = d.days.find((x) => x.id === dayId);
          if (!day) return d;
          const ex = d.exercises.find((e) => e.id === exerciseId);
          const n = Math.max(1, Math.round(sets));
          const next = { ...(day.setsOverride ?? {}) };
          // Powrót do wartości bazowej kasuje nadpisanie — plan zostaje czysty
          // i późniejsza zmiana `targetSets` w bazie ćwiczeń znów działa.
          if (ex && n === ex.targetSets) delete next[exerciseId];
          else next[exerciseId] = n;
          if (Object.keys(next).length === 0) delete day.setsOverride;
          else day.setsOverride = next;
          return d;
        });
      },

      setTarget(exerciseId, weight) {
        mutate((d) => {
          d.targets[exerciseId] = weight;
          // P8-1/P8-3: ręczna zmiana celu w Planie KASUJE cel hipertrofii tego
          // ćwiczenia. Bez tego zmiana w Planie nie miała w trybie Hipertrofia
          // żadnego skutku (widok czytał `hyperTargets`), a apka i tak odsyłała
          // do Planu — ślepy zaułek. Dla ćwiczeń z niezmienionym zakresem cel
          // jest po prostu JEDEN; dla pozostałych (własny cel liczony przez
          // e1RM) skasowany cache odbuduje się z nowej wartości — użytkownik
          // właśnie powiedział, że to ona jest prawdą.
          if (d.hyperTargets) delete d.hyperTargets[exerciseId];
          return d;
        });
      },

      finishSession(sessionData) {
        // Policzone PRZED mutate: updater przekazany do setState musi być czysty
        // (StrictMode wywołuje go dwa razy w dev) — side-effect (push) w środku
        // podwajał wpisy w summaries.
        const mode = sessionData.mode ?? "strength";
        // P1-10: moment ZAKOŃCZENIA (date w sessionData to moment startu, patrz
        // TrainScreen.startDay) — liczony PRZED mutate, żeby StrictMode (dev)
        // podwajające wywołanie updatera nie dało dwóch różnych znaczników czasu.
        const finishedAt = new Date().toISOString();
        const summaries = sessionProgressionSummaries(state, sessionData);
        // P2-9: id i snapshot celów SPRZED zapisu — wygenerowane tutaj (nie w
        // mutate) z tego samego powodu co finishedAt: updater musi być czysty.
        const sessionId = uid();
        const undo: UndoSnapshot = {
          sessionId,
          targets: { ...state.targets },
          hyperTargets: { ...(state.hyperTargets ?? {}) },
          mesoStartIso: state.settings.mesoStartIso,
        };
        mutate((d) => {
          const session: Session = { ...sessionData, id: sessionId, completed: true, finishedAt };
          d.sessions.push(session);
          // P2-8: deload NIE zapisuje progresji — cele zamrożone, wracasz do
          // swoich ciężarów w przyszłym tygodniu. `summaries` i tak wracają do
          // TrainScreen (dla ewentualnego info), po prostu nigdy nie są tu stosowane.
          if (mode === "deload") {
            // P4-5: tydzień deloadu zeruje licznik mezocyklu — objętość po
            // powrocie znów startuje od planu bazowego, nie od narosłych +1/tydzień.
            d.settings = { ...d.settings, mesoStartIso: session.date };
            return d;
          }
          for (const s of summaries) {
            // P8-1: osobny cel hipertrofii ma sens WYŁĄCZNIE dla ćwiczeń,
            // którym ten tryb zmienia zakres powtórzeń (bazowy repMax ≤ 8 —
            // tam cel jest realnie niższy, bo liczony przez e1RM). Gdy zakres
            // zostaje bez zmian, obie ścieżki opisują ten sam ciężar, więc
            // progresja idzie do `targets` — inaczej tydzień siłowy i tydzień
            // hipertroficzny rozjeżdżały cele tego samego ćwiczenia i żaden
            // z nich nigdy nie doganiał drugiego (zgłoszenie Kamila: komplet
            // 3×12 na 17,5 kg podniósł cel siłowy do 18,75, a karta w trybie
            // Hipertrofia dalej pokazywała 17,5).
            if (mode === "hypertrophy" && !hypertrophyKeepsRange(s.exercise)) {
              d.hyperTargets = d.hyperTargets ?? {};
              d.hyperTargets[s.exercise.id] = s.result.nextWeight;
            } else {
              d.targets[s.exercise.id] = s.result.nextWeight;
              if (d.hyperTargets) delete d.hyperTargets[s.exercise.id];
            }
          }
          return d;
        });
        return { summaries, undo };
      },

      undoFinishSession(undo) {
        mutate((d) => {
          d.sessions = d.sessions.filter((s) => s.id !== undo.sessionId);
          d.targets = { ...undo.targets };
          d.hyperTargets = { ...undo.hyperTargets };
          d.settings = { ...d.settings, mesoStartIso: undo.mesoStartIso };
          return d;
        });
      },

      deleteSession(sessionId) {
        mutate((d) => {
          d.sessions = d.sessions.filter((s) => s.id !== sessionId);
          return d;
        });
      },

      updateSession(session) {
        // P8-5: edycja treningu w Historii PRZELICZA progresję. Do tej pory
        // `updateSession` tylko podmieniało sesję — cele zostawały policzone ze
        // starych liczb, więc po poprawieniu wyniku karta w Treningu twierdziła
        // "ostatnio komplet, a cel nie drgnął" i nie dawało się tego naprawić
        // inaczej niż ręczną zmianą celu w Planie.
        //
        // Przeliczamy TYLKO ćwiczenia, dla których edytowana sesja jest
        // NAJŚWIEŻSZA — jeśli po niej był kolejny trening tego ćwiczenia, to on
        // wyznaczył obecny cel i poprawka sprzed dwóch tygodni nie ma prawa go
        // nadpisać. Deload nie rusza celów (są zamrożone, §18.1), sesja
        // nieukończona też nie.
        const changes = recomputeTargetsForEditedSession(state, session);
        mutate((d) => {
          const i = d.sessions.findIndex((s) => s.id === session.id);
          if (i >= 0) d.sessions[i] = session;
          for (const c of changes) {
            if (c.hyper) {
              d.hyperTargets = d.hyperTargets ?? {};
              d.hyperTargets[c.exercise.id] = c.to;
            } else {
              d.targets[c.exercise.id] = c.to;
              if (d.hyperTargets) delete d.hyperTargets[c.exercise.id];
            }
          }
          return d;
        });
        return changes;
      },

      addBody(entry) {
        mutate((d) => {
          const prev = d.body.find((b) => b.date === entry.date);
          d.body = d.body.filter((b) => b.date !== entry.date);
          // Zachowaj wcześniej zapisany obwód pasa, gdy nowy wpis go nie podaje
          // (naturalne "poprawiam tylko wagę" nie może kasować pomiaru pasa).
          d.body.push(
            entry.waist === undefined && prev?.waist !== undefined
              ? { ...entry, waist: prev.waist }
              : entry
          );
          d.body.sort((a, b) => a.date.localeCompare(b.date));
          return d;
        });
      },

      removeBody(date) {
        mutate((d) => {
          d.body = d.body.filter((b) => b.date !== date);
          return d;
        });
      },

      addSquash(entry) {
        mutate((d) => {
          d.squash.push({ ...entry, id: uid() });
          d.squash.sort((a, b) => a.date.localeCompare(b.date));
          return d;
        });
      },

      removeSquash(id) {
        mutate((d) => {
          d.squash = d.squash.filter((s) => s.id !== id);
          return d;
        });
      },

      updateSettings(patch) {
        mutate((d) => {
          // P4-5: włączenie przełącznika startuje mezocykl OD TERAZ (nie od
          // historii) — inaczej stare konto dostałoby od razu wielotygodniowy
          // skok objętości. Ustawiane tylko przy przejściu false/undefined -> true
          // i tylko gdy jeszcze nie ma startu (nie nadpisuje przy kolejnych zapisach).
          const startingMeso = patch.volumeProgression === true && !d.settings.volumeProgression && !d.settings.mesoStartIso;
          d.settings = { ...d.settings, ...patch };
          if (startingMeso) d.settings.mesoStartIso = new Date().toISOString();
          return d;
        });
      },

      addExercise(exercise, target) {
        mutate((d) => {
          if (!exercise.primaryMuscle) {
            exercise.primaryMuscle = CATEGORY_TO_MUSCLE[exercise.category];
          }
          d.exercises.push(exercise);
          d.targets[exercise.id] = target;
          return d;
        });
      },

      updateExercise(exercise) {
        mutate((d) => {
          if (!exercise.primaryMuscle) {
            exercise.primaryMuscle = CATEGORY_TO_MUSCLE[exercise.category];
          }
          const i = d.exercises.findIndex((e) => e.id === exercise.id);
          if (i >= 0) d.exercises[i] = exercise;
          return d;
        });
      },

      setArchived(exerciseId, archived) {
        mutate((d) => {
          const ex = d.exercises.find((e) => e.id === exerciseId);
          if (ex) ex.archived = archived;
          return d;
        });
      },

      updateDay(day) {
        mutate((d) => {
          const i = d.days.findIndex((x) => x.id === day.id);
          if (i >= 0) d.days[i] = day;
          return d;
        });
      },

      restoreDayPlan(dayId) {
        mutate((d) => computeRestoredDayPlan(d, dayId));
      },

      addGymProfile(profile) {
        mutate((d) => {
          d.settings.gymProfiles = [...(d.settings.gymProfiles ?? []), profile];
          return d;
        });
      },

      updateGymProfile(profile) {
        mutate((d) => {
          const list = d.settings.gymProfiles ?? [];
          const i = list.findIndex((p) => p.id === profile.id);
          if (i >= 0) list[i] = profile;
          d.settings.gymProfiles = list;
          return d;
        });
      },

      deleteGymProfile(id) {
        mutate((d) => {
          d.settings.gymProfiles = (d.settings.gymProfiles ?? []).filter((p) => p.id !== id);
          if (d.settings.activeGymProfileId === id) d.settings.activeGymProfileId = undefined;
          return d;
        });
      },

      setActiveGymProfile(id) {
        mutate((d) => {
          d.settings.activeGymProfileId = id ?? undefined;
          return d;
        });
      },

      exportJson() {
        return serializeBackup(state, true);
      },

      importJson(json) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          return "Nie udało się odczytać pliku (niepoprawny JSON).";
        }
        const err = validateBackup(parsed);
        if (err) return err;
        // Kopia bezpieczeństwa PRZED nadpisaniem — ratunek po pomyłce (zły plik,
        // przypadkowy klik). Stan sprzed importu, nie ten właśnie wczytywany.
        saveAutoBackupSnapshot(state);
        const migrated = migrateState(parsed);
        // Bezpieczne backupy nigdy nie zawierają tokenu (patrz serializeBackup), a stare
        // pliki sprzed tego fixu mogły go zawierać — token z importu jest zawsze ignorowany,
        // zachowujemy ten skonfigurowany lokalnie na tym urządzeniu.
        migrated.settings.gistToken = state.settings.gistToken;
        setState(migrated);
        return null;
      },

      resetAll() {
        // Kopia bezpieczeństwa PRZED wyzerowaniem — z tych samych powodów co przy imporcie.
        saveAutoBackupSnapshot(state);
        // "Wyzeruj wszystko" ma naprawdę czyścić historię — ustawiamy flagi
        // historySeeded/historyTargetsSeeded/restSecondsBackfilled/
        // neutralDayLabelsSeeded, żeby jednorazowe dosiewy NIE wstrzyknęły
        // z powrotem historii, nie przeliczyły celów, nie próbowały dolewać
        // restSeconds ani nie nadpisały nazw dni (świeży seed ma już
        // wszystko: nowe nazwy, restSeconds, brak potrzeby historii).
        setState({
          ...defaultState(),
          historySeeded: true,
          historyTargetsSeeded: true,
          restSecondsBackfilled: true,
          neutralDayLabelsSeeded: true,
          rirCalibrated: true,
          planVolumeBumpSeeded: true,
          rdlTargetFixed: true,
          rdlHyperTargetFixed: true,
          plankRangeSeeded: true,
          gymLaddersSeeded: true,
          dumbbellTargetsSnapped: true,
          hyperTargetsUnified: true,
        });
      },

      restoreAutoBackup() {
        const snapshot = readAutoBackupSnapshot();
        if (!snapshot) return "Brak zapisanej kopii automatycznej.";
        setState(snapshot.state);
        return null;
      },
    };
  }, [state]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore poza AppProviderem");
  return ctx;
}
