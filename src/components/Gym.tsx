import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { platePlan, fmtKg, MUSCLE_COLORS } from "@/lib/logic";
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

// ── Timer przerwy ──────────────────────────────────────────────────────────

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

export function RestTimer({
  seconds,
  sound,
  autostartKey,
  stopKey,
  variant = "pill",
}: {
  seconds: number;
  sound: boolean;
  /** zmiana wartości restartuje odliczanie (np. po odhaczeniu serii) */
  autostartKey?: number;
  /** Zmiana wartości ZATRZYMUJE i resetuje do pełnej długości (bez auto-startu) —
   * używane przy przejściu na inne ćwiczenie w trybie skupienia: czas na ogarnięcie
   * sprzętu/ciężaru nie jest odpoczynkiem, więc odliczanie nie ma lecieć w tle. */
  stopKey?: number;
  /** P3-6: "pill" (domyślnie, jak dziś - pływająca pigułka) albo "panel" (duże cyfry
   * + pasek postępu, tryb skupienia). */
  variant?: "pill" | "panel";
}) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const beeped = useRef(false);
  // P4-2: poświata "done" (zielona) zostaje chwilę po zejściu do zera, potem gaśnie
  // sama - inaczej pigułka świeciłaby na zielono aż do następnego auto-startu.
  const [showDoneGlow, setShowDoneGlow] = useState(false);
  const doneGlowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autostartKey === undefined || autostartKey === 0) return;
    setLeft(seconds);
    setRunning(true);
    beeped.current = false;
  }, [autostartKey, seconds]);

  useEffect(() => {
    if (stopKey === undefined) return;
    setRunning(false);
    setLeft(seconds);
    beeped.current = false;
  }, [stopKey]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (sound && !beeped.current) {
            beeped.current = true;
            beep();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, sound]);

  useEffect(() => {
    if (doneGlowTimer.current) clearTimeout(doneGlowTimer.current);
    if (left === 0) {
      setShowDoneGlow(true);
      doneGlowTimer.current = setTimeout(() => setShowDoneGlow(false), 2000);
    } else {
      setShowDoneGlow(false);
    }
    return () => {
      if (doneGlowTimer.current) clearTimeout(doneGlowTimer.current);
    };
  }, [left]);

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const almostDone = running && left > 0 && left <= 5;

  const toggle = () => {
    if (left === 0) setLeft(seconds);
    beeped.current = false;
    setRunning((r) => !r);
  };
  const reset = () => {
    setRunning(false);
    setLeft(seconds);
    beeped.current = false;
  };

  if (variant === "panel") {
    // P3-6: tryb skupienia - duze cyfry + pasek "uciekajacy" w miare odliczania.
    // Bez animate-pulse/animowanego opacity (patrz P0-6) - animujemy tylko width.
    const pct = seconds > 0 ? Math.max(0, Math.min(100, (left / seconds) * 100)) : 0;
    const totalMm = Math.floor(seconds / 60);
    const totalSs = seconds % 60;
    return (
      <div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-4xl tabular-nums",
                left === 0 ? "text-green-400" : almostDone ? "text-amber-400" : "text-foreground"
              )}
            >
              {mm}:{ss.toString().padStart(2, "0")}
            </span>
            <span className="text-sm text-muted-foreground">
              / {totalMm}:{totalSs.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" className="h-9 w-9" onClick={toggle} aria-label={running ? "Pauza" : "Start"}>
              {running ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={reset} aria-label="Reset">
              <RotateCcw size={16} />
            </Button>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", left > 0 && left <= 5 ? "bg-red-500" : "bg-amber-400")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // P4-2: neonowa otoczka pigułki (poza trybem skupienia). "idle" = zero swiecenia
  // (pelny czas, nie leci) - inaczej pigulka swiecilaby przez caly trening bez powodu.
  // Pauza w polowie odliczania traktowana jak idle - swiatlo tylko gdy realnie leci.
  const glowState: "idle" | "running" | "almost" | "done" = showDoneGlow
    ? "done"
    : almostDone
      ? "almost"
      : running
        ? "running"
        : "idle";
  const pct = seconds > 0 ? Math.max(0, Math.min(100, (left / seconds) * 100)) : 0;
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
              left === 0
                ? "text-green-400"
                : almostDone
                  ? "text-amber-400"
                  : running
                    ? "text-foreground"
                    : "text-muted-foreground"
            )}
          >
            {mm}:{ss.toString().padStart(2, "0")}
          </span>
          <div className="mt-0.5 h-[2px] w-[56px] overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
          </div>
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
