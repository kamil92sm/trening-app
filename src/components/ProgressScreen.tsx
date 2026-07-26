import { useMemo, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Muscle } from "@/lib/types";
import {
  weeklyMuscleVolume,
  actualWeeklyMuscleVolume,
  muscleRangesFor,
  STATUS_COLORS,
  STATUS_LABELS,
  exerciseHistory,
  projectHistory,
  sessionVolume,
  mondayOf,
  fmtDateShort,
  fmtKg,
  bestE1rm,
  e1rm,
  detectPlateau,
  type VolumeGoal,
} from "@/lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { LineChart, BarChart } from "@/components/Charts";
import { cn } from "@/lib/utils";

export function ProgressScreen() {
  const { state, setDayActive, updateSettings } = useStore();

  const volumeGoal: VolumeGoal = state.settings.volumeGoal ?? "hypertrophy";
  const [volumeView, setVolumeView] = useState<"planned" | "actual">("planned");
  const [editingRanges, setEditingRanges] = useState(false);
  const ranges = muscleRangesFor(volumeGoal, state.settings.muscleRanges);
  const plannedVolumes = useMemo(() => weeklyMuscleVolume(state, volumeGoal), [state, volumeGoal]);
  const actualVolumes = useMemo(() => actualWeeklyMuscleVolume(state, volumeGoal), [state, volumeGoal]);
  const volumes = volumeView === "planned" ? plannedVolumes : actualVolumes;
  const bonusDay = state.days.find((d) => d.optional) ?? null;

  // P1-5: reczne nadpisanie zakresu min-max dla partii (Progres -> Objetosc).
  // Brak zakresu (null) = usun override, wraca domyslny zakres celu.
  function setMuscleRange(muscle: Muscle, range: { min: number; max: number } | null) {
    const next = { ...(state.settings.muscleRanges ?? {}) };
    if (range) next[muscle] = range;
    else delete next[muscle];
    updateSettings({ muscleRanges: next });
  }

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
  const projection = useMemo(() => projectHistory(history, 3), [history]);
  const projectionData = projection.map((p) => ({ x: new Date(p.date).getTime(), y: p.e1rm }));

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
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Objętość tygodniowa</CardTitle>
            <button
              type="button"
              onClick={() => setEditingRanges((v) => !v)}
              className={cn(
                "shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                editingRanges && "bg-accent text-foreground"
              )}
              aria-label="Edytuj zakresy serii"
            >
              <Pencil size={14} />
            </button>
          </div>
          <CardDescription>
            Serie robocze na partię (główna = 1, wspomagająca = ½) ·{" "}
            {volumeView === "planned" ? "z planu" : "wykonane w ostatnich 7 dniach"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
              {(["planned", "actual"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setVolumeView(view)}
                  className={cn(
                    "px-2.5 py-1.5 transition-colors",
                    volumeView === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {view === "planned" ? "Plan" : "Wykonane (7 dni)"}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
              {(["strength", "hypertrophy"] as const).map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => updateSettings({ volumeGoal: goal })}
                  className={cn(
                    "px-2.5 py-1.5 transition-colors",
                    volumeGoal === goal ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {goal === "strength" ? "Cel: Siła" : "Cel: Hipertrofia"}
                </button>
              ))}
            </div>
          </div>
          {volumes.map((v) => {
            const range = ranges[v.muscle];
            const hasOverride = !!state.settings.muscleRanges?.[v.muscle];
            const pct = Math.min((v.sets / (range.max * 1.3)) * 100, 100);
            return (
              <div key={v.muscle}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="shrink-0">{v.muscle}</span>
                  {editingRanges ? (
                    <div className="flex items-center gap-1">
                      <NumberField
                        value={range.min}
                        fallback={range.min}
                        onChange={(min) => setMuscleRange(v.muscle, { min, max: range.max })}
                        className="h-6 w-12 px-1 text-center text-[11px]"
                      />
                      <span className="text-muted-foreground">–</span>
                      <NumberField
                        value={range.max}
                        fallback={range.max}
                        onChange={(max) => setMuscleRange(v.muscle, { min: range.min, max })}
                        className="h-6 w-12 px-1 text-center text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => setMuscleRange(v.muscle, null)}
                        disabled={!hasOverride}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label={`Resetuj zakres: ${v.muscle}`}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold" style={{ color: STATUS_COLORS[v.status] }}>
                        {v.sets}
                      </span>{" "}
                      / {range.min}–{range.max}
                      {hasOverride && <span className="ml-1 text-[9px] text-purple-300">wł.</span>}
                    </span>
                  )}
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
            projection={projectionData}
            formatY={(y) => `${Math.round(y)}`}
            formatX={(x) => fmtDateShort(new Date(x).toISOString())}
          />
          {projectionData.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Przerywana linia: szacunek na kolejne treningi przy utrzymaniu dotychczasowego tempa
              — nie prognoza, ekstrapolacja trendu.
            </p>
          )}
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
