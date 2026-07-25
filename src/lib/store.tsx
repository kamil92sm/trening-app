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
  Session,
  Settings,
  SquashEntry,
  WorkoutDay,
} from "./types";
import {
  CATEGORY_TO_MUSCLE,
  defaultState,
  migrateState,
  OLD_STORAGE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "./seed";
import { computeProgression, type ProgressionResult } from "./logic";
import { uid } from "./utils";

export interface FinishSummary {
  exercise: Exercise;
  result: ProgressionResult;
}

interface Store {
  state: AppState;
  setDayActive(dayId: string, active: boolean): void;
  setTarget(exerciseId: string, weight: number): void;
  finishSession(session: Omit<Session, "id" | "completed">): FinishSummary[];
  deleteSession(sessionId: string): void;
  updateSession(session: Session): void;
  addBody(entry: BodyEntry): void;
  removeBody(date: string): void;
  addSquash(entry: Omit<SquashEntry, "id">): void;
  removeSquash(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  addExercise(exercise: Exercise, target: number): void;
  updateExercise(exercise: Exercise): void;
  setArchived(exerciseId: string, archived: boolean): void;
  updateDay(day: WorkoutDay): void;
  exportJson(): string;
  importJson(json: string): string | null;
  resetAll(): void;
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

      setTarget(exerciseId, weight) {
        mutate((d) => {
          d.targets[exerciseId] = weight;
          return d;
        });
      },

      finishSession(sessionData) {
        // Policzone PRZED mutate: updater przekazany do setState musi być czysty
        // (StrictMode wywołuje go dwa razy w dev) — side-effect (push) w środku
        // podwajał wpisy w summaries.
        const summaries: FinishSummary[] = [];
        for (const entry of sessionData.entries) {
          const ex = state.exercises.find((e) => e.id === entry.exerciseId);
          if (!ex) continue;
          summaries.push({ exercise: ex, result: computeProgression(ex, entry.targetWeight, entry.sets) });
        }
        mutate((d) => {
          const session: Session = { ...sessionData, id: uid(), completed: true };
          d.sessions.push(session);
          for (const s of summaries) {
            d.targets[s.exercise.id] = s.result.nextWeight;
          }
          return d;
        });
        return summaries;
      },

      deleteSession(sessionId) {
        mutate((d) => {
          d.sessions = d.sessions.filter((s) => s.id !== sessionId);
          return d;
        });
      },

      updateSession(session) {
        mutate((d) => {
          const i = d.sessions.findIndex((s) => s.id === session.id);
          if (i >= 0) d.sessions[i] = session;
          return d;
        });
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
          d.settings = { ...d.settings, ...patch };
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

      exportJson() {
        return JSON.stringify(state, null, 2);
      },

      importJson(json) {
        try {
          const parsed = JSON.parse(json);
          if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sessions)) {
            return "To nie wygląda na backup tej aplikacji.";
          }
          setState(migrateState(parsed));
          return null;
        } catch {
          return "Nie udało się odczytać pliku (niepoprawny JSON).";
        }
      },

      resetAll() {
        // "Wyzeruj wszystko" ma naprawdę czyścić historię — ustawiamy flagę
        // historySeeded, żeby dosiew startowych sesji NIE wstrzyknął ich z powrotem.
        setState({ ...defaultState(), historySeeded: true });
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
