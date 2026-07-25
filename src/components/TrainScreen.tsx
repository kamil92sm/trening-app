import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  TrendingUp,
  MoveRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { useStore, type FinishSummary } from "@/lib/store";
import type { ExerciseLog } from "@/lib/types";
import { fmtKg, sessionVolume } from "@/lib/logic";
import { gistBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RestTimer } from "@/components/Gym";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const DRAFT_KEY = "trening-app-draft";

interface Draft {
  dayId: string;
  date: string;
  entries: ExerciseLog[];
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function TrainScreen() {
  const store = useStore();
  const { state } = store;
  const [draft, setDraft] = useState<Draft | null>(loadDraft);
  const [summary, setSummary] = useState<FinishSummary[] | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(state.settings.restSeconds);
  const pendingBackup = useRef(false);

  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, [draft]);

  // Auto-backup do Gista: state tutaj to zamknięcie z renderu, w którym finish()
  // zostało wywołane — jeszcze BEZ właśnie zakończonej sesji (setState jest
  // asynchroniczny). Backup odpalamy dopiero w efekcie po re-renderze, żeby
  // wysłać już zaktualizowany stan (z nową sesją i nowymi celami).
  useEffect(() => {
    if (!pendingBackup.current) return;
    pendingBackup.current = false;
    const { gistToken, gistId } = state.settings;
    if (!gistToken) return;
    gistBackup(gistToken, state, gistId)
      .then(({ gistId: newGistId }) => {
        store.updateSettings({ gistId: newGistId, lastBackup: new Date().toISOString() });
      })
      .catch((err: unknown) => {
        toast("Auto-backup nieudany", err instanceof Error ? err.message : "Nieznany błąd");
      });
  }, [state]);

  const activeDays = state.days.filter((d) => !d.optional || d.active);

