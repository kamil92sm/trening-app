import { useState } from "react";
import { Check, ChevronDown, Dumbbell, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtKg, sessionVolume } from "@/lib/logic";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HistoryScreen() {
  const { state, deleteSession } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

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
                <button
                  type="button"
                  className="mt-3 flex items-center gap-1.5 text-xs text-destructive/80 hover:text-destructive"
                  onClick={() => {
                    if (confirm("Usunąć ten trening z historii?")) deleteSession(session.id);
                  }}
                >
                  <Trash2 size={13} /> Usuń trening
                </button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
