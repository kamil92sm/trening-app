# POMYSLY.md — roadmapa rozwoju aplikacji treningowej

Rozpisane przez Fable (architektura + decyzje), do wdrażania przez Sonneta zadanie po
zadaniu. Każde zadanie jest samowystarczalne: pliki, dokładny spec, kryteria akceptacji.
Nie trzeba czytać historii rozmów ani analizować całego repo.

**Prompt dla Sonneta (kopiuj-wklej):**
```
Wdróż zadanie P0-1 z POMYSLY.md. Trzymaj się sekcji "Zasady implementacji".
Po skończeniu odhacz zadanie w POMYSLY.md i zrób commit.
```

---

## Zasady implementacji (OBOWIĄZKOWE dla każdego zadania)

1. **Nigdy nie zmieniaj**: ID istniejących ćwiczeń/dni w `src/lib/seed.ts`,
   `STORAGE_KEY` (`trening-app-v2`), ani semantyki `perHand`/`isHold`.
   Historia w localStorage użytkownika odwołuje się do tych ID.
2. **Zmiana kształtu danych persystowanych** (typy w `types.ts`, plan w seedzie) →
   podbij `SCHEMA_VERSION` w `seed.ts` i upewnij się, że `migrateState()` zachowuje
   `sessions`, `body`, `squash`, `settings` **oraz `targets` użytkownika dla ćwiczeń,
   które istnieją w nowym seedzie** (patrz P0-1, tam jest to do poprawy).
   Nowe pole w `Settings` NIE wymaga bumpa — merge z `DEFAULT_SETTINGS` załatwia braki,
   wystarczy dodać default.
3. Przed commitem musi przejść: `npm test` (logika) i `npm run build` (tsc + Vite +
   sklejenie do `docs/index.html`). Deliverable to `docs/index.html` — commituj go razem
   ze źródłami.
4. Jedno zadanie = jeden commit, message `feat(P0-1): ...`. Po wdrożeniu zmień w tym
   pliku `[ ]` na `[x]` z datą.
5. UI po polsku, ciemny motyw, mobile-first (max-w-xl). Komponenty z `src/components/ui/*`
   (własne, lekkie) — **nie dodawaj Radix/shadcn ani innych zależności** bez wyraźnej
   potrzeby zapisanej w zadaniu.
6. Safe-area iOS: górne elementy sticky/fixed muszą respektować
   `env(safe-area-inset-top)`, dolne `env(safe-area-inset-bottom)` (wzorce są w
   `TrainScreen.tsx` i `App.tsx`).
7. Nowe funkcje silnika (logika bez UI) → dołóż test do `tests/logic.test.ts`.

---

## P0 — najpierw (realna wartość od zaraz)

### [x] P0-1. Dzień bonusowy 2.0 — ćwiczenia UZUPEŁNIAJĄCE zamiast powtórek (2026-07-25)
**Problem:** obecny bonus powtarza ćwiczenia z planu (wznosy, uginanie, francuz, łydki,
allahy, wiosłowanie). To był świadomy design „pump na tych samych ruchach", ale użytkownik
chce ruchów, których plan 3-dniowy NIE zawiera — dobijają partie zaniedbane bez
dublowania regeneracji.

**Pliki:** `src/lib/seed.ts`, `src/lib/types.ts` (bez zmian typów), `tests/logic.test.ts`.

**Spec:**
1. Dodaj do `SEED_EXERCISES` (helper `ex(...)`, NOWE ID — starych nie ruszać):
   | id | nazwa | kat. | unit | zakres | serie | incr | primary | uwagi |
   |----|-------|------|------|--------|-------|------|---------|-------|
   | `face_pull` | Face pull (wyciąg) | Barki | cable | 12–15 | 3 | 2.5 | Barki | note: „Tylny akton + rotatory — antidotum na wyciskania. Łokcie wysoko, ściągaj do twarzy." |
   | `hammer_curl` | Uginanie młotkowe hantli | Biceps | dumbbell | 10–12 | 2 | 1 | Biceps | note: „Brachialis i przedramię — grubość ramienia, mocniejszy chwyt (pomoże w MC i RDL)." |
   | `pushdown` | Prostowanie ramion na wyciągu | Triceps | cable | 10–12 | 2 | 2.5 | Triceps | note: „Łokcie przyklejone do boków. Inny kąt niż francuz." |
   | `calf_seated` | Wspięcia na palce siedząc | Łydki | machine | 12–20 | 3 | 2.5 | Łydki | note: „Płaszczkowaty (kolano zgięte) — inna głowa niż wspięcia stojąc. Pauza w górze." |
   | `side_plank` | Plank bokiem | Brzuch | bodyweight | 30–30 | 3 | 2.5 | Brzuch | `isHold: true, rir: 0`, note: „Na stronę. Skosy + QL — core w płaszczyźnie, której deska nie łapie." |
