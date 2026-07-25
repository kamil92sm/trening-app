import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  weeklyMuscleVolume,
  MUSCLE_RANGES,
  STATUS_COLORS,
  STATUS_LABELS,
  exerciseHistory,
  sessionVolume,
  mondayOf,
  fmtDateShort,
  fmtKg,
  bestE1rm,
  e1rm,
  detectPlateau,
} from "@/lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LineChart, BarChart } from "@/components/Charts";

export function ProgressScreen() {
  const { state, setDayActive } = useStore();

  const volumes = useMemo(() => weeklyMuscleVolume(state), [state]);
  const bonusDay = state.days.find((d) => d.optional) ?? null;

  const exercisesWithHistory = state.exercises.filter(
    (ex) => !ex.archived && state.sessions.some((s) => s.entries.some((e) => e.exerciseId === ex.id))
  );
  const selectable = exercisesWithHistory.length > 0
    ? exercisesWithHistory
    : state.exercises.filter((e) => !e.archived);
  const [selectedId, setSelectedId] = useState<string>(selectable[0]?.id ?? "");
  const selected = state.exercises.find((e) => e.id === selectedId) ?? selectable[0];

  const history = selected ? exerciseHistory(state, selected.id) : [];
  const chartData = history.map((p) => ({ x: new Date(p.date).getTime(), y: p.e1rm }));

  const weeklyTonnage = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const s of state.sessions) {
      const key = mondayOf(s.date);
      byWeek.set(key, (byWeek.get(key) ?? 0) + sessionVolume(state, s));
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([week, v]) => ({ label: fmtDateShort(week), value: Math.round(v) }));
  }, [state]);

  const records = useMemo(() => {
    return state.exercises
      .filter((ex) => !ex.archived && !ex.isHold)
      .map((ex) => {
        let bestW = 0;
        let bestE = 0;
        for (const s of state.sessions) {
          const entry = s.entries.find((e) => e.exerciseId === ex.id);
          if (!entry) continue;
          for (const set of entry.sets) {
            if (!set.done) continue;
            bestW = Math.max(bestW, set.weight);
          }
          bestE = Math.max(bestE, bestE1rm(ex, entry));
        }
        return { ex, bestW, bestE: Math.round(bestE * 10) / 10 };
      })
      .filter((r) => r.bestW > 0);
  }, [state]);

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Progres</h1>

      {/* Objętość tygodniowa per partia */}
      <Card>
        <CardHeader>
          <CardTitle>Objętość tygodniowa</CardTitle>
          <CardDescription>Serie robocze na partię (główna = 1, wspomagająca = ½)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {volumes.map((v) => {
            const range = MUSCLE_RANGES[v.muscle];
            const pct = Math.min((v.sets / (range.max * 1.3)) * 100, 100);
            return (
              <div key={v.muscle}>
                <div className="flex items-baseline justify-between text-xs">
                  <span>{v.muscle}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold" style={{ color: STATUS_COLORS[v.status] }}>
                      {v.sets}
                    </span>{" "}
                    / {range.min}–{range.max}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[v.status] }}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
            {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
              </span>
            ))}
          </div>
          {bonusDay && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-border p-2.5">
              <div>
                <p className="text-xs font-medium">Dzień bonusowy</p>
                <p className="text-[10px] text-muted-foreground">{bonusDay.short}</p>
              </div>
              <Switch
                checked={!!bonusDay.active}
                onCheckedChange={(v) => setDayActive(bonusDay.id, v)}
                accent="#a855f7"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Postęp ćwiczenia */}
      <Card>
        <CardHeader>
          <CardTitle>Postęp ćwiczenia</CardTitle>
          <CardDescription>
            {selected?.isHold ? "Najlepszy czas (s) w kolejnych sesjach" : "Szacowany 1RM (Epley) w kolejnych sesjach"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {selectable.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </Select>
          <LineChart
            data={chartData}
            formatY={(y) => `${Math.round(y)}`}
            formatX={(x) => fmtDateShort(new Date(x).toISOString())}
          />
          {selected && history.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ostatnio: {fmtKg(history[history.length - 1].topWeight)} ×{" "}
              {history[history.length - 1].topReps}
              {selected.isHold ? " s" : ""} · aktualny cel: {fmtKg(state.targets[selected.id] ?? 0)}
            </p>
          )}
          {selected && detectPlateau(state, selected.id) && (
            <p className="rounded-md bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-300">
              Zastój (3 treningi bez postępu). Opcje: mikro-skok +1,25 kg mimo braku kompletu
              powtórzeń, LUB tydzień -30% ciężaru (deload), LUB zamiana ćwiczenia na 4–6 tyg.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tonaż tygodniowy */}
      <Card>
        <CardHeader>
          <CardTitle>Tonaż tygodniowy</CardTitle>
          <CardDescription>Suma kg × powtórzenia (hantle ×2), tygodniami</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={weeklyTonnage} formatValue={(v) => `${(v / 1000).toFixed(1)}t`} />
        </CardContent>
      </Card>

      {/* Rekordy */}
      <Card>
        <CardHeader>
          <CardTitle>Rekordy</CardTitle>
          <CardDescription>Najcięższa seria i najlepszy szacowany 1RM</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak danych — zaloguj pierwszy trening.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {records.map((r) => (
                <div key={r.ex.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="min-w-0 truncate pr-2">{r.ex.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    max {fmtKg(r.bestW)} · e1RM{" "}
                    <span className="font-semibold text-foreground">{fmtKg(r.bestE)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
