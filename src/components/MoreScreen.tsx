import { useRef, useState } from "react";
import { Download, Trash2, Upload, Cloud, CloudDownload, Pencil, Plus, RotateCcw, X, FileSpreadsheet } from "lucide-react";
import { useStore, readAutoBackupSnapshot } from "@/lib/store";
import type { GymProfile } from "@/lib/types";
import { fmtDate, fmtDateShort, fmtKg, sessionsToCsv } from "@/lib/logic";
import { gistBackup, gistRestore, GistApiError } from "@/lib/backup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateInput, Input, Label, Select } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { PlateBar } from "@/components/Gym";
import { LineChart } from "@/components/Charts";
import { uid } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ProfileFormState {
  editingId: string | null;
  name: string;
  barWeight: number;
  platesRaw: string;
  weightStep: number;
}

const emptyProfileForm: ProfileFormState = {
  editingId: null,
  name: "",
  barWeight: 20,
  platesRaw: "25, 20, 15, 10, 5, 2.5, 1.25",
  weightStep: 0,
};

const today = () => new Date().toISOString().slice(0, 10);

export function MoreScreen() {
  const store = useStore();
  const { state } = store;

  // Waga ciała
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyWaist, setBodyWaist] = useState("");
  const [bodyDate, setBodyDate] = useState(today());

  // Squash
  const [sqMinutes, setSqMinutes] = useState("60");
  const [sqIntensity, setSqIntensity] = useState(4);
  const [sqDate, setSqDate] = useState(today());

  // Talerze
  const [plateTarget, setPlateTarget] = useState(String(state.targets["squat"] ?? 60));

  // Siłownie (profile innego sprzętu)
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const gymProfiles = state.settings.gymProfiles ?? [];
  const activeProfile = gymProfiles.find((p) => p.id === state.settings.activeGymProfileId) ?? null;

  function saveProfile() {
    if (!profileForm) return;
    const plates = profileForm.platesRaw
      .split(",")
      .map((x) => parseFloat(x.trim().replace(",", ".")))
      .filter((x) => x > 0);
    if (!profileForm.name.trim() || plates.length === 0) {
      toast("Uzupełnij nazwę i talerze");
      return;
    }
    const profile: GymProfile = {
      id: profileForm.editingId ?? uid(),
      name: profileForm.name.trim(),
      barWeight: profileForm.barWeight,
      plates,
      weightStep: profileForm.weightStep > 0 ? profileForm.weightStep : undefined,
    };
    if (profileForm.editingId) store.updateGymProfile(profile);
    else store.addGymProfile(profile);
    toast("Zapisano siłownię", profile.name);
    setProfileForm(null);
  }

  // Chmura (auto-backup)
  const [cloudBusy, setCloudBusy] = useState<"backup" | "restore" | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // 401 od GitHuba = token odrzucony (wygasł/odwołany) — czyścimy go i wyłączamy
  // auto-backup, żeby apka nie biła głową w ścianę kolejnymi nieudanymi próbami
  // (patrz Etap 1: fix bezpieczeństwa backupu). Wartość tokenu nigdy nie trafia do komunikatu.
  function handleGistError(err: unknown, fallbackTitle: string) {
    if (err instanceof GistApiError && err.status === 401) {
      store.updateSettings({ gistToken: undefined, autoBackup: false });
      toast("Token odrzucony", "GitHub odrzucił token — został wyczyszczony, a auto-backup wyłączony. Wygeneruj nowy i wklej ponownie.");
    } else {
      toast(fallbackTitle, err instanceof Error ? err.message : "Nieznany błąd");
    }
  }

  async function backupNow() {
    const token = state.settings.gistToken;
    if (!token) {
      toast("Brak tokena", "Wklej token GitHub (uprawnienie Gists: Read & write) powyżej.");
      return;
    }
    setCloudBusy("backup");
    try {
      const { gistId } = await gistBackup(token, state, state.settings.gistId);
      store.updateSettings({ gistId, lastBackup: new Date().toISOString() });
      toast("Backup wysłany do chmury");
    } catch (err) {
      handleGistError(err, "Backup nieudany");
    } finally {
      setCloudBusy(null);
    }
  }

  async function restoreFromCloud() {
    const token = state.settings.gistToken;
    const gistId = state.settings.gistId;
    if (!token || !gistId) {
      toast("Brak danych", "Wklej token oraz Gist ID (widoczne po pierwszym backupie).");
      return;
    }
    if (!confirm("Nadpisać obecne dane danymi z chmury? Zmiany od ostatniego backupu przepadną.")) return;
    setCloudBusy("restore");
    try {
      const json = await gistRestore(token, gistId);
      const err = store.importJson(json);
      if (err) toast("Przywracanie nieudane", err);
      else toast("Przywrócono z chmury", "Dane zostały nadpisane backupem.");
    } catch (err) {
      handleGistError(err, "Przywracanie nieudane");
    } finally {
      setCloudBusy(null);
    }
  }

  // P1-11: liczba sesji w PLIKU vs OBECNIE, zeby bylo widac PRZED potwierdzeniem
  // ile danych zostanie zastapionych. Niepoprawny JSON/ksztalt -> importJson i
  // tak to zlapie i zwroci czytelny komunikat, tu po prostu pomijamy liczniki.
  function fileSessionCount(json: string): number | null {
    try {
      const parsed = JSON.parse(json);
      return parsed && Array.isArray(parsed.sessions) ? parsed.sessions.length : null;
    } catch {
      return null;
    }
  }

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

  // Etap 6/P6-8: eksport historii do CSV - czytelny w Excelu/Numbers, przetrwa
  // nawet gdyby ta konkretna wersja apki kiedyś przestała istnieć.
  function exportCsv() {
    const blob = new Blob([sessionsToCsv(state)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trening-historia-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV wyeksportowany", a.download);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const json = String(reader.result);
      const count = fileSessionCount(json);
      if (count !== null) {
        const ok = confirm(`Zaimportować ${count} sesji? Obecne ${state.sessions.length} zostaną zastąpione.`);
        if (!ok) return;
      }
      const err = store.importJson(json);
      if (err) toast("Import nieudany", err);
      else toast("Backup wczytany", "Dane zostały przywrócone.");
    };
    reader.readAsText(file);
  }

  function restoreAutoBackup() {
    const snapshot = readAutoBackupSnapshot();
    if (!snapshot) return;
    if (!confirm(`Przywrócić stan sprzed ostatniego importu/resetu (${fmtDate(snapshot.savedAt)})? Obecne dane zostaną zastąpione.`)) return;
    const err = store.restoreAutoBackup();
    if (err) toast("Nie udało się przywrócić", err);
    else toast("Przywrócono kopię automatyczną", `Stan sprzed ${fmtDate(snapshot.savedAt)}.`);
  }

  const bodySorted = [...state.body].sort((a, b) => b.date.localeCompare(a.date));
  const squashSorted = [...state.squash].sort((a, b) => b.date.localeCompare(a.date));

  // Rekompozycja: waga i pas jako % zmiany od pierwszego pomiaru (ta sama skala mimo różnych jednostek)
  const bodyAsc = [...state.body].sort((a, b) => a.date.localeCompare(b.date));
  const pctSeries = (points: { date: string; value: number }[]) => {
    const base = points[0]?.value;
    if (!base) return [];
    return points.map((p) => ({ x: new Date(p.date).getTime(), y: ((p.value - base) / base) * 100 }));
  };
  const weightSeries = pctSeries(bodyAsc.map((b) => ({ date: b.date, value: b.weight })));
  const waistPoints = bodyAsc.filter((b) => b.waist !== undefined).map((b) => ({ date: b.date, value: b.waist! }));
  const waistSeries = pctSeries(waistPoints);
  const bodyChartSeries =
    bodyAsc.length >= 2
      ? { weight: weightSeries, waist: waistSeries.length >= 2 ? waistSeries : undefined }
      : null;

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-lg font-bold">Więcej</h1>

      {/* Waga ciała + rekompozycja */}
      <Card>
        <CardHeader>
          <CardTitle>Waga ciała</CardTitle>
          <CardDescription>Obwód pasa (opcjonalnie) — sygnał rekompozycji obok samej wagi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input
              type="number" inputMode="decimal" step="0.1" placeholder="kg"
              className="min-w-0"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
            />
            <Input
              type="number" inputMode="decimal" step="0.5" placeholder="pas cm"
              className="min-w-0"
              value={bodyWaist}
              onChange={(e) => setBodyWaist(e.target.value)}
            />
            <DateInput value={bodyDate} onChange={(e) => setBodyDate(e.target.value)} />
            <Button
              onClick={() => {
                const w = parseFloat(bodyWeight);
                if (!w) return;
                const waist = parseFloat(bodyWaist);
                store.addBody({ date: bodyDate, weight: w, waist: waist > 0 ? waist : undefined });
                setBodyWeight("");
                setBodyWaist("");
                toast("Zapisano wagę", `${w} kg${waist > 0 ? ` · pas ${waist} cm` : ""} · ${bodyDate}`);
              }}
            >
              Zapisz
            </Button>
          </div>
          {bodyChartSeries && (
            <div>
              <LineChart
                data={bodyChartSeries.weight}
                data2={bodyChartSeries.waist}
                height={140}
                color="#22c55e"
                color2="#f59e0b"
                formatY={(y) => `${y > 0 ? "+" : ""}${y.toFixed(1)}%`}
                formatX={(x) => fmtDateShort(new Date(x).toISOString())}
              />
              {bodyChartSeries.waist && (
                <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" /> Waga
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Pas
                  </span>
                </div>
              )}
            </div>
          )}
          {bodySorted.slice(0, 5).map((b) => (
            <div key={b.date} className="group flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmtDate(b.date)}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {fmtKg(b.weight)}
                {b.waist !== undefined && ` · ${b.waist} cm`}
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
            <DateInput value={sqDate} onChange={(e) => setSqDate(e.target.value)} />
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

      {/* Siłownie (profile innego sprzętu — wyjazd, inny klub) */}
      <Card>
        <CardHeader>
          <CardTitle>Siłownie</CardTitle>
          <CardDescription>
            Inny gryf, talerze lub skok hantli na innej siłowni? Dodaj profil i przełącz aktywny —
            cele w Treningu dostaną sugestię dopasowaną do dostępnego sprzętu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label>Aktywna siłownia</Label>
            <Select
              value={activeProfile?.id ?? ""}
              onChange={(e) => store.setActiveGymProfile(e.target.value || null)}
            >
              <option value="">Domowa (gryf {fmtKg(state.settings.barWeight)})</option>
              {gymProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          {gymProfiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-muted-foreground">
                  Gryf {fmtKg(p.barWeight)} · talerze {p.plates.join("/")}
                  {p.weightStep ? ` · krok ${fmtKg(p.weightStep)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Edytuj siłownię"
                  onClick={() =>
                    setProfileForm({
                      editingId: p.id,
                      name: p.name,
                      barWeight: p.barWeight,
                      platesRaw: p.plates.join(", "),
                      weightStep: p.weightStep ?? 0,
                    })
                  }
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Usuń siłownię"
                  onClick={() => {
                    if (confirm(`Usunąć siłownię „${p.name}"?`)) store.deleteGymProfile(p.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {profileForm ? (
            <div className="space-y-2 rounded-md border border-border p-2.5">
              <div>
                <Label>Nazwa</Label>
                <Input
                  placeholder="np. Siłownia u rodziców"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Gryf (kg)</Label>
                  <NumberField
                    decimal
                    value={profileForm.barWeight}
                    fallback={20}
                    onChange={(n) => setProfileForm({ ...profileForm, barWeight: n })}
                  />
                </div>
                <div>
                  <Label>Krok hantli/maszyn (kg, opc.)</Label>
                  <NumberField
                    decimal
                    value={profileForm.weightStep}
                    fallback={0}
                    onChange={(n) => setProfileForm({ ...profileForm, weightStep: n })}
                  />
                </div>
              </div>
              <div>
                <Label>Talerze (kg, po przecinku)</Label>
                <Input
                  value={profileForm.platesRaw}
                  onChange={(e) => setProfileForm({ ...profileForm, platesRaw: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" size="sm" onClick={saveProfile}>
                  Zapisz
                </Button>
                <Button variant="outline" size="sm" onClick={() => setProfileForm(null)}>
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setProfileForm(emptyProfileForm)}
            >
              <Plus size={14} /> Dodaj siłownię
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Kalkulator talerzy */}
      <Card>
        <CardHeader>
          <CardTitle>Kalkulator talerzy</CardTitle>
          <CardDescription>
            Gryf {fmtKg(activeProfile?.barWeight ?? state.settings.barWeight)}
            {activeProfile && ` · ${activeProfile.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="number" inputMode="decimal" step="0.25"
            value={plateTarget}
            onChange={(e) => setPlateTarget(e.target.value)}
          />
          <PlateBar
            target={parseFloat(plateTarget) || 0}
            barWeight={activeProfile?.barWeight ?? state.settings.barWeight}
            plates={activeProfile?.plates ?? state.settings.plates}
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
            <Label>Domyślna przerwa między seriami (s)</Label>
            <Input
              type="number" inputMode="numeric" step="15"
              value={state.settings.restSeconds}
              onChange={(e) => store.updateSettings({ restSeconds: parseInt(e.target.value) || 120 })}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Używana tylko dla ćwiczeń bez własnej przerwy — te ustawisz w Planie.
            </p>
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

      {/* Chmura (auto-backup) */}
      <Card>
        <CardHeader>
          <CardTitle>Chmura (auto-backup)</CardTitle>
          <CardDescription>
            Prywatny GitHub Gist jako zapasowa kopia — przetrwa zgubienie telefonu. Gist jest
            „sekretny" (nie pojawia się w wyszukiwarce), ale to NIE jest pełna prywatność — nie
            jest szyfrowany. Token nigdy nie jest częścią backupu (ani pliku, ani gista) — żyje
            tylko lokalnie w tej przeglądarce. Token: GitHub → Settings → Developer settings →
            Fine-grained token → uprawnienie wyłącznie „Gists: Read and write". Jeśli GitHub
            odrzuci token (błąd 401), trzeba wkleić nowy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label>GitHub token</Label>
            <Input
              type="password"
              placeholder="ghp_… lub github_pat_…"
              value={state.settings.gistToken ?? ""}
              onChange={(e) => store.updateSettings({ gistToken: e.target.value.trim() || undefined })}
            />
          </div>
          <div>
            <Label>Gist ID (wypełnia się samo po pierwszym backupie)</Label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="np. 3a1b2c…"
                value={state.settings.gistId ?? ""}
                onChange={(e) => store.updateSettings({ gistId: e.target.value || undefined })}
              />
              {state.settings.gistId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Wyczyść Gist ID"
                  onClick={() => store.updateSettings({ gistId: undefined })}
                >
                  <X size={15} />
                </Button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Usuń, jeśli stary gist trzeba porzucić (np. skompromitowany) — kolejny „Backup teraz" utworzy nowy.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-2.5">
            <div>
              <p className="text-xs font-medium">Auto-backup po każdym treningu</p>
              <p className="text-[10px] text-muted-foreground">
                Ostatni backup: {state.settings.lastBackup ? fmtDate(state.settings.lastBackup) : "nigdy"}
              </p>
            </div>
            <Switch
              checked={!!state.settings.autoBackup}
              onCheckedChange={(v) => store.updateSettings({ autoBackup: v })}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              disabled={cloudBusy !== null}
              onClick={backupNow}
            >
              <Cloud size={15} /> {cloudBusy === "backup" ? "Wysyłanie…" : "Backup teraz"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={cloudBusy !== null}
              onClick={restoreFromCloud}
            >
              <CloudDownload size={15} /> {cloudBusy === "restore" ? "Wczytywanie…" : "Przywróć z chmury"}
            </Button>
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
          <Button variant="outline" className="w-full" onClick={exportCsv}>
            <FileSpreadsheet size={15} /> Eksport CSV (historia treningów)
          </Button>
          {(() => {
            const autoBackup = readAutoBackupSnapshot();
            return (
              <Button variant="outline" className="w-full" disabled={!autoBackup} onClick={restoreAutoBackup}>
                <RotateCcw size={15} />
                Przywróć ostatnią kopię automatyczną
                {autoBackup && <span className="text-[10px] text-muted-foreground">({fmtDate(autoBackup.savedAt)})</span>}
              </Button>
            );
          })()}
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
