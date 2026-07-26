import { useMemo, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Muscle } from "@/lib/types";
import {
  weeklyMuscleVolume,
  actualWeeklyMuscleVolume,
  actualVolumeWindow,
  muscleRangesFor,
  STATUS_COLORS,
  STATUS_LABELS,
  exerciseHistory,
  projectHistory,
  sessionVolume,
  sessionDuration,
  weeklyAdherence,
  strengthRatios,
  mondayOf,
  fmtDateShort,
  fmtKg,
  fmtTonnage,
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
  const [volumeMetric, setVolumeMetric] = useState<"sets" | "tonnage">("sets");
  const [editingRanges, setEditingRanges] = useState(false);
  const ranges = muscleRangesFor(volumeGoal, state.settings.muscleRanges);
  const plannedVolumes = useMemo(() => weeklyMuscleVolume(state, volumeGoal), [state, volumeGoal]);
  const actualVolumes = useMemo(() => actualWeeklyMuscleVolume(state, volumeGoal), [state, volumeGoal]);
  const volumes = volumeView === "planned" ? plannedVolumes : actualVolumes;
  // P3-3: kontekst okna "Wykonane (7 dni)" - tlumaczy, kiedy i dlaczego liczby
  // pokrywaja sie z planem (zbieznosc danych, nie blad).
  const actualWindow = useMemo(() => actualVolumeWindow(state), [state]);
  const plannedByMuscle = useMemo(() => new Map(plannedVolumes.map((v) => [v.muscle, v.sets])), [plannedVolumes]);
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
  // P2-2: dni squasha jako pionowe znaczniki na wykresie postępu — korelacja
  // zostawiona człowiekowi do oceny, apka tylko pokazuje surowe dane obok siebie.
  const squashMarkers = useMemo(() => state.squash.map((s) => new Date(s.date).getTime()), [state.squash]);
  const projectionData = projection.map((p) => ({ x: new Date(p.date).getTime(), y: p.e1rm }));
  // Zakres X wykresu (bez punktów projekcji) — do sprawdzenia, czy warto pokazac
  // podpis "fioletowa kreska = squash" (pusty gdy brak historii cwiczenia).
  const chartXs = chartData.map((d) => d.x);
  const hasVisibleSquashMarker =
    chartXs.length > 0 && squashMarkers.some((m) => m >= Math.min(...chartXs) && m <= Math.max(...chartXs));

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

  // P1-10: sredni czas i gestosc (kg/min) z tych samych ostatnich 8 tygodni co
  // wykres tonazu wyzej. Tylko sesje z policzalnym sessionDuration (finishedAt).
  const sessionStats = useMemo(() => {
    const weekKeys = [...new Set(state.sessions.map((s) => mondayOf(s.date)))].sort();
    const last8Weeks = new Set(weekKeys.slice(-8));
    const withDuration = state.sessions
      .filter((s) => last8Weeks.has(mondayOf(s.date)))
      .map((s) => ({ duration: sessionDuration(s), volume: sessionVolume(state, s) }))
      .filter((s): s is { duration: number; volume: number } => s.duration !== null);
    if (withDuration.length === 0) return null;
    const totalMinutes = withDuration.reduce((sum, s) => sum + s.duration, 0);
    const totalVolume = withDuration.reduce((sum, s) => sum + s.volume, 0);
    return {
      avgDuration: Math.round(totalMinutes / withDuration.length),
      avgDensity: Math.round(totalVolume / totalMinutes),
      count: withDuration.length,
    };
  }, [state]);

  // P2-11: konsekwencja - ukonczone treningi ostatnich 8 tygodni vs plan.
  const adherence = useMemo(() => weeklyAdherence(state), [state]);
  const completeWeeks = adherence.filter((w) => w.done >= w.planned).length;

  // P2-12: standardy silowe wzgledem masy ciala - ciekawostka, karta ukryta gdy brak danych.
  const strengthRatiosData = useMemo(() => strengthRatios(state), [state]);

  // P3-8: baza urosla do ~90 pozycji - jeden przebieg po sesjach (Map exId->best)
  // zamiast petli po kazdym cwiczeniu ze skanowaniem wszystkich sesji w srodku.
  const records = useMemo(() => {
    const exById = new Map(state.exercises.map((ex) => [ex.id, ex]));
    const best = new Map<string, { bestW: number; bestE: number }>();
    for (const s of state.sessions) {
      for (const entry of s.entries) {
        const ex = exById.get(entry.exerciseId);
        if (!ex || ex.archived || ex.isHold) continue;
        const acc = best.get(ex.id) ?? { bestW: 0, bestE: 0 };
        for (const set of entry.sets) {
          if (!set.done) continue;
          acc.bestW = Math.max(acc.bestW, set.weight);
        }
        acc.bestE = Math.max(acc.bestE, bestE1rm(ex, entry));
        best.set(ex.id, acc);
      }
    }
    // Kolejnosc jak w state.exercises (plan) - zachowanie identyczne jak przed zmiana.
    return state.exercises
      .filter((ex) => best.has(ex.id))
      .map((ex) => {
        const { bestW, bestE } = best.get(ex.id)!;
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
            {volumeMetric === "sets" && (
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
            )}
          </div>
          <CardDescription>
            {volumeMetric === "sets"
              ? "Serie robocze na partię (główna = 1, wspomagająca = ½)"
              : "Tonaż na partię (kg × powtórzenia, hantle ×2)"}{" "}
            · {volumeView === "planned" ? "z planu" : "wykonane w ostatnich 7 dniach"}
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
              {(["sets", "tonnage"] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => {
                    setVolumeMetric(metric);
                    if (metric === "tonnage") setEditingRanges(false);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 transition-colors",
                    volumeMetric === metric ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {metric === "sets" ? "Serie" : "kg"}
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
          {volumeView === "actual" && (
            <p className="text-[10px] text-muted-foreground">
              {actualWindow.sessions === 0
                ? "Brak treningów w tym oknie"
                : `${actualWindow.sessions} ${
                    actualWindow.sessions === 1 ? "trening" : actualWindow.sessions < 5 ? "treningi" : "treningów"
                  } · ${fmtDateShort(actualWindow.fromIso)}–${fmtDateShort(actualWindow.toIso)}`}
            </p>
          )}
          {(() => {
            const maxTonnage = Math.max(1, ...volumes.map((v) => v.tonnage));
            return volumes.map((v) => {
            if (volumeMetric === "tonnage") {
              const pct = Math.min((v.tonnage / maxTonnage) * 100, 100);
              return (
                <div key={v.muscle}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="shrink-0">{v.muscle}</span>
                    <span className="tabular-nums font-semibold text-foreground">{fmtTonnage(v.tonnage)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            }
            const range = ranges[v.muscle];
            const hasOverride = !!state.settings.muscleRanges?.[v.muscle];
            const pct = Math.min((v.sets / (range.max * 1.3)) * 100, 100);
            // P3-3: w widoku "Wykonane" pokaz cien planu (marker + delta) -
            // to odpowiedz na "czemu to samo co plan?": widac wprost, ze
            // wartosci sa rowne albo o ile sie rozjezdzaja.
            const planned = volumeView === "actual" ? plannedByMuscle.get(v.muscle) ?? 0 : null;
            const delta = planned !== null ? +(v.sets - planned).toFixed(1) : 0;
            const plannedPct = planned !== null ? Math.min((planned / (range.max * 1.3)) * 100, 100) : 0;
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
                      {planned !== null && (
                        <span className="ml-1 text-[10px]">
                          (plan {planned}
                          {delta !== 0 && (
                            <span className={delta > 0 ? "text-sky-400" : "text-amber-400"}>
                              {delta > 0 ? `, +${delta}` : `, ${delta}`}
                            </span>
                          )}
                          )
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="relative mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[v.status] }}
                  />
                  {planned !== null && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-foreground/60"
                      style={{ left: `${plannedPct}%` }}
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            );
            });
          })()}
          {volumeMetric === "sets" && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
              {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                  {STATUS_LABELS[s]}
                </span>
              ))}
            </div>
          )}
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
            markers={squashMarkers}
            formatY={(y) => `${Math.round(y)}`}
            formatX={(x) => fmtDateShort(new Date(x).toISOString())}
          />
          {projectionData.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Przerywana linia: szacunek na kolejne treningi przy utrzymaniu dotychczasowego tempa
              — nie prognoza, ekstrapolacja trendu.
            </p>
          )}
          {hasVisibleSquashMarker && (
            <p className="text-[10px] text-muted-foreground">
              <span className="mr-1 inline-block h-2 w-0.5 bg-purple-400 align-middle" /> Fioletowa
              kreska: dzień squasha. Wniosek o wpływie na siłę zostaw sobie — apka tylko pokazuje daty obok siebie.
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
          {sessionStats && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Śr. czas treningu: <span className="font-medium text-foreground">{sessionStats.avgDuration} min</span>
              {" · "}gęstość: <span className="font-medium text-foreground">{sessionStats.avgDensity} kg/min</span>
              {" "}(z {sessionStats.count} {sessionStats.count === 1 ? "treningu z czasem" : "treningów z czasem"})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Konsekwencja */}
      <Card>
        <CardHeader>
          <CardTitle>Konsekwencja</CardTitle>
          <CardDescription>Ukończone treningi tygodniami — najsilniejszy predyktor wyniku</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between gap-1">
            {adherence.map((w) => {
              const status = w.done === 0 ? "zero" : w.done >= w.planned ? "full" : "partial";
              const color = status === "full" ? "#22c55e" : status === "partial" ? "#f59e0b" : "#71717a";
              return (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: w.planned }).map((_, i) => (
                      <div
                        key={i}
                        className="h-2.5 w-2.5 rounded-full"
                        style={
                          i < w.done
                            ? { backgroundColor: color }
                            : { border: "1px solid currentColor", opacity: 0.25 }
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[8px] text-muted-foreground">{fmtDateShort(w.week)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {completeWeeks}/{adherence.length} tygodni z kompletem
          </p>
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

      {/* Standardy siłowe */}
      {strengthRatiosData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Standardy siłowe</CardTitle>
            <CardDescription>e1RM względem masy ciała — orientacyjnie, mężczyźni bez sprzętu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {strengthRatiosData.map((r) => (
              <div key={r.exId} className="flex items-center justify-between text-xs">
                <span>{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.ratio.toFixed(2)}× <span className="font-medium text-foreground">{r.level}</span>
                </span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted-foreground">
              Progi orientacyjne z ogólnych tabel siłowych — nie uwzględniają wieku, wzrostu ani
              dźwigni. Ciekawostka, nie ocena.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
