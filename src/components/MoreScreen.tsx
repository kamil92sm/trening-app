import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtKg } from "@/lib/logic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PlateBar } from "@/components/Gym";
import { Sparkline } from "@/components/Charts";
import { toast } from "@/hooks/use-toast";

const today = () => new Date().toISOString().slice(0, 10);

export function MoreScreen() {
  const store = useStore();
  const { state } = store;

  // Waga ciała
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyDate, setBodyDate] = useState(today());

  // Squash
  const [sqMinutes, setSqMinutes] = useState("60");
  const [sqIntensity, setSqIntensity] = useState(4);
  const [sqDate, setSqDate] = useState(today());

  // Talerze
  const [plateTarget, setPlateTarget] = useState(String(state.targets["squat"] ?? 60));

  const fileRef = useRef<HTMLInputElement>(null);

  function exportBackup() {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trening-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup wyeksportowany", a.download);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const err = store.importJson(String(reader.result));
      if (err) toast("Import nieudany", err);
      else toast("Backup wczytany", "Dane zostały przywrócone.");
    };
    reader.readAsText(file);
  }

  const bodySorted = [...state.body].sort((a, b) => b.date.localeCompare(a.date));
  const squashSorted = [...state.squash].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Więcej</h1>

      {/* Waga ciała */}
      <Card>
        <CardHeader>
          <CardTitle>Waga ciała</CardTitle>
          {state.body.length >= 2 && (
            <div className="text-muted-foreground">
              <Sparkline values={state.body.map((b) => b.weight)} width={140} color="#22c55e" />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="number" inputMode="decimal" step="0.1" placeholder="kg"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
            />
            <Input type="date" value={bodyDate} onChange={(e) => setBodyDate(e.target.value)} />
            <Button
              onClick={() => {
                const w = parseFloat(bodyWeight);
                if (!w) return;
                store.addBody({ date: bodyDate, weight: w });
                setBodyWeight("");
                toast("Zapisano wagę", `${w} kg · ${bodyDate}`);
              }}
            >
              Zapisz
            </Button>
          </div>
          {bodySorted.slice(0, 5).map((b) => (
            <div key={b.date} className="group flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmtDate(b.date)}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {fmtKg(b.weight)}
                <button
                  type="button"
                  className="text-muted-foreground/50 hover:text-destructive"
                  onClick={() => store.removeBody(b.date)}
                  aria-label="Usuń wpis"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Squash */}
      <Card>
        <CardHeader>
          <CardTitle>Squash</CardTitle>
          <CardDescription>{state.squash.length} sesji zalogowanych</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="number" inputMode="numeric" placeholder="min"
              value={sqMinutes}
              onChange={(e) => setSqMinutes(e.target.value)}
              className="w-20"
            />
            <Select value={sqIntensity} onChange={(e) => setSqIntensity(parseInt(e.target.value))} className="w-28">
              {[1, 2, 3, 4, 5].map((i) => (
                <option key={i} value={i}>
                  Int. {i}/5
                </option>
              ))}
            </Select>
            <Input type="date" value={sqDate} onChange={(e) => setSqDate(e.target.value)} />
            <Button
              onClick={() => {
                const m = parseInt(sqMinutes);
                if (!m) return;
                store.addSquash({ date: sqDate, minutes: m, intensity: sqIntensity });
                toast("Zapisano squash", `${m} min · intensywność ${sqIntensity}/5`);
              }}
            >
              +
            </Button>
          </div>
          {squashSorted.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmtDate(s.date)}</span>
              <span className="flex items-center gap-2">
                {s.minutes} min · {"●".repeat(s.intensity)}{"○".repeat(5 - s.intensity)}
                <button
                  type="button"
                  className="text-muted-foreground/50 hover:text-destructive"
                  onClick={() => store.removeSquash(s.id)}
                  aria-label="Usuń wpis"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Kalkulator talerzy */}
      <Card>
        <CardHeader>
          <CardTitle>Kalkulator talerzy</CardTitle>
          <CardDescription>Gryf {fmtKg(state.settings.barWeight)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="number" inputMode="decimal" step="0.25"
            value={plateTarget}
            onChange={(e) => setPlateTarget(e.target.value)}
          />
          <PlateBar
            target={parseFloat(plateTarget) || 0}
            barWeight={state.settings.barWeight}
            plates={state.settings.plates}
          />
        </CardContent>
      </Card>

      {/* Ustawienia */}
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Imię</Label>
              <Input
                value={state.settings.name}
                onChange={(e) => store.updateSettings({ name: e.target.value })}
              />
            </div>
            <div>
              <Label>Gryf (kg)</Label>
              <Input
                type="number" inputMode="decimal" step="0.5"
                value={state.settings.barWeight}
                onChange={(e) => store.updateSettings({ barWeight: parseFloat(e.target.value) || 20 })}
              />
            </div>
          </div>
          <div>
            <Label>Przerwa między seriami (s)</Label>
            <Input
              type="number" inputMode="numeric" step="15"
              value={state.settings.restSeconds}
              onChange={(e) => store.updateSettings({ restSeconds: parseInt(e.target.value) || 120 })}
            />
          </div>
          <div>
            <Label>Talerze (kg, po przecinku)</Label>
            <Input
              defaultValue={state.settings.plates.join(", ")}
              onBlur={(e) => {
                const plates = e.target.value
                  .split(",")
                  .map((x) => parseFloat(x.trim().replace(",", ".")))
                  .filter((x) => x > 0);
                if (plates.length > 0) store.updateSettings({ plates });
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-2.5">
            <p className="text-xs font-medium">Dźwięk timera</p>
            <Switch
              checked={state.settings.sound}
              onCheckedChange={(v) => store.updateSettings({ sound: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>
            Dane żyją tylko w tej przeglądarce — rób kopię po ważnych treningach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button className="flex-1" variant="secondary" onClick={exportBackup}>
              <Download size={15} /> Eksport
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackup(f);
                e.target.value = "";
              }}
            />
          </div>
          <Button
            variant="outline"
            className="w-full text-destructive"
            onClick={() => {
              if (confirm("Wyzerować WSZYSTKIE dane (plan, historię, wagę, squash)?") && confirm("Na pewno? Tego nie da się cofnąć bez backupu.")) {
                store.resetAll();
                toast("Dane wyzerowane");
              }
            }}
          >
            Wyzeruj wszystko
          </Button>
        </CardContent>
      </Card>

      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        Trening PWA · schemat v{state.version} · {state.sessions.length} treningów
      </p>
    </div>
  );
}