2. Cele startowe w `SEED_TARGETS`: `face_pull: 20, hammer_curl: 10, pushdown: 20,
   calf_seated: 30, side_plank: 0`.
3. Dzień `bonus`: `exerciseIds: ["face_pull","hammer_curl","pushdown","calf_seated","side_plank"]`,
   `short: "Uzupełnienie: tył barków, ramiona, łydki, core"`.
4. `SCHEMA_VERSION` → **3**.
5. **Popraw `migrateState()`**: przy migracji ze starej wersji zachowaj też
   wypracowane `targets` użytkownika dla ID istniejących w nowym seedzie:
   `targets: { ...fresh.targets, ...pick(old.targets, znane ID) }`. Obecnie migracja
   nadpisuje cele seedem — użytkownik straciłby progresję. To KLUCZOWA część zadania.
6. Testy: migracja v2→v3 zachowuje targets (`bench_bb: 50` zostaje 50), bonus ma 5
   nowych ćwiczeń, objętość Barki rośnie po włączeniu bonusu.

**Akceptacja:** `npm test` OK; po wdrożeniu na telefonie historia i cele bez zmian,
bonus pokazuje nowe ćwiczenia.
**Rozmiar:** M

### [x] P0-2. Auto-backup do chmury (GitHub Gist) — odporność na zgubiony telefon (2026-07-25)
**Weryfikacja pomysłu Gemini:** wykonalne i najlepsza opcja. `api.github.com` wspiera
CORS, więc single-file PWA może pisać do prywatnego gista bez żadnego backendu.
Odrzucone alternatywy: Google Drive (OAuth zbyt ciężki w single-file), Firebase/Supabase
(przesada dla 1 użytkownika, klucze publiczne), iCloud (brak API z weba).

**Pliki:** `src/lib/types.ts` (Settings), `src/lib/seed.ts` (DEFAULT_SETTINGS),
nowy `src/lib/backup.ts`, `src/components/MoreScreen.tsx`, `src/components/TrainScreen.tsx`.

**Spec:**
1. `Settings` += `gistToken?: string; gistId?: string; autoBackup?: boolean;
   lastBackup?: string` (ISO). Defaulty: `autoBackup: false`, reszta undefined.
   (Rozszerzenie Settings — bez bumpa wersji, patrz Zasady pkt 2.)
2. Nowy `src/lib/backup.ts`:
   ```ts
   export async function gistBackup(state: AppState): Promise<{ gistId: string }>
   // POST https://api.github.com/gists  (gdy brak gistId): body
   // { description: "Trening — backup", public: false,
   //   files: { "trening-backup.json": { content: JSON.stringify(state) } } }
   // PATCH https://api.github.com/gists/{id} (gdy jest gistId).
   // Nagłówki: Authorization: `Bearer ${token}`, Accept: application/vnd.github+json.
   export async function gistRestore(token: string, gistId: string): Promise<string>
   // GET gista, zwróć content pliku trening-backup.json (może być truncated →
   // wtedy fetch raw_url).
   ```
3. `MoreScreen` — nowa karta „Chmura (auto-backup)" nad kartą Backup:
   - Input na token (type="password") + krótka instrukcja: „GitHub → Settings →
     Developer settings → Fine-grained token, uprawnienie tylko Gists: Read & write".
   - Switch „Auto-backup po każdym treningu".
   - Przycisk „Backup teraz" → `gistBackup`, zapisz `gistId` + `lastBackup`, toast.
   - Przycisk „Przywróć z chmury" → `gistRestore` → `store.importJson` (z confirm!).
   - Tekst statusu: „Ostatni backup: {data}" / „Nigdy".
4. `TrainScreen.finish()`: po `finishSession` jeśli `autoBackup && gistToken` →
   fire-and-forget `gistBackup` (błąd = toast, nie blokuje podsumowania).
