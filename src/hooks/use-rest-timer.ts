// P6-2: cienki hook nad singletonem src/lib/rest-timer-store.ts.
import { useSyncExternalStore } from "react";
import { restTimer } from "@/lib/rest-timer-store";
import type { RestTimerState } from "@/lib/rest-timer";

export function useRestTimerState(): RestTimerState {
  return useSyncExternalStore(restTimer.subscribe, restTimer.getSnapshot, restTimer.getSnapshot);
}

export { restTimer };