  function startDay(dayId: string) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) return;
    const entries: ExerciseLog[] = day.exerciseIds
      .map((exId) => {
        const ex = state.exercises.find((e) => e.id === exId);
        if (!ex || ex.archived) return null;
        const target = state.targets[exId] ?? 0;
        return {
          exerciseId: exId,
          targetWeight: target,
          sets: Array.from({ length: ex.targetSets }, () => ({
            weight: target,
            reps: ex.isHold ? ex.repMax : ex.repMin,
            done: false,
          })),
        };
      })
      .filter((e): e is ExerciseLog => e !== null);
    setDraft({ dayId, date: new Date().toISOString(), entries });
  }

  function updateSet(entryIdx: number, setIdx: number, patch: Partial<{ weight: number; reps: number; done: boolean }>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const set = next.entries[entryIdx].sets[setIdx];
      Object.assign(set, patch);
      return next;
    });
    if (patch.done === true) {
      const exId = draft?.entries[entryIdx]?.exerciseId;
      const ex = exId ? state.exercises.find((e) => e.id === exId) : undefined;
      setTimerSeconds(ex?.restSeconds ?? state.settings.restSeconds);
      setTimerKey((k) => k + 1);
    }
  }

  function addSet(entryIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const sets = next.entries[entryIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({ weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false });
      return next;
    });
  }

  function removeSet(entryIdx: number, setIdx: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.entries[entryIdx].sets.splice(setIdx, 1);
      return next;
    });
  }

  function finish() {
    if (!draft) return;
    const anyDone = draft.entries.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !confirm("Żadna seria nie jest odhaczona. Zakończyć mimo to?")) return;
    const results = store.finishSession({
      dayId: draft.dayId,
      date: draft.date,
      entries: draft.entries,
    });
    setSummary(results);
    setDraft(null);

    if (state.settings.autoBackup && state.settings.gistToken) {
      // Fire-and-forget: nie blokuje podsumowania treningu. Sam fetch odpala
      // się w efekcie powyżej, po tym jak state odzwierciedli finishSession().
      pendingBackup.current = true;
    }
  }

  function cancel() {
    if (confirm("Porzucić ten trening? Wpisane serie przepadną.")) setDraft(null);
  }

  // ── Podsumowanie po treningu ─────────────────────────────────────────────
  if (summary) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold">Podsumowanie treningu</h1>
        {summary.map(({ exercise, result }) => (
          <Card key={exercise.id}>
            <CardContent className="flex items-start gap-3 p-3">
              <span
                className={cn(
                  "mt-0.5 rounded-full p-1.5",
                  result.status === "up" && "bg-green-500/15 text-green-400",
                  result.status === "hold" && "bg-sky-500/15 text-sky-400",
                  result.status === "deload" && "bg-amber-500/15 text-amber-400"
                )}
              >
                {result.status === "up" ? (
                  <TrendingUp size={16} />
                ) : result.status === "deload" ? (
                  <AlertTriangle size={16} />
                ) : (
                  <MoveRight size={16} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{exercise.name}</p>
                <p className="text-xs text-muted-foreground">{result.message}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button className="w-full" size="lg" onClick={() => setSummary(null)}>
          Zamknij
        </Button>
      </div>
    );
  }

  // ── Wybór dnia ───────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-bold">Cześć, {state.settings.name}! 💪</h1>
        <p className="text-sm text-muted-foreground">Wybierz dzień treningowy:</p>
        {activeDays.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => startDay(day.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <span
              className="h-10 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: day.accent ?? "#38bdf8" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{day.name}</span>
              <span className="block text-xs text-muted-foreground">
                {day.short} · {day.exerciseIds.length} ćwiczeń
              </span>
            </span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }

  // ── Logger serii ─────────────────────────────────────────────────────────
  const day = state.days.find((d) => d.id === draft.dayId);
  const doneCount = draft.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalCount = draft.entries.reduce((n, e) => n + e.sets.length, 0);
  const volume = sessionVolume(state, {
    id: "draft",
    dayId: draft.dayId,
    date: draft.date,
    entries: draft.entries,
    completed: false,
  });

  return (
    <div className="pb-16">
      <div
        className="sticky top-0 z-10 border-b border-border bg-background/95 p-4 backdrop-blur"
        style={{
          // przykryj pasek statusu tłem nagłówka (body ma padding-top pod island)
          marginTop: "calc(env(safe-area-inset-top) * -1)",
          paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold">{day?.name ?? "Trening"}</h1>
            <p className="text-xs text-muted-foreground">
              {day?.short} · {doneCount}/{totalCount} serii · {fmtKg(volume)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={cancel} className="text-muted-foreground">
            <X size={15} /> Porzuć
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {draft.entries.map((entry, ei) => {
          const ex = state.exercises.find((e) => e.id === entry.exerciseId);
          if (!ex) return null;
          const unitLabel = ex.isHold ? "s" : "powt.";
          return (
            <Card key={entry.exerciseId}>
              <CardHeader>
                <CardTitle className="text-sm">{ex.name}</CardTitle>
                <CardDescription>
                  {ex.targetSets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}{" "}
                  {unitLabel} · cel {fmtKg(entry.targetWeight)}
                  {ex.perHand && " (na rękę)"} · RIR {ex.rir}
                </CardDescription>
                {ex.note && <p className="text-[11px] leading-snug text-amber-200/70">{ex.note}</p>}
              </CardHeader>
              <CardContent className="space-y-1.5">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-4 text-xs text-muted-foreground">{si + 1}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      className="h-9 w-20 text-center"
                      value={set.weight === 0 ? "" : set.weight}
                      placeholder="kg"
                      onChange={(e) => updateSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">kg ×</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-16 text-center"
                      value={set.reps === 0 ? "" : set.reps}
                      placeholder={unitLabel}
                      onChange={(e) => updateSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                    />
                    <span className="w-8 text-xs text-muted-foreground">{unitLabel}</span>
                    <button
                      type="button"
                      onClick={() => updateSet(ei, si, { done: !set.done })}
                      className={cn(
                        "ml-auto flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                        set.done
                          ? "border-green-500 bg-green-500/20 text-green-400"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                      aria-label={set.done ? "Odznacz serię" : "Zalicz serię"}
                    >
                      <Check size={16} />
                    </button>
                    {si >= ex.targetSets && (
                      <button
                        type="button"
                        onClick={() => removeSet(ei, si)}
                        className="flex h-9 w-7 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label="Usuń serię"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => addSet(ei)}>
                  <Plus size={14} /> Dodaj serię
                </Button>
              </CardContent>
            </Card>
          );
        })}

        <Button className="w-full" size="lg" onClick={finish}>
          Zakończ trening
        </Button>
      </div>

      <div
        className="fixed left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-1.5 shadow-lg backdrop-blur"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <RestTimer seconds={timerSeconds} sound={state.settings.sound} autostartKey={timerKey} />
      </div>
    </div>
  );
}
