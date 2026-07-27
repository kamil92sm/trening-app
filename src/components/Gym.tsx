import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { platePlan, fmtKg, MUSCLE_COLORS } from "@/lib/logic";
import { remainingMs, isRunning, isPaused, isFinished, isFreshlyFinished } from "@/lib/rest-timer";
import { restTimer, useRestTimerState } from "@/hooks/use-rest-timer";
import type { Exercise, Muscle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Kolorowe tagi partii (P3-7) ─────────────────────────────────────────────

export function MuscleTag({ muscle, kind }: { muscle: Muscle; kind: "primary" | "secondary" }) {
  const color = MUSCLE_COLORS[muscle];
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[9px] leading-none",
        kind === "primary" ? "font-semibold" : "opacity-70"
      )}
      style={{ backgroundColor: `${color}${kind === "primary" ? "33" : "1a"}`, color }}
    >
      {muscle}
      {kind === "secondary" && " ½"}
    </span>
  );
}

/** Tagi partii ćwiczenia (główna + wspomagające) — brak `primaryMuscle` = brak renderu. */
export function MuscleTags({ exercise }: { exercise: Exercise }) {
  if (!exercise.primaryMuscle) return null;
  return (
    <div className="flex flex-wrap gap-1">
      <MuscleTag muscle={exercise.primaryMuscle} kind="primary" />
      {(exercise.secondaryMuscles ?? []).map((m) => (
        <MuscleTag key={m} muscle={m} kind="secondary" />
      ))}
    </div>
  );
}

// ── Wizualny kalkulator talerzy ────────────────────────────────────────────

export function PlateBar({
  target,
  barWeight,
  plates,
  compact,
}: {
  target: number;
  barWeight: number;
  plates: number[];
  /** P3-5: mniejsza wersja do loggera (Trening) - "Wiecej" zostaje pelnowymiarowa. */
  compact?: boolean;
}) {
  const plan = platePlan(target, barWeight, plates);
  const maxPlate = Math.max(...plates, 25);

  return (
    <div>
      <div className={cn("flex items-center justify-center gap-[3px]", compact ? "h-16" : "h-24")}>
        {/* gryf */}
        <div className={cn("rounded-l bg-zinc-500", compact ? "h-1.5 w-10" : "h-2 w-16")} />
        <div className={cn("bg-zinc-400", compact ? "h-4 w-1.5" : "h-6 w-2")} />
        {plan.perSide.map((p, i) => {
          const h = (28 + (p / maxPlate) * 60) * (compact ? 0.65 : 1);
          return (
            <div
              key={i}
              className="flex items-center justify-center rounded-sm bg-primary/80 text-[9px] font-bold text-primary-foreground"
              style={{ height: h, width: p >= 10 ? (compact ? 12 : 14) : compact ? 8 : 10 }}
            >
              {p >= 10 && !compact ? p : ""}
            </div>
          );
        })}
        <div className={cn("rounded-r bg-zinc-500", compact ? "h-1.5 w-7" : "h-2 w-10")} />
      </div>
      <div className="mt-1 text-center text-xs text-muted-foreground">
        {plan.perSide.length > 0 ? (
          <>
            Na stronę: <span className="font-medium text-foreground">{plan.perSide.join(" + ")}</span>
          </>
        ) : (
          "Sam gryf"
        )}
        {!plan.ok && plan.leftover > 0 && (
          <span className="text-amber-400"> · brakuje {fmtKg(plan.leftover)}</span>
        )}
        {!plan.ok && plan.leftover < 0 && (
          <span className="text-amber-400"> · cel lżejszy niż gryf</span>
        )}
      </div>
    </div>
  );
}

// ── Timer przerwy (P6-2) ────────────────────────────────────────────────────
// Stan (`RestTimerState`) i zegar zyja w src/lib/rest-timer-store.ts, POZA
// Reactem - ten komponent go tylko CZYTA (useRestTimerState) i steruje nim
// przez restTimer.toggle()/reset(). Zadnego lokalnego `left`/`running` w
// useState: odmontowanie tego komponentu (zmiana zakladki) juz nie gubi
// odliczania, a `beep()` (w store'ze) odpala sie raz - w momencie realnego
// przekroczenia zera z zegara sciennego, nie z dekrementowanego licznika.

function fmtMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/** "przed chwilą" / "N min temu" - do komunikatu o przerwie zakonczonej w tle. */
function fmtAgo(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return "przed chwilą";
  return `${Math.floor(totalSec / 60)} min temu`;
}