5. Bezpieczeństwo: token żyje w localStorage — akceptowalne dla prywatnej apki
   (scope tylko gist). NIE logować tokena, NIE wysyłać nigdzie poza api.github.com.

**Akceptacja:** trening → gist się aktualizuje; na czystej przeglądarce token+gistId →
Przywróć → pełny stan wraca. `npm run build` OK.
**Rozmiar:** M

### [x] P0-3. Smart-Timer — przerwa zależna od ćwiczenia + autostart (2026-07-25)
**Weryfikacja pomysłu Gemini:** trafiony. Autostart po odhaczeniu serii i pływający
timer nad nawigacją JUŻ SĄ w nowej wersji (`TrainScreen` + `RestTimer` w `Gym.tsx`) —
zostaje część „per ćwiczenie". Uwaga: **wibracje (navigator.vibrate) NIE działają na
iOS Safari/PWA** — pomysł Gemini odrzucony; zamiast tego jest dźwięk, opcjonalnie dodaj
mignięcie tła timera w ostatnich 5 s.

**Pliki:** `src/lib/types.ts`, `src/lib/seed.ts`, `src/components/TrainScreen.tsx`,
`src/components/PlanScreen.tsx` (edytor), `src/components/Gym.tsx` (opcjonalny flash).

**Spec:**
1. `Exercise` += `restSeconds?: number` (brak = użyj `settings.restSeconds`).
2. Seed: `squat: 180, deadlift: 180, bench_bb: 150, row_bb: 150, ohp: 150,
   hipthrust: 150, rdl: 150, incline_db: 120, bench_db: 120, pulldown: 120,
   lunges: 120`; izolacje (lateral, curl_bb, french, crunch, calf, row_db): 90;
   plank: 60. (To zmiana planu → wymaga bumpa `SCHEMA_VERSION` — jeśli robisz po P0-1,
   wystarczy dopisać pola, wersja już 3; jeśli osobno → bump i migracja wg Zasad.)
3. `TrainScreen`: stan `timerSeconds`; `updateSet(..., done:true)` ustawia
   `timerSeconds = ex.restSeconds ?? settings.restSeconds` i podbija `timerKey`.
   `RestTimer` dostaje `seconds={timerSeconds}`.
4. Edytor w `PlanScreen`: pole „Przerwa (s)" (puste = domyślna).
5. Test: brak (UI); ale jeśli dodasz helper `restFor(ex, settings)` w logic.ts — przetestuj.

**Akceptacja:** seria przysiadu startuje 180 s, seria bicepsa 90 s; pole w edytorze działa.
**Rozmiar:** S

### [x] P0-4. „Ostatnio" w loggerze — poprzedni wynik pod ręką (2026-07-25)
**Mój pomysł.** Na siłowni najczęstsze pytanie: „ile zrobiłem ostatnio?". Dziś trzeba
iść do Historii.

**Pliki:** `src/lib/logic.ts`, `src/components/TrainScreen.tsx`, `tests/logic.test.ts`.

**Spec:**
1. `logic.ts`: `export function lastEntry(state, exId): { date: string; sets: SetLog[] } | null`
   — ostatnia ukończona sesja zawierająca ćwiczenie (pomiń serie `!done`).
2. W karcie ćwiczenia w loggerze, pod nagłówkiem, szary wiersz:
   `Ostatnio (14.07): 45×8 · 45×7 · 45×6` (format `fmtDateShort`; dla hold `×40s`).
   Brak historii → nic nie renderuj.
3. Test na `lastEntry` (najnowsza sesja wygrywa, pomija nieukończone serie).

**Akceptacja:** wiersz widoczny od drugiego treningu danego ćwiczenia.
**Rozmiar:** S

---

## P1 — drugi rzut (analityka i wygoda)

### [ ] P1-1. Plateau breaker (detektor zastoju)
**Weryfikacja pomysłu Gemini:** dobry, ale wdrażamy jako SUGESTIĘ, nie automat —
apka nie powinna sama zmieniać planu.
**Spec:** `logic.ts`: `detectPlateau(state, exId): boolean` — ostatnie **3** punkty
`exerciseHistory` mają ten sam `topWeight` i e1RM w widełkach ±1%. W podsumowaniu
treningu (`TrainScreen`, sekcja summary) i w `ProgressScreen` przy wykresie pokaż
bursztynowy box: „Zastój (3 treningi bez postępu). Opcje: mikro-skok +1,25 kg mimo
braku kompletu powtórzeń, LUB tydzień -30% ciężaru (deload), LUB zamiana ćwiczenia
na 4–6 tyg." Test na detektor. **Rozmiar:** M

