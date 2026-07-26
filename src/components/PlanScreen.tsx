import { useState, type InputHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Category, Exercise, Unit } from "@/lib/types";
import { fmtKg } from "@/lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { uid, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const CATEGORIES: Category[] = [
  "Klatka", "Plecy", "Barki", "Nogi", "Pośladki", "Łydki", "Biceps", "Triceps", "Brzuch", "Inne",
];
const UNITS: { value: Unit; label: string }[] = [
  { value: "barbell", label: "Sztanga" },
  { value: "dumbbell", label: "Hantle" },
  { value: "machine", label: "Maszyna" },
  { value: "cable", label: "Wyciąg" },
  { value: "bodyweight", label: "Masa ciała" },
];

function parseNum(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && raw.trim() !== "" ? n : null;
}

function formatNum(n: number): string {
  return String(n).replace(".", ",");
}

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  value: number;
  onChange: (n: number) => void;
  fallback: number;
  decimal?: boolean;
}

// Wewnętrzny surowy string zamiast sterowania bezpośrednio liczbą — pozwala
// wyczyścić pole do pusta i wpisać przecinek, zanim wartość jest parsowalna.
function NumberField({ value, onChange, fallback, decimal, ...props }: NumberFieldProps) {
  const [raw, setRaw] = useState(() => formatNum(value));
  const pattern = decimal ? /^\d*[.,]?\d*$/ : /^\d*$/;
  return (
    <Input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        if (!pattern.test(v)) return;
        setRaw(v);
        const n = parseNum(v);
        if (n !== null) onChange(n);
      }}
      onBlur={() => {
        const n = parseNum(raw) ?? fallback;
        onChange(n);
        setRaw(formatNum(n));
      }}
      {...props}
    />
  );
}

interface EditorState {
  exercise: Exercise;
  target: number;
  isNew: boolean;
}