export function RestTimer({ variant = "pill" }: {
  /** P3-6: "pill" (domyślnie, jak dziś - pływająca pigułka) albo "panel" (duże cyfry
   * + pasek postępu, tryb skupienia). */
  variant?: "pill" | "panel";
}) {
  const state = useRestTimerState();
  const now = Date.now();
  const left = remainingMs(state, now);
  const running = isRunning(state);
  const paused = isPaused(state);
  const finished = isFinished(state);
  // P4-2: poswiata "done" (zielona) - okno ~2s tuz po zejsciu do zera, ten sam
  // efekt co dawny `showDoneGlow`, teraz liczony z `lastEndedAt` zamiast z timeoutu.
  const justFinished = isFreshlyFinished(state, now, 2000);
  // P6-2 pkt 5: "Przerwa skonczona X temu" - tylko gdy realnie minela w tle
  // (>5s, zeby nie dublowac poswiaty przy normalnym, obserwowanym zejsciu do
  // zera) i nie dawniej niz ~10 min (potem po prostu wyzeruj - patrz spec).
  const agoMs = state.lastEndedAt !== null ? now - state.lastEndedAt : 0;
  const showAgo = finished && isFreshlyFinished(state, now, 10 * 60 * 1000) && agoMs > 5000;
  const doneColor = finished && isFreshlyFinished(state, now, 10 * 60 * 1000);
  const almostDone = running && left > 0 && left <= 5000;
  // P6-5: w spoczynku (nikt jeszcze nie startowal TEGO odliczania) pigulka/panel
  // maja mowic co pokazuja - "Przerwa: Przysiad", nie goly "3:00" bez kontekstu.
  const showLabel = !running && !paused && !finished && state.label !== null;

  const toggle = () => restTimer.toggle();
  const reset = () => restTimer.reset();

  if (variant === "panel") {
    // P3-6: tryb skupienia - duze cyfry + pasek "uciekajacy" w miare odliczania.
    // Bez animate-pulse/animowanego opacity (patrz P0-6) - animujemy tylko width.
    const pct = state.totalSec > 0 ? Math.max(0, Math.min(100, (left / (state.totalSec * 1000)) * 100)) : 0;
    return (
      <div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-4xl tabular-nums",
                doneColor ? "text-green-400" : almostDone ? "text-amber-400" : "text-foreground"
              )}
            >
              {fmtMmSs(left)}
            </span>
            <span className="text-sm text-muted-foreground">/ {fmtMmSs(state.totalSec * 1000)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9"
              onClick={toggle}
              aria-label={running ? "Pauza" : "Start"}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={reset} aria-label="Reset">
              <RotateCcw size={16} />
            </Button>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", left > 0 && left <= 5000 ? "bg-red-500" : "bg-amber-400")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {showAgo && <p className="mt-1 text-[11px] text-green-400">Przerwa skończona {fmtAgo(agoMs)}</p>}
        {showLabel && <p className="mt-1 truncate text-[11px] text-muted-foreground">Przerwa: {state.label}</p>}
      </div>
    );
  }

  // P4-2: neonowa otoczka pigułki (poza trybem skupienia). "idle" = zero swiecenia
  // (pelny czas, nie leci) - inaczej pigulka swiecilaby przez caly trening bez powodu.
  // Pauza w polowie odliczania traktowana jak idle - swiatlo tylko gdy realnie leci.
  const glowState: "idle" | "running" | "almost" | "done" = justFinished
    ? "done"
    : almostDone
      ? "almost"
      : running
        ? "running"
        : "idle";
  const pct = state.totalSec > 0 ? Math.max(0, Math.min(100, (left / (state.totalSec * 1000)) * 100)) : 0;
  const barColor =
    glowState === "done" ? "bg-green-400" : glowState === "almost" ? "bg-amber-400" : glowState === "running" ? "bg-sky-400" : "bg-muted-foreground/30";

  return (
    <div className="relative">
      {/* Warstwa poświaty - BEZ backdrop-blur (ten jest na wrapperze w TrainScreen),
          translateZ(0) promuje ją do własnej warstwy GPU, żeby animacja box-shadow
          nie wymuszała repaintu rozmytego tła pigułki (patrz P0-6). */}
      <span aria-hidden className="rest-glow" data-state={glowState} style={{ transform: "translateZ(0)" }} />
      <div className="relative flex items-center gap-2">
        {/* Bez animate-pulse: pulsujące opacity wewnątrz pigułki z backdrop-blur
            zmusza iOS Safari do repaintu całej rozmytej warstwy co klatkę —
            wygląda jak "rozjeżdżanie się". Sam kolor + istniejący beep() wystarczą. */}
        <TimerReset size={16} className={cn("text-muted-foreground", almostDone && "text-amber-400")} />
        <div className="flex flex-col items-center">
          <span
            className={cn(
              "w-[56px] text-center font-mono text-lg tabular-nums",
              doneColor ? "text-green-400" : almostDone ? "text-amber-400" : running ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {fmtMmSs(left)}
          </span>
          <div className="mt-0.5 h-[2px] w-[56px] overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
          </div>
          {showAgo && (
            <span className="mt-0.5 w-[56px] truncate text-center text-[8px] leading-none text-green-400/80">
              {fmtAgo(agoMs)}
            </span>
          )}
          {showLabel && (
            <span className="mt-0.5 w-[56px] truncate text-center text-[8px] leading-none text-muted-foreground">
              {state.label}
            </span>
          )}
        </div>
        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={toggle} aria-label={running ? "Pauza" : "Start"}>
          {running ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={reset} aria-label="Reset">
          <RotateCcw size={14} />
        </Button>
      </div>
    </div>
  );
}

/** Czy warto pokazać pływającą pigułkę (poza trybem skupienia): leci, jest
 * zapauzowana, albo skończyła się niedawno (<10 min - potem sama "znika",
 * patrz rest-timer.ts:isFreshlyFinished). Używane w App.tsx do decyzji, czy
 * w ogóle montować <RestTimer variant="pill" /> na bieżącej zakładce. */
export function useShowRestPill(): boolean {
  const state = useRestTimerState();
  const now = Date.now();
  return isRunning(state) || isPaused(state) || (isFinished(state) && isFreshlyFinished(state, now, 10 * 60 * 1000));
}
