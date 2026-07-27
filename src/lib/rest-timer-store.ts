// P6-2: singleton store dla timera przerwy — żyje POZA drzewem Reacta, więc
// przeżywa odmontowanie TrainScreen (zmiana zakładki, App.tsx renderuje
// ekrany warunkowo) i przeżywa uśpienie apki (odliczanie liczone z zegara
// ściennego, patrz rest-timer.ts). Subskrybowany przez useSyncExternalStore
// (src/hooks/use-rest-timer.ts).
import {
  type RestTimerState,
  idleState,
  isRunning,
  isPaused,
  startState,
  pauseState,
  resumeState,
  resetState,
  tick,
} from "./rest-timer";

const STORAGE_KEY = "trening-app-rest-timer";

function loadInitial(): RestTimerState {
  if (typeof window === "undefined") return idleState(0);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return idleState(0);
    const p = JSON.parse(raw) as Partial<RestTimerState> | null;
    if (!p || typeof p.totalSec !== "number") return idleState(0);
    return {
      totalSec: p.totalSec,
      endsAt: typeof p.endsAt === "number" ? p.endsAt : null,
      pausedLeftMs: typeof p.pausedLeftMs === "number" ? p.pausedLeftMs : null,
      lastEndedAt: typeof p.lastEndedAt === "number" ? p.lastEndedAt : null,
    };
  } catch {
    return idleState(0);
  }
}

// Ten sam beep co wczesniej w Gym.tsx (P0-3) - przeniesiony tutaj, bo teraz
// go odpala store (moment realnego przekroczenia zera), nie komponent.
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // audio niedostępne — trudno
  }
}

let state: RestTimerState = loadInitial();
let soundEnabled = true;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function notify() {
  listeners.forEach((cb) => cb());
}

function syncInterval() {
  if (typeof window === "undefined") return;
  if (isRunning(state) && intervalId === null) {
    intervalId = setInterval(poll, 250);
  } else if (!isRunning(state) && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Tick 250 ms (nie 1000 - po powrocie z tla cyfra ma sie poprawic natychmiast).
// `state` dostaje NOWA referencje przy KAZDYM pollu (nawet gdy tick() nie
// zmienil danych) - useSyncExternalStore bailuje z re-rendera, gdy getSnapshot
// zwroci Object.is-rowna wartosc, a licznik ma tykac co 250 ms na ekranie.
function poll() {
  const now = Date.now();
  const next = tick(state, now);
  const finished = next !== state;
  state = { ...next };
  if (finished) {
    persist();
    if (soundEnabled) beep();
  }
  syncInterval();
  notify();
}

function setState(next: RestTimerState) {
  state = next;
  persist();
  syncInterval();
  notify();
}

// Powrot z tla / zmiana karty / wygaszenie ekranu: wymuszony natychmiastowy
// przelicz + notify, zamiast czekac do 250 ms (a jesli interval byl w tle
// dlawiony przez iOS - to jedyny pewny moment, kiedy dostaniemy swiezy stan).
if (typeof window !== "undefined") {
  const onWake = () => poll();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onWake();
  });
  window.addEventListener("pageshow", onWake);
  window.addEventListener("focus", onWake);
  syncInterval();
}

function start(totalSec: number) {
  setState(startState(totalSec, Date.now()));
}

/** Zatrzymuje bieżące odliczanie; opcjonalnie ustawia nowy `totalSec` (np. przy zmianie ćwiczenia). */
function stop(totalSec?: number) {
  setState(idleState(totalSec ?? state.totalSec));
}

function pause() {
  if (!isRunning(state)) return;
  setState(pauseState(state, Date.now()));
}

function resume() {
  if (!isPaused(state)) return;
  setState(resumeState(state, Date.now()));
}

/** Start<->pauza; ze stanu zatrzymanego/skończonego startuje pełną długość od nowa. */
function toggle() {
  if (isRunning(state)) pause();
  else if (isPaused(state)) resume();
  else start(state.totalSec);
}

function reset() {
  setState(resetState(state));
}

function setSound(enabled: boolean) {
  soundEnabled = enabled;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): RestTimerState {
  return state;
}

// Bez `this` - metody sa wolane wylacznie jako `restTimer.metoda(...)`, nigdy
// nie destrukturyzowane, ale wolne funkcje ponizej i tak sa odpornejsze na
// przyszle refaktory (np. przekazanie `restTimer.toggle` jako callback).
export const restTimer = { start, stop, pause, resume, toggle, reset, setSound, subscribe, getSnapshot };