### [ ] P1-2. Obwód pasa + wykres rekompozycji
**Weryfikacja pomysłu Gemini:** sensowny i tani. **Spec:** `BodyEntry` += `waist?: number`
(cm). Drugi input w karcie Waga ciała. `LineChart` += opcjonalny drugi szereg
(`data2`, `color2`, prawa oś nie jest potrzebna — normalizuj lub druga linia w tej samej
skali procentowej zmiany od pierwszego pomiaru; prościej: dwie linie, tooltip zbędny).
Zmiana typu persystowanego → bump wersji wg Zasad. **Rozmiar:** M

### [ ] P1-3. Zamień ćwiczenie (zajęty sprzęt)
**Weryfikacja pomysłu Gemini:** trafiony, z jedną poprawką — NIE przeliczaj ciężaru
z „ogólnego e1RM partii" (pseudonauka, różne dźwignie), tylko weź `targets[nowe]`
albo 0 i każ wpisać. **Spec:** w karcie ćwiczenia w loggerze ikonka ⇄ → lista ćwiczeń
z tym samym `primaryMuscle` (bez archiwalnych, bez już obecnych w treningu) → podmiana
TYLKO w drafcie tej sesji (plan bez zmian): nowe `exerciseId`, `targetWeight` z targets,
serie prefill wg `targetSets`. **Rozmiar:** M

### [ ] P1-4. Wake Lock — ekran nie gaśnie podczas treningu
**Mój pomysł.** iOS 16.4+ wspiera Screen Wake Lock API w PWA. **Spec:** w `TrainScreen`,
gdy `draft !== null`: `navigator.wakeLock?.request("screen")`; zwolnij przy finish/cancel;
ponów przy `visibilitychange` (wraca z tła). Cicho ignoruj brak API. **Rozmiar:** S

