// P6-2: cienki hook nad singletonem src/lib/rest-timer-store.ts.
import { useSyncExternalStore } from "react";
import { restTimer, type RestTimerSnapshot } from "@/lib/rest-timer-store";

export function useRestTimerState(): RestTimerSnapshot {
  return useSyncExternalStore(restTimer.subscribe, restTimer.getSnapshot, restTimer.getSnapshot);
}

export { restTimer };
