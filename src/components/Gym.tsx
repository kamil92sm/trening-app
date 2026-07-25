import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { platePlan, fmtKg } from "@/lib/logic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Wizualny kalkulator talerzy ────────────────────────────────────────────

export function PlateBar({
  target,
  barWeight,
  plates,
}: {
  target: number;
  barWeight: number;
  plates: number[];
}) {
  const plan = platePlan(target, barWeight, plates);
  const maxPlate = Math.max(...plates, 25);

  return (
    <div>
      <div className="flex h-24 items-center justify-center gap-[3px]">
        {/* gryf */}
        <div className="h-2 w-16 rounded-l bg-zinc-500" />
        <div className="h-6 w-2 bg-zinc-400" />
        {plan.perSide.map((p, i) => {
          const h = 28 + (p / maxPlate) * 60;
          return (
            <div
              key={i}
              className="flex items-center justify-center rounded-sm bg-primary/80 text-[9px] font-bold text-primary-foreground"
              style={{ height: h, width: p >= 10 ? 14 : 10 }}
            >
              {p >= 10 ? p : ""}
            </div>
          );
        })}
        <div className="h-2 w-10 rounded-r bg-zinc-500" />
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
}: {
  seconds: number;
  sound: boolean;
  /** zmiana wartości restartuje odliczanie (np. po odhaczeniu serii) */
  autostartKey?: number;
}) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const beeped = useRef(false);

  useEffect(() => {
    if (autostartKey === undefined || autostartKey === 0) return;
    setLeft(seconds);
    setRunning(true);
    beeped.current = false;
  }, [autostartKey, seconds]);

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

  const mm = Math.floor(left / 60);
  const ss = left % 60;

  return (
    <div className="flex items-center gap-2">
      <TimerReset size={16} className="text-muted-foreground" />
      <span
        className={cn(
          "min-w-[52px] font-mono text-lg tabular-nums",
          left === 0 ? "text-green-400" : running ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
      <Button
        size="icon"
        variant="secondary"
        className="h-8 w-8"
        onClick={() => {
          if (left === 0) setLeft(seconds);
          beeped.current = false;
          setRunning((r) => !r);
        }}
        aria-label={running ? "Pauza" : "Start"}
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => {
          setRunning(false);
          setLeft(seconds);
          beeped.current = false;
        }}
        aria-label="Reset"
      >
        <RotateCcw size={14} />
      </Button>
    </div>
  );
}