### [ ] P1-5. Edytowalne zakresy objętości (MUSCLE_RANGES)
**Z listy „otwarte pomysły" w CLAUDE.md.** **Spec:** `Settings` += `muscleRanges?:
Partial<Record<Muscle, {min,max}>>`; `weeklyMuscleVolume` przyjmuje merge
`MUSCLE_RANGES` + override z settings. UI: w karcie Objętość (Progres) tryb edycji
(ołówek) → dwa inputy przy partii. **Rozmiar:** S/M

### [ ] P1-6. Druga metryka objętości: tonaż per partia
**Z listy „otwarte pomysły" w CLAUDE.md** — `weeklyMuscleVolume` JUŻ liczy `tonnage`,
brakuje tylko UI. **Spec:** w karcie Objętość przełącznik „serie | kg" — widok kg
pokazuje `tonnage` (formatuj `x.x t` powyżej 1000 kg). Bez zmian silnika, bez testów.
**Rozmiar:** S

### [ ] P1-7. Przypomnienie o backupie
**Zależność:** jeśli P0-2 wdrożone i autoBackup włączony — pomiń licznik, pokaż tylko
gdy autoBackup OFF. **Spec:** po `finishSession`, jeśli liczba sesji od `lastBackup`
≥ 6 (lub `lastBackup` pusty i sesji ≥ 6) → toast „Zrób backup — ostatni: X treningów
temu" z guzikiem prowadzącym do Więcej. **Rozmiar:** S

---

## P2 — wisienki (gdy P0/P1 działają)

### [ ] P2-1. Heatmapa mięśni (ludzik SVG)
**Weryfikacja Gemini:** fajny wizual, czysty frontend. **Spec:** nowy komponent
`MuscleMap.tsx`: uproszczona sylwetka przód/tył (własne SVG paths, ~10 regionów
zmapowanych na `Muscle`), fill wg `STATUS_COLORS[status]` z `weeklyMuscleVolume`.
Umieść nad listą w karcie Objętość; lista zostaje (dostępność). **Rozmiar:** M/L

### [ ] P2-2. Korelacja squash ↔ siła
**Weryfikacja Gemini:** ograniczona wartość naukowa przy n=1 i 1 meczu/tydz., ale tania:
**Spec:** `LineChart` += `markers?: number[]` (timestampy) — pionowe kreski;
w Progresie, dla wykresu ćwiczenia, pokaż kreski w dniach squasha ±1 dzień przed sesją.
Wniosek zostaw człowiekowi (bez automatycznych "%"). **Rozmiar:** S/M

### [ ] P2-3. Paragon treningowy (obrazek do rolki)
**Weryfikacja Gemini:** wykonalne BEZ html-to-image (nie dodawaj zależności!) —
rysuj ręcznie na `<canvas>` (1080×1350, ciemne tło, tonaż, czas, serie, rekordy,
progresje ↑). `canvas.toBlob` → `navigator.share({ files: [new File(...)] })`
(iOS 15+), fallback: link download. Guzik „Udostępnij" w podsumowaniu treningu.
**Rozmiar:** M

### [ ] P2-4. Check-in gotowości (autoregulacja)
**Weryfikacja Gemini:** uczciwie — „szokowanie CUN" to bro-science, ale sama
autoregulacja (mniej serii przy słabym śnie/DOMS) jest zasadna. Wdrażamy lekko:
**Spec:** przy starcie dnia opcjonalny mini-panel (pomiń = brak kary): sen 1–5,
zakwasy 1–5. Jeśli sen ≤ 2 lub suma ≤ 4 → toast-sugestia: „Słaba regeneracja —
rozważ -1 serię w przysiadzie/MC, izolacje bez zmian". Zapisz odpowiedzi w
`Session` (+= `readiness?: {sleep:number; doms:number}`) — dane pod przyszłe analizy.
Bump wersji wg Zasad. **Rozmiar:** M

### [ ] P2-5. Edycja sesji w historii
**Mój pomysł** — literówka w ciężarze psuje rekordy i e1RM na zawsze. **Spec:**
w rozwiniętej sesji „Edytuj" → dialog z edycją serii (weight/reps/done) →
`store.updateSession(session)` (nowa akcja). UWAGA: NIE przeliczaj wstecz targets —
tylko dane sesji. **Rozmiar:** M

---

## Odrzucone / niewykonalne (nie wdrażać, nie wracać do tematu)

- **Wibracje timera** — `navigator.vibrate` nie istnieje na iOS Safari/PWA. Zamiennik:
  dźwięk (jest) + opcjonalny flash w P0-3.
- **Firebase / Supabase / własny backend** — koszt złożoności nieproporcjonalny dla
  1 użytkownika; Gist (P0-2) daje to samo bez utrzymania.
- **Google Drive sync** — OAuth w single-file PWA wymaga client_id, redirectów
  i odświeżania tokenów; Gist prostszy o rząd wielkości.
- **Auto-przeliczanie ciężaru zamiennika z e1RM partii** (część pomysłu Gemini P1-3) —
  różne dźwignie/sprzęt = wynik byłby fikcją.

## Zrobione (kontekst)

- [x] 2026-07-25: pełne źródła w repo, build 1-plikowy do `docs/`, testy `npm test`.
- [x] 2026-07-25: safe-area dla Dynamic Island (body padding-top, sticky header,
  timer i toasty z env()); timer autostart po odhaczeniu serii, pływa nad nawigacją.
- [x] 2026-07-25: P0-1 dzień bonusowy 2.0 — 5 nowych ćwiczeń uzupełniających
  (face_pull, hammer_curl, pushdown, calf_seated, side_plank), SCHEMA_VERSION 3,
  migrateState zachowuje targets użytkownika dla znanych ID przy migracji ze starej wersji.
- [x] 2026-07-25: P0-2 auto-backup do prywatnego GitHub Gista — nowy src/lib/backup.ts
  (gistBackup/gistRestore), karta „Chmura" w Więcej (token, gist ID, switch, backup/
  przywróć), fire-and-forget backup po finishSession gdy autoBackup włączony.
- [x] 2026-07-25: P0-3 smart-timer — Exercise.restSeconds (per ćwiczenie: 180s ciężkie
  wielostawowe, 150/120s średnie, 90s izolacje, 60s deski), pole w edytorze Planu,
  RestTimer autostartuje z właściwym czasem po odhaczeniu serii, miga bursztynem
  w ostatnich 5 s.
- [x] 2026-07-25: P0-4 „Ostatnio" w loggerze — `lastEntry()` w logic.ts (ostatnia
  ukończona sesja z danym ćwiczeniem, pomija nieodhaczone serie), szary wiersz pod
  nagłówkiem karty ćwiczenia w TrainScreen z datą i wynikiem poprzedniej sesji.
