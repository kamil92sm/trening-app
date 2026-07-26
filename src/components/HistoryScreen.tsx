import { useState } from "react";
import { Check, ChevronDown, Dumbbell, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";
import { fmtDate, fmtKg, sessionVolume, sessionDuration } from "@/lib/logic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function HistoryScreen() {
  const { state, deleteSession, updateSession } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Session | null>(null);

  function setEditSet(entryIdx: number, setIdx: number, patch: Partial<{ weight: number; reps: number; done: boolean }>) {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      Object.assign(next.entries[entryIdx].sets[setIdx], patch);
      return next;
    });
  }

  function saveEdit() {
    if (!editing) return;
    updateSession(editing);
    setEditing(null);
    toast("Zapisano zmiany w treningu");
  }

  const sessions = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 p-4 text-center">
        <Dumbbell size={40} className="text-muted-foreground/40" />
        <h1 className="font-semibold">Jeszcze pusto</h1>
        <p className="max-w-[240px] text-sm text-muted-foreground">
          Zakończone treningi pojawią się tutaj. Wejdź w zakładkę Trening i zacznij pierwszy!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Historia ({sessions.length})</h1>
      {sessions.map((session) => {
        const day = state.days.find((d) => d.id === session.dayId);
        const open = expanded === session.id;
        const doneSets = session.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
        const duration = sessionDuration(session);
        return (
          <Card key={session.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 p-3 text-left"
              onClick={() => setExpanded(open ? null : session.id)}
            >
              <span
                className="h-9 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: day?.accent ?? "#38bdf8" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {day?.name ?? "Trening"} · {day?.short}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDate(session.date)} · {doneSets} serii · {fmtKg(sessionVolume(state, session))}
                  {duration !== null && ` · ${duration} min`}
                </span>
              </span>
              <ChevronDown
                size={16}
                className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              />
            </button>
            {open && (
              <CardContent className="border-t border-border/60 pt-3">
                <div className="space-y-2.5">
                  {session.entries.map((entry) => {
                    const ex = state.exercises.find((e) => e.id === entry.exerciseId);
                    return (
                      <div key={entry.exerciseId}>
                        <p className="text-xs font-medium">{ex?.name ?? entry.exerciseId}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {entry.sets.map((s, i) => (
                            <span
                              key={i}
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] tabular-nums",
                                s.done
                                  ? "border-green-500/40 bg-green-500/10 text-green-300"
                                  : "border-border text-muted-foreground line-through"
                              )}
                            >
                              {s.weight}×{s.reps}
                              {ex?.isHold ? "s" : ""}
                              {s.done && <Check size={10} />}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setEditing(structuredClone(session))}
                  >
                    <Pencil size={13} /> Edytuj
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-destructive/80 hover:text-destructive"
                    onClick={() => {
                      if (confirm("Usunąć ten trening z historii?")) deleteSession(session.id);
                    }}
                  >
                    <Trash2 size={13} /> Usuń trening
                  </button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Edytuj trening">
        {editing && (
          <div className="space-y-3">
            {editing.entries.map((entry, ei) => {
              const ex = state.exercises.find((e) => e.id === entry.exerciseId);
              const unitLabel = ex?.isHold ? "s" : "powt.";
              return (
                <div key={entry.exerciseId}>
                  <p className="text-xs font-medium">{ex?.name ?? entry.exerciseId}</p>
                  <div className="mt-1 space-y-1.5">
                    {entry.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="w-4 text-xs text-muted-foreground">{si + 1}</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.25"
                          className="h-8 w-20 text-center"
                          value={s.weight}
                          onChange={(e) => setEditSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">kg ×</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          className="h-8 w-16 text-center"
                          value={s.reps}
                          onChange={(e) => setEditSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                        />
                        <span className="w-8 text-xs text-muted-foreground">{unitLabel}</span>
                        <button
                          type="button"
                          onClick={() => setEditSet(ei, si, { done: !s.done })}
                          className={cn(
                            "ml-auto flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                            s.done
                              ? "border-green-500 bg-green-500/20 text-green-400"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                          aria-label={s.done ? "Odznacz serię" : "Zalicz serię"}
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Button className="w-full" onClick={saveEdit}>
              Zapisz zmiany
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
