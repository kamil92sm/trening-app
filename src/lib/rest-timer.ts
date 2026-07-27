// P6-2: stan timera przerwy POZA Reactem, liczony z zegara ściennego
// (`endsAt - now`), nigdy przez dekrementację licznika. Dwa problemy, jedno
// źródło: stary `RestTimer` trzymał `left`/`running` w `useState` (Gym.tsx) —
// (a) zmiana zakładki odmontowuje TrainScreen (App.tsx renderuje ekrany
// warunkowo), więc stan przepadał; (b) `setInterval` dekrementujący co 1 s był
// dławiony przez iOS w tle, więc po powrocie licznik pokazywał czas sprzed
// wyjścia. Tu czas jest ZAWSZE pochodną `Date.now()`, więc oba znikają.
//
// Czysty moduł — bez importu Reacta, bez `window`/`localStorage` — testowalny
// bez DOM-u (patrz tests/logic.test.ts). Warstwa ze store'em/persystencją/
// nasłuchem visibilitychange żyje w src/lib/rest-timer-store.ts.

export interface RestTimerState {
  totalSec: number;
  /** epoch ms, kiedy odliczanie ma dojść do zera; null = nie leci. */
  endsAt: number | null;
  /** !== null = zapauzowany, trzyma pozostały czas w ms z momentu pauzy. */
  pausedLeftMs: number | null;
  /** epoch ms faktycznego zakończenia odliczania — do komunikatu "skończona X temu". */
  lastEndedAt: number | null;
}

const TEN_MIN_MS = 10 * 60 * 1000;

/** Stan spoczynkowy: pokazuje `totalSec`, nic nie leci, nic się nie skończyło. */
export function idleState(totalSec: number): RestTimerState {
  return { totalSec, endsAt: null, pausedLeftMs: null, lastEndedAt: null };
}

export function remainingMs(s: RestTimerState, now: number): number {
  if (s.pausedLeftMs !== null) return Math.max(0, s.pausedLeftMs);
  if (s.endsAt !== null) return Math.max(0, s.endsAt - now);
  if (s.lastEndedAt !== null) return 0;
  return s.totalSec * 1000;
}

export function isRunning(s: RestTimerState): boolean {
  return s.endsAt !== null;
}

export function isPaused(s: RestTimerState): boolean {
  return s.pausedLeftMs !== null;
}

export function isFinished(s: RestTimerState): boolean {
  return s.endsAt === null && s.pausedLeftMs === null && s.lastEndedAt !== null;
}

/**
 * `true` tylko krótko po faktycznym zakończeniu (domyślnie 10 min) — steruje
 * kolorem/komunikatem "skończona X temu" i (w store'ze) widocznością pigułki
 * na innych zakładkach, NIE samym faktem "czy skończona".
 */
export function isFreshlyFinished(s: RestTimerState, now: number, staleMs: number = TEN_MIN_MS): boolean {
  return s.lastEndedAt !== null && now - s.lastEndedAt < staleMs;
}

export function startState(totalSec: number, now: number): RestTimerState {
  return { totalSec, endsAt: now + totalSec * 1000, pausedLeftMs: null, lastEndedAt: null };
}

export function pauseState(s: RestTimerState, now: number): RestTimerState {
  if (s.endsAt === null) return s;
  return { ...s, endsAt: null, pausedLeftMs: Math.max(0, s.endsAt - now) };
}

export function resumeState(s: RestTimerState, now: number): RestTimerState {
  if (s.pausedLeftMs === null) return s;
  return { ...s, endsAt: now + s.pausedLeftMs, pausedLeftMs: null };
}

/** Reset do pełnej długości, zatrzymany — `totalSec` zostaje bez zmian. */
export function resetState(s: RestTimerState): RestTimerState {
  return idleState(s.totalSec);
}

/** Zatrzymanie bieżącego odliczania (bez zmiany `totalSec`) — patrz też store'owe `stop(totalSec)`. */
export function stopState(s: RestTimerState): RestTimerState {
  return idleState(s.totalSec);
}

/**
 * Wołane co tick (250 ms) i przy powrocie z tła: jeśli odliczanie realnie
 * minęło (porównanie z zegarem ściennym, NIE dekrementacja), przechodzi w
 * stan "skończona" — `lastEndedAt` to PRAWDZIWY moment końca (`s.endsAt`), nie
 * `now`, więc "skończona X temu" jest poprawne nawet gdy poll przyszedł z
 * dużym opóźnieniem (apka wróciła z tła po kilku minutach). Zwraca to samo
 * `s` (referencyjnie), gdy nic się nie zmieniło — pozwala wywołującemu
 * odróżnić realną zmianę od zwykłego ticku odświeżającego zegar.
 */
export function tick(s: RestTimerState, now: number): RestTimerState {
  if (s.endsAt !== null && now >= s.endsAt) {
    return { totalSec: s.totalSec, endsAt: null, pausedLeftMs: null, lastEndedAt: s.endsAt };
  }
  return s;
}