export function PlanScreen() {
  const store = useStore();
  const { state } = store;
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  function openNew() {
    setEditor({
      isNew: true,
      target: 20,
      exercise: {
        id: uid(),
        name: "",
        category: "Inne",
        unit: "barbell",
        perHand: false,
        isHold: false,
        repMin: 8,
        repMax: 12,
        targetSets: 3,
        increment: 2.5,
        rir: 2,
      },
    });
  }

  function openEdit(ex: Exercise) {
    setEditor({ isNew: false, exercise: structuredClone(ex), target: state.targets[ex.id] ?? 0 });
  }

  function saveEditor() {
    if (!editor) return;
    const ex = editor.exercise;
    if (!ex.name.trim()) {
      toast("Podaj nazwę ćwiczenia");
      return;
    }
    ex.perHand = ex.unit === "dumbbell";
    if (editor.isNew) {
      store.addExercise(ex, editor.target);
      toast("Dodano ćwiczenie", ex.name);
    } else {
      store.updateExercise(ex);
      store.setTarget(ex.id, editor.target);
      toast("Zapisano zmiany", ex.name);
    }
    setEditor(null);
  }

  function moveExercise(dayId: string, idx: number, dir: -1 | 1) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) return;
    const ids = [...day.exerciseIds];
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    store.updateDay({ ...day, exerciseIds: ids });
  }

  function removeFromDay(dayId: string, exId: string) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day) return;
    store.updateDay({ ...day, exerciseIds: day.exerciseIds.filter((id) => id !== exId) });
  }

  function addToDay(dayId: string, exId: string) {
    const day = state.days.find((d) => d.id === dayId);
    if (!day || !exId) return;
    store.updateDay({ ...day, exerciseIds: [...day.exerciseIds, exId] });
    setAddingTo(null);
  }

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Plan</h1>

      {/* Dni treningowe */}
      <h2 className="pt-1 text-sm font-semibold text-muted-foreground">Dni treningowe</h2>
      {state.days.map((day) => {
        const inactive = day.optional && !day.active;
        return (
          <Card key={day.id} className={cn(inactive && "opacity-60")}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-8 w-1.5 rounded-full"
                  style={{ backgroundColor: day.accent ?? "#38bdf8" }}
                />
                <div>
                  <CardTitle className="text-sm">{day.name}</CardTitle>
                  <CardDescription>{day.short}</CardDescription>
                </div>
              </div>
              {day.optional && (
                <Switch
                  checked={!!day.active}
                  onCheckedChange={(v) => store.setDayActive(day.id, v)}
                  accent="#a855f7"
                />
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {day.exerciseIds.map((exId, idx) => {
                const ex = state.exercises.find((e) => e.id === exId);
                if (!ex) return null;
                return (
                  <div key={exId} className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate rounded p-1 text-left hover:bg-accent"
                      onClick={() => openEdit(ex)}
                    >
                      {ex.name}{" "}
                      <span className="text-muted-foreground">
                        {ex.targetSets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`} ·{" "}
                        {fmtKg(state.targets[exId] ?? 0)}
                      </span>
                    </button>
                    <button type="button" onClick={() => moveExercise(day.id, idx, -1)} className="p-1 text-muted-foreground disabled:opacity-30" disabled={idx === 0} aria-label="W górę">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveExercise(day.id, idx, 1)} className="p-1 text-muted-foreground disabled:opacity-30" disabled={idx === day.exerciseIds.length - 1} aria-label="W dół">
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromDay(day.id, exId)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Usuń z dnia"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
              {addingTo === day.id ? (
                <Select
                  autoFocus
                  className="mt-1 h-9"
                  defaultValue=""
                  onChange={(e) => addToDay(day.id, e.target.value)}
                  onBlur={() => setAddingTo(null)}
                >
                  <option value="" disabled>
                    Wybierz ćwiczenie…
                  </option>
                  {state.exercises
                    .filter((e) => !e.archived && !day.exerciseIds.includes(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </Select>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAddingTo(day.id)}>
                  <Plus size={14} /> Dodaj ćwiczenie
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Baza ćwiczeń */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Baza ćwiczeń</h2>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus size={14} /> Nowe
        </Button>
      </div>
      <Card>
        <CardContent className="divide-y divide-border/60 p-2">
          {state.exercises.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 p-2 text-left text-xs hover:bg-accent",
                ex.archived && "opacity-50"
              )}
              onClick={() => openEdit(ex)}
            >
              <span className="min-w-0 flex-1 truncate">
                {ex.name}
                {ex.archived && " (archiwum)"}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {ex.category} · {fmtKg(state.targets[ex.id] ?? 0)}
              </span>
              <Pencil size={12} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Edytor ćwiczenia */}
      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.isNew ? "Nowe ćwiczenie" : "Edytuj ćwiczenie"}
      >
        {editor && (
          <div className="space-y-3">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={editor.exercise.name}
                onChange={(e) =>
                  setEditor({ ...editor, exercise: { ...editor.exercise, name: e.target.value } })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kategoria</Label>
                <Select
                  value={editor.exercise.category}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      exercise: { ...editor.exercise, category: e.target.value as Category },
                    })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Sprzęt</Label>
                <Select
                  value={editor.exercise.unit}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      exercise: { ...editor.exercise, unit: e.target.value as Unit },
                    })
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Serie</Label>
                <NumberField
                  value={editor.exercise.targetSets}
                  fallback={1}
                  onChange={(n) =>
                    setEditor({ ...editor, exercise: { ...editor.exercise, targetSets: n } })
                  }
                />
              </div>
              <div>
                <Label>Powt. min</Label>
                <NumberField
                  value={editor.exercise.repMin}
                  fallback={1}
                  onChange={(n) =>
                    setEditor({ ...editor, exercise: { ...editor.exercise, repMin: n } })
                  }
                />
              </div>
              <div>
                <Label>Powt. max</Label>
                <NumberField
                  value={editor.exercise.repMax}
                  fallback={1}
                  onChange={(n) =>
                    setEditor({ ...editor, exercise: { ...editor.exercise, repMax: n } })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Cel (kg)</Label>
                <NumberField
                  decimal
                  value={editor.target}
                  fallback={0}
                  onChange={(n) => setEditor({ ...editor, target: n })}
                />
              </div>
              <div>
                <Label>Przyrost (kg)</Label>
                <NumberField
                  decimal
                  value={editor.exercise.increment}
                  fallback={0}
                  onChange={(n) =>
                    setEditor({ ...editor, exercise: { ...editor.exercise, increment: n } })
                  }
                />
              </div>
              <div>
                <Label>RIR</Label>
                <NumberField
                  value={editor.exercise.rir}
                  fallback={0}
                  onChange={(n) =>
                    setEditor({ ...editor, exercise: { ...editor.exercise, rir: n } })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Przerwa po serii (s)</Label>
              <Input
                type="number" inputMode="numeric" step="15"
                placeholder={`domyślna (${state.settings.restSeconds} s)`}
                value={editor.exercise.restSeconds ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditor({
                    ...editor,
                    exercise: { ...editor.exercise, restSeconds: v === "" ? undefined : parseInt(v) || undefined },
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div>
                <p className="text-xs font-medium">Ćwiczenie na czas</p>
                <p className="text-[10px] text-muted-foreground">np. plank — powtórzenia to sekundy</p>
              </div>
              <Switch
                checked={editor.exercise.isHold}
                onCheckedChange={(v) =>
                  setEditor({ ...editor, exercise: { ...editor.exercise, isHold: v } })
                }
              />
            </div>
            <div>
              <Label>Notatka / wskazówka</Label>
              <Input
                value={editor.exercise.note ?? ""}
                onChange={(e) =>
                  setEditor({ ...editor, exercise: { ...editor.exercise, note: e.target.value } })
                }
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={saveEditor}>
                Zapisz
              </Button>
              {!editor.isNew && (
                <Button
                  variant="outline"
                  onClick={() => {
                    store.setArchived(editor.exercise.id, !editor.exercise.archived);
                    setEditor(null);
                  }}
                >
                  {editor.exercise.archived ? "Przywróć" : "Archiwizuj"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
