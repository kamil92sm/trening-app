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
   wystarczy dodać default. Tak samo **opcjonalne, samonaprawiające się pole w
   `AppState`**, którego BRAK daje poprawne zachowanie (np. `historySeeded?` — brak
   flagi = dosiew historii startowej, co jest pożądanym efektem): nie wymaga bumpa.
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

### [x] P0-5. Tryb treningu: Siła / Hipertrofia (przełącznik na ekranie wyboru dnia) (2026-07-26)
**Pomysł Kamila (26.07.2026), architektura: Fable.** Użytkownik chce w danym tygodniu
świadomie wybrać cel: siła (jak dotychczas — plan trenera 1:1) albo hipertrofia
(wzrost mięśni), a apka ma przeliczyć powtórzenia / ciężar / RIR. Wybór tygodniowy,
przełączalny w dowolnym momencie.

**Podstawa naukowa (stan wiedzy 2026) — z niej wynika KAŻDA decyzja specu, nie zmieniać
mechaniki bez zajrzenia tutaj:**
1. **Ciężar:** hipertrofia jest podobna w szerokim zakresie ciężarów (~30–85% 1RM),
   o ile serie kończą się blisko upadku; siła wymaga specyficznie ciężkich ciężarów
   (Schoenfeld et al. 2017 JSCR, meta; Currier et al. 2023 BJSM, sieciowa meta).
   → Tryb siły zostaje na 5–8 z ciężkim ciężarem; tryb hipertrofii schodzi na 8–12
   przy ~75–80% e1RM (najlepszy kompromis czas/efekt).
2. **Bliskość upadku:** hipertrofia rośnie w sposób CIĄGŁY im bliżej upadku mięśniowego,
   siła jest na to w dużej mierze niewrażliwa (Robinson, Pelland, Remmert et al. 2024,
   Sports Medicine — meta-regresja 55 badań hipertrofii + 67 siły, RIR jako predyktor
   ciągły). → Tryb hipertrofii obniża RIR 2→1; tryb siły zostaje na RIR 2.
3. **Objętość:** liczba serii/tydzień napędza hipertrofię z malejącymi zwrotami; siła
   wysyca się objętością szybciej, a częstotliwość pomaga głównie sile (Pelland et al.,
   Sports Medicine 2026 — 67 badań, 2058 osób). → W v1 serie BEZ zmian (plan 3-dniowy
   jest w sensownym oknie); dźwignią trybu są powtórzenia+RIR+ciężar. Opcjonalne v2:
   +1 seria na izolacjach w trybie hipertrofii.
4. **Przerwy:** dłuższe przerwy (≥2 min) są LEPSZE także dla hipertrofii na ruchach
   złożonych — krótkie przerwy „na pompę" to mit (Schoenfeld et al. 2016 JSCR).
   → `restSeconds` BEZ ZMIAN w obu trybach.
5. **Przełączanie tygodniami** = periodyzacja falująca; meta-analizy nie pokazują
   przewagi sztywnej periodyzacji liniowej nad falującą (Grgic et al. 2017).
   → Wybór trybu per tydzień przez użytkownika jest w pełni uprawniony metodycznie.

**Pliki:** `types.ts`, `logic.ts`, `store.tsx`, `TrainScreen.tsx`, `tests/logic.test.ts`.
**NIE dotykać `seed.ts`** — plan trenera to źródło prawdy trybu siły; hipertrofia jest
WIDOKIEM POCHODNYM liczonym w locie (żadnych zmian ID/zakresów w seedzie).

**Spec:**
1. Typy (`types.ts`): `export type TrainingMode = "strength" | "hypertrophy"`.
   `Settings.trainingMode?: TrainingMode` (brak = "strength" — zero zmian dla obecnego
   użytkownika). `Session.mode?: TrainingMode` (brak = "strength" — wszystkie stare
   sesje są siłowe). `AppState.hyperTargets?: Record<string, number>` — cele trybu
   hipertrofii, OSOBNE od `targets`, żeby tryby nie psuły sobie nawzajem podwójnej
   progresji. Wszystkie pola opcjonalne i samonaprawiające → **BEZ bumpa
   SCHEMA_VERSION** (Zasady pkt 2).
2. `logic.ts` — czyste funkcje (każda z testem):
   ```ts
   export function exerciseForMode(ex: Exercise, mode: TrainingMode): Exercise
   // strength → ex bez zmian.
   // hypertrophy:
   //   isHold            → bez zmian (plank zostaje plankiem)
   //   id === "deadlift" → { ...ex, repMin: 6, repMax: 8, rir: 2 }  // WYJĄTEK
   //     bezpieczeństwa: nie schodzimy na 8-12 i RIR 1 na klasycznym MC,
   //     nota "UWAGA NA PLECY" zostaje
   //   repMax <= 8       → { ...ex, repMin: 8, repMax: 12, rir: 1 } // bench/squat/row/ohp
   //   else              → { ...ex, rir: 1 }  // zakres już hipertroficzny, bliżej upadku
   // targetSets / increment / restSeconds NIGDY nie zmieniane (nauka pkt 3 i 4).

   export function weightForReps(e1: number, reps: number, rir: number): number
   // Odwrócony Epley: e1 / (1 + (reps + rir) / 30) — ciężar, przy którym `reps`
   // powtórzeń zostawia ~`rir` w zapasie.

   export function hyperTargetFor(state: AppState, ex: Exercise): number
   // 1) state.hyperTargets?.[ex.id] jeśli istnieje (wypracowana progresja hip.);
   // 2) jeśli exerciseForMode NIE zmienia zakresu (bazowe repMax > 8) → targets[ex.id]
   //    (ten sam zakres, różnica tylko w RIR — wspólny cel na start);
   // 3) inaczej (konwersja z ciężkiego zakresu): e1 = e1rm ostatniego punktu
   //    exerciseHistory(state, ex.id); fallback bez historii:
   //    e1 = targets[ex.id] * (1 + (ex.repMin + ex.rir) / 30);
   //    hEx = exerciseForMode(ex, "hypertrophy");
   //    w = weightForReps(e1, hEx.repMin, hEx.rir)   // np. 8 powt. @ RIR 1 ≈ 77% e1RM
   //    zaokrąglij do wielokrotności ex.increment: Math.round(w/inc)*inc (inc min 0,5).
   // Sanity-check na danych Kamila: bench e1RM 54 → 42,5 kg (8-12 RIR1) vs 45 (5-8 RIR2);
   // squat e1RM 82,3 → 62,5; deadlift e1RM 95,6 → 75 (6-8 RIR2). Liczby wychodzą sensownie.
   ```
3. `store.tsx`: `finishSession` — sessionData ma już `mode` (bo `Session.mode?`);
   progresję licz na `exerciseForMode(ex, mode)`, a `nextWeight` zapisuj do `targets`
   (strength) ALBO `hyperTargets` (hypertrophy). `resetAll` bez zmian.
4. `TrainScreen.tsx`:
   - Ekran wyboru dnia: segmented control „Cel tygodnia: Siła | Hipertrofia" nad listą
     dni; persist `updateSettings({ trainingMode })`; default strength. Mikro-copy pod
     spodem: „Przełączaj między tygodniami — periodyzacja falująca jest równie skuteczna
     jak sztywne bloki."
   - `startDay`: `hEx = exerciseForMode(ex, mode)`; cel = strength ? `targets[id]` :
     `hyperTargetFor(state, ex)`; prefill reps = `hEx.repMax`; `Draft += mode`
     (stary draft w localStorage bez pola = strength).
   - Nagłówek loggera: badge trybu (Siła #38bdf8 / Hipertrofia #a855f7).
   - Karta ćwiczenia: zakres/RIR renderuj z `hEx`, nie z `ex`.
   - „Ostatnio": gdy mode sesji ostatniego wpisu ≠ bieżący tryb, dopisz „ (siła)" /
     „ (hip.)" — rozszerz mapę lastByExercise o mode sesji.
   - Sugestia profilu siłowni (FEAT-1) liczy się na trybowym celu — API bez zmian.
   - `finish()`: mode idzie w sessionData; paragon: dopisek „· Hipertrofia" przy nazwie
     dnia gdy tryb hip. (opcjonalne).
5. Progres: BEZ zmian — e1RM normalizuje oba tryby do jednej linii (to zaleta metryki),
   projekcja FEAT-2 działa. Opcjonalnie toast przy przełączeniu trybu: „Pamiętaj o
   przełączniku Cel: Siła/Hipertrofia w Progresie" (NIE zmieniaj volumeGoal automatycznie).
6. Testy (`tests/logic.test.ts`):
   - exerciseForMode: bench 5-8 → 8-12 RIR1; deadlift → 6-8 RIR2 (wyjątek); lateral
     12-15 → zakres bez zmian + RIR1; plank → identyczny; mode strength → identyczny.
   - weightForReps: e1=130, reps=8, rir=1 → 100.
   - hyperTargetFor: (a) z historii (100×8 → e1 126,7 → ~97,5 przy inc 2,5);
     (b) fallback z targets bez historii; (c) hyperTargets ma pierwszeństwo;
     (d) ćwiczenie 8-12 → cel == targets (bez konwersji).
   - Sesja bez `mode` (stare dane) → progresja pisze do `targets`, nie hyperTargets.

**Akceptacja:** przełącznik na ekranie wyboru dnia zmienia prescriptions w loggerze
(np. bench: 45 kg × 5-8 RIR 2 → ~42,5 kg × 8-12 RIR 1); sesja hipertroficzna aktualizuje
`hyperTargets`, `targets` nietknięte (i odwrotnie); stare dane zachowują się identycznie;
`npm test` + `npm run build` OK.
**Rozmiar:** L

### [x] P0-6. Timer przerwy „rozjeżdża się" przy < 5 s (jank na iOS) (2026-07-26)
**Zgłoszenie Kamila (2026-07-26 wieczór):** „Zegar jak jest mniej niż 5 sekund to coś się
rozjeżdża chyba."

**Diagnoza (do potwierdzenia reprodukcją, NIE zgaduj naprawy zanim zobaczysz problem):**
Timer to pływająca pigułka `fixed left-1/2 -translate-x-1/2... bg-card/95 backdrop-blur`
(`src/components/TrainScreen.tsx:616-621`). Przy `left <= 5` włącza się `almostDone`
(`src/components/Gym.tsx:121`), które dokłada `animate-pulse text-amber-400` do JEDNOCZEŚNIE
ikony (`Gym.tsx:125`) i liczby (`Gym.tsx:126-139`). Najbardziej prawdopodobne przyczyny,
w kolejności:
1. **`animate-pulse` wewnątrz elementu z `backdrop-blur` na iOS Safari** — pulsujący opacity
   zmusza warstwę blur do repaintu co klatkę; przy `fixed`+`-translate-x-1/2` (centrowanie)
   to daje migotanie/„rozjeżdżanie", nie realny layout shift. To najmocniejszy kandydat.
2. **Dwie NIEZSYNCHRONIZOWANE animacje** (ikona i liczba mają osobny `animate-pulse`) —
   pulsują w innej fazie, co wygląda na „rozjeżdżanie się" elementów względem siebie.
3. Szerokość liczby: `min-w-[52px]` + `tabular-nums` powinny trzymać stałą szerokość, ale
   `min-w` to tylko dolny limit — dla pewności zamień na sztywne `w-[56px] text-center`.

**Spec naprawy:**
1. **Najpierw zreprodukuj**: ustaw krótki `restSeconds` (np. 6 s) w ustawieniach/ćwiczeniu,
   odhacz serię, obserwuj przejście 6→5→…→0 w podglądzie (najlepiej wąskim, mobile, dark).
   Ustal DevToolsami, co realnie się dzieje (repaint blur vs. zmiana box-size).
2. Ustabilizuj szerokość liczby: `w-[56px] text-center tabular-nums` zamiast `min-w-[52px]`.
3. Utemperuj animację tak, by nie biła w warstwę blur: albo (a) usuń `animate-pulse` z dzieci
   pigułki i zrób miganie na elemencie BEZ `backdrop-blur` (np. cień/obwódka pigułki, albo
   osobny wewnętrzny wrapper bez blur), albo (b) zejdź z `animate-pulse` na sam stały amber +
   istniejący `beep()` (Kamil i tak ma dźwięk), albo (c) jeśli zostaje pulsowanie — pulsuj
   TYLKO jeden element (całą pigułkę albo samą liczbę), nie ikonę i liczbę osobno, żeby fazy
   się nie rozjeżdżały.
4. Pigułka ma zostać wyśrodkowana i tej samej szerokości przez całe 6→0 (żadnego dryfu w bok).

**Akceptacja:** przy < 5 s timer nie miga/nie dryfuje; pigułka stoi w miejscu, ta sama
szerokość do 0:00; `npm run build` OK. To fix UI — bez nowych zależności, bez zmian silnika.
**Rozmiar:** S

### [x] P0-7. Przywróć standardowy plan dnia (po przypadkowym usunięciu ćwiczenia) (2026-07-26)
**Zgłoszenie Kamila (2026-07-26 wieczór):** „usunęło mi się jedno ćwiczenie z planu i nie
mogę przywrócić standardowego planu na dany dzień, chcę mieć tę opcję." — Fable potwierdza:
dobry pomysł, `SEED_DAYS`/`SEED_EXERCISES`/`SEED_TARGETS` w `src/lib/seed.ts` są źródłem
prawdy, więc przywrócenie jest deterministyczne i tanie.

**Kontekst kodu:** plan dnia to `WorkoutDay.exerciseIds` (`src/lib/types.ts`), edytowalny
w `PlanScreen.tsx`. Store ma już `updateDay(day)` (`store.tsx:237`), `addExercise`,
`updateExercise` (`store.tsx:207,218`). Seed eksportuje `SEED_DAYS` (`seed.ts:150`),
`SEED_EXERCISES` (`seed.ts:47`), `SEED_TARGETS` (`seed.ts:183`). ID ćwiczeń/dni są stabilne
(§1 Zasad) — więc `SEED_DAYS.find(d => d.id === dayId)` daje oryginalną listę ID.

**Spec:**
1. **Store — nowa akcja `restoreDayPlan(dayId)`** (dopisz do interfejsu `Store`,
   `store.tsx:35-58`):
   - Znajdź `seedDay = SEED_DAYS.find(d => d.id === dayId)`. Jeśli brak (dzień usera, nie z
     seeda) → nic nie rób / zwróć info (patrz p.4).
   - Dla każdego `exId` z `seedDay.exerciseIds`, którego NIE MA w `state.exercises` (np. Kamil
     go skasował): dołóż z powrotem z `SEED_EXERCISES.find(e => e.id === exId)` oraz cel z
     `SEED_TARGETS[exId]` (fallback do celu z seeda/0). Jeśli ćwiczenie istnieje ale jest
     `archived` → odarchiwizuj (`setArchived(exId,false)`), NIE nadpisuj jego celu/parametrów
     (chroni progresję i ręczne kalibracje usera).
   - Ustaw `day.exerciseIds = [...seedDay.exerciseIds]` przez `updateDay`. Zachowaj
     user-owe pola dnia, które nie dotyczą listy (`active` dla bonusu, `accent` jeśli user
     zmieniał — albo świadomie wróć do seeda; wybierz i opisz w commicie, domyślnie: przywróć
     tylko `exerciseIds`, resztę zostaw).
   - **NIE ruszaj** `targets` istniejących ćwiczeń (wypracowana progresja) — przywracamy tylko
     SKŁAD dnia i brakujące ćwiczenia, nie zerujemy ciężarów.
2. **UI w `PlanScreen.tsx`** — w edytorze każdego dnia przycisk „Przywróć standardowy plan"
   (ikona `RotateCcw`), za `confirm()` („Przywrócić oryginalny zestaw ćwiczeń dla tego dnia?
   Dołoży brakujące ćwiczenia i ustawi kolejność jak w planie. Twoje ciężary zostają."),
   → `store.restoreDayPlan(day.id)` + toast potwierdzający.
   - Pokaż przycisk tylko dla dni obecnych w `SEED_DAYS` (mon/wed/fri/bonus). Dla dni
     stworzonych przez usera nie ma czego przywracać.
3. Persystencja: to zwykła mutacja `state` przez istniejące akcje → localStorage sam się
   zapisze (mechanizm w `store.tsx`). Bez bumpa `SCHEMA_VERSION` (kształt danych bez zmian).
4. Rozważ (opcjonalnie, jeśli tanie): przy okazji „Przywróć CAŁY plan" w Ustawieniach/Więcej
   — pętla `restoreDayPlan` po wszystkich `SEED_DAYS`. Nie wymagane w MVP tego zadania.
5. **Test** (`tests/logic.test.ts`): jeśli wydzielisz czystą funkcję (np.
   `restoredDayPlan(state, dayId): {exercises, days, targets}`) — przetestuj: po usunięciu
   `crunch` z `state.exercises` i z `days.mon.exerciseIds`, `restoreDayPlan("mon")` przywraca
   `crunch` do listy i do `exercises`, a cel istniejącego `bench_bb` (np. ręcznie 55) zostaje
   55, nie wraca do seeda. Jeśli logika siedzi w store bez czystej funkcji — dołóż chociaż
   asercję na kształt wyniku.

**Akceptacja:** po skasowaniu ćwiczenia z dnia jeden klik przywraca oryginalny zestaw i
brakujące ćwiczenie; ciężary/progresja pozostałych ćwiczeń nietknięte; `npm test` +
`npm run build` OK.
**Rozmiar:** M

### [ ] P0-8. Hipertrofia zmienia też SERIE (cel serii/partia + mądry rozkład z limitem)
**Zgłoszenie/decyzja Kamila (2026-07-26 wieczór):** dziś przełącznik Siła/Hipertrofia w
Treningu zmienia tylko powtórzenia/RIR/ciężar (`exerciseForMode`), NIE serie — więc po
wejściu w Progres → Objętość → „Plan" → Hipertrofia plan świeci bursztynem (te same serie
mierzone wyższą poprzeczką hipertrofii). Kamil chce, żeby przełączenie na hipertrofię
**realnie dokładało serie** (poprawna periodyzacja: hipertrofia jest objętościowo cięższa),
dzięki czemu plan w trybie hipertrofii jest bardziej zielony — ale **zasłużenie** (serie
realnie wykonane, nie kosmetyka słupka).

**⚠️ TO COFA §5.7 CLAUDE.md** („`targetSets` NIGDY nie zmieniane"). Świadoma zmiana decyzji
projektowej na prośbę użytkownika — zaktualizuj CLAUDE.md §5.7 i POMYSLY P0-5, żeby dok. nie
kłamała. Reguła siły (Plan seed = źródło prawdy) zostaje; hipertrofia dalej jest widokiem
POCHODNYM — tylko teraz pochodna dotyczy też liczby serii.

**⚠️ ŚCIANA STRUKTURALNA (kluczowe — bez tego wyjdzie absurd):** plan 3-dniowy ma dla części
partii TYLKO JEDNO ćwiczenie/tydzień (Biceps = tylko `curl_bb` w pn.; Łydki = tylko `calf` w
śr.). Naiwne „dobij serie do celu partii" dałoby 8 serii uginania w jednej sesji. **Dlatego
obowiązuje LIMIT serii na ćwiczenie**, a niedobór ponad limit ma zostać UCZCIWIE bursztynowy
z nudge'em „włącz dzień bonusowy". Zielenienie ma być częściowe i prawdziwe (§11), nie na siłę.

**Wybór Kamila:** wariant „stały cel serii/partia + mądry rozkład" (nie płaskie +1). Poniżej
konkretny, deterministyczny, ograniczony algorytm realizujący ten wybór bez ściany.

**Pliki:** `src/lib/logic.ts` (nowa funkcja + integracje), `src/lib/types.ts` (ewent. stałe),
`src/components/TrainScreen.tsx` (logger + finishSession), `src/components/ProgressScreen.tsx`
(widok objętości „Plan"), `tests/logic.test.ts`, CLAUDE.md, POMYSLY.md.

**Spec — silnik:**
1. **Stałe (tunable, w `logic.ts`):**
   - `HYPER_SET_TARGET: Record<Muscle, number>` — docelowe serie robocze/tydzień/partię w
     hipertrofii. Domyślnie = `MUSCLE_RANGES_HYPERTROPHY[m].min` (duże 10, małe 8). NIE wymyślaj
     innych liczb bez powodu — spójność z istniejącymi progami statusu.
   - `HYPER_SETS_CAP_PER_EXERCISE = 4` — twardy limit serii roboczych na jedno ćwiczenie w
     hipertrofii (baza 3→max 4, izolacja 2→max 4). Powyżej = śmieciowa objętość, nie dokładaj.
2. **Nowa funkcja `hyperSetPlan(state): Record<string, number>`** (exId → docelowe `targetSets`
   w hipertrofii), liczona z AKTYWNYCH dni (dzień `optional` tylko gdy `active`):
   - Start: każdemu ćwiczeniu przypisz jego bazowe `ex.targetSets`.
   - Dla każdej `Muscle`: policz bieżące serie PRIMARY z aktywnych dni (suma `targetSets`
     ćwiczeń, których `primaryMuscle === m`). `deficit = max(0, HYPER_SET_TARGET[m] - bieżące)`.
   - Rozłóż deficyt na ćwiczenia z tym `primaryMuscle`: round-robin +1 seria naraz, aż deficyt
     = 0 LUB wszystkie te ćwiczenia uderzą w `CAP`. (Round-robin = równy rozkład; jak jedno
     ćwiczenie ma primary=tej partii i jest jedyne, dojdzie tylko do CAP i stop — reszta
     deficytu przepada, co jest OK: widać to potem jako bursztyn + nudge.)
   - Secondary (0,5×) NIE sterują dokładaniem serii (żeby uniknąć sprzężeń między partiami) —
     liczą się dopiero w metryce objętości jak dziś. Overshoot partii mocno wspomaganych (np.
     Triceps od wyciskań) jest OK — problemem jest tylko niedobór.
   - Zwróć mapę tylko dla ćwiczeń, których serie realnie wzrosły względem bazy (reszta =
     bez zmian, czytaj z `ex.targetSets`). Determinizm: ta sama mapa dla tego samego stanu.
3. **Integracja z trybem:** `exerciseForMode(ex, mode)` NIE zmieniaj (jest per-ćwiczenie, bez
   kontekstu planu). Zamiast tego w miejscach, które budują serie/liczą objętość, gdy tryb =
   hipertrofia, użyj `targetSets = hyperSetPlan(state)[ex.id] ?? ex.targetSets`. Rozważ helper
   `targetSetsForMode(state, ex, mode)` = `mode==="hypertrophy" ? (hyperSetPlan(...)[id] ??
   ex.targetSets) : ex.targetSets`, żeby nie liczyć `hyperSetPlan` w wielu miejscach (memoizuj
   albo policz raz i przekaż).
4. **Progresja:** `finishSession` już liczy `computeProgression` na `exerciseForMode(ex, mode)`.
   Rozszerz tak, by w hipertrofii warunek „wszystkie serie robocze trafiły `repMax`" używał
   `targetSetsForMode(...)` (tej samej liczby serii co logger). Zapis dalej do `hyperTargets`
   (hipertrofia) vs `targets` (siła) — tryby nie psują sobie progresji (§5.7). Nie zmieniaj
   `ex.increment` ani seeda.

**Spec — UI:**
5. **Logger (`TrainScreen`):** startując dzień w trybie hipertrofii, generuj tyle wierszy serii
   ile `targetSetsForMode(state, ex, "hypertrophy")` (nie `ex.targetSets`). W sile bez zmian.
   Zweryfikuj, że „Ostatnio", paragon-usunięty (P2-6) i draft w localStorage znoszą zmienną
   liczbę serii.
6. **Objętość „Plan" (`ProgressScreen`):** widok „Plan" ma odzwierciedlać AKTUALNY
   `settings.trainingMode`. Przekaż tryb do `weeklyMuscleVolume` (dodaj opcjonalny param
   `setsFor?: (ex)=>number` albo `mode?`), żeby w hipertrofii liczył serie z `hyperSetPlan`.
   „Wykonane (7 dni)" liczy z realnych sesji — bez zmian (i tak pokaże, czy Kamil te serie
   ZROBIŁ). Domyślne wywołania i istniejące testy bez `mode` mają działać jak dziś (siła/baza).
7. **Rozwiąż dezorientację dwóch przełączników** (to był punkt zapalny Kamila):
   - Minimum: gdy `trainingMode === "hypertrophy"`, domyślnie ustaw też widok „Plan" na progi
     hipertrofii (albo zsynchronizuj `volumeGoal` z `trainingMode` przy wejściu w Progres —
     wybierz jedno, opisz w commicie). Cel: „przełączam trening na hipertrofię → w Progresie od
     razu widzę plan hipertroficzny", bez ręcznego drugiego klika.
   - Zostaw krótką notę pod kartą objętości: „Hipertrofia = wyższa poprzeczka serii; plan
     dokłada serie do limitu {CAP}/ćwiczenie. Partie z jednym ćwiczeniem/tydzień zostają
     poniżej — dołóż dzień bonusowy, by je dobić." (uczciwe wyjaśnienie ściany strukturalnej.)

**Testy (`tests/logic.test.ts`):**
- `hyperSetPlan`: dla partii z ≥2 ćwiczeniami/tydzień deficyt rozkłada się równo i dobija do
  celu bez przekroczenia CAP; dla partii z 1 ćwiczeniem (biceps) dochodzi TYLKO do CAP i
  zatrzymuje się (nie 8 serii).
- `weeklyMuscleVolume` w hipertrofii pokazuje więcej serii niż w sile dla partii z ≥2
  ćwiczeniami (bardziej zielono), ale partia z 1 ćwiczeniem dalej `low` (uczciwie).
- Progresja w hipertrofii z podbitą liczbą serii: „wszystkie serie robocze na `repMax`"
  liczy właściwą (podbitą) liczbę serii; zapis do `hyperTargets`, `targets` nietknięte.
- Determinizm: `hyperSetPlan(state)` dwa razy = ten sam wynik.

**Akceptacja:** przełączenie Treningu na Hipertrofię realnie dokłada serie (widać w loggerze),
Progres → Objętość → Plan jest bardziej zielony dla partii z ≥2 ćwiczeniami i uczciwie
bursztynowy dla partii z jednym; progresja siły i hipertrofii dalej rozdzielne; CLAUDE.md §5.7
zaktualizowane; `npm test` + `npm run build` OK.
**Rozmiar:** L
**UWAGA dla Sonneta:** to duże zadanie z realnymi decyzjami (synchro przełączników, wartości
stałych). Jeśli któraś decyzja z pkt 6–7 jest niejasna — dopytaj Kamila PRZED kodowaniem,
nie zgaduj. Reszta (algorytm `hyperSetPlan`, limit, uczciwy residual) jest zamknięta.

---

## P1 — drugi rzut (analityka i wygoda)

### [x] P1-1. Plateau breaker (detektor zastoju) (2026-07-25)
**Weryfikacja pomysłu Gemini:** dobry, ale wdrażamy jako SUGESTIĘ, nie automat —
apka nie powinna sama zmieniać planu.
**Spec:** `logic.ts`: `detectPlateau(state, exId): boolean` — ostatnie **3** punkty
`exerciseHistory` mają ten sam `topWeight` i e1RM w widełkach ±1%. W podsumowaniu
treningu (`TrainScreen`, sekcja summary) i w `ProgressScreen` przy wykresie pokaż
bursztynowy box: „Zastój (3 treningi bez postępu). Opcje: mikro-skok +1,25 kg mimo
braku kompletu powtórzeń, LUB tydzień -30% ciężaru (deload), LUB zamiana ćwiczenia
na 4–6 tyg." Test na detektor. **Rozmiar:** M

### [x] P1-2. Obwód pasa + wykres rekompozycji (2026-07-25)
**Weryfikacja pomysłu Gemini:** sensowny i tani. **Spec:** `BodyEntry` += `waist?: number`
(cm). Drugi input w karcie Waga ciała. `LineChart` += opcjonalny drugi szereg
(`data2`, `color2`, prawa oś nie jest potrzebna — normalizuj lub druga linia w tej samej
skali procentowej zmiany od pierwszego pomiaru; prościej: dwie linie, tooltip zbędny).
Zmiana typu persystowanego → bump wersji wg Zasad. **Rozmiar:** M

### [x] P1-3. Zamień ćwiczenie (zajęty sprzęt) (2026-07-25)
**Weryfikacja pomysłu Gemini:** trafiony, z jedną poprawką — NIE przeliczaj ciężaru
z „ogólnego e1RM partii" (pseudonauka, różne dźwignie), tylko weź `targets[nowe]`
albo 0 i każ wpisać. **Spec:** w karcie ćwiczenia w loggerze ikonka ⇄ → lista ćwiczeń
z tym samym `primaryMuscle` (bez archiwalnych, bez już obecnych w treningu) → podmiana
TYLKO w drafcie tej sesji (plan bez zmian): nowe `exerciseId`, `targetWeight` z targets,
serie prefill wg `targetSets`. **Rozmiar:** M

### [x] P1-4. Wake Lock — ekran nie gaśnie podczas treningu (2026-07-25)
**Mój pomysł.** iOS 16.4+ wspiera Screen Wake Lock API w PWA. **Spec:** w `TrainScreen`,
gdy `draft !== null`: `navigator.wakeLock?.request("screen")`; zwolnij przy finish/cancel;
ponów przy `visibilitychange` (wraca z tła). Cicho ignoruj brak API. **Rozmiar:** S

### [x] P1-5. Edytowalne zakresy objętości (MUSCLE_RANGES) (2026-07-26)
**Z listy „otwarte pomysły" w CLAUDE.md.** **Spec:** `Settings` += `muscleRanges?:
Partial<Record<Muscle, {min,max}>>`; `weeklyMuscleVolume` przyjmuje merge
`MUSCLE_RANGES` + override z settings. UI: w karcie Objętość (Progres) tryb edycji
(ołówek) → dwa inputy przy partii. **Rozmiar:** S/M
**Wdrożone:** `muscleRangesFor(goal, overrides?)` mergujący; `weeklyMuscleVolume`/
`actualWeeklyMuscleVolume`/`suggestBonusExercises` czytają `state.settings.muscleRanges`.
UI: pencil-toggle w nagłówku karty Objętość, wiersz partii w edycji ma dwa `NumberField`
(min/max) + reset (RotateCcw, aktywny tylko gdy jest override); poza edycją znacznik „wł."
przy nadpisanej partii. 3 nowe testy. `npm test` + `npm run build` OK.

### [x] P1-6. Druga metryka objętości: tonaż per partia (2026-07-26)
**Z listy „otwarte pomysły" w CLAUDE.md** — `weeklyMuscleVolume` JUŻ liczy `tonnage`,
brakuje tylko UI. **Spec:** w karcie Objętość przełącznik „serie | kg" — widok kg
pokazuje `tonnage` (formatuj `x.x t` powyżej 1000 kg). Bez zmian silnika, bez testów.
**Rozmiar:** S
**Wdrożone:** przełącznik „Serie | kg" w `ProgressScreen.tsx`; widok kg pokazuje `fmtTonnage`
(lokalna funkcja UI, bez zmian w `logic.ts`), pasek relatywny do max tonażu w widoku (bez
kolorów statusu — zakresy są w seriach). Edycja zakresów (P1-5) i legenda statusów ukryte
w widoku kg. `npm run build` OK.

### [x] P1-7. Przypomnienie o backupie (2026-07-26)
**Zależność:** jeśli P0-2 wdrożone i autoBackup włączony — pomiń licznik, pokaż tylko
gdy autoBackup OFF. **Spec:** po `finishSession`, jeśli liczba sesji od `lastBackup`
≥ 6 (lub `lastBackup` pusty i sesji ≥ 6) → toast „Zrób backup — ostatni: X treningów
temu" z guzikiem prowadzącym do Więcej. **Rozmiar:** S
**Wdrożone:** `toast()` dostał opcjonalny trzeci argument `{label, tab}` — `Toaster`
(App.tsx) renderuje przycisk akcji i nawiguje przez własny `setTab` (toast żyje 6 s
zamiast 3 s, gdy ma akcję). `TrainScreen`: po `finishSession`, gdy `autoBackup` OFF,
licznik sesji od `lastBackup` (lub od zera, gdy backupu jeszcze nie było) ≥ 6 → toast.
Zweryfikowane w przeglądarce: toast pojawia się przy 6. sesji, „Przejdź do Więcej"
przełącza zakładkę. `npm test` + `npm run build` OK.

### [x] P1-8. Rekord (PR) na żywo — w loggerze i w podsumowaniu (2026-07-26)
**Skąd:** rekordy są dziś liczone TYLKO w Progresie (`ProgressScreen.tsx:63`, karta „Rekordy") —
w trakcie treningu apka nie mówi ani słowa, gdy właśnie pobiłeś życiówkę. Najtańsza możliwa
dawka motywacji: dane już są, brakuje sygnału w momencie, w którym ma znaczenie.

**Pliki:** `src/lib/logic.ts`, `src/components/TrainScreen.tsx`, `tests/logic.test.ts`.

**Spec — silnik:**
- `personalBests(state, exId, excludeSessionId?): { weight: number; e1rm: number; holdSeconds: number }`
  — maksimum po WSZYSTKICH ukończonych sesjach (`completed`), tylko serie `done`.
  Dla `isHold` liczy się `reps` (sekundy) → `holdSeconds`; dla reszty `weight` i `e1rm` (Epley).
  Brak historii → same zera (pierwsza seria NIE jest wtedy „rekordem" — patrz niżej).
- `isSetRecord(ex, set, best): "weight" | "e1rm" | "hold" | null` — czysta funkcja porównująca
  pojedynczą serię z rekordem. Zwraca `null`, gdy `best` jest zerowy (brak historii = brak PR,
  żeby pierwszy trening nowego ćwiczenia nie świecił się na złoto przy każdej serii).
  Priorytet, gdy pobite oba: `weight` > `e1rm` (cięższy ciężar to mocniejszy komunikat).

**Spec — UI:**
- Logger: `personalBests` policz RAZ na wejście do drafta (`useMemo` po `state.sessions`, jak
  `lastByExercise` — nie licz per keystroke). Gdy zaznaczona (`done`) seria bije rekord: złota
  ramka/plakietka „PR" przy wierszu serii + jednorazowy `toast("Rekord!", "<nazwa> — 62,5 kg × 8")`.
  Odznaczenie serii cofa plakietkę (stan liczony z danych, nie zapamiętywany).
- Podsumowanie treningu: nad listą progresji sekcja „🏆 Rekordy tej sesji" (nazwa + wynik),
  ukryta gdy brak. Nie dubluj toastów z loggera.

**Testy:** `personalBests` pomija serie `!done` i sesje `!completed`; `excludeSessionId` działa;
`isSetRecord` → `null` przy pustej historii; hold porównuje sekundy, nie ciężar; priorytet
`weight` nad `e1rm`.
**Akceptacja:** pobicie ciężaru/e1RM w trakcie treningu widać natychmiast przy serii i w
podsumowaniu; brak fałszywych PR na pierwszym treningu ćwiczenia; `npm test` + `npm run build` OK.
**Rozmiar:** M
**Wdrożone:** `personalBests`/`isSetRecord` w `logic.ts` (9 testów). `TrainScreen.tsx`:
`personalBestsByExercise` (useMemo po `state.sessions`/`state.exercises`) → złoty pierścień +
plakietka „PR" przy serii i jednorazowy toast przy zaznaczeniu; podsumowanie liczy rekordy
PRZED `finishSession` (na rekordach sprzed tej sesji), karta „🏆 Rekordy tej sesji" pokazuje
jeden, najlepszy wynik na ćwiczenie. Zweryfikowane w przeglądarce (Playwright): 50 kg × 5 na
tle historii 40 kg × 8 poprawnie oznaczone jako PR na żywo i w podsumowaniu.

### [x] P1-9. Serie rozgrzewkowe — ramp-up z gotowym układem talerzy (2026-07-26)
**Po co:** przy 65–80 kg w przysiadzie/MC rozgrzewka to 3–4 serie, których nikt nie liczy w
głowie — a apka ma już cały aparat (`platePlan`, `nearestAchievable`, aktywny profil siłowni
z FEAT-1). Wpisujesz się na ławkę i widzisz: „20 × 8 · 40 × 5 · 55 × 3 · 65 × 2" z talerzami
na stronę. Zero nowych danych, czysta arytmetyka na tym, co już jest.

**Pliki:** `src/lib/logic.ts`, `src/components/TrainScreen.tsx`, `tests/logic.test.ts`.

**Spec — silnik:** `warmupPlan(ex, workWeight, bar, plates): { weight: number; reps: number }[]`
- Tylko `ex.unit === "barbell"` i `!ex.isHold` — dla hantli/maszyn ramp jest trywialny i
  zaśmieciłby UI (świadome ograniczenie v1, nie przeoczenie).
- Kroki: pusty gryf × 8 (pomiń, gdy `bar >= 0.5 * workWeight`), potem 50% × 5, 70% × 3, 85% × 2.
- Każdy krok przez `nearestAchievable(pct * workWeight, bar, plates)`; **nigdy** nie przekrocz
  `workWeight`; usuń duplikaty i kroki niemonotoniczne (przy lekkich ciężarach 50% i 70% mogą
  wpaść na ten sam osiągalny ciężar — wtedy jedna seria, nie dwie identyczne).
- `workWeight <= bar` → `[]` (nie ma czego rozgrzewać sztangą).

**Spec — UI:** w karcie ćwiczenia w loggerze zwijany wiersz „Rozgrzewka (4)" — po rozwinięciu
lista kroków, każdy z rozpisaniem `platePlan` na stronę (jak `PlateBar` w `Gym.tsx`).
**Serie rozgrzewkowe NIE są logowane** — nie wchodzą do `entry.sets`, tonażu, objętości ani
progresji (to podpowiedź, nie dane). Gryf/talerze bierz z AKTYWNEGO profilu siłowni, jeśli
ustawiony (spójnie z FEAT-1), inaczej z `settings`.

**Testy:** ramp dla 100 kg/gryf 20 → monotoniczny, ostatni krok < 100, wszystkie osiągalne z
talerzy; `workWeight = 20` (sam gryf) → `[]`; ćwiczenie nie-sztangowe → `[]`; deduplikacja przy
lekkim ciężarze (np. 30 kg) nie zwraca dwóch identycznych kroków.
**Akceptacja:** rozgrzewka widoczna przy ćwiczeniach ze sztangą, liczby zgadzają się z
kalkulatorem talerzy, tonaż sesji bez zmian po rozwinięciu rozgrzewki.
**Rozmiar:** M
**Wdrożone:** `warmupPlan()` w `logic.ts` (8 testów). `TrainScreen.tsx`: zwijany wiersz
„Rozgrzewka (N)" w karcie ćwiczenia, gryf/talerze z aktywnego profilu siłowni (FEAT-1) albo
domowe, każdy krok z rozpisaniem `platePlan` na stronę. Zweryfikowane w przeglądarce: dla
celu 45 kg (gryf 20) rampa 20×8 → 22,5×5 → 32,5×3 → 37,5×2, wszystko ściśle rosnące i poniżej
celu; serie rozgrzewkowe nie trafiają do `entry.sets`.

### [x] P1-10. Czas trwania treningu i gęstość (tonaż/min) (2026-07-26)
**Skąd:** `Session` ma tylko `date` (= moment STARTU, ustawiany w `startDay`), więc apka nie wie,
czy trening trwał 45 minut czy dwie godziny. To jedna z niewielu metryk, których nie da się
odtworzyć wstecz — im wcześniej zacznie się zbierać, tym lepiej.

**Pliki:** `src/lib/types.ts`, `src/lib/store.tsx`, `src/components/TrainScreen.tsx`,
`src/components/HistoryScreen.tsx`, `src/components/ProgressScreen.tsx`, `tests/logic.test.ts`.

**Spec:**
- `Session += finishedAt?: string` (ISO). Ustawiane w `store.finishSession` (`store.tsx:119`)
  na `new Date().toISOString()`. `date` zostaje momentem startu — nie zmieniaj jego semantyki.
- **Bez bumpa `SCHEMA_VERSION`** — pole opcjonalne, którego brak (stare sesje, historia startowa)
  daje poprawne zachowanie „czas nieznany". Zgodne z Zasadą 2 (pole samonaprawiające się).
- `sessionDuration(session): number | null` w `logic.ts` — minuty, `null` gdy brak `finishedAt`
  **albo gdy wynik > 240 min** (apka została otwarta na noc — lepiej „—" niż bzdura w statystyce).
- UI: podsumowanie treningu („58 min · 2,1 t · 36 kg/min"), wiersz sesji w Historii (czas obok
  daty), Progres — średni czas i gęstość z ostatnich 8 tygodni pod wykresem tonażu.
  Gęstość = `sessionVolume / minuty`, ukryj gdy `duration === null`.

**Testy:** `sessionDuration` liczy minuty poprawnie; brak `finishedAt` → `null`; 5 h → `null`.
**Akceptacja:** nowo zakończony trening pokazuje czas, stare sesje pokazują „—" i nic się nie
wysypuje; `npm test` + `npm run build` OK.
**Rozmiar:** S
**Wdrożone:** `Session.finishedAt?` (bez bumpa wersji), `sessionDuration()` w `logic.ts` (4 testy),
`fmtTonnage` przeniesiony z `ProgressScreen.tsx` do `logic.ts` (współdzielony z P1-6). UI:
podsumowanie treningu („45 min · 7,6 t · 168 kg/min" w teście), Historia (czas przy sesjach ze
znanym `finishedAt`, brak dla starych/historii startowej), Progres (średnia z ostatnich 8
tygodni pod wykresem tonażu). Zweryfikowane w przeglądarce na wszystkich trzech ekranach.

### [x] P1-11. Twarda walidacja importu + kopia bezpieczeństwa przed nadpisaniem (2026-07-26)
**Realne ryzyko:** `store.importJson` (`store.tsx:287`) sprawdza tylko, czy `parsed.sessions`
jest tablicą — plik z połowicznie poprawnym kształtem (albo backup z innej apki, który ma pole
`sessions`) przechodzi walidację i **nadpisuje cały stan bez odwrotu**. To jedyne miejsce w
apce, gdzie jedno kliknięcie może skasować całą historię. Cena naprawy: mała.

**Pliki:** `src/lib/backup.ts` (albo nowy `src/lib/validate.ts`), `src/lib/store.tsx`,
`src/components/MoreScreen.tsx`, `tests/logic.test.ts`.

**Spec:**
- `validateBackup(parsed: unknown): string | null` — `null` = OK, inaczej komunikat po polsku
  wskazujący KONKRETNY brak. Sprawdź: obiekt; `version` liczba; `exercises`/`days` tablice, w
  których każdy element ma `id` i `name` (string); `targets` obiekt; `sessions` tablica, a każda
  sesja ma `id`, `dayId`, `date` i tablicę `entries`; `body`/`squash` tablice; `settings` obiekt.
  Nie waliduj pola po polu do końca świata — chodzi o odsianie „to nie jest backup tej apki",
  nie o pełny schemat.
- `importJson` woła `validateBackup` PRZED `setState`; przy błędzie zwraca jego komunikat.
- **Kopia bezpieczeństwa:** przed nadpisaniem (import) ORAZ przed `resetAll` zapisz bieżący stan
  do `localStorage` pod `trening-app-backup-auto` (jeden slot, nadpisywany). W „Więcej" → Backup
  przycisk „Przywróć ostatnią kopię automatyczną" (aktywny tylko gdy slot istnieje, z datą).
  To ma być ratunek po pomyłce, nie drugi system backupu — jeden slot wystarczy.
- Potwierdzenie importu: `confirm()` z liczbą sesji w PLIKU vs liczbą sesji OBECNIE
  („Zaimportować 12 sesji? Obecne 34 zostaną zastąpione."). Kamil ma zobaczyć, że traci więcej,
  niż zyskuje, ZANIM kliknie.

**Testy:** `validateBackup` — poprawny `defaultState()` → `null`; `{}` → komunikat; obcy JSON z
polem `sessions` (ale bez `exercises`/`settings`) → komunikat; sesja bez `entries` → komunikat.
**Akceptacja:** import obcego pliku odbity z sensownym komunikatem, import poprawnego działa jak
dziś, po imporcie/resecie da się wrócić do stanu sprzed operacji.
**Rozmiar:** S/M
**Wdrożone:** `validateBackup()` w nowym `src/lib/validate.ts` (6 testów), wołane w
`store.importJson` przed `setState`. Kopia bezpieczeństwa: jeden slot
(`trening-app-backup-auto`) nadpisywany przed importem i `resetAll`, nowa akcja
`store.restoreAutoBackup()`. `MoreScreen.tsx`: `confirm()` przed importem pokazuje liczbę sesji
w pliku vs obecnie, przycisk „Przywróć ostatnią kopię automatyczną" (z datą, aktywny tylko gdy
slot istnieje). Zweryfikowane w przeglądarce end-to-end (Playwright): zły plik → czytelny
komunikat błędu, dobry plik z mniejszą liczbą sesji → import po potwierdzeniu, przywrócenie
kopii automatycznej cofa do stanu sprzed importu.

---

## P2 — wisienki (gdy P0/P1 działają)

### [x] P2-1. Heatmapa mięśni (ludzik SVG) (2026-07-25; WYCOFANE 2026-07-26 na prośbę użytkownika — nie wracać)
**Weryfikacja Gemini:** fajny wizual, czysty frontend. **Spec:** nowy komponent
`MuscleMap.tsx`: uproszczona sylwetka przód/tył (własne SVG paths, ~10 regionów
zmapowanych na `Muscle`), fill wg `STATUS_COLORS[status]` z `weeklyMuscleVolume`.
Umieść nad listą w karcie Objętość; lista zostaje (dostępność). **Rozmiar:** M/L

### [x] P2-2. Korelacja squash ↔ siła (2026-07-26)
**Weryfikacja Gemini:** ograniczona wartość naukowa przy n=1 i 1 meczu/tydz., ale tania:
**Spec:** `LineChart` += `markers?: number[]` (timestampy) — pionowe kreski;
w Progresie, dla wykresu ćwiczenia, pokaż kreski w dniach squasha ±1 dzień przed sesją.
Wniosek zostaw człowiekowi (bez automatycznych "%"). **Rozmiar:** S/M
**Wdrożone:** `LineChart` dostał `markers?: number[]` (fioletowa przerywana kreska, filtrowana
do domeny X wykresu). `ProgressScreen.tsx`: wszystkie daty squasha jako markery na wykresie
„Postęp ćwiczenia" + podpis wyjaśniający, gdy któryś marker wypada w widocznym oknie. Bez zmian
silnika i testów (czysty UI). Zweryfikowane w przeglądarce.

### [x] P2-3. Paragon treningowy (obrazek do rolki) (2026-07-26; WYCOFANE 2026-07-26 wieczór na prośbę Kamila — patrz P2-6, nie wracać)
**Weryfikacja Gemini:** wykonalne BEZ html-to-image (nie dodawaj zależności!) —
rysuj ręcznie na `<canvas>` (1080×1350, ciemne tło, tonaż, czas, serie, rekordy,
progresje ↑). `canvas.toBlob` → `navigator.share({ files: [new File(...)] })`
(iOS 15+), fallback: link download. Guzik „Udostępnij" w podsumowaniu treningu.
**Rozmiar:** M
**WYCOFANE:** Kamil nie chce tej funkcji („nie jest mi potrzebna"). Usunięcie = zadanie P2-6.

### [x] P2-4. Check-in gotowości (autoregulacja) (2026-07-26)
**Weryfikacja Gemini:** uczciwie — „szokowanie CUN" to bro-science, ale sama
autoregulacja (mniej serii przy słabym śnie/DOMS) jest zasadna. Wdrażamy lekko:
**Spec:** przy starcie dnia opcjonalny mini-panel (pomiń = brak kary): sen 1–5,
zakwasy 1–5. Jeśli sen ≤ 2 lub suma ≤ 4 → toast-sugestia: „Słaba regeneracja —
rozważ -1 serię w przysiadzie/MC, izolacje bez zmian". Zapisz odpowiedzi w
`Session` (+= `readiness?: {sleep:number; doms:number}`) — dane pod przyszłe analizy.
Bump wersji wg Zasad. **Rozmiar:** M
**Wdrożone:** `Session.readiness?` — **BEZ bumpa wersji** (odstępstwo od tego zapisu spec: pole
opcjonalne/samonaprawiające się nie wymaga bumpa wg Zasady 2, patrz P1-10 gdzie ustalono ten
wzorzec). Panel „Jak się dziś czujesz?" na ekranie wyboru dnia (pigułki 1–5 dla obu skal,
kierunek „wyżej = lepiej" dla obu), dotknięcie ustawia oba pola (nietknięte = neutralne 3),
kasowane po starcie dnia. Toast przy niskiej gotowości liczony PRZED `setState` (nie w jego
updaterze) — inaczej StrictMode w dev podwajał toast. Zweryfikowane w przeglądarce.

### [x] P2-5. Edycja sesji w historii (2026-07-26)
**Mój pomysł** — literówka w ciężarze psuje rekordy i e1RM na zawsze. **Spec:**
w rozwiniętej sesji „Edytuj" → dialog z edycją serii (weight/reps/done) →
`store.updateSession(session)` (nowa akcja). UWAGA: NIE przeliczaj wstecz targets —
tylko dane sesji. **Rozmiar:** M

### [x] P2-6. Usuń funkcję paragonu / „Udostępnij" (cofnięcie P2-3) (2026-07-26)
**Zgłoszenie Kamila (2026-07-26 wieczór):** „nie chcę w ogóle opcji paragonu. Wywal ją, nie
jest mi potrzebna." Cofamy P2-3 w całości.

**Do usunięcia (dokładna lista, chirurgicznie — nie tknij backupu do Gista!):**
1. **`src/lib/receipt.ts`** — usuń cały plik (`drawReceipt`, `shareReceipt`, `ReceiptData`,
   `ReceiptItem`).
2. **`src/components/TrainScreen.tsx`:**
   - Import `Share2` z lucide-react (`:12`).
   - Import `drawReceipt, shareReceipt, type ReceiptData` (`:28`) — usuń całą linię.
   - Stan `receipt`/`setReceipt` (`:74`) i `receiptCanvasRef` (`:79`).
   - W `finish()` (`:260-301`) cały blok budujący paragon: `dayNameBase/dayName`,
     `doneSets/totalSets/volume` (liczone TYLKO pod paragon), `durationMin`, `items`,
     `setReceipt({...})` (`:272-292`). **UWAGA:** zostaw `store.finishSession(...)`,
     `setSummary(results)`, `setDraft(null)` ORAZ blok auto-backupu do Gista
     (`:296+` `if (state.settings.autoBackup ...)`) — to niezależne od paragonu, MUSI zostać.
   - Funkcja `shareWorkout()` (`:307-311`) — usuń.
   - W widoku podsumowania: przycisk „Udostępnij" (`:351-353`), `setReceipt(null)` w onClick
     „Zamknij" (`:359` — zostaw `setSummary(null)`), ukryty `<canvas>` (`:364`).
   - Sprawdź, czy po usunięciu `volume`/`sessionVolume`/`topOfEntry`/`fmtKg` nie zostają
     nieużywane w tym pliku (TS `noEmit` je złapie) — usuń martwe importy, ale tylko te
     faktycznie osierocone (część jest używana gdzie indziej w pliku).
3. Nie ruszaj `src/lib/backup.ts` ani karty „Chmura" — to inna funkcja (backup ≠ paragon).

**Akceptacja:** `tsc --noEmit` bez błędów o nieużywanych/brakujących symbolach, `npm run
build` OK; po treningu podsumowanie pokazuje tylko listę + „Zamknij" (bez „Udostępnij");
brak referencji do `receipt` w kodzie (`grep -ri receipt src/` czysto poza ewentualnym
komentarzem historii). Auto-backup do Gista dalej działa.
**Rozmiar:** S

### [x] P2-7. Dobór dnia bonusowego pod niedotrenowaną partię — WDROŻONE (26.07.2026)
**Pomysł Kamila (2026-07-26 wieczór):** „może losowanie bonusowego dnia na dany
zestaw/partię?" — zamiast jednego sztywnego składu bonusu, apka proponuje wariant pod partię,
która najbardziej kuleje.

**Decyzje Kamila (doprecyzowanie przed kodem):**
1. **Wariant (A) — deterministyczny dobór pod deficyt**, nie losowanie. Kamil zauważył sam
   kluczowy niuans: skoro bonus robi na końcu tygodnia (po Pon/Śr/Pt), lepiej liczyć deficyt
   z FAKTYCZNIE wykonanych serii w tym tygodniu (`actualWeeklyMuscleVolume`, z INFO-1a), nie
   z planu (`weeklyMuscleVolume`, który jest statyczny i zawsze wskazałby te same partie).
2. **Jednorazowa podpowiedź „na dziś"** w drafcie sesji (jak „Użyj" w FEAT-1) — NIE nadpisuje
   stałego składu dnia `bonus` w `state.days`. Cache'owana (nie liczona na nowo przy każdym
   wejściu na ekran), z ręcznym przyciskiem „Odśwież" gdy w tygodniu coś się zmieniło.
3. **Progresja działa normalnie** — dobrane ćwiczenia bonusu wchodzą do drafta jak każde inne,
   `finishSession`/`computeProgression` traktuje je bez wyjątków.

**Implementacja:**
- `logic.ts`: `suggestBonusExercises(state, count, nowIso?): Exercise[]` — liczy
  `actualWeeklyMuscleVolume(state, goal)` (goal z `settings.volumeGoal`, domyślnie
  hipertrofia), filtruje partie ze statusem `low`, sortuje po deficycie `(sets - min)` rosnąco
  (największa dziura pierwsza). Pula kandydatów = wszystkie nie-zarchiwizowane ćwiczenia BEZ
  tych już obecnych w aktywnych dniach GŁÓWNYCH (`!day.optional`) — nie dubluje ruchów, które
  i tak są w tygodniu. Dla każdej deficytowej partii dobiera jedno pasujące `primaryMuscle`
  ćwiczenie z puli; jeśli deficytowych partii mniej niż `count`, dobija resztę dowolnymi
  ćwiczeniami z puli (żeby bonus nie był pusty).
- `TrainScreen.tsx`: nowy cache w localStorage (`trening-app-bonus-suggestion`,
  `{dayId, exerciseIds, generatedAt}`), analogiczny do drafta sesji. Na ekranie wyboru dnia,
  pod dniem bonusowym (gdy aktywny), panel: przycisk „Dobierz pod słabe partie" → liczy
  sugestię i cache'uje; gdy sugestia istnieje — lista nazw ćwiczeń + „Rozpocznij z propozycją"
  (startuje draft z `overrideExerciseIds` zamiast `day.exerciseIds`, plan bez zmian) +
  „Odśwież" (przelicza na nowo, np. po zalogowaniu kolejnego treningu w tygodniu).
  `startDay(dayId, overrideExerciseIds?)` — jedyna zmiana w istniejącej funkcji, w pełni
  zgodna z wzorcem FEAT-1/P1-3 (modyfikacja TYLKO drafta).
- 4 nowe testy w `tests/logic.test.ts`: Łydki=`low` (0 serii w tygodniu, reszta partii
  częściowo pokryta) → sugestia zawiera `calf_seated` (nie `calf`, bo ten jest w dniu Środa);
  dobicie do pełnej puli 5 ćwiczeń bonus 2.0 bez duplikatów; żaden pick spoza dni głównych.
- **Zweryfikowane w przeglądarce (Playwright):** włączenie dnia Bonus w Planie → wejście do
  Treningu → „Dobierz pod słabe partie" pokazuje `Wspięcia na palce siedząc · Face pull ·
  Uginanie młotkowe hantli · Prostowanie ramion na wyciągu · Plank bokiem` (łydki jako
  najbardziej deficytowa partia trafiły na pierwsze miejsce) → „Rozpocznij z propozycją"
  startuje logger z tym składem → `state.days` (plan) bez zmian, cache w
  `trening-app-bonus-suggestion` zapisany → po zaliczeniu serii i „Zakończ trening" progresja
  policzona normalnie (`calf_seated` 30→32,5 kg, jak każde inne ćwiczenie).
**Rozmiar:** M

---

## Nowa partia pomysłów (Opus 5, 2026-07-26 wieczór) — P2-8…P2-12

Propozycje „level up" po wdrożeniu P2-7. Kolejność w sekcji = moja rekomendacja wartości do
kosztu. **P2-8 (Deload) wymaga decyzji Kamila przed kodowaniem** — reszta jest zamknięta.

### [x] P2-8. Tryb tygodnia: DELOAD (trzeci przełącznik + nudge po zastoju) (2026-07-26)
**Dlaczego to jest największy „level up" z tej listy:** apka umie już periodyzację falującą
(P0-5: Siła ↔ Hipertrofia tydzień w tydzień) i umie WYKRYĆ zastój (P1-1 `detectPlateau`), ale
nie ma jedynego narzędzia, które zastój faktycznie odkręca — lżejszego tygodnia. Dziś jedyną
reakcją na spadek formy jest bursztynowy komunikat „odbuduj powtórzenia", czyli walka na tym
samym ciężarze aż do skutku. Deload domyka pętlę: obciążenie → zmęczenie → **rozładowanie** →
superkompensacja. To też domyka lukę „Auto-deload" z listy otwartych pomysłów w CLAUDE.md §10.

**Spec — silnik (`logic.ts`, `types.ts`):**
- `TrainingMode += "deload"` (trzecia wartość, `types.ts`). Przejrzyj WSZYSTKIE miejsca
  porównujące `mode === "hypertrophy"` — muszą świadomie obsłużyć trzeci przypadek
  (`store.finishSession`, `TrainScreen`, `exerciseForMode`, `targetForMode`), nie wpaść w
  domyślny else.
- `exerciseForMode(ex, "deload")` → bazowy (siłowy) zakres powtórzeń BEZ zmian, `rir: ex.rir + 2`
  (masz zejść z ciężarem, nie z powtórzeniami — objętość spada przez ciężar i serie, nie przez
  bicie rekordów w powtórzeniach).
- `deloadTargetFor(state, ex)` → `round(0.65 × targets[ex.id])` do `ex.increment`. Baza to
  ZAWSZE cel siłowy (`targets`), nawet gdy poprzedni tydzień był hipertroficzny — deload jest
  odpoczynkiem od obu trybów. `targetForMode` dostaje trzecią gałąź.
- Serie: w loggerze `max(2, ex.targetSets - 1)` (jeśli P0-8 zostanie wdrożone wcześniej, licz od
  `targetSetsForMode`, nie od surowego `ex.targetSets`).
- **Progresja WYŁĄCZONA:** `finishSession` przy `mode === "deload"` NIE zapisuje ani `targets`,
  ani `hyperTargets` — cele zamrożone. Podsumowanie pokazuje „Deload — cele bez zmian, wracasz
  do swoich ciężarów w przyszłym tygodniu." Bez tego deload rozwaliłby progresję (3 serie na
  65% trafiłyby `repMax` i apka „awansowałaby" ciężar w dół albo w górę — oba wyniki błędne).
- `weeksSinceDeload(state): number` — liczba pełnych tygodni (po `mondayOf`) od ostatniej sesji
  z `mode === "deload"`; brak takiej sesji → liczy od pierwszej sesji w historii.

**Spec — UI (`TrainScreen`):** trzeci kafelek w przełączniku „Cel tygodnia" (Siła · Hipertrofia ·
Deload, kolor bursztynowy — spójnie ze statusem `deload` w podsumowaniu). Plakietka „Deload" w
nagłówku loggera (jak dziś „Siła"/„Hipertrofia"), etykieta `(deload)` w wierszu „Ostatnio"
(`lastByExercise` już rozróżnia tryby). **Nudge:** na ekranie wyboru dnia bursztynowy box, gdy
`weeksSinceDeload(state) >= 6` LUB `detectPlateau` zwraca `true` dla ≥ 3 ćwiczeń: „6 tygodni bez
lżejszego tygodnia i zastój w 3 ćwiczeniach — rozważ tydzień deloadu." Sugestia, nie automat
(§11) — nie przełączaj trybu za użytkownika.

**Decyzje z pkt „DO USTALENIA" — podjęte BEZ Kamila** (pytanie zablokowane w tej sesji przez
przerwania narzędzia; przyjęte moje własne rekomendacje z tej sekcji, jawnie udokumentowane
tutaj i w commicie — do zrewidowania, jeśli Kamil zechce inaczej):
1. **65% ciężaru** — przyjęte wprost (środek klasycznego zakresu 50–70%).
2. **Minus jedna seria** — przyjęte: schodzimy też z objętością, nie tylko z ciężarem.
3. **Deload liczy się do objętości tygodniowej jak normalny tydzień** — przyjęte (i tak nie
   wymagało zmian w silniku: `weeklyMuscleVolume`/`actualWeeklyMuscleVolume` liczą serie
   niezależnie od trybu, w którym zostały wykonane).

**Testy:** `exerciseForMode(ex, "deload")` nie rusza zakresu, podnosi RIR o 2; `deloadTargetFor`
liczy 65% i zaokrągla do `increment`; `finishSession` w deloadzie NIE zmienia `targets` ani
`hyperTargets` (kluczowy test — to jest miejsce, gdzie błąd kosztuje wypracowaną progresję);
`weeksSinceDeload` liczy tygodnie poprawnie i radzi sobie z brakiem deloadu w historii.
**Akceptacja:** tydzień deloadu da się przeklikać bez tykania planu, cele po nim są dokładnie
takie, jak przed nim, nudge pojawia się po 6 tygodniach; CLAUDE.md §5.7 dopisane o trzecim trybie.
**Rozmiar:** M/L
**Wdrożone:** wszystko z sekcji „Spec — silnik/UI" powyżej, 1:1. 12 nowych testów. Dodatkowo:
`store.finishSession` wraca po `d.sessions.push(session)` gdy `mode==="deload"` (progresja
pominięta w całości, nie tylko „nie nadpisana"); podsumowanie treningu w deloadzie renderuje
JEDEN komunikat „Deload — cele bez zmian" zamiast per-ćwiczeniowych kart progresji (te liczyłyby
się na 65% ciężaru i myliłyby — patrz `computeProgression`, który nie wie nic o trybie). Przy
okazji poprawiony drobny bug: opis „N×M powt." w karcie ćwiczenia w loggerze pokazywał stałą
liczbę serii z planu zamiast faktycznej liczby wierszy w drafcie — przy deloadzie (i przy ręcznym
dodaniu serii) tekst nie zgadzał się z tym, co widać poniżej. Zweryfikowane w przeglądarce
end-to-end: cel 45 kg → deload 30 kg (65%, zaokrąglone do 2,5) × 2 serie (zamiast 3) → po
zakończeniu cel WCIĄŻ 45 kg, sesja zapisana z `mode: "deload"`, podsumowanie pokazuje banner.

### [x] P2-9. Cofnij zakończenie treningu (undo progresji) (2026-07-26)
**Realne ryzyko:** `finishSession` (`store.tsx:119`) natychmiast nadpisuje `targets` /
`hyperTargets`. Kliknięcie „Zakończ trening" o jedną serię za wcześnie (albo przez pomyłkę na
pustym drafcie) zapisuje sesję I przesuwa cele. P2-5 pozwala edytować sesję w Historii, ale
**świadomie nie przelicza celów wstecz** — czyli po pomyłce cele zostają złe i trzeba je poprawiać
ręcznie w Planie, pamiętając poprzednie wartości. Undo rozwiązuje to jednym kliknięciem.

**Pliki:** `src/lib/store.tsx`, `src/components/TrainScreen.tsx`.

**Spec:** `finishSession` zwraca (obok `FinishSummary[]`) `undo: { sessionId, targets,
hyperTargets }` — snapshot celów SPRZED zapisu (płytka kopia obu map) + id nowej sesji. Nowa
akcja `store.undoFinishSession(undo)`: usuwa sesję o tym id i przywraca obie mapy w całości.
Przycisk „Cofnij zakończenie" (wariant `ghost`, dyskretny) na ekranie podsumowania, obok
„Zamknij". Snapshot trzymaj w stanie Reacta w `TrainScreen` — **nie persystuj**: undo działa
dopóki widzisz podsumowanie, potem znika. To świadome ograniczenie zakresu (zero zmian schematu,
zero nowych ścieżek migracji) i pokrywa 95% realnych pomyłek, bo są zauważane od razu.
⚠️ Jeśli włączony auto-backup do Gista: undo musi też oznaczyć backup jako nieaktualny albo
odpalić ponowny backup po cofnięciu, inaczej chmura zostanie ze stanem „po pomyłce".

**Testy:** manualne (akcja store'a + UI, nie czysta logika) — opisz w commicie, co sprawdziłeś.
**Akceptacja:** cofnięcie usuwa sesję z Historii i przywraca cele co do grosza; ponowne
zakończenie tego samego treningu nie jest możliwe (draft już wyczyszczony — po undo wróć do
ekranu wyboru dnia, nie do loggera).
**Rozmiar:** M
**Wdrożone:** `finishSession` zwraca `FinishResult { summaries, undo }` (`undo.sessionId` i snapshot
obu map celów, generowane PRZED `mutate` jak `finishedAt`). `store.undoFinishSession(undo)` usuwa
sesję i przywraca mapy. Przycisk „Cofnij zakończenie" (ghost) w podsumowaniu, snapshot tylko w
stanie Reacta. Po undo — jeśli auto-backup włączony — odpala ponowny backup, żeby chmura nie
zostawała ze stanem sprzed cofnięcia. Zweryfikowane w przeglądarce end-to-end: 9 sesji/cel 45 →
zakończenie → 10 sesji/cel 47,5 → cofnięcie → z powrotem 9 sesji/cel 45, ekran wyboru dnia.

### [x] P2-10. Podpowiedź następnego dnia w rotacji (2026-07-26)
**Po co:** ekran wyboru dnia pokazuje 3–4 równorzędne kafelki i za każdym razem trzeba pomyśleć,
co jest dziś. Apka wie to z historii. Mikro-usprawnienie, ale dotyka jedynego ekranu, przez który
przechodzi się przed KAŻDYM treningiem.

**Pliki:** `src/lib/logic.ts`, `src/components/TrainScreen.tsx`, `tests/logic.test.ts`.

**Spec:** `nextDaySuggestion(state): string | null` — bierze ostatnią ukończoną sesję (bez dnia
bonusowego), znajduje jej `dayId` w kolejności `state.days` (tylko dni aktywne, nie-opcjonalne)
i zwraca następny z zawijaniem (fri → mon). Brak historii → pierwszy aktywny dzień. UI: na
sugerowanym kafelku subtelna ramka w kolorze `accent` dnia + chip „następny w rotacji". Kafelki
zostają klikalne wszystkie — to podpowiedź, nie blokada.
**Testy:** po `mon` → `wed`; po `fri` → `mon` (zawijanie); brak sesji → pierwszy dzień; ostatnia
sesja z dnia bonusowego jest pomijana (nie resetuje rotacji).
**Rozmiar:** S
**Wdrożone:** `nextDaySuggestion()` w `logic.ts` (5 testów). `TrainScreen.tsx`: sugerowany kafelek
dostaje ramkę w kolorze własnego `accent` + chip „następny w rotacji", wszystkie kafelki nadal
klikalne. Zweryfikowane w przeglądarce (domyślna historia kończy się na piątku → podpowiedź to
poniedziałek).

### [x] P2-11. Kalendarz konsekwencji (8 tygodni × dni + seria) (2026-07-26)
**Po co:** wszystkie dzisiejsze wykresy pokazują CIĘŻARY. Żaden nie pokazuje najsilniejszego
predyktora wyniku — czy w ogóle chodzisz na siłownię. Jeden rzut oka na 8 tygodni mówi więcej niż
tonaż tygodniowy, bo pokazuje dziury.

**Pliki:** `src/lib/logic.ts`, `src/components/ProgressScreen.tsx`, `tests/logic.test.ts`.

**Spec:** `weeklyAdherence(state, weeks = 8): { week: string; done: number; planned: number }[]` —
dla każdego z ostatnich `weeks` poniedziałków (`mondayOf`) liczy ukończone sesje vs liczbę
aktywnych dni nie-opcjonalnych (dzień bonusowy liczy się do `done`, ale NIE podnosi `planned` —
inaczej włączenie bonusu psułoby statystykę za tygodnie, w których go nie było). UI: siatka 8
kolumn w karcie w Progresie, kropka pełna/pusta per dzień + podpis „5/6 tygodni z kompletem".
Kolory: komplet = zielony, częściowo = bursztyn, zero = szary (NIE czerwony — to log treningowy,
nie wyrzut sumienia).
**Testy:** tydzień z 3/3 sesji → `done === planned`; tydzień pusty → `done === 0`; dzień bonusowy
nie podbija `planned`; okno obejmuje dokładnie `weeks` tygodni wstecz.
**Rozmiar:** S/M
**Wdrożone:** `weeklyAdherence(state, weeks=8, nowIso?)` w `logic.ts` (6 testów). `ProgressScreen.tsx`:
karta „Konsekwencja" — 8 kolumn (tygodnie), każda kolumna to `planned` kropek (pełne w kolorze
statusu tygodnia, puste = sam obrys), podpis „X/8 tygodni z kompletem". Zweryfikowane w
przeglądarce (3 ostatnie tygodnie z historii startowej pełne/zielone, starsze puste).

### [x] P2-12. Standardy siłowe względem masy ciała (2026-07-26)
**Po co:** `body` (waga) i e1RM leżą w tym samym stanie i nigdy się nie spotykają. Stosunek
ciężaru do masy ciała to jedyny kontekst, który mówi „jesteś już mocny", gdy same kilogramy
przestają robić wrażenie. Tanie, bo dane są.

**Pliki:** `src/lib/logic.ts`, `src/components/ProgressScreen.tsx`, `tests/logic.test.ts`.

**Spec:** `strengthRatios(state)` → dla `squat`, `deadlift`, `bench_bb`, `ohp`: najlepsze e1RM z
historii ÷ **najnowsza** waga z `body`. Progi (× masy ciała, orientacyjne, mężczyźni, bez sprzętu):
bench 0,75 / 1,0 / 1,25 · przysiad 1,0 / 1,25 / 1,5 · MC 1,25 / 1,5 / 1,75 · OHP 0,45 / 0,6 / 0,75
→ etykiety „początkujący / średniozaawansowany / zaawansowany". Karta ukryta w całości, gdy brak
wpisu wagi (nie zgaduj masy ciała) albo brak historii danego ćwiczenia.
**Framowanie (§11 — to jest tu ważniejsze niż kod):** pod kartą obowiązkowo: „Progi orientacyjne
z ogólnych tabel siłowych — nie uwzględniają wieku, wzrostu ani dźwigni. Ciekawostka, nie ocena."
Bez emoji-medali i bez „awansów" — to ma być punkt odniesienia, nie grywalizacja.
**Testy:** brak wagi → pusty wynik; progi klasyfikują poprawnie na granicy (dokładnie 1,0 × masy
w benchu → średniozaawansowany, nie początkujący); e1RM brany jako maksimum z całej historii.
**Rozmiar:** S
**Wdrożone:** `strengthRatios()` w `logic.ts` (5 testów) — środkowy i górny próg sterują etykietą,
dolny tylko punkt odniesienia w danych (dokumentacyjny, nie wyświetlany osobno w MVP).
`ProgressScreen.tsx`: karta ukryta w całości bez wpisu wagi, z obowiązkowym zastrzeżeniem pod
listą. Zweryfikowane w przeglądarce: karta niewidoczna bez wagi, po dodaniu wpisu poprawne
współczynniki i etykiety dla wszystkich czterech ćwiczeń z historią.

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
- **Powiadomienie o końcu przerwy, gdy apka jest w tle** (Opus 5, 2026-07-26) — kuszące, ale
  na iOS niewykonalne w tej architekturze. Web Push w PWA z ekranu głównego (iOS 16.4+) wymaga
  **service workera I serwera push** — a deliverable to jeden sklejony `docs/index.html` bez SW,
  hostowany na GitHub Pages (brak backendu). Lokalne powiadomienia „za 2 minuty" nie istnieją w
  Safari (brak `TimestampTrigger`), a timery JS są dławione, gdy apka idzie w tło — więc nawet
  `Notification` odpalone z żywej strony nie zadziała w scenariuszu, o który chodzi (scrollujesz
  Instagram, apka śpi). Zostaje to, co jest: dźwięk + timer na ekranie + Wake Lock (P1-4), który
  utrzymuje ekran włączony w trakcie treningu. Nie wracać bez zmiany architektury (SW + backend).

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
- [x] 2026-07-25: P1-1 plateau breaker — `detectPlateau()` w logic.ts (3 ostatnie
  treningi ten sam topWeight i e1RM w widełkach ±1%), bursztynowy box-sugestia
  w podsumowaniu treningu (TrainScreen) i przy wykresie postępu (ProgressScreen).
- [x] 2026-07-25: P1-2 obwód pasa + rekompozycja — `BodyEntry.waist?`, SCHEMA_VERSION
  4, drugi input w karcie Waga ciała, `LineChart` z opcjonalnym drugim szeregiem
  (`data2`/`color2`), obie serie znormalizowane do % zmiany od pierwszego pomiaru
  (wspólna skala mimo różnych jednostek kg/cm).
- [x] 2026-07-25: P1-3 zamień ćwiczenie — ikonka ⇄ w karcie ćwiczenia w loggerze
  (TrainScreen) pokazuje listę zamienników z tym samym `primaryMuscle` (bez
  archiwalnych, bez już obecnych w treningu); podmiana działa TYLKO w drafcie
  bieżącej sesji, plan (seed/dni) zostaje nietknięty.
- [x] 2026-07-25: P1-4 Wake Lock — ekran nie gaśnie w trakcie treningu
  (`navigator.wakeLock.request("screen")` gdy trwa draft, odnawiane po
  powrocie karty z tła przez `visibilitychange`, zwalniane przy zakończeniu/
  porzuceniu treningu; brak wsparcia albo odmowa cicho ignorowane).
- [x] 2026-07-25: P2-1 heatmapa mięśni (`MuscleMap.tsx`) — WYCOFANA 2026-07-26
  na prośbę użytkownika (nie podobał się ludzik); komponent usunięty, karta
  Objętość wróciła do samej listy partii.
- [x] 2026-07-26: P2-3 paragon treningowy — nowy `receipt.ts`: `drawReceipt()`
  rysuje ręcznie na `<canvas>` 1080×1350 (bez html-to-image), `shareReceipt()`
  robi `navigator.share` z plikiem PNG (iOS 15+) albo pobranie jako fallback.
  Guzik „Udostępnij" w podsumowaniu treningu. Przy okazji naprawiony bug w
  `store.finishSession` (nieczysty updater dublował summaries pod StrictMode).
- [x] 2026-07-26: P2-5 edycja sesji w historii — nowa akcja `store.updateSession()`,
  guzik „Edytuj" w rozwiniętej sesji otwiera dialog z edycją każdej serii
  (ciężar/powt./zaliczona), zapis nadpisuje tylko dane sesji — targets i
  progresja NIE są przeliczane wstecz.
- [x] 2026-07-26: P0-5 tryb treningu Siła/Hipertrofia — przełącznik na ekranie
  wyboru dnia (`TrainScreen.tsx`), persystowany w `settings.trainingMode`.
  `logic.ts`: `exerciseForMode()` (hipertrofia = 8–12 RIR1, wyjątek deadlift
  6–8 RIR2, zakresy już ≥8 zostają + RIR1, isHold bez zmian), `weightForReps()`
  (odwrócony Epley), `hyperTargetFor()` (konwersja z e1RM historii, fallback
  bez historii, cache w `hyperTargets`), `targetForMode()`. `store.finishSession`
  liczy progresję na `exerciseForMode` i zapisuje do `targets` (siła) albo
  `hyperTargets` (hipertrofia) — tryby nie psują sobie progresji. Badge trybu
  w loggerze, „Ostatnio" dopisuje etykietę trybu gdy różny od bieżącego,
  paragon z dopiskiem „· Hipertrofia". `targetSets`/`increment`/`restSeconds`
  nietknięte (nauka: objętość i przerwy niezależne od trybu). 12 nowych testów,
  sanity-check na realnych danych Kamila (bench e1RM 54→42,5 kg, squat 82,3→62,5,
  deadlift 95,6→75) zweryfikowany manualnie w przeglądarce z identycznym wynikiem.

---

## P3 — zgłoszenia Kamila (sesja 26.07.2026, wieczór II)

Osiem zadań ze screenów i rozmowy. Każde jest samowystarczalne: root cause (gdzie
realnie leży problem, z numerami linii), spec i kryteria akceptacji. Obowiązują
**„Zasady implementacji"** z góry pliku — czytaj je przed każdym zadaniem.

**Prompt dla Sonneta (kopiuj-wklej, jedno zadanie na raz):**
```
Wdróż zadanie P3-1 z POMYSLY.md. Trzymaj się sekcji "Zasady implementacji"
oraz "Wspólne pułapki P3". Po skończeniu odhacz zadanie w POMYSLY.md,
uruchom npm test i npm run build, zrób commit.
```

**Kolejność wdrażania (zależności):** P3-1 → P3-4 → P3-3 → P3-7 → P3-2 → P3-5 →
P3-8 → P3-6. Uzasadnienie: najpierw bugi (szybkie, izolowane), potem tagi partii
(P3-7 daje `MUSCLE_COLORS`, którego używa też tryb skupienia), potem sterowanie
ciężarem i talerze (P3-2, P3-5 — komponenty używane w obu układach loggera),
potem baza ćwiczeń (P3-8 — dotyka migracji, chcesz mieć wcześniejsze zmiany już
zacommitowane), a tryb skupienia (P3-6) na końcu, bo renderuje wszystko powyżej.

### Wspólne pułapki P3 (przeczytaj RAZ, obowiązują we wszystkich zadaniach)

1. **Draft sesji to jedno źródło prawdy.** `Draft` w `TrainScreen.tsx:48` żyje w
   `localStorage` pod `trening-app-draft` i jest odtwarzany po restarcie apki.
   Żadne zadanie z P3 nie ma prawa zmieniać kształtu `Draft` inaczej niż przez
   **dodanie opcjonalnego pola** — `loadDraft()` (`:57`) nie waliduje kształtu, więc
   pole wymagane wysadzi trening w trakcie po odświeżeniu strony.
2. **UI nie dotyka `state.targets`.** Wszystko, co dzieje się w loggerze (zmiana
   ciężaru, zamiana ćwiczenia, sugestia siłowni), zmienia TYLKO draft. Cele rusza
   wyłącznie `finishSession` (`store.tsx:112`). To świadomy kontrakt — nie łam go.
3. **`computeProgression` liczy z `entry.targetWeight`, nie z ciężarów serii**
   (`logic.ts:278`). Ręczna zmiana ciężaru w serii NIE zmienia bazy progresji.
   To dzisiejsze zachowanie — w P3-2 zostawiamy je bez zmian (patrz P3-9).
4. **Nowe pole w `Settings` nie wymaga bumpa `SCHEMA_VERSION`** — merge z
   `DEFAULT_SETTINGS` w `migrateState` (`seed.ts:276`) uzupełnia braki. Nowe
   OPCJONALNE pole w istniejącym typie persystowanym też nie, o ile brak pola daje
   poprawne zachowanie. Bump potrzebny dopiero, gdy stare dane stałyby się
   niepoprawne.
5. **Mobile-first, max-w-xl, iPhone.** Wiersz serii w loggerze mieści się dziś na
   375 px na styk. Każdy nowy element w tym wierszu wymaga wyrzucenia czegoś innego
   (patrz P3-2). Minimalny cel dotykowy: 36×36 px.
6. Bez nowych zależności. Ikony wyłącznie z `lucide-react` (już w projekcie).

---

### [x] P3-1. BUG: zaznaczenie Snu podświetla Zakwasy „3" + panel gotowości ma być domyślnie zwinięty (2026-07-26)

**Objaw (screen Kamila):** klika „Sen 4", a apka od razu zaznacza „Zakwasy 3",
których nie wybierał. Do sesji zapisuje się zmyślona wartość.

**Root cause:** `updateReadiness()` w `src/components/TrainScreen.tsx:275-281`:
```ts
const next = { sleep: readiness?.sleep ?? 3, doms: readiness?.doms ?? 3, ...patch };
```
Typ `Session.readiness` (`types.ts:87`) wymaga OBU pól, więc kod dosypuje 3 jako
„środek skali". Efekt: pierwszy klik zawsze ustawia drugą skalę na 3 i podświetla
ją w UI (`:642`, `:662`). Dodatkowo psuje to warunek toastu `:277`
(`next.sleep + next.doms <= 4` liczy zmyśloną trójkę).

**Uwaga kontekstowa:** `readiness` jest dziś **danymi tylko do zapisu** — poza
toastem nic ich nie czyta (sprawdzone: brak odczytów w Historii/Progresie). To nie
jest powód, żeby ich nie naprawiać, ale nie ma potrzeby dorabiania konsumentów.

**Pliki:** `src/lib/types.ts`, `src/components/TrainScreen.tsx`.

**Spec:**
1. `types.ts`: rozluźnij typ na `readiness?: { sleep?: number; doms?: number }`
   (w `Session`). To **rozszerzenie** — stare sesje z obiema wartościami nadal są
   poprawne, więc **BEZ bumpa `SCHEMA_VERSION`**.
2. `TrainScreen.tsx`: ten sam typ w `Draft` (`:54`) i w stanie `readiness` (`:130`).
3. `updateReadiness`: żadnych domyślnych trójek —
   `const next = { ...(readiness ?? {}), ...patch };`.
   Warunek toastu przepisz tak, żeby brakująca wartość NIE wywoływała sugestii:
   ```ts
   const lowSleep = next.sleep !== undefined && next.sleep <= 2;
   const lowBoth = next.sleep !== undefined && next.doms !== undefined && next.sleep + next.doms <= 4;
   if (lowSleep || lowBoth) toast(...);
   ```
   Toast ma polecieć **raz na przejście w stan niskiej gotowości**, nie przy każdym
   kliknięciu — jeśli poprzedni stan już spełniał warunek, nie pokazuj drugi raz.
4. Zapis do sesji: jeżeli obie wartości są `undefined`, zapisz `readiness: undefined`
   (nie pusty obiekt) — `startDay` `:308` i `finish` `:438`.
5. **Zwijany panel** (druga część zgłoszenia): cała karta „Jak się dziś czujesz?"
   (`:629-682`) ma być domyślnie **zwinięta**. Wzorzec 1:1 z „Rozgrzewki" w loggerze
   (`:879-908`): `useState(false)` + przycisk-nagłówek z `ChevronRight`/`ChevronDown`.
   Nagłówek zwinięty pokazuje podsumowanie:
   - nic nie wybrane → `Jak się dziś czujesz? (opcjonalnie)`
   - wybrane → `Gotowość: sen 4 · zakwasy —` (myślnik dla braku).
   Stan zwinięcia **lokalny w komponencie**, bez persystencji (po starcie dnia panel
   znika i tak).

**Kryteria akceptacji:**
- Klik „Sen 4" → podświetlona wyłącznie czwórka w rzędzie Snu, rząd Zakwasów pusty.
- Zakończenie treningu z samym snem → w `state.sessions[…].readiness` jest
  `{ sleep: 4 }` bez klucza `doms`.
- Panel po wejściu na Trening zwinięty; rozwinięcie i zwinięcie nie kasuje wyboru.
- „Wyczyść" nadal działa (ustawia `null`) i zwija podsumowanie do wersji „opcjonalnie".
- `npm test` i `npm run build` przechodzą.

---

### [x] P3-2. Plus/minus przy ciężarze w loggerze (szybka korekta wagi) (2026-07-26)

**Czego chce Kamil:** przy każdym ciężarze mały `−` i `+`, żeby nie wywoływać
klawiatury iOS na zmianę 45 → 47,5 kg.

**Pliki:** `src/components/TrainScreen.tsx` (wiersz serii `:911-972`), ewentualnie
nowy `src/components/ui/stepper.tsx`.

**Spec:**
1. Krok = `hEx.increment` ćwiczenia (`hEx` = `exerciseForMode(ex, draft.mode)`, już
   policzone w `:802`). Dla `bench_bb` to 2,5 kg, dla hantli 1–2 kg. **Nie** wprowadzaj
   globalnego kroku 2,5 — hantle skaczą inaczej.
2. `−` schodzi do minimum 0 (bez wartości ujemnych). Wynik zaokrąglaj:
   `Math.round(v * 100) / 100` — inaczej 1.25 + 2.5 potrafi dać 3.7500000000000004.
3. **Synchronizacja dalszych serii** (to jest zachowanie, którego się oczekuje w
   praktyce): jeśli edytowana seria NIE jest zaliczona, a kolejne serie tego ćwiczenia
   też nie są zaliczone **i mają dokładnie ten sam ciężar co przed zmianą** — zmień je
   razem z nią. Gdy ciężary się już rozjechały (Kamil ręcznie ustawił inne), nie
   nadpisuj niczego. Zaliczonych serii nie ruszaj NIGDY.
   Zaimplementuj jako osobną funkcję obok `updateSet`:
   ```ts
   function setWeightWithSync(entryIdx: number, setIdx: number, weight: number)
   ```
   `updateSet` zostaw bez zmian (używa go m.in. logika rekordów i timera).
4. **NIE zmieniaj `entry.targetWeight`** — to baza progresji (patrz „Wspólne
   pułapki" pkt 3). Steppery zmieniają wyłącznie ciężary serii.
5. Dla `isHold` (plank) ciężar = dodatkowe obciążenie — steppery działają tak samo
   (krok `increment`, tam 5). Powtórzeń/sekund nie ruszamy w tym zadaniu.
6. **Layout wiersza (krytyczne, 375 px).** Dziś wiersz to:
   `[nr] [kg input w-20] "kg ×" [reps input w-16] [powt.] [PR] [✓] [− serii]`.
   Po dołożeniu dwóch przycisków to się nie mieści. Docelowo:
   ```
   [nr w-4] [− h-9 w-7] [input w-16 text-center] [+ h-9 w-7] [× ] [input w-14] [PR] [✓ h-9 w-9] [usuń]
   ```
   - usuń tekstowe etykiety „kg" i „powt." (jednostka zostaje w `placeholder`),
   - `−`/`+` jako `<button>` z ikoną `Minus`/`Plus` 14 px, `h-9 w-7`, `rounded-md`,
     `border border-border`, `text-muted-foreground`, `active:bg-accent`,
   - `aria-label`: „Zmniejsz ciężar" / „Zwiększ ciężar",
   - przycisk usuwania serii (`:960-969`, ikona `Minus`) zamień na ikonę `Trash2`
     — dwa różne `Minus` obok siebie w jednym wierszu to pomyłka na dotyku,
   - cały wiersz `gap-1` zamiast `gap-2`.
7. Sprawdź render przy 4+ seriach i przy włączonym PR-ringu (`:919`) — nic nie może
   wychodzić poza kartę ani zawijać się do drugiej linii na 375 px.

**Kryteria akceptacji:**
- `+` na ćwiczeniu z `increment: 2.5` przy 45 kg daje 47,5; `−` przy 0 zostaje 0.
- Zmiana ciężaru w serii 1 (niezaliczonej) przenosi się na serie 2–3, dopóki mają tę
  samą wagę; po ręcznej zmianie serii 3 na inną wartość seria 3 przestaje się
  synchronizować.
- Zaliczona (zielona) seria nigdy nie zmienia ciężaru.
- `entry.targetWeight` po sesji ze steppera jest niezmieniony (widać po komunikacie
  progresji w podsumowaniu — liczy się od celu, nie od klikniętej wagi).
- Wiersz mieści się na 375 px, brak zawijania.

---

### [x] P3-3. „Plan" i „Wykonane (7 dni)" pokazują identyczne wartości — to NIE jest bug w kodzie (2026-07-26)

**Zgłoszenie:** w Progresie oba przełączniki dają to samo, więc wygląda na zepsute.

**Root cause — zweryfikowany empirycznie (26.07.2026):** przełącznik działa
poprawnie (`ProgressScreen.tsx:41-43`, `logic.ts:126` i `:169`). Wartości są równe,
bo **dane tak wyszły**. Okno „ostatnie 7 dni" (dziś + 6 wstecz) na dzień 26 lipca
łapie dokładnie trzy sesje z historii startowej: 20, 22 i 24 lipca — po jednej z
każdego dnia planu, wszystkie serie zaliczone, liczba serii identyczna jak
`targetSets`. Wynik uruchomienia obu funkcji na świeżym stanie:

| partia | plan | wykonane |
|--------|------|----------|
| Klatka | 9 | 9 |
| Plecy | 9 | 9 |
| Barki | 10,5 | 10,5 |
| Nogi | 6 | 6 |
| Pośladki | 8,5 | 8,5 |
| Tył uda | 6,5 | 6,5 |
| Łydki | 3 | 3 |
| Biceps | 6 | 6 |
| Triceps | 8 | 8 |
| Brzuch | 7 | 7 |

Czyli: „Wykonane" pokaże co innego dopiero, gdy Kamil opuści trening, doda serię,
zrobi bonus albo minie tydzień bez treningu. **Nie „naprawiaj" liczb.** Zadanie
polega na tym, żeby widok sam się tłumaczył i różnicę było widać na pierwszy rzut oka.

**Pliki:** `src/components/ProgressScreen.tsx`, `src/lib/logic.ts`, `tests/logic.test.ts`.

**Spec:**
1. W widoku „Wykonane (7 dni)" dopisz pod nagłówkiem karty kontekst okna:
   `3 treningi · 20–26 lip` (liczba ukończonych sesji w oknie + zakres dat).
   Policz to nową, eksportowaną funkcją w `logic.ts`:
   ```ts
   export function actualVolumeWindow(state: AppState, nowIso?: string):
     { sessions: number; fromIso: string; toIso: string }
   ```
   Ta sama arytmetyka okna co `actualWeeklyMuscleVolume` — **wydziel wyliczanie
   granic okna do wspólnego helpera**, żeby nie rozjechały się w przyszłości.
   Gdy `sessions === 0`, pokaż `brak treningów w tym oknie` zamiast zakresu dat.
2. W widoku „Wykonane" dorysuj **cień planu**: pod paskiem realizacji cienka
   kreska/znacznik na pozycji wartości z planu + w liczbach `9 (plan 9)`. Gdy
   różnica jest niezerowa, pokaż deltę na kolorowo: `7 (plan 9, −2)`
   (`text-amber-400` dla minusa, `text-sky-400` dla plusa). To jest właściwa
   odpowiedź na „czemu to samo?" — widać wprost, że realizacja = plan.
3. Znany drobiazg do naprawy przy okazji: granice okna liczone są przez
   `toISOString()` (UTC), a `session.date` bywa zapisany w czasie lokalnym
   (`new Date().toISOString()` w drafcie vs `"2026-07-06T18:00:00"` w historii
   startowej). Po północy czasu lokalnego w strefie ujemnej okno mogłoby zjechać
   o dobę. Policz `cutoff`/`now` z komponentów lokalnych
   (`getFullYear/getMonth/getDate`), nie z `toISOString()`.
4. Testy w `tests/logic.test.ts`:
   - sesja z 2 zaliczonymi seriami zamiast 3 → „wykonane" < „plan" dla tej partii,
   - sesja spoza okna (8 dni wstecz) nie jest liczona,
   - `actualVolumeWindow` na historii startowej z `nowIso = 2026-07-26` zwraca
     `{ sessions: 3, fromIso: "2026-07-20", toIso: "2026-07-26" }`.

**Kryteria akceptacji:**
- Przełączenie na „Wykonane (7 dni)" pokazuje liczbę sesji i zakres dat.
- Przy identycznych liczbach widać `(plan 9)` — użytkownik rozumie, że to zgodność,
  nie awaria.
- Po świadomym opuszczeniu ćwiczenia w treningu wartości się rozjeżdżają i widać deltę.

---

### [x] P3-4. Pola z datą mają inny rozmiar niż sąsiednie inputy (sekcja „Więcej") (2026-07-26)

**Objaw:** w kartach „Waga ciała" i „Squash" kafelek z datą jest wyższy/szerszy niż
sąsiednie pola i wygląda inaczej w każdej z tych dwóch kart.

**Root cause — dwie niezależne przyczyny:**
1. **Różne szerokości między kartami:** to zwykły flexbox. W „Wadze"
   (`MoreScreen.tsx:201-212`) trzy pola bez klas szerokości dzielą wiersz po równo;
   w „Squashu" (`:277-291`) sąsiedzi mają sztywne `w-20` i `w-28`, więc data dostaje
   całą resztę. Stąd dwa różne rozmiary tego samego pola.
2. **Inna wysokość niż reszta:** `input[type="date"]` w Safari iOS renderuje się
   przez własny shadow DOM (`::-webkit-date-and-time-value`) z własnym paddingiem
   i wyrównaniem — `h-10` z `ui/input.tsx:9` nie wystarcza, pole puchnie i tekst
   jest wyśrodkowany inaczej niż w zwykłym inpucie.

**Pliki:** `src/components/ui/input.tsx`, `src/index.css`, `src/components/MoreScreen.tsx`.

**Spec:**
1. W `ui/input.tsx` dodaj eksportowany komponent `DateInput` — cienka nakładka na
   `Input` z ustalonymi klasami:
   ```tsx
   <Input type="date" className={cn("h-10 w-[9.5rem] shrink-0 appearance-none", className)} … />
   ```
   Żadnej nowej logiki — to ma być jedno miejsce prawdy o rozmiarze pola daty.
2. W `src/index.css` (warstwa bazowa) dołóż reset shadow-partów WebKita:
   ```css
   input[type="date"] { -webkit-appearance: none; appearance: none; }
   input[type="date"]::-webkit-date-and-time-value { text-align: left; margin: 0; }
   input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; }
   ```
3. Podmień oba wystąpienia (`MoreScreen.tsx:212` i `:291`) na `<DateInput>`.
   W karcie „Waga ciała" dodaj `min-w-0` do dwóch pól liczbowych, żeby to data
   dyktowała szerokość, a nie odwrotnie.
4. Sprawdź, czy nie zostały inne surowe `type="date"` (dziś są dokładnie dwa).

**Kryteria akceptacji:**
- Oba pola daty mają identyczną szerokość i wysokość, równą wysokości sąsiednich
  inputów i przycisków (`h-10`).
- Karta „Waga ciała" nadal mieści `kg`, `pas cm`, datę i „Zapisz" w jednym wierszu
  na 375 px (jeśli nie mieści — przełam wiersz na `flex-wrap`, nie zwężaj daty).

---

### [x] P3-5. Rozwijana miniaturka sztangi (układ talerzy) przy każdym ćwiczeniu w loggerze (2026-07-26)

**Czego chce Kamil:** przy ćwiczeniu w Treningu rozwijany panel z taką samą
wizualizacją sztangi jak w „Więcej", pokazujący jakie talerze założyć. **Domyślnie
zwinięty.**

**Pliki:** `src/components/TrainScreen.tsx`, ewentualnie `src/components/Gym.tsx`.

**Spec:**
1. Komponent już istnieje: `PlateBar` z `src/components/Gym.tsx:9` (rysuje gryf +
   talerze + podpis „Na stronę: 20 + 10"). Importuj go, **nie pisz drugiego**.
2. Wzorzec zwijania: 1:1 jak „Rozgrzewka" (`TrainScreen.tsx:879-908`) — stan
   `const [openPlates, setOpenPlates] = useState<Set<number>>(new Set())`, przycisk
   z `ChevronRight`/`ChevronDown` i etykietą `Talerze`.
3. Gryf i talerze bierz z **aktywnego profilu siłowni**: zmienne `warmupBar` i
   `warmupPlates` są już policzone w `:259-260` (profil → fallback na domową).
   Nazwy są mylące (powstały dla rozgrzewki) — zmień je na `activeBar`/`activePlates`
   i popraw dwa istniejące użycia.
4. **Ciężar do pokazania:** waga pierwszej NIEZALICZONEJ serii; gdy wszystkie
   zaliczone — waga ostatniej serii. Nie `entry.targetWeight` (po korekcie
   steppera z P3-2 pokazywałby nieprawdę).
5. **Pokazuj tylko dla `ex.unit === "barbell"`.** Dla hantli/maszyny/wyciągu
   układ talerzy nie ma sensu — sekcja ma się w ogóle nie renderować (jak
   `warmupSteps.length > 0` dziś).
6. Nagłówek zwinięty niech od razu niesie informację, żeby często nie trzeba było
   rozwijać: `Talerze · 20 + 10 na stronę` (z `platePlan(...).perSide`), a przy
   niemożliwym ciężarze `Talerze · brakuje 1,25 kg` w `text-amber-400`.
7. `PlateBar` ma dziś `h-24` — w loggerze to dużo. Dodaj mu opcjonalny prop
   `compact?: boolean` (wysokość `h-16`, mniejsze talerze), używany tylko tutaj;
   „Więcej" zostaje bez zmian.

**Kryteria akceptacji:**
- Wejście w dzień: żaden panel talerzy nie jest rozwinięty.
- Rozwinięcie przy przysiadzie 65 kg pokazuje `20 + 2,5` na stronę (gryf 20 kg).
- Zmiana ciężaru serii steppera (P3-2) natychmiast zmienia układ talerzy.
- Przy hantlach/maszynie sekcji nie ma w ogóle.
- Przełączenie aktywnej siłowni w „Więcej" zmienia układ talerzy w loggerze.

---

### [x] P3-6. Tryb skupienia — jedno ćwiczenie na ekran (przełącznik na ekranie wyboru dnia) (2026-07-26)

**Czego chce Kamil (screen `IMG_3157`):** alternatywny układ loggera — jedno
ćwiczenie na cały ekran, duże wiersze serii, duży timer przerwy z „uciekającym"
paskiem, a po zaliczeniu ostatniej serii automatyczne przejście do kolejnego
ćwiczenia. Obecny układ ze scrollem ma zostać — wybór **suwakiem na ekranie
wyboru dnia**.

**Pliki:** `src/lib/types.ts`, `src/components/TrainScreen.tsx`, `src/components/Gym.tsx`.

**Spec:**
1. `Settings.loggerLayout?: "list" | "focus"` (brak = `"list"`). Bez bumpa schematu
   (pkt 4 wspólnych pułapek). Domyślną wartość dopisz do `DEFAULT_SETTINGS`
   jawnie jako `"list"`.
2. Przełącznik: `Switch` z `src/components/ui/switch.tsx`, na ekranie wyboru dnia,
   w karcie pod „Cel tygodnia": tytuł `Tryb skupienia`, podpis
   `Jedno ćwiczenie na ekran zamiast listy ze scrollem.` Zmiana zapisuje się przez
   `store.updateSettings({ loggerLayout })` i działa **w trakcie trwającego treningu**
   (draft jest wspólny) — nie blokuj przełącznika, gdy draft istnieje.
3. **Architektura (najważniejsze):** tryb skupienia to **wyłącznie inny render tego
   samego draftu**. Zero zmian w `Draft`, `updateSet`, `addSet`, `removeSet`,
   `finish`, `undoFinish`, timerze i backupie. Wydziel z dzisiejszego renderu
   loggera dwa komponenty w tym samym pliku:
   - `ExerciseCard` — dzisiejsza karta (nagłówek, „Ostatnio", rozgrzewka, talerze,
     wiersze serii), używana przez oba układy,
   - `FocusLogger` — nawigacja + jedno `ExerciseCard` na ekran.
   Wspólny stan (draft, timer) zostaje w `TrainScreen`. Bez duplikacji logiki.
4. **Układ ekranu skupienia** (wzorowany na screenie, ale w naszym stylu):
   - sticky nagłówek: `{dzień.short} · ĆW. {i+1}/{n}` + plakietka trybu tygodnia
     (`MODE_BADGE`, już istnieje) + „Porzuć"; respektuj `env(safe-area-inset-top)`
     (wzorzec `:766-772`),
   - duża nazwa ćwiczenia + kolorowe tagi partii (P3-7),
   - podpis `3×8–12 · cel 57,5 kg · RIR 2` (jak dziś w `CardDescription`),
   - wiersze serii: zaliczone — zielona ramka i `Check`; pierwsza niezaliczona —
     bursztynowa ramka i etykieta `TERAZ`; kolejne — wygaszone,
   - pod seriami panel timera (pkt 5),
   - stopka: `←` poprzednie, kropki postępu ćwiczeń, `→` następne; na ostatnim
     ćwiczeniu zamiast `→` przycisk `Zakończ trening`.
5. **Timer z paskiem:** rozszerz `RestTimer` (`Gym.tsx:80`) o
   `variant?: "pill" | "panel"` (domyślnie `"pill"` — dzisiejszy wygląd).
   `"panel"`: duże `mm:ss` (`text-4xl font-mono tabular-nums`), obok `/ 01:30`,
   pod spodem pasek postępu `left / seconds` (kurczy się w miarę odliczania),
   kolor `bg-amber-400` → `bg-red-500` gdy zostało ≤ 5 s.
   **Bez `animate-pulse` i bez animowanego `opacity` na warstwie z `backdrop-blur`**
   — patrz P0-6 (jank na iOS). Animuj wyłącznie `width` paska (`transition-all`).
   W trybie skupienia pigułka timera (`:986-991`) ma się NIE renderować — panel ją
   zastępuje.
6. **Auto-przejście:** gdy zaliczona zostanie ostatnia niezaliczona seria bieżącego
   ćwiczenia, po **900 ms** przeskocz na następne ćwiczenie. Warunki:
   - nie przeskakuj, jeśli użytkownik w międzyczasie sam zmienił ćwiczenie
     (porównaj indeks przed i po; użyj `useRef` na timeout i czyść go w cleanupie),
   - z ostatniego ćwiczenia nie przeskakuj nigdzie — pokaż `Zakończ trening`,
   - odznaczenie serii nie cofa przejścia (wracasz strzałką `←`).
7. Indeks bieżącego ćwiczenia trzymaj w `useState`, **nie w drafcie** — po
   restarcie apki w trakcie treningu wróć na pierwsze ćwiczenie z niezaliczoną serią
   (policz przy montowaniu).
8. **Klawiatura numeryczna z screena — świadomie POZA zakresem.** Natywna
   klawiatura iOS (`inputMode="decimal"`) robi to samo, a własny keypad to ~150
   linii, konflikt z autofocusem i utrata zaznaczania tekstu. Ze steppera z P3-2
   i tak wynika, że klawiatura będzie potrzebna rzadko. Jeśli Kamil po użyciu
   nadal będzie chciał keypad — osobne zadanie.

**Kryteria akceptacji:**
- Suwak wyłączony → logger wygląda i działa dokładnie jak dziś (regresja zerowa).
- Suwak włączony → jedno ćwiczenie na ekran, brak scrolla do sąsiednich ćwiczeń.
- Zaliczenie ostatniej serii → po ~1 s widać kolejne ćwiczenie; timer wystartował.
- `←`/`→` chodzą po ćwiczeniach w obie strony, kropki pokazują postęp.
- Porzucenie i wznowienie treningu (odświeżenie strony) nie gubi draftu.
- Podsumowanie po treningu i progresja identyczne w obu układach.

---

### [x] P3-7. Kolorowe tagi partii przy ćwiczeniach w Treningu (2026-07-26)

**Czego chce Kamil:** przy każdym ćwiczeniu w loggerze widoczne, jakie partie
pracują — kolorowe plakietki.

**Pliki:** `src/lib/logic.ts`, `src/components/TrainScreen.tsx`,
`src/components/PlanScreen.tsx`, `tests/logic.test.ts` (niewymagane).

**Spec:**
1. W `logic.ts`, obok `STATUS_COLORS` (`:85`), dodaj **jedno źródło prawdy** o
   kolorach partii:
   ```ts
   export const MUSCLE_COLORS: Record<Muscle, string> = {
     Klatka: "#ef4444", Plecy: "#3b82f6", Barki: "#f59e0b", Nogi: "#22c55e",
     Pośladki: "#ec4899", "Tył uda": "#14b8a6", Łydki: "#84cc16",
     Biceps: "#a855f7", Triceps: "#f97316", Brzuch: "#eab308",
   };
   ```
   (Kolory dobrane tak, żeby sąsiadujące partie się nie zlewały na ciemnym tle;
   możesz je poprawić, ale trzymaj jeden zestaw dla całej apki.)
2. Komponent `MuscleTag` (mały, lokalny w `TrainScreen.tsx` albo w `Gym.tsx` jeśli
   używany też gdzie indziej):
   - partia **główna**: wypełnienie `${color}33`, tekst w `color`, `font-semibold`,
   - partia **wspomagająca**: ta sama paleta, ale `${color}1a`, tekst
     `${color}` z `opacity-70` i sufiksem `½` (to odzwierciedla wagę ½ serii
     w liczniku objętości — spójność z `weeklyMuscleVolume`),
   - klasy: `rounded-full px-1.5 py-0.5 text-[9px] leading-none`.
3. Renderuj tagi w nagłówku karty ćwiczenia w loggerze, pod nazwą, przed
   `CardDescription`. Kolejność: główna, potem wspomagające w kolejności z
   `secondaryMuscles`. Ćwiczenie bez `primaryMuscle` (może się zdarzyć przy
   ćwiczeniach użytkownika) → brak tagów, bez pustego kontenera.
4. Te same tagi dołóż na liście ćwiczeń w `PlanScreen` (przy nazwie w dniu) —
   ten sam komponent, bez duplikatu stylów.
5. W trybie skupienia (P3-6) tagi idą pod dużą nazwą ćwiczenia.

**Kryteria akceptacji:**
- Przy „Wyciskanie sztangi płasko" widać `Klatka`, `Triceps ½`, `Barki ½` w trzech
  różnych kolorach.
- Kolory są identyczne w Treningu i w Planie (jedno źródło).
- Karta ćwiczenia nie urosła o więcej niż jeden wiersz na 375 px.

---

### [x] P3-8. Rozszerzona baza ćwiczeń (~70 pozycji) + poprawka migracji, która ją w ogóle wpuści (2026-07-26)

**Czego chce Kamil:** dużo więcej ćwiczeń w bazie, skategoryzowanych, żeby móc
podmieniać ruchy (zajęty sprzęt, inna siłownia, urozmaicenie).

**⚠️ NAJWAŻNIEJSZE — bez kroku 1 nowe ćwiczenia NIE dotrą do telefonu Kamila.**
`migrateState()` w ścieżce „aktualny schemat" (`seed.ts:270-279`) robi
`{ ...fresh, ...old }`, czyli **tablica `old.exercises` w całości przykrywa seed**.
Kamil ma już `version === SCHEMA_VERSION`, więc dopisanie pozycji do
`SEED_EXERCISES` samo z siebie da mu… nic. A bump `SCHEMA_VERSION` (ścieżka
„stara wersja", `:292-299`) podmienia `exercises` na seed i **skasowałby ćwiczenia,
które sam dodał**. Rozwiązaniem jest merge biblioteki, nie bump.

**Pliki:** `src/lib/seed.ts`, `src/lib/logic.ts`, `src/components/TrainScreen.tsx`,
`src/components/PlanScreen.tsx`, `tests/logic.test.ts`.

**Spec — krok 1: merge biblioteki ćwiczeń (rób to PIERWSZE, osobny commit).**
1. W `seed.ts` dodaj:
   ```ts
   export function mergeExerciseLibrary(userExercises: Exercise[]): Exercise[]
   ```
   Reguły (kolejność ma znaczenie):
   - ćwiczenie o ID istniejącym u użytkownika → **zostaje wersja użytkownika**
     w całości (jego zakresy, `increment`, `note`, `archived`, `restSeconds`);
     nie „dolewaj" pól z seeda,
   - ćwiczenie z seeda o ID, którego user nie ma → dołóż `structuredClone` z seeda,
   - ćwiczenia stworzone przez użytkownika (ID spoza seeda) → zostają nietknięte,
   - kolejność wynikowa: najpierw pozycje użytkownika w jego kolejności, potem
     nowe z seeda (stabilnie, bez sortowania).
2. Wywołaj to w **obu** ścieżkach `migrateState` (`:272` i `:292`) oraz zadbaj,
   by `targets` dostały wartości startowe dla nowych ID — obecne
   `{ ...fresh.targets, ...(old.targets ?? {}) }` załatwia to samo z siebie, pod
   warunkiem, że **każde nowe ćwiczenie ma wpis w `SEED_TARGETS`**.
3. Operacja jest idempotentna i samonaprawiająca → **`SCHEMA_VERSION` zostaje 5**.
4. Testy: user z własnym ćwiczeniem + zmodyfikowanym `bench_bb` (repMax 10)
   przechodzi migrację → własne ćwiczenie jest, `bench_bb.repMax === 10`, a nowe
   pozycje z seeda doszły z celami z `SEED_TARGETS`.

**Spec — krok 2: ćwiczenia.** Dopisz do `SEED_EXERCISES` poniższe pozycje helperem
`ex(id, name, category, unit, repMin, repMax, targetSets, increment, primary, secondary[], extra)`.
Zasady:
- **ID istniejących ćwiczeń są nietykalne** — nowe ID nie mogą kolidować z:
  `bench_bb, hipthrust, row_bb, lateral, curl_bb, crunch, squat, deadlift,
  incline_db, lunges, calf, plank, ohp, pulldown, rdl, bench_db, row_db, french,
  face_pull, hammer_curl, pushdown, calf_seated, side_plank`.
- **Żadne nowe ćwiczenie nie trafia do `SEED_DAYS`.** Plan 3-dniowy + bonus
  zostaje bez zmian — to biblioteka do podmian, nie zmiana treningu.
- **Pułapka `perHand`:** helper `ex()` ustawia `perHand = unit === "dumbbell"`
  (`seed.ts:35`), co dla ćwiczeń trzymanych JEDNYM hantlem oburącz (goblet, russian
  twist, kettlebell swing, pullover) zawyżyłoby tonaż ×2. Dla tych pozycji przekaż
  jawnie `{ perHand: false }` w `extra` (oznaczone `perHand:false` w tabeli).
- `rir` domyślnie 2 (helper); dla `isHold` ustaw `rir: 0` jak w `plank`.
- `restSeconds`: 150–180 dla ciężkich wielostawowych, 90–120 dla reszty, 60 dla
  izolacji i `isHold`.
- Każdy `note` ma być krótkim cue technicznym po polsku (jak istniejące).
- **Każde ID musi dostać wpis w `SEED_TARGETS`** (kolumna „cel"). Ćwiczenia
  z masą ciała: `0` (to dodatkowe obciążenie, nie masa Kamila).

**KLATKA**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `bench_incline_bb` | Wyciskanie sztangi skos góra | barbell | 6–10 | 3 | 2.5 | Klatka | Triceps, Barki | 35 |
| `dip_chest` | Dipy na poręczach (tułów w przód) | bodyweight | 6–12 | 3 | 2.5 | Klatka | Triceps, Barki | 0 |
| `pushup` | Pompki | bodyweight | 10–20 | 3 | 2.5 | Klatka | Triceps, Barki | 0 |
| `fly_db` | Rozpiętki hantlami | dumbbell | 10–15 | 3 | 1 | Klatka | Barki | 10 |
| `fly_cable` | Rozpiętki na wyciągu (brama) | cable | 10–15 | 3 | 2.5 | Klatka | Barki | 10 |
| `press_machine` | Wyciskanie na maszynie | machine | 8–12 | 3 | 2.5 | Klatka | Triceps, Barki | 40 |
| `pullover_db` | Pullover hantlem (`perHand:false`) | dumbbell | 10–12 | 3 | 2 | Klatka | Plecy | 20 |

**PLECY**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `pullup` | Podciąganie nachwytem | bodyweight | 4–10 | 3 | 2.5 | Plecy | Biceps | 0 |
| `chinup` | Podciąganie podchwytem | bodyweight | 5–10 | 3 | 2.5 | Plecy | Biceps | 0 |
| `pulldown_neutral` | Ściąganie drążka chwytem neutralnym | machine | 8–12 | 3 | 2.5 | Plecy | Biceps | 45 |
| `row_cable` | Wiosłowanie na wyciągu siedząc | cable | 8–12 | 3 | 2.5 | Plecy | Biceps | 45 |
| `row_tbar` | Wiosłowanie T-bar | barbell | 8–10 | 3 | 2.5 | Plecy | Biceps | 40 |
| `row_machine` | Wiosłowanie na maszynie | machine | 8–12 | 3 | 2.5 | Plecy | Biceps | 40 |
| `row_db_bent` | Wiosłowanie hantlami w opadzie | dumbbell | 8–12 | 3 | 2 | Plecy | Biceps | 16 |
| `rack_pull` | Martwy ciąg z podstawek | barbell | 5–8 | 3 | 5 | Plecy | Tył uda, Pośladki | 80 |
| `pulldown_straight` | Ściąganie prostymi ramionami (wyciąg) | cable | 12–15 | 3 | 2.5 | Plecy | — | 25 |
| `shrug_db` | Szrugsy z hantlami | dumbbell | 10–15 | 3 | 2 | Plecy | Barki | 22 |
| `back_ext` | Hiperekstensje (wyprosty tułowia) | bodyweight | 10–15 | 3 | 2.5 | Tył uda | Plecy, Pośladki | 0 |

**BARKI**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `ohp_db` | Wyciskanie hantli nad głowę | dumbbell | 8–12 | 3 | 2 | Barki | Triceps | 14 |
| `arnold_press` | Wyciskanie Arnolda | dumbbell | 8–12 | 3 | 2 | Barki | Triceps | 12 |
| `lateral_cable` | Wznosy bokiem na wyciągu | cable | 12–15 | 3 | 2.5 | Barki | — | 7.5 |
| `rear_delt_db` | Odwrotne rozpiętki hantlami | dumbbell | 12–15 | 3 | 1 | Barki | Plecy | 7 |
| `rear_delt_machine` | Odwrotny butterfly (maszyna) | machine | 12–15 | 3 | 2.5 | Barki | Plecy | 25 |
| `upright_row` | Podciąganie sztangi wzdłuż tułowia | barbell | 10–12 | 3 | 2.5 | Barki | Biceps | 25 |
| `front_raise_db` | Wznosy przodem hantli | dumbbell | 10–15 | 2 | 1 | Barki | — | 8 |
| `shrug_bb` | Szrugsy ze sztangą | barbell | 10–15 | 3 | 2.5 | Plecy | Barki | 60 |

**NOGI (czworogłowe / złożone)**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `front_squat` | Przysiad przedni | barbell | 5–8 | 3 | 2.5 | Nogi | Pośladki, Brzuch | 40 |
| `goblet_squat` | Przysiad goblet (`perHand:false`) | dumbbell | 8–12 | 3 | 2 | Nogi | Pośladki | 20 |
| `leg_press` | Suwnica (wypychanie nogami) | machine | 8–12 | 3 | 5 | Nogi | Pośladki | 120 |
| `hack_squat` | Hack squat (maszyna) | machine | 8–12 | 3 | 5 | Nogi | Pośladki | 60 |
| `leg_ext` | Prostowanie nóg (maszyna) | machine | 12–15 | 3 | 2.5 | Nogi | — | 35 |
| `bulgarian_split` | Przysiad bułgarski | dumbbell | 8–12 | 3 | 2 | Nogi | Pośladki | 12 |
| `step_up` | Wejścia na skrzynię | dumbbell | 10–12 | 3 | 2 | Nogi | Pośladki | 12 |

**NOGI (tył uda / biodra)**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `leg_curl_lying` | Uginanie nóg leżąc | machine | 10–12 | 3 | 2.5 | Tył uda | Łydki | 30 |
| `leg_curl_seated` | Uginanie nóg siedząc | machine | 10–15 | 3 | 2.5 | Tył uda | — | 35 |
| `nordic_curl` | Nordic curl | bodyweight | 5–8 | 3 | 2.5 | Tył uda | Pośladki | 0 |
| `good_morning` | Dzień dobry (good morning) | barbell | 8–12 | 3 | 2.5 | Tył uda | Plecy, Pośladki | 30 |
| `rdl_bb` | RDL ze sztangą | barbell | 6–10 | 3 | 2.5 | Tył uda | Pośladki, Plecy | 60 |
| `deadlift_sumo` | Martwy ciąg sumo | barbell | 5–6 | 2 | 2.5 | Tył uda | Nogi, Plecy, Pośladki | 70 |
| `kb_swing` | Swing kettlebell (`perHand:false`) | dumbbell | 12–20 | 3 | 4 | Pośladki | Tył uda | 16 |

**POŚLADKI**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `hipthrust_machine` | Hip thrust na maszynie | machine | 8–12 | 3 | 5 | Pośladki | Tył uda | 60 |
| `glute_bridge` | Wyciskanie bioder z podłogi (sztanga) | barbell | 10–15 | 3 | 2.5 | Pośladki | Tył uda | 40 |
| `cable_kickback` | Odwodzenie nogi w tył (wyciąg) | cable | 12–15 | 3 | 2.5 | Pośladki | Tył uda | 10 |
| `abduction_machine` | Odwodzenie nóg (maszyna) | machine | 12–20 | 3 | 2.5 | Pośladki | — | 35 |

**ŁYDKI**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `calf_press` | Wspięcia na palce na suwnicy | machine | 10–15 | 3 | 5 | Łydki | — | 80 |

**BICEPS**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `curl_db` | Uginanie hantli stojąc | dumbbell | 10–12 | 3 | 1 | Biceps | — | 10 |
| `curl_incline_db` | Uginanie hantli na skosie | dumbbell | 10–12 | 3 | 1 | Biceps | — | 8 |
| `curl_preacher` | Uginanie na modlitewniku | barbell | 10–12 | 3 | 1.25 | Biceps | — | 15 |
| `curl_cable` | Uginanie na wyciągu | cable | 10–15 | 3 | 2.5 | Biceps | — | 20 |
| `curl_concentration` | Uginanie w podporze (koncentracja) | dumbbell | 10–12 | 2 | 1 | Biceps | — | 8 |
| `curl_reverse` | Uginanie nachwytem (przedramiona) | barbell | 10–15 | 2 | 1.25 | Biceps | — | 15 |

**TRICEPS**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `bench_close_bb` | Wyciskanie sztangi wąsko | barbell | 6–10 | 3 | 2.5 | Triceps | Klatka, Barki | 35 |
| `dip_triceps` | Dipy na poręczach (tułów pionowo) | bodyweight | 6–12 | 3 | 2.5 | Triceps | Klatka, Barki | 0 |
| `dip_bench` | Pompki na ławce | bodyweight | 10–15 | 3 | 2.5 | Triceps | Klatka | 0 |
| `pushdown_rope` | Prostowanie ramion z liną | cable | 10–15 | 3 | 2.5 | Triceps | — | 20 |
| `overhead_ext_cable` | Wyciskanie francuskie na wyciągu zza głowy | cable | 10–12 | 3 | 2.5 | Triceps | — | 20 |
| `skullcrusher_db` | Wyciskanie francuskie hantlami leżąc | dumbbell | 10–12 | 3 | 1 | Triceps | — | 10 |
| `kickback_db` | Prostowanie ramienia w opadzie | dumbbell | 12–15 | 2 | 1 | Triceps | — | 6 |

**BRZUCH**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `hanging_leg_raise` | Unoszenie nóg w zwisie | bodyweight | 8–15 | 3 | 2.5 | Brzuch | — | 0 |
| `leg_raise_lying` | Unoszenie nóg leżąc | bodyweight | 12–20 | 3 | 2.5 | Brzuch | — | 0 |
| `ab_wheel` | Kółko do brzucha (rollout) | bodyweight | 8–15 | 3 | 2.5 | Brzuch | Plecy | 0 |
| `woodchop_cable` | Drwal na wyciągu | cable | 12–15 | 3 | 2.5 | Brzuch | — | 15 |
| `russian_twist` | Rosyjskie skręty (`perHand:false`) | dumbbell | 15–20 | 3 | 2 | Brzuch | — | 10 |
| `dead_bug` | Dead bug | bodyweight | 10–15 | 3 | 2.5 | Brzuch | — | 0 |
| `hollow_hold` | Hollow hold (`isHold`, 30 s, `rir:0`) | bodyweight | 30–30 | 3 | 5 | Brzuch | — | 0 |
| `pallof_press` | Pallof press (antyrotacja) | cable | 10–12 | 3 | 2.5 | Brzuch | — | 10 |

**INNE**
| id | nazwa | unit | zakres | serie | incr | primary | secondary | cel |
|----|-------|------|--------|-------|------|---------|-----------|-----|
| `farmer_walk` | Spacer farmera (`isHold`, 40 s, `rir:0`) | dumbbell | 40–40 | 3 | 2 | Plecy | Brzuch, Barki | 24 |

**Spec — krok 3: UI musi wytrzymać ~90 ćwiczeń.**
1. **Zamiana ćwiczenia w loggerze** (`TrainScreen.tsx:807-815, :852-868`): lista
   kandydatów filtrowana po `primaryMuscle` urośnie do kilkunastu pozycji.
   - dodaj pole wyszukiwania (filtr `includes` po nazwie, bez znaków diakrytycznych:
     `normalize("NFD").replace(/\p{Diacritic}/gu, "")`),
   - sortuj: najpierw ćwiczenia z historią Kamila (są w `state.sessions`), potem
     alfabetycznie,
   - kontener `max-h-64 overflow-y-auto`.
2. **Dodawanie ćwiczenia do dnia** (`PlanScreen.tsx`, `addingTo`): `<select>`
   z 90 pozycjami jest bezużyteczny — pogrupuj przez `<optgroup label={kategoria}>`
   (kolejność kategorii jak w `CATEGORIES`, `PlanScreen.tsx:16`).
3. **Lista bazy ćwiczeń w Planie:** dodaj filtr po kategorii (rząd chipów) i pole
   szukania. Zarchiwizowane nadal na końcu/wyszarzone jak dziś.
4. **Dobór bonusu** (`suggestBonusExercises`, `logic.ts:228`): pula rośnie z ~5 do
   ~90 pozycji, więc propozycje zrobią się losowe i mogą trafić w sprzęt, którego
   Kamil nie ma. Wprowadź ranking kandydatów w obrębie deficytowej partii:
   1. ćwiczenia, które Kamil już kiedykolwiek wykonał (są w `sessions`),
   2. ćwiczenia z dnia bonusowego z seeda,
   3. reszta biblioteki.
   Test: przy deficycie „Barki" i historii z `lateral` propozycja zawiera `lateral`
   przed `arnold_press`.
5. **Wydajność:** `state.exercises.find(...)` w pętlach (`logic.ts:133`, `:188`,
   `ProgressScreen.tsx:121-129`) robi się O(n·m). Zbuduj `Map<string, Exercise>`
   raz na wywołanie funkcji i używaj jej w pętli. Zmiana czysto mechaniczna,
   bez zmiany wyników — testy muszą przejść bez modyfikacji.

**Kryteria akceptacji:**
- Po `npm run build` i wgraniu na telefon (stan z `version: 5`, `historySeeded: true`)
  nowe ćwiczenia są widoczne w Planie, a plan dnia, historia i cele bez zmian.
- Ćwiczenie edytowane wcześniej przez użytkownika zachowuje jego wartości.
- Żaden dzień w `SEED_DAYS` nie zmienił składu.
- Objętość tygodniowa (Progres) pokazuje te same liczby co przed zmianą — nowe
  ćwiczenia nie są w żadnym aktywnym dniu, więc nie mogą jej ruszyć. **To najlepszy
  test regresji tego zadania.**
- `npm test` zielone (w tym nowe testy merge'a i rankingu bonusu).

---

### [ ] P3-9. (OPCJONALNE, do decyzji Kamila) Progresja liczona od faktycznie użytego ciężaru

**Kontekst:** `computeProgression` (`logic.ts:278`) przyjmuje `entry.targetWeight`
jako bazę i **ignoruje ciężary wpisane w seriach**. Dziś to rzadko boli, bo ręczna
zmiana wagi wymaga klawiatury. Po wdrożeniu P3-2 (steppery) i P3-8 (podmiany
ćwiczeń) korekta w locie stanie się codziennością — a wtedy zrobienie 3×12 na
ciężarze o 5 kg niższym niż cel podbije cel od tej WYŻSZEJ wartości.

**Propozycja (jeśli Kamil to potwierdzi):** bazą progresji niech będzie najczęstszy
ciężar wśród zaliczonych serii roboczych (moda; przy remisie — niższy), a
`targetWeight` tylko fallbackiem, gdy brak zaliczonych serii. Do tego w podsumowaniu
komunikat typu `Liczone od 60 kg (cel był 62,5 kg)`, gdy wartości się różnią.

**Dlaczego nie robimy tego od ręki:** to zmiana semantyki silnika, która dotknie
też `catchUpTargetsFromHistory` (`seed.ts:323`) i historię startową. Wymaga świadomej
zgody Kamila i osobnego kompletu testów — nie doklejaj tego do P3-2.

---

## P4 — zgłoszenia Kamila + „paka na level up" (sesja 27.07.2026, Opus 5)

Trzy zgłoszenia ze screenów (P4-1…P4-3) + siedem pomysłów rozwojowych (P4-4…P4-10),
rozpisanych tak, żeby dało się je wdrażać pojedynczo, bez czytania tej rozmowy.

**Prompt dla Sonneta (kopiuj-wklej, jedno zadanie na raz):**
```
Wdróż zadanie P4-1 z POMYSLY.md. Trzymaj się sekcji "Zasady implementacji"
oraz "Wspólne pułapki P3" (nadal obowiązują). Po skończeniu odhacz zadanie
w POMYSLY.md, uruchom npm test + npm run build i zrób commit.
```

### Wspólne pułapki P4 (przeczytaj RAZ)

1. **Dolna krawędź ekranu jest zatłoczona.** W trybie listy siedzą tam trzy rzeczy
   naraz: nawigacja (`App.tsx:73`, `fixed bottom-0`, wysokość ~60 px + 10 px paddingu),
   pigułka timera (`TrainScreen.tsx:1302`, `bottom: 78px`, wysokość ~44 px) i — po
   P4-1 — toasty. Każde zadanie ruszające dół ekranu musi sprawdzić wszystkie trzy
   na iPhonie, nie tylko w DevToolsach.
2. **Zakaz animowania rzeczy wewnątrz warstw z `backdrop-blur`** (lekcja z P0-6,
   `Gym.tsx:228`). iOS Safari repaintuje wtedy całą rozmytą warstwę co klatkę i
   wygląda to jak rozjeżdżanie się. Animować wolno: `width`, `transform`,
   `box-shadow`/`opacity` **na osobnej warstwie bez `backdrop-blur`**.
3. **Nie zmieniaj semantyki `setVolume`/`entryVolume`** (`logic.ts:390-397`) bez
   przeczytania P4-3 — tonaż z tych funkcji karmi jednocześnie „Tonaż tygodniowy",
   „gęstość kg/min" (P1-10), rekordy i objętość per partia.
4. Bez nowych zależności, ikony z `lucide-react`, UI po polsku, mobile-first.

---

### [x] P4-1. Toasty na dole ekranu (zamiast pod Dynamic Island) (2026-07-27)

**Problem (screen IMG_3161):** toast „Zmieniono cel tygodnia" wjeżdża na górę i
zasłania nagłówek ekranu oraz kartę „Cel tygodnia" — dokładnie ten element, którego
dotyczy. Na 6,1" ekranie zabiera ~20% widoku i jest daleko od kciuka.

**Pliki:** `src/App.tsx:21-51` (komponent `Toaster`), `src/hooks/use-toast.ts`
(bez zmian w API), ewentualnie `src/index.css` (zmienne wysokości docka).

**Spec:**
1. `Toaster` przenieś z `top: calc(env(safe-area-inset-top) + 12px)` na dół:
   `bottom: 132px` (stała `BOTTOM_DOCK_PX = 132` w `App.tsx`, z komentarzem skąd
   liczba: 60 px nawigacja + 10 px padding + 44 px pigułka timera + 2×~9 px odstępu).
   **Nie dodawaj `env(safe-area-inset-bottom)`** — nawigacja świadomie go nie używa
   (`App.tsx:70-75`), dodanie go tutaj rozjedzie toasty względem paska.
2. Kolejność stosu: `flex-col-reverse`, żeby **najnowszy toast był najniżej**
   (najbliżej kciuka), a starsze wypychane w górę.
3. Maksymalnie 3 widoczne naraz — nadmiar obcinaj w `Toaster` (`toasts.slice(-3)`),
   nie ruszaj kolejki w `use-toast.ts`.
4. Wejście: `translateY(8px) → 0` + `opacity 0 → 1`, 180 ms, `ease-out`. Realizacja
   przez klasę Tailwinda z `tailwindcss-animate` (jest w projekcie) albo prosty
   `@keyframes` w `index.css`. Toast **nie ma** `backdrop-blur` na tej samej warstwie
   co animacja — jeśli zostawiasz `backdrop-blur`, animuj wrapper, nie rozmytą kartę
   (pułapka 2 wyżej).
5. Dismiss dotykiem: kliknięcie w treść toasta go zamyka (`dismissToast(t.id)`),
   z wyjątkiem kliknięcia w przycisk akcji (ten ma własny handler i nawigację).
   Minimalny cel dotykowy całej karty i tak > 36 px.
6. Kolizja z pigułką timera: przy stałej 132 px toast **nigdy** nie nachodzi na
   timer, kosztem ~50 px pustki na zakładkach bez timera. To świadomy wybór —
   prostszy i odporniejszy niż mierzenie DOM-u.
   *Wariant B (opcjonalny, tylko jeśli ta pustka będzie przeszkadzać):* dołóż do
   `use-toast.ts` moduł-singleton `setToastOffset(px)` (ten sam wzorzec co
   `listeners`), `TrainScreen` w trybie listy ustawia 132 przy montowaniu pigułki i
   72 przy odmontowaniu. Bez kontekstu Reacta, bez zmiany API `toast()`.

**Kryteria akceptacji:**
- Toast po zmianie trybu tygodnia pojawia się nad nawigacją, nie zasłania karty „Cel".
- W trakcie treningu (tryb listy) toast „Rekord!" (`TrainScreen.tsx:420`) nie nachodzi
  na pigułkę timera ani jej nie zasłania.
- Toast z akcją („Zrób backup" → „Przejdź do Więcej", `TrainScreen.tsx:279`) nadal
  nawiguje i znika po kliknięciu.
- W trybie skupienia (sticky header) nic się nie zmienia — toasty i tak są na dole.
- Sprawdzone na iPhonie z ekranu głównego (standalone), nie tylko w Safari.

---

### [x] P4-2. Neonowa otoczka pigułki timera (tryb listy, NIE tryb skupienia) (2026-07-27)

**Czego chce Kamil:** żeby odliczanie przerwy w normalnym trybie (pływająca pigułka
nad nawigacją) miało „fajną neonową otoczkę" — czytelny sygnał peryferyjny, że czas
leci, bez patrzenia w cyfry. Tryb skupienia (`variant="panel"`) zostaje jak jest.

**Pliki:** `src/components/Gym.tsx:226-253` (`RestTimer`, gałąź `pill`),
`src/components/TrainScreen.tsx:1302-1307` (wrapper pigułki), `src/index.css`
(zmienne koloru neonu).

**Spec:**
1. **Osobna warstwa poświaty.** Wrapper pigułki (`TrainScreen.tsx:1302`) ma
   `backdrop-blur` — poświaty NIE nakładaj na ten element. Zamiast tego wstaw
   wewnątrz `RestTimer` (albo w wrapperze) `<span aria-hidden>` pozycjonowany
   `absolute -inset-[2px] rounded-full pointer-events-none` **bez** `backdrop-blur`,
   z `box-shadow` robiącym neon i `transform: translateZ(0)`. Animuj tylko tę warstwę.
2. **Stany i kolory** (nowe zmienne w `index.css`, obok istniejących tokenów):
   - `idle` (nie leci, pełny czas): brak poświaty — pigułka wygląda jak dziś, żeby
     nie świeciła bez powodu przez cały trening.
   - `running` (leci, > 5 s): cyan `--neon-run: 190 95% 55%`,
     `box-shadow: 0 0 10px 1px hsl(var(--neon-run)/0.45), 0 0 24px 4px hsl(var(--neon-run)/0.18)`
     + obrys `0 0 0 1px hsl(var(--neon-run)/0.55)`.
   - `almost` (ostatnie 5 s): bursztyn `--neon-warn: 38 95% 55%`, ta sama formuła z
     mocniejszą alfą (0.6 / 0.28).
   - `done` (0 s): zieleń `--neon-done: 142 70% 45%`, poświata zostaje ~2 s po zejściu
     do zera, potem gaśnie (`setTimeout` + stan, albo klasa zdejmowana po `transitionend`).
   - Przejścia między stanami: `transition: box-shadow 300ms ease` — zmienia się
     **tylko przy zmianie stanu**, nie co sekundę.
3. **Pasek postępu w obrysie.** Pod cyframi (wewnątrz pigułki) cienki pasek 2 px,
   `width: (left/seconds)*100%`, kolor jak aktualny stan, `transition-all` — dokładnie
   ten sam wzorzec co `variant="panel"` (`Gym.tsx:216-221`), który już jest sprawdzony
   pod kątem janku. Animujemy **wyłącznie `width`**.
4. **Zakaz:** `animate-pulse`, animowane `opacity`/`filter: blur()` na warstwie z
   `backdrop-blur`, `@keyframes` odpalane co klatkę na rozmytym elemencie. Jeśli chcesz
   delikatne „tętno" w ostatnich 5 s — wolno TYLKO na osobnej warstwie poświaty (pkt 1),
   `@keyframes` na `box-shadow`, cykl ≥ 1 s, i musi być zgaszone przy
   `@media (prefers-reduced-motion: reduce)`.
5. Cyfry zostają jak dziś (`text-amber-400` w ostatnich 5 s, `text-green-400` na zerze)
   — neon je uzupełnia, nie zastępuje.

**Kryteria akceptacji:**
- Timer nieaktywny = zero świecenia; po odhaczeniu serii pigułka zapala się na cyan.
- Ostatnie 5 s = bursztyn, zero „rozjeżdżania się" na iPhonie (regresja P0-6).
- Po dojściu do zera zielona poświata gaśnie sama, timer nie zostaje zapalony na stałe.
- Tryb skupienia (`variant="panel"`) wygląda identycznie jak przed zmianą.
- `npm run build` przechodzi, `docs/index.html` przebudowany.

---

### [x] P4-3. „Brzuch: 0 kg" w widoku Wykonane → to nie jest jeden bug, tylko dwa braki (2026-07-27)

**Pytanie Kamila (screen IMG_3162):** czemu w „Objętość tygodniowa → Wykonane (7 dni)
→ kg" Brzuch pokazuje 0 kg.

**Diagnoza (dwie niezależne przyczyny — obie prawdziwe):**

1. **Izometryka nie ma tonażu.** `setVolume()` (`logic.ts:390-392`) zwraca **0** dla
   każdego ćwiczenia z `isHold: true` — bo `reps` to wtedy sekundy, a `kg × sekundy`
   to inna jednostka niż `kg × powtórzenia` i doliczenie tego do tonażu zafałszowałoby
   wszystkie pozostałe metryki. W planie Kamila Brzuch obsługują dokładnie dwa
   ćwiczenia: `crunch` (Allahy, poniedziałek) i `plank` (deska, środa, `isHold: true`,
   `seed.ts:94`). Nagłówek na screenie mówi „2 treningi · 21.07–27.07" i pokazuje
   zerowe Pośladki i Biceps — a te wiszą wyłącznie na poniedziałku (`hipthrust`,
   `curl_bb`, `seed.ts:456`). Czyli w oknie były środa + piątek: **Brzuch dostał serie
   z deski, ale deska z definicji daje 0 kg tonażu**.
2. **Zerowy tonaż jest nieodróżnialny od „nic nie robiłem".** W widoku „Serie" Brzuch
   pokazuje 4 serie (deska), po przełączeniu na „kg" spada do 0 bez żadnego wyjaśnienia
   — i to jest realny problem UI, nie błąd liczenia. Ten sam efekt złapie każde
   ćwiczenie `unit: "bodyweight"` logowane z ciężarem 0 (podciąganie, unoszenie nóg
   w zwisie, dead bug — `seed.ts:405-435`): wykonane, a w tonażu zero.

**To znaczy: liczby są poprawne, brakuje kontekstu w UI.** Nie „naprawiaj" tego
doliczaniem sekund do kilogramów.

**Pliki:** `src/lib/logic.ts` (`MuscleVolume`, `weeklyMuscleVolume`,
`actualWeeklyMuscleVolume`), `src/components/ProgressScreen.tsx:238-260`,
`tests/logic.test.ts`.

**Spec (część A — obowiązkowa, czysto informacyjna):**
1. Rozszerz `MuscleVolume` (`logic.ts:115-121`) o dwa pola:
   `holdSets: number` (serie z `isHold`, zaliczone) i `zeroLoadSets: number`
   (serie zaliczone, nie-`isHold`, o `weight === 0`). Licz je w obu funkcjach
   (`weeklyMuscleVolume` — z planu, `actualWeeklyMuscleVolume` — z sesji), tą samą
   wagą co `direct` (tylko partia GŁÓWNA, wspomagające pomijaj — inaczej przypis
   pojawi się przy połowie partii).
2. W `ProgressScreen`, w gałęzi `volumeMetric === "tonnage"` (`:241-252`), pod paskiem
   dopisz linijkę `text-[10px] text-muted-foreground`, gdy `tonnage === 0 && sets > 0`:
   - `holdSets > 0` → `„{holdSets} serii izometrycznych — czas pod napięciem nie ma tonażu"`
   - `zeroLoadSets > 0` → `„{zeroLoadSets} serii z masą własną (0 kg wpisane) — brak tonażu"`
   - oba > 0 → obie części po przecinku.
   Gdy `tonnage === 0 && sets === 0` → nic nie dopisuj (partia faktycznie nietrenowana).
3. Dopisek w `CardDescription` przy metryce „kg" (`:174`): dodaj `„· bez izometryki"`,
   żeby zasada była widoczna zanim ktoś zacznie szukać zera.

**Spec (część B — OPCJONALNA, do decyzji Kamila; nie wdrażaj bez potwierdzenia):**
Licz masę ciała w tonażu dla ćwiczeń `unit: "bodyweight"` (bez `isHold`):
`(bodyweight × coef + weight) × reps`, gdzie `bodyweight` to ostatni wpis z
`state.body` (wzorzec: `logic.ts:549`), a `coef` z małej tabeli w `logic.ts`
(podciąganie/dipy 1.0, pompki 0.65, unoszenie nóg 0.5, reszta 0.5). Za przełącznikiem
`settings.countBodyweightInTonnage` (domyślnie **false** — brak bumpa `SCHEMA_VERSION`,
patrz pułapka 4 z P3), bo włączenie tego zmienia też „Tonaż tygodniowy" i gęstość
kg/min z P1-10, czyli rozjeżdża porównanie z historycznymi tygodniami. Jeśli wdrażasz —
przy włączonym przełączniku pokaż w karcie „Tonaż tygodniowy" ostrzeżenie, że starsze
tygodnie liczone są tą samą regułą wstecz (bo bierze ostatnią wagę ciała, nie ówczesną).

**Kryteria akceptacji (część A):**
- Brzuch przy samej desce w oknie: `0 kg` + przypis o izometryce, nie gołe zero.
- Partia bez żadnej serii w oknie (np. Pośladki bez poniedziałku): `0 kg` bez przypisu.
- Widok „Serie" bez zmian wizualnych.
- Nowe testy w `tests/logic.test.ts`: (a) sesja z samą deską → `tonnage === 0`,
  `holdSets === liczba zaliczonych serii`; (b) ćwiczenie `bodyweight` z `weight: 0`
  → `zeroLoadSets > 0`, `tonnage === 0`; (c) zwykłe ćwiczenie → oba pola `0`.

---

## P4 — pomysły rozwojowe („paka na level up")

Uszeregowane po stosunku *realny wpływ na przyrosty / koszt wdrożenia*. P4-4 i P4-5
to jedyne dwa, które zmieniają **co robisz na siłowni**; reszta to lepszy wgląd
i motywacja. Jeśli Kamil ma czas tylko na jedno — P4-4.

---

### [x] P4-4. Autoregulacja przyrostu: RIR ostatniej serii steruje progresją (2026-07-27)

**Dlaczego to jest największy skok jakości:** dziś progresja widzi tylko powtórzenia
(`computeProgression`, `logic.ts:339+`). 3×8 wykonane na luzie (2–3 powtórzenia
w zapasie) i 3×8 wyszarpane na skraju upadku dają **ten sam** wynik: +1 krok ciężaru.
W pierwszym przypadku tracisz tydzień na zbyt małym skoku, w drugim wchodzisz
w przetrenowanie. Aplikacja ma już pole `rir` w `Exercise` (cel), ale nigdy nie
pyta, ile faktycznie zostało w baku.

**Pliki:** `src/lib/types.ts` (`SetLog`), `src/lib/logic.ts` (`computeProgression`),
`src/components/TrainScreen.tsx` (logger + podsumowanie), `tests/logic.test.ts`.

**Spec:**
1. `SetLog` dostaje **opcjonalne** `rir?: number` (0–4). Opcjonalne = brak bumpa
   `SCHEMA_VERSION`, stare sesje i draft działają bez zmian (pułapka 4 z P3).
   `Draft` też nie zmienia kształtu — `SetLog` jest w nim reużywany.
2. **Pytamy tylko o ostatnią serię roboczą ćwiczenia** — nie o każdą. Po odhaczeniu
   ostatniej serii w karcie ćwiczenia pokaż jeden rząd 4 przycisków (36×36 px,
   mieszczą się, bo to osobny wiersz pod seriami, nie w wierszu serii — patrz
   pułapka 5 z P3): `0 (upadek) · 1 · 2 · 3+`. Pominięcie = `undefined` = dzisiejsze
   zachowanie. Nie blokuj zakończenia treningu brakiem RIR.
3. `computeProgression` dostaje trzeci, opcjonalny argument `lastRir?: number` i
   modyfikuje wynik **tylko gdy komplet powtórzeń został zrobiony** (czyli tam, gdzie
   dziś jest `+increment`):
   - `lastRir >= 3` → `+2 × increment`, komunikat „Zostały 3+ w zapasie — podwójny skok".
     **Limit bezpieczeństwa (obowiązkowy):** podwójny skok tylko gdy
     `2 * ex.increment <= 0.15 * targetWeight` ORAZ `ex.id !== "deadlift"` — inaczej
     zwykły `+increment`. Bez tego wznosy bokiem (9 kg, krok 1) dostałyby +22% w tydzień,
     a hantle na skosie (16 kg, krok 2) +25%. W praktyce podwójny skok dostają sztangowe
     wielostawowe (wyciskanie 11%, przysiad 7,7%, wiosłowanie 8%), izolacje na hantlach nie.
     Wyjątek martwego ciągu jest spójny z istniejącym wyjątkiem w `exerciseForMode`.
   - `lastRir === 2` albo `undefined` → jak dziś (`+increment`).
   - `lastRir <= 1` → `+increment`, ale dopisz „Blisko upadku — jeśli następny raz
     nie wyjdzie, zostań na tym ciężarze".
   Gdy powtórzeń NIE ma kompletu, a `lastRir === 0` w **dwóch sesjach z rzędu** →
   zwróć sygnał deloadu dla tego ćwiczenia (ten sam kanał komunikatu co dziś).
   `increment` nigdy nie jest zmieniany w bazie — mnożysz go tylko przy liczeniu celu.
4. Deload (`mode === "deload"`) ignoruje RIR — progresja tam i tak jest wyłączona.
5. Podsumowanie treningu pokazuje powód skoku, gdy był podwójny.

**Kryteria akceptacji:**
- Testy: komplet + RIR 3 na wyciskaniu (45 kg, krok 2,5) → 50 kg; komplet + RIR 3 na
  wznosach bokiem (9 kg, krok 1 — limit 15%) → 10 kg, NIE 11; komplet + RIR 3 na martwym
  ciągu → pojedynczy krok; komplet + RIR 1 → +1 krok + ostrzeżenie;
  komplet bez RIR → identycznie jak przed zmianą (regresja!); brak kompletu + RIR 0
  dwa razy → sygnał deloadu.
- Trening bez dotykania RIR daje dokładnie te same cele co dziś.
- Odświeżenie strony w trakcie treningu nie gubi zapisanych RIR (draft).

---

### [~] P4-5. Progresja OBJĘTOŚCI w mezocyklu (nie tylko ciężaru) — CZĘŚĆ 1 WDROŻONA (27.07.2026)

**Dlaczego:** ciężar rośnie co tydzień, liczba serii stoi w miejscu od pierwszego dnia.
Objętość to główny sterownik hipertrofii, a apka już wie wszystko, co potrzebne:
serie per partia (`weeklyMuscleVolume`), zakresy min–max (`MUSCLE_RANGES_*`),
tryb deload (P2-8) i licznik tygodni od deloadu (`weeksSinceDeload`).

**Spec:**
1. Nowe `settings.volumeProgression?: boolean` (domyślnie false) + `settings.mesoStartIso?`.
2. Gdy włączone i `trainingMode === "hypertrophy"`: co tydzień od startu mezocyklu
   apka proponuje **+1 serię** dla partii, która jest poniżej `min` swojego zakresu
   (najpierw największy deficyt), do maksymalnie +1 seria na partię na tydzień
   i nigdy powyżej `max`. To **propozycja na ekranie wyboru dnia** (jak nudge deloadu),
   nie automat zmieniający plan — Kamil klika „Dodaj serię do {ćwiczenie}", co
   podbija `targetSets` w drafcie sesji (nie w planie!).
3. Po tygodniu deloadu licznik się zeruje (`mesoStartIso = data deloadu`), objętość
   wraca do bazowej z planu.
4. Karta w Progres: „Mezocykl: tydzień 3/5 · serie tygodniowo 9 → 12".

**Kryteria akceptacji:** wyłączone = zero zmian w UI; włączone nie modyfikuje nigdy
`state.days`/`exercises`; propozycja znika, gdy partia wejdzie w zakres.

**Część 1 wdrożona (27.07.2026) — silnik, bez UI:**
- `types.ts`: `Settings.volumeProgression?: boolean`, `Settings.mesoStartIso?: string` (obie
  opcjonalne, brak bumpa `SCHEMA_VERSION`).
- `logic.ts`: `mesocycleWeek(mesoStartIso, nowIso?)` — numer tygodnia mezocyklu (1-indeksowany,
  granice poniedziałkowe jak `weeksSinceDeload`, żeby oba liczniki nie rozjeżdżały się).
  `volumeProgressionSuggestions(state, nowIso?)` — zwraca `VolumeProgressionSuggestion[]`
  (`muscle, currentSets, min, max, proposedAdd, newTotal`), posortowane po największym
  deficycie; `[]` gdy wyłączone, tryb ≠ hipertrofia, brak `mesoStartIso` albo tydzień 1
  (jeszcze 0 narosłych tygodni). `proposedAdd` liczony z **planu** (`weeklyMuscleVolume`),
  nigdy nie przekracza `max`, znika (filtrowany) gdy partia i tak jest ≥ `min`.
- **Świadoma zmiana względem specu:** licznik tygodni startuje od `settings.mesoStartIso`
  (ustawianego przez store przy PRZEŁĄCZENIU `volumeProgression` na `true`), NIE od
  `weeksSinceDeload` wprost — inaczej włączenie przełącznika na koncie z długą historią
  odpaliłoby od razu wielotygodniowy skok objętości zamiast łagodnego +1/tydzień od teraz.
  `weeksSinceDeload` i tak istnieje i jest reużywalne gdyby potrzebny był inny licznik.
- `store.tsx`: `updateSettings` ustawia `mesoStartIso = now` TYLKO przy przejściu
  `false/undefined -> true` i tylko gdy jeszcze go nie ma (nie nadpisuje przy każdym zapisie
  ustawień). `finishSession` przy `mode === "deload"` zeruje `mesoStartIso` do daty tej sesji
  (mezocykl wraca do zera po deloadzie, objętość znów startuje z planu bazowego).
  `UndoSnapshot` dostał `mesoStartIso?` (P2-9 cofnięcie sesji poprawnie przywraca też ten
  licznik, nie tylko `targets`/`hyperTargets`).
- **Świadomie POZA częścią 1 (do części 2):** UI — karta/nudge na ekranie wyboru dnia,
  przycisk „Dodaj serię do {ćwiczenie}" (wymaga zmapowania partii → konkretne ćwiczenie
  w drafcie sesji, dziś silnik zwraca tylko poziom partii), karta „Mezocykl: tydzień X/Y"
  w Progresie, przełącznik `volumeProgression` w ustawieniach (dziś włączalny tylko
  programistycznie/w testach, nie z UI).
- **Zweryfikowane:** 9 nowych testów w `tests/logic.test.ts` (wyłączone/tryb siła/brak startu/
  tydzień 1 → `[]`; tydzień 3 → Klatka 9→11 serii; capping przy max; zniknięcie po wejściu
  w zakres przez `muscleRanges` override). `npm test` 100% OK, `npm run build` (tsc + vite +
  singlefile) bez błędów.

---

### [ ] P4-6. Kurs masy ciała: trend, tempo i sprzężenie z pasem

**Dlaczego:** paka powstaje w kuchni, a apka ma już `BodyEntry` z wagą **i obwodem
pasa** (P1-2) — i nie robi z tego żadnego wniosku. Surowa waga dzienna skacze ±1 kg
przez wodę i jedzenie, więc wykres nic nie mówi.

**Pliki:** nowy `src/lib/body.ts` (czysta logika + testy), karta w `ProgressScreen`
albo `MoreScreen`.

**Spec:**
1. `movingAverage(body, days = 7)` — średnia krocząca wagi; wykres pokazuje surowe
   punkty (cienko) + średnią (grubo). To jedyna liczba, na którą warto patrzeć.
2. `weeklyRate(body, weeks = 3)` — tempo w kg/tydz. z regresji liniowej średniej
   kroczącej (ten sam aparat co `projectHistory`, `logic.ts`).
3. Ocena tempa względem celu: `settings.bodyGoal?: "bulk" | "recomp" | "cut"`.
   Dla `bulk` pasmo docelowe **0,25–0,5% masy ciała / tydzień** (przy 80 kg:
   0,2–0,4 kg/tydz.). Status jak przy objętości: za wolno / w zakresie / za szybko.
4. **Sprzężenie z pasem (to jest ta wartościowa część):** jeśli w oknie 4 tygodni
   obwód pasa rośnie szybciej niż waga w ujęciu procentowym → komunikat
   „Pas rośnie szybciej niż masa — nadwyżka za duża, zejdź o ~200 kcal".
   Odwrotnie (waga rośnie, pas stoi) → „Idealnie, trzymaj tak".
5. Szacunek białka: `1,6–2,2 g/kg` masy ciała, jedna linijka, bez kalkulatora posiłków.
6. **Świadomie POZA zakresem:** liczenie kalorii, baza produktów, makro per posiłek.
   To osobna aplikacja, nie doklejaj jej tutaj.

**Kryteria akceptacji:** < 3 pomiary → karta mówi „za mało danych", nie rysuje trendu;
testy dla `movingAverage` i `weeklyRate` (w tym trend płaski i spadkowy).

---

### [ ] P4-7. Raport tygodniowy — jedna karta, cztery liczby, jedna rekomendacja

**Dlaczego:** dane są, wniosków nie ma. Kamil musi sam przełączać widoki, żeby
zobaczyć, czy tydzień był dobry.

**Spec:** karta na górze Progres, generowana z istniejących funkcji (zero nowej
matematyki poza sklejeniem):
- **Zrobione:** X z Y zaplanowanych treningów (dni aktywne vs sesje w oknie).
- **Tonaż:** suma tygodnia i zmiana % vs poprzedni (`weeklyTonnage` już liczone,
  `ProgressScreen:90`).
- **Siła:** ćwiczenia, w których e1RM wzrósł / spadł (z `progressHistory`).
- **Objętość:** partie poniżej `min` (z `actualWeeklyMuscleVolume`).
- **Jedna rekomendacja** wybrana priorytetowo: deload (jeśli `weeksSinceDeload` ≥ 6
  lub `detectPlateau` na ≥ 3 ćwiczeniach) → dzień bonusowy (jeśli ≥ 2 partie `low`) →
  „trzymaj kurs".
Zwijalna, domyślnie rozwinięta w niedzielę i poniedziałek, zwinięta w resztę tygodnia.

---

### [ ] P4-8. Pomiary obwodów (biceps, klatka, udo) obok wagi i pasa

**Dlaczego:** „paka" to obwody, nie liczba na wadze — a przy powolnym, czystym
przyroście masy waga potrafi stać w miejscu przez 3 tygodnie, podczas gdy ramię rośnie.
Bez tego jedynym dowodem postępu są kilogramy na sztandze.

**Spec:** `BodyEntry` dostaje opcjonalne `chest?`, `arm?`, `thigh?` (cm) — opcjonalne,
więc bez bumpa `SCHEMA_VERSION`. Pola zwinięte pod „Więcej pomiarów" w karcie Waga
ciała (`MoreScreen.tsx:223`), żeby nie rozdymać codziennego wpisu. Wykres: przełącznik
serii (waga / pas / klatka / ramię / udo), ten sam `LineChart` z normalizacją do %
zmiany, który już obsługuje dwie serie (P1-2). Historia bez pomiarów po prostu ich nie
rysuje.

---

### [x] P4-9. Cel na 12 tygodni + ETA z realnego trendu (2026-07-27)

**Dlaczego:** `projectHistory` (FEAT-2) już ekstrapoluje trend, ale nie odpowiada na
pytanie, które faktycznie motywuje: „kiedy wycisnę 60 kg".

**Spec:** w karcie „Postęp ćwiczenia" pole „Cel: ___ kg" (per ćwiczenie,
`settings.liftGoals?: Record<string, number>`). Z nachylenia regresji policz ETA
w tygodniach i pokaż: „Przy dotychczasowym tempie: ~7 tygodni (ok. 14.09)". Gdy
nachylenie ≤ 0 → „Trend płaski — cel nieosiągalny bez zmiany (patrz plateau breaker)",
bez zmyślania optymistycznej daty (§11 — uczciwe framowanie). Znacznik celu jako
pozioma linia przerywana na wykresie.

---

### [ ] P4-10. (OPCJONALNE) Superserie antagonistyczne — krótszy trening, ta sama robota

**Dlaczego:** para ćwiczeń na przeciwstawne partie (wiosłowanie + wyciskanie,
biceps + triceps) pozwala skrócić trening o ~20% bez straty na objętości — przy
3 treningach/tydzień to realna różnica między „poszedłem" a „odpuściłem".

**Spec:** w Planie możliwość oznaczenia dwóch ćwiczeń jako pary
(`WorkoutDay.supersets?: [string, string][]`). W loggerze para renderuje się jako
jedna karta z dwoma wierszami serii i **jednym** timerem między parami (a nie po
każdej serii). Wymaga ostrożności w trybie skupienia (jedna para = jeden ekran) i
w liczeniu objętości (bez zmian — serie liczą się normalnie).
**Nie zaczynaj od tego** — to najbardziej inwazyjna zmiana w loggerze z całego P4.

---

## P5 — zgłoszenia Kamila (sesja 27.07.2026, wieczór II — Opus 5)

Trzy tematy: dwie poprawki wykresu postępu (**P5-1**, **P5-2** — małe, niezależne od siebie,
po ~30–60 min) i jeden duży feature: **instrukcja wykonania ćwiczenia z animowanym ludzikiem**
(**P5-3**, rozbity na trzy etapy 3a/3b/3c — każdy wdrażany i commitowany osobno).

**Prompt dla Sonneta (kopiuj-wklej, jedno zadanie na raz):**
```
Wdróż zadanie P5-1 z POMYSLY.md. Trzymaj się sekcji "Zasady implementacji" oraz
"Wspólne pułapki P3/P4/P5" (nadal obowiązują). Po skończeniu odhacz zadanie w
POMYSLY.md, uruchom npm test + npm run build i zrób commit.
```

### Wspólne pułapki P5 (przeczytaj RAZ)

1. **`LineChart` karmi DWA różne wykresy** — „Postęp ćwiczenia" (`ProgressScreen.tsx:464`,
   e1RM w kg albo sekundy dla `isHold`, + `projection`, `markers`, `goalY`) oraz „Waga i pas"
   (`MoreScreen.tsx:231`, DWA szeregi, wartości procentowe ze znakiem i jednym miejscem po
   przecinku, `formatY={(y) => ...toFixed(1)}%`). Każda zmiana skali osi musi zostać obejrzana
   na **obu**, inaczej naprawiasz jeden wykres i psujesz drugi.
2. **`npm test` to czysty node przez esbuild, bez Reacta i bez DOM-u.** Logika testowalna →
   `src/lib/*` (bez importu Reacta), JSX → `src/components/*`. Nowe pliki z danymi (skala osi,
   pozy ludzika, teksty instrukcji) trzymaj w `src/lib/`, żeby dało się je objąć testami.
3. **Zmiana sygnatury `projectHistory` musi być wstecznie zgodna.** Cztery istniejące testy
   (`tests/logic.test.ts:841-853`) wołają ją z historią z przeszłości (2026-07) i sprawdzają
   konkretne daty. Nowy parametr `nowIso` **musi być opcjonalny i domyślnie wyłączać
   przycinanie** (patrz P5-2 pkt 1) — inaczej testy padną i „naprawisz" je przez zepsucie
   asercji, czego robić nie wolno.
4. Bez nowych zależności, ikony z `lucide-react`, UI po polsku, mobile-first. Deliverable to
   jeden plik `docs/index.html` — dziś **368 KB**. To jest budżet: każdy KB dokładany do
   bundla jest widoczny w czasie startu apki na telefonie (patrz analiza w P5-3).

---

### [x] P5-1. Oś Y wykresu postępu pokazuje nieokrągłe (a czasem zdublowane) liczby — WDROŻONE (27.07.2026)

**Problem (zgłoszenie Kamila):** na wykresie „Postęp ćwiczenia" podpisy osi po lewej to
losowo wyglądające liczby (np. `54 / 57 / 61 / 64`), a przy krótkiej historii potrafią się
powtórzyć (`50 / 50 / 50 / 50`) — wygląda jak błąd renderowania.

**Root cause (to nie jest przypadek — to dokładnie to, co robi kod):**
`Charts.tsx:8-12`:
```ts
function niceTicks(min, max, count = 4) {
  if (min === max) return [min];
  const step = (max - min) / count;      // ← równy podział, ZERO zaokrąglania do ładnych wartości
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}
```
plus `Charts.tsx:57-59`, gdzie domena jest wcześniej rozciągana o 15% z każdej strony:
```ts
const spanY = Math.max(...ys) - Math.min(...ys);
const minY  = Math.min(...ys) - (spanY || 1) * 0.15;
const maxY  = Math.max(...ys) + (spanY || 1) * 0.15;
```
Nazwa `niceTicks` jest myląca — funkcja nie robi nic „nice": dzieli **rozciągniętą, nieokrągłą**
domenę na 3 równe kawałki, a `formatY` (`ProgressScreen.tsx:469`) zaokrągla wynik do liczby
całkowitej dopiero na etapie wyświetlania. Dwa realne scenariusze:

- **e1RM 55,0 … 62,9 kg** → span 7,9 → domena 53,815 … 64,085 → ticki 53,815 / 57,238 /
  60,662 / 64,085 → podpisy **54 / 57 / 61 / 64**. Odstępy między liniami siatki: 3,4 kg.
  Nic nie zaczepia się o okrągłe 55 / 60 / 65.
- **jeden punkt historii albo płaska seria (np. zawsze 50 kg)** → `spanY = 0` → domena
  49,85 … 50,15 → ticki 49,85 / 49,95 / 50,05 / 50,15 → podpisy **50 / 50 / 50 / 50**
  (cztery identyczne liczby na czterech różnych liniach — to jest ten „dziwny" widok).

**Pliki:** nowy `src/lib/scale.ts`, `src/components/Charts.tsx:8-12,41-42,52-59,76,90-93`,
`src/components/ProgressScreen.tsx:469`, `tests/logic.test.ts` (nowe testy).

**Spec:**

1. Nowy **czysty** moduł `src/lib/scale.ts` (bez Reacta — ma być testowalny, pułapka 2):
   ```ts
   /** Zaokrąglenie „w górę do ładnej" wartości: 1 / 2 / 2,5 / 5 / 10 × 10^n. */
   function niceNum(range: number, round: boolean): number { … }

   export interface Scale { min: number; max: number; step: number; ticks: number[]; decimals: number }

   /**
    * Skala osi Y z podpisami na OKRĄGŁYCH wartościach (algorytm Heckberta „nice numbers").
    * @param minStep najmniejszy sensowny krok w jednostce serii (kg → 0.5, sekundy → 1, % → 0.5)
    */
   export function niceScale(min: number, max: number, maxTicks = 4, minStep = 0.5): Scale
   ```
   Wymagania:
   - `min === max` (jeden punkt / płaska seria) → rozszerz domenę o `max(minStep * 2, |min| * 0.05)`
     w obie strony, **zanim** policzysz krok. Nigdy nie zwracaj dwóch ticków o tym samym podpisie.
   - `step = max(minStep, niceNum(range / (maxTicks - 1), true))`; `min` w dół do wielokrotności
     `step` (`Math.floor(min / step) * step`), `max` w górę (`Math.ceil`).
   - **Uwaga na float:** pętla `for (let v = niceMin; v <= niceMax + step * 1e-9; v += step)`
     kumuluje błąd — generuj ticki przez `Math.round(niceMin / step + i)` × `step` i
     dodatkowo zaokrąglaj wynik do 6 miejsc (`Math.round(v * 1e6) / 1e6`), inaczej wyjdzie
     `57.99999999999999`.
   - `decimals = step < 1 ? 1 : 0` — do domyślnego formatowania podpisów.
   - Odporność na śmieci: `NaN`/`Infinity` w wejściu → zwróć `{min: 0, max: 1, step: 1, ticks: [0, 1], decimals: 0}`
     zamiast wysypywać render.
2. `Charts.tsx` — `LineChart`:
   - Usuń lokalne `niceTicks`, użyj `niceScale`. **Domena osi Y = domena ze skali**
     (`scale.min`/`scale.max`), a nie stare `±15%`. Padding wizualny jest już zapewniony przez
     zaokrąglenie w dół/górę do wielokrotności kroku; jeżeli po zaokrągleniu linia dotyka
     krawędzi (dane dokładnie na ticku), dołóż **pół kroku** z tej strony.
   - Nowy opcjonalny prop `minTickStep?: number` (domyślnie `0.5`). `goalY` nadal wchodzi do
     wyliczenia domeny (dziś `Charts.tsx:54`) — cel poza zakresem danych musi zostać widoczny.
   - **Szerokość marginesu lewego licz z najdłuższego podpisu**, zamiast sztywnego `pad.l = 38`
     (`Charts.tsx:42`): `pad.l = 10 + maxLabelChars * 5.6` (fontSize 9 ≈ 5,4 px na znak), min. 26.
     Bez tego podpisy typu `+12.5%` (MoreScreen) albo `1250` wchodzą pod wykres.
   - Domyślny `formatY` ma używać `scale.decimals` (`y.toFixed(scale.decimals)`), nie
     `Math.round`. Wywołania z własnym `formatY` (MoreScreen) działają jak dziś.
3. `ProgressScreen.tsx:469` — **usuń** `formatY={(y) => `${Math.round(y)}`}` (domyślne
   formatowanie ze skali jest teraz lepsze) i dołóż `minTickStep={selected?.isHold ? 1 : 0.5}`
   (sekundy planku nie mają połówek).
4. `MoreScreen.tsx:231` — zostaw `formatY` (procenty), ale sprawdź w przeglądarce, czy przy
   serii wagi (np. −1,2% … +0,8%) podpisy wychodzą okrągłe i czy 0% wpada na siatkę.
   Jeśli nie — dołóż `minTickStep={0.5}` jawnie.

**Testy (`tests/logic.test.ts`, import z `../src/lib/scale`):**
- `niceScale(55, 62.9)` → wszystkie ticki są wielokrotnościami `step`, `step ∈ {1, 2, 2.5, 5}`,
  `min ≤ 55`, `max ≥ 62.9`.
- `niceScale(50, 50)` → **≥ 2 ticki i wszystkie podpisy różne** (regresja na bug ze screena).
- `niceScale(0, 0)` → nie wybucha, `step > 0`.
- `niceScale(-1.2, 0.8, 4, 0.5)` → zawiera `0` wśród ticków.
- `niceScale(NaN, 5)` → fallback, bez wyjątku.

**Kryteria akceptacji:** podpisy osi to okrągłe liczby ze stałym krokiem (np. 55 / 57,5 / 60 /
62,5), żadne dwa podpisy się nie powtarzają, linia celu (`goalY`) i projekcja nadal mieszczą się
w kadrze, wykres wagi w „Więcej" wygląda nie gorzej niż przed zmianą.

**Zweryfikowane:** nowy `src/lib/scale.ts` (`niceScale`, algorytm "nice numbers" z krokiem
1/2/2,5/5×10ⁿ), wpięty w `Charts.tsx` (domena osi = domena skali, margines lewy z długości
najdłuższego podpisu, `minTickStep` prop). `ProgressScreen.tsx` przekazuje
`minTickStep={selected?.isHold ? 1 : 0.5}` zamiast starego `formatY={Math.round}`.
**Świadoma zmiana względem specu:** `decimals = Number.isInteger(step) ? 0 : 1` zamiast dosłownego
`step < 1 ? 1 : 0` z tekstu specu — ten ostatni dałby `decimals=0` przy `step=2,5` (np. w
przykładzie 55/62,9), co renderowałoby „57,5" jako „58" i psuło własne kryterium akceptacji z tej
samej sekcji. 5 nowych testów w `tests/logic.test.ts`, `npm test`/`npm run build` zielone.

---

### [x] P5-2. Przerywana projekcja startuje w przeszłości i nie widać, gdzie jest „dziś" — WDROŻONE (27.07.2026)

**Pytanie Kamila:** „przerywana zaczyna się nie od dnia dzisiejszego — czy tak powinno być?"

**Odpowiedź (i co z tego wynika):** **częściowo tak, częściowo nie.**
- **Tak** co do punktu zaczepienia linii: przerywana **celowo** wychodzi z ostatniego realnego
  punktu historii (`Charts.tsx:71-75` — `toPath([data[data.length-1], ...projection])`), żeby
  linia nie miała dziury. Trend jest liczony z historii, więc musi startować tam, gdzie historia
  się kończy. Tego nie zmieniamy.
- **Nie** co do dat samych kropek projekcji. `projectHistory` (`logic.ts:760-778`) generuje je
  jako `data ostatniej sesji + k × średni odstęp`. Jeśli ostatni trening tego ćwiczenia był
  np. 10 dni temu, a średni odstęp to 7 dni, **pierwsza „przyszła" kropka wypada 3 dni w
  przeszłości**. Apka pokazuje wtedy „prognozę" na dzień, który już był — to jest realny błąd.
- **Nie** też co do czytelności: na osi X są tylko dwa podpisy (min i max, `Charts.tsx:95-104`),
  a `maxX` uwzględnia punkty projekcji — prawy podpis to data z przyszłości i nic na wykresie
  nie mówi, gdzie kończy się rzeczywistość, a zaczyna ekstrapolacja.

**Pliki:** `src/lib/logic.ts:760-778` (`projectHistory`), `src/components/Charts.tsx` (nowy
prop `nowX`), `src/components/ProgressScreen.tsx:126,464-477`, `tests/logic.test.ts:841-853`.

**Spec:**

1. `projectHistory(history, count = 3, nowIso?: string)`:
   - Zachowaj `linearTrendE1rm` (wspólne z `estimateGoalEta` — nie duplikuj matematyki).
   - Gdy `nowIso` **nie jest podany** → zachowanie identyczne jak dziś (kluczowe dla
     istniejących testów, pułapka 3).
   - Gdy `nowIso` jest podany → generuj kandydatów dla `k = 1, 2, 3, …`
     (`date = lastTime + avgInterval × k`, `e1rm = last.e1rm + slope × k` — **ten sam `k`**,
     żeby wartość odpowiadała dacie, a nie kolejności kropki), **pomijaj te z datą < now**
     i zbierz pierwsze `count` z datą ≥ now. Limit bezpieczeństwa: `k ≤ count + 26`
     (pół roku); po jego przekroczeniu zwróć to, co uzbierane.
   - Gdy ostatni punkt historii jest w przyszłości (śmieciowe dane / strefa czasowa) →
     nie kombinuj, zachowaj się jak bez `nowIso`.
   - Zaktualizuj docblock: napisz wprost, że kropki są przycinane do przyszłości, a linia
     nadal wychodzi z ostatniej sesji.
2. `Charts.tsx` — nowy opcjonalny prop `nowX?: number` (timestamp):
   - Pionowa linia `stroke="currentColor"`, `strokeOpacity={0.3}`, `strokeDasharray="3 3"`,
     od `pad.t` do `height - pad.b`, plus podpis `dziś` (`fontSize 8.5`, `fillOpacity 0.55`)
     tuż nad linią, wyrównany tak, żeby nie wychodził poza `width - pad.r`.
   - `nowX` **wchodzi do domeny X** (razem z `data`/`data2`/`projection`), żeby przy historii
     kończącej się dawno temu „dziś" nie wypadło poza kadr.
   - Rysuj **pod** seriami (przed `<path>`), tak jak `markers`, żeby nie zasłaniało kropek.
     Nie myl tego ze znacznikami squasha (fioletowe, `Charts.tsx:105-118`) — inny kolor,
     inny opis w legendzie.
3. `ProgressScreen.tsx`:
   - `projectHistory(history, 3, new Date().toISOString())` (linia 126) i `nowX={Date.now()}`
     w `<LineChart>` (linia 464).
   - Podpis pod wykresem (dziś linie 472-477) rozbuduj o punkt zaczepienia i odstęp — tekst
     ma odpowiadać na dokładnie to pytanie, które zadał Kamil:
     „Przerywana wychodzi z **ostatniego treningu** (14.07) — stamtąd liczony jest trend.
     Kropki to spodziewane kolejne sesje (co ~7 dni). Szacunek przy utrzymaniu tempa, nie prognoza."
     Daty i odstęp bierz z danych (`history[last].date`, `avgIntervalMs` — wystaw go z
     `projectHistory` albo policz w komponencie z historii), nie wpisuj na sztywno.
   - Gdy `hasVisibleSquashMarker` jest prawdziwe, w legendzie obok fioletowej kreski dopisz
     szarą kreskę „dziś", żeby dwie pionowe linie nie myliły się ze sobą.

**Testy (`tests/logic.test.ts`):**
- Cztery istniejące testy `projectHistory` (linie 841-853) **muszą przejść bez zmian**.
- Nowy: historia kończąca się 10 dni przed `now`, odstęp 7 dni → wszystkie 3 zwrócone daty
  są ≥ `now`, a pierwsza to `last + 14 dni` (bo `k=1` wypadł w przeszłości).
- Nowy: `e1rm` pierwszej zwróconej kropki = `last.e1rm + slope × 2` (spójność `k` i daty).
- Nowy: historia kończąca się dziś → wynik identyczny jak bez `nowIso`.

**Kryteria akceptacji:** na wykresie widać pionową kreskę „dziś"; żadna kropka projekcji nie
leży na lewo od niej; przerywana nadal wychodzi z ostatniej pełnej kropki; podpis pod wykresem
tłumaczy oba fakty jednym zdaniem.

**Zweryfikowane:** `projectHistory(history, count, nowIso?)` — bez `nowIso` identyczne zachowanie
(chronione istniejącymi testami), z `nowIso` przycina kropki do `>= now` (limit `k <= count+26`).
`Charts.tsx` dostał `nowX` (pionowa przerywana kreska „dziś", wchodzi do domeny X, rysowana pod
seriami). `ProgressScreen.tsx` przekazuje `projectHistory(history, 3, new Date().toISOString())`
i `nowX={Date.now()}`, podpis pod wykresem tłumaczy punkt zaczepienia + odstęp (liczony z
historii, nie na sztywno), legenda dostała szarą kreskę „dziś" obok fioletowej squasha.
7 nowych testów (4 istniejące bez zmian + 3 nowe), `npm test`/`npm run build` zielone.

---

### [ ] P5-3. Instrukcja wykonania ćwiczenia — animowany ludzik + kroki (domyślnie zwinięte)

**Czego chce Kamil:** przy każdym ćwiczeniu domyślnie schowana sekcja; po rozwinięciu widać,
**jak** się to ćwiczenie wykonuje (miniaturka ludzika / mini-filmik) + ewentualne uwagi i
kroki. Ma ratować sytuację „nie znam tego ćwiczenia" — np. po zamianie ćwiczenia (P1-3) albo
przy ćwiczeniu z rozszerzonej bazy (P3-8, 90 pozycji).

#### Analiza: dlaczego NIE filmik i NIE GIF (przeczytaj przed wyborem podejścia)

| Wariant | Rozmiar | Offline | Werdykt |
|---|---|---|---|
| GIF/WebP per ćwiczenie w bundlu (data-URI) | 30–80 KB × 90 = **3–7 MB** (dziś cały plik ma 368 KB) | tak | **Odrzucone** — 10–20× większy bundle, sekundy startu na LTE |
| Pliki w `docs/anim/` dociągane na żądanie | bundle bez zmian | **nie** (brak service workera, apka z ekranu głównego bez sieci = puste kadry) | Odrzucone — łamie „jeden plik" z §7 CLAUDE.md |
| Osadzony YouTube (`<iframe>`) | ~0 KB | nie | Odrzucone — wymaga sieci, ciasteczka/tracking, w PWA na iOS zachowuje się nieprzewidywalnie |
| **Animowany ludzik SVG (wektor, generowany z pozycji stawów)** | **~0,3 KB na wzorzec ruchu**, ~18 wzorców = ~6 KB | tak | **Rekomendacja** |
| Link „szukaj w YouTube" jako uzupełnienie | 0 KB | nie (ale to świadome wyjście z apki) | Opcjonalne, etap 3c |

Wektorowy ludzik wygrywa, bo jeden wzorzec ruchu (np. „wyciskanie leżąc") obsługuje **wszystkie**
warianty tego ruchu (sztanga, hantle, maszyna, skos) — 90 ćwiczeń mapuje się na ~18 wzorców.
Do tego rysunek jest w kolorach motywu, działa offline i nie ma problemów licencyjnych.

#### Model animacji (rdzeń — przeczytaj zanim zaczniesz kodować)

Ludzik z boku, `viewBox="0 0 120 120"`, zbudowany z **zagnieżdżonych grup obracanych wokół
stawów**. Każdy segment rysowany jest jako linia z `(0,0)` do `(0, len)` (czyli **w dół**), a
potem obracany: `rotate(a)`, gdzie dodatnie `a` = zgodnie z ruchem wskazówek zegara
(`a = 90` → segment celuje w lewo, `a = -90` → w prawo).

Hierarchia: `root(translate + rotate)` → `tors` → `[szyja+głowa]`, `[ramię → przedramię →
dłoń(+sprzęt)]`; `root` → `udo → podudzie → stopa`. Sprzęt jest **dzieckiem przedramienia**,
więc automatycznie jedzie za dłonią. W widoku z boku sztanga to po prostu **koło** (`<circle>`),
hantel — mały zaokrąglony prostokąt; nie trzeba rysować gryfu wzdłuż ekranu.

Animacja **bez JS** (kluczowe dla baterii i dla pułapki 2 z P4 — żadnego `requestAnimationFrame`
i żadnego animowania wewnątrz warstw z `backdrop-blur`): każdy staw dostaje dwie zmienne CSS
(kąt w pozie A i w pozie B) i **jedną wspólną klatkę kluczową**:

```css
@keyframes tt-joint { from { transform: rotate(var(--a)); } to { transform: rotate(var(--b)); } }
.tt-j { animation: tt-joint var(--dur, 2.4s) ease-in-out infinite alternate; transform-origin: 0 0; }
@keyframes tt-root { from { transform: translate(var(--ax), var(--ay)) rotate(var(--ar)); }
                     to   { transform: translate(var(--bx), var(--by)) rotate(var(--br)); } }
@media (prefers-reduced-motion: reduce) { .tt-j, .tt-root { animation: none; transform: rotate(var(--b)); } }
```
Wszystkie stawy mają ten sam czas trwania i `alternate`, więc ruch jest zsynchronizowany
(ekscentryka = ta sama animacja odtwarzana w tył). Kąty są **statyczne** — CSS interpoluje
tylko między dwiema rozwiniętymi wartościami, więc `var()` w `@keyframes` jest tu bezpieczne.

Typy (plik `src/lib/anim-poses.ts`, **bez importu Reacta** — pułapka 2):
```ts
export interface Pose {
  rootX: number; rootY: number; rootRot: number;   // biodro + obrót całej sylwetki (leżenie = 90)
  torso: number; neck: number;
  shoulder: number; elbow: number;
  hip: number; knee: number; ankle: number;
}
export type Load  = "none" | "barbell" | "dumbbell" | "cable" | "bar-back" | "bar-hip";
export type Decor = "floor" | "bench-flat" | "bench-incline" | "rack" | "pulley-high" | "pulley-low" | "mat";
export type MovePatternId =
  | "bench_press" | "incline_press" | "fly" | "dip" | "pushup"
  | "row_bent" | "pulldown" | "pullup" | "row_seated" | "shrug"
  | "squat" | "hinge" | "lunge" | "leg_press" | "leg_curl" | "calf_raise"
  | "press_overhead" | "lateral_raise" | "face_pull"
  | "curl" | "triceps_ext" | "crunch" | "plank";
export interface MovePattern {
  id: MovePatternId; label: string; load: Load; decor: Decor[];
  a: Pose; b: Pose; durationMs?: number;   // a = pozycja startowa, b = końcowa
}
export const MOVE_PATTERNS: Record<MovePatternId, MovePattern>;
```

Wzorzec referencyjny (skopiuj konwencję kątów, resztę dobierz w podglądzie na żywo):
```ts
bench_press: {
  id: "bench_press", label: "Wyciskanie leżąc", load: "barbell", decor: ["bench-flat", "floor"],
  // leżenie: cała sylwetka obrócona o 90°, ruch tylko w barku i łokciu
  a: { rootX: 46, rootY: 62, rootRot: 90, torso: 0, neck: -8, shoulder: -80, elbow: 75,  hip: 55, knee: -80, ankle: 20 },
  b: { rootX: 46, rootY: 62, rootRot: 90, torso: 0, neck: -8, shoulder: -95, elbow: 5,   hip: 55, knee: -80, ankle: 20 },
  durationMs: 2400,
}
```

#### Etap [x] P5-3a — silnik + 6 wzorców + wpięcie w Trening — WDROŻONE (27.07.2026)

**Pliki:** nowe `src/lib/anim-poses.ts`, `src/lib/guide.ts`, `src/components/ExerciseAnim.tsx`;
zmiany w `src/components/TrainScreen.tsx` (~1052-1085, wzorem P3-5) i `src/index.css` (keyframes).

1. `src/lib/guide.ts` (czysty, testowalny):
   ```ts
   export interface ExerciseGuide {
     pattern: MovePatternId;
     setup: string[];      // 1–2 zdania: ustawienie przed pierwszym powtórzeniem
     steps: string[];      // 3–5 kroków samego powtórzenia (koncentryka + ekscentryka)
     mistakes: string[];   // 2–3 typowe błędy ("czego NIE robić")
     safety?: string;      // tylko tam, gdzie realne ryzyko (martwy, przysiad, OHP)
   }
   export const GUIDES: Record<string, ExerciseGuide>;              // klucz = Exercise.id
   export function guideFor(ex: Exercise): ExerciseGuide | null;    // id → GUIDES, fallback → wzorzec z kategorii/partii
   ```
   `guideFor` musi mieć **fallback po `primaryMuscle` + `unit`** (mapa ~10 pozycji), żeby
   ćwiczenie dodane ręcznie przez Kamila też dostało sensowną animację; brak dopasowania →
   `null` → UI po prostu nie pokazuje przycisku (żadnych pustych paneli).
2. `src/components/ExerciseAnim.tsx` — `<ExerciseAnim pattern={id} size={96} />`. Renderuje
   szkielet wg modelu wyżej, ustawia zmienne CSS z `MOVE_PATTERNS[pattern].a/.b`, rysuje
   `decor` jako statyczne kształty **pod** ludzikiem, kolory z tokenów motywu
   (`stroke="currentColor"`, sprzęt akcentem `#38bdf8`), `aria-hidden` + `role="img"` z
   `aria-label={label}`.
3. W tym etapie wypełnij **6 wzorców** pokrywających plan z §6 CLAUDE.md: `bench_press`,
   `squat`, `hinge` (martwy/RDL), `row_bent`, `press_overhead`, `curl` — i wpisy `GUIDES` dla
   ćwiczeń z trzech dni planu + bonusu (~14 pozycji).
4. UI w `TrainScreen.tsx`: nowy stan `openGuide: Set<number>` + `toggleGuide(ei)`,
   **dokładnie wzorem `openPlates`** (`:141`, `:1052-1085`) — ten sam przycisk z
   `ChevronRight/ChevronDown`, `text-[11px] text-muted-foreground`, etykieta
   **„Jak wykonać?"**. Panel po rozwinięciu: animacja (96 px, po lewej) + po prawej kroki
   („Ustawienie" / „Ruch" / „Częste błędy"), `safety` na bursztynowo (`text-amber-300`),
   na dole `text-[10px]`: „Skrót techniczny — nie zastąpi trenera."
   Umieść blok **pod** miniaturką talerzy, nad listą serii. Domyślnie zwinięte **zawsze** —
   nie zapisuj stanu do `AppState` (żadnej migracji schematu w tym zadaniu).
5. Sprawdź, czy **tryb skupienia** (P3-6) renderuje tę samą kartę ćwiczenia — jeśli tak,
   sekcja pojawi się automatycznie; jeśli ma osobny render, dołóż ją i tam.

**Testy:** dla każdego `Exercise` z `SEED_EXERCISES` z wpisem w `GUIDES` → `guideFor` zwraca
obiekt, `MOVE_PATTERNS[guide.pattern]` istnieje, `steps.length >= 3`, `mistakes.length >= 2`.
Dodatkowo: `guideFor` na ćwiczeniu spoza `GUIDES` (np. sztucznym, `primaryMuscle: "Klatka"`)
zwraca fallback, nie `null`.

**Kryteria akceptacji:** w Treningu przy ćwiczeniu jest zwinięte „Jak wykonać?"; po rozwinięciu
ludzik płynnie powtarza ruch na iPhonie (sprawdź w podglądzie i na telefonie po deployu),
zwinięcie zatrzymuje animację (komponent odmontowany), `npm run build` rośnie o < 15 KB.

**Zweryfikowane:** `src/lib/anim-poses.ts` (6 wzorców: `bench_press`, `squat`, `hinge`,
`row_bent`, `press_overhead`, `curl` — celowo `Partial<Record<...>>`, nie pełny `Record`,
reszta ~16 wzorców dochodzi w 3b), `src/lib/guide.ts` (`GUIDES` dla 15 ćwiczeń z planu 3-dniowego,
`guideFor()` z fallbackiem po `primaryMuscle` dla Klatka/Plecy/Barki/Nogi/Pośladki/Tył uda/
Biceps/Triceps — Łydki i Brzuch świadomie bez fallbacku, czekają na `calf_raise`/`crunch`/`plank`
w 3b), `src/components/ExerciseAnim.tsx` (SVG bez JS, `.tt-j`/`.tt-root` keyframes w `index.css`,
`prefers-reduced-motion` honorowany), przycisk „Jak wykonać?" w `TrainScreen.tsx` wzorem
`openPlates`/P3-5 (stan lokalny, nie w `AppState`) — automatycznie widoczny w obu układach
loggera (list/focus), bo oba korzystają z jednej `renderExerciseCard`.
**Bug znaleziony i naprawiony podczas weryfikacji:** `.tt-root` nie miał `transform-origin: 0 0`
(domyślny bounding-box-center w SVG psuł pivot obrotu). **Ważniejsza poprawka:** pierwszy szkic
autorskich (nie-referencyjnych) 5 wzorców używał `rootRot: 180` dla pozycji stojących — to
poprawnie odwracało tors w górę, ale RÓWNIEŻ odwracało nogi w górę (ten sam obrót działa na obie
gałęzie). Poprawka: `rootRot: 0` dla wszystkich stojących wzorców, `torso` przesunięty o +180°
(nogi liczone od zera są już poprawne, ramiona nie wymagały zmian bo są dziećmi torsu). Kąty barku
w hinge/row_bent/press_overhead/curl też przeliczone tak, by ręka trzymała ciężar zgodnie z
kierunkiem ruchu (w dół przy wiszącej sztandze, w górę przy wyciskaniu nad głowę). Zweryfikowane
liczbowo przez `getCTM()` w przeglądarce (Playwright), nie tylko wzrokowo — każdy staw wypada w
sensownym kierunku dla wszystkich 6 wzorców w obu pozycjach (a/b). Rozmiar bundla: 368 KB → 380 KB
(+12 KB, w budżecie). 3 nowe testy `guideFor`/`MOVE_PATTERNS` w `tests/logic.test.ts`,
`npm test`/`npm run build` zielone.

#### Etap [ ] P5-3b — pełna baza: pozostałe wzorce + teksty do wszystkich 90 ćwiczeń

Uzupełnij `MOVE_PATTERNS` do pełnej listy z `MovePatternId` i `GUIDES` do **wszystkich**
ćwiczeń z `SEED_EXERCISES` (90 pozycji, `seed.ts:47-449`). Zasady dla tekstów:
- Po polsku, krótko, tryb rozkazujący, bez żargonu bez wyjaśnienia. 3–5 kroków, max ~12 słów
  na krok — to ma się czytać między seriami, na telefonie, na stojąco.
- **Nie powielaj `ex.note`** (cue trenera już wyświetlany, `TrainScreen.tsx:1021`) — instrukcja
  ma opisywać ruch, notatka zostaje osobno jako wskazówka „na ten tydzień".
- `safety` tylko tam, gdzie jest realne ryzyko (martwy ciąg, przysiad, OHP, wiosłowanie w
  opadzie, allahy z dużym ciężarem). Nie strasz przy wznosach bokiem.
- §11 CLAUDE.md (uczciwe framowanie) obowiązuje też tutaj: żadnych obietnic typu „to ćwiczenie
  najszybciej buduje klatkę".
- Budżet: 90 wpisów × ~250 B ≈ 22 KB źródła. Jeśli po buildzie `docs/index.html` przekracza
  **420 KB**, skróć teksty zamiast wycinać ćwiczenia.

Dołóż też `ExerciseAnim` **w Planie** (`PlanScreen.tsx`, okno edycji ćwiczenia) — przeglądanie
biblioteki poza siłownią to połowa wartości tej funkcji.

#### Etap [ ] P5-3c — (OPCJONALNE) link do filmiku

Nowe pole `Exercise.videoUrl?: string` (typ opcjonalny → **bez bumpa `SCHEMA_VERSION`**,
istniejące stany działają) + pole w oknie edycji ćwiczenia w Planie. W panelu „Jak wykonać?"
przycisk **„Obejrzyj filmik ↗"** (`target="_blank" rel="noreferrer"`), a gdy `videoUrl` puste —
**„Szukaj w YouTube ↗"** z linkiem `https://www.youtube.com/results?search_query=` +
`encodeURIComponent(ex.name + " technika")`. Świadomie **link, nie `<iframe>`**: zero KB, zero
trackerów w apce, działa też gdy Apple zmieni zasady osadzania. Minus do zaakceptowania:
z PWA na ekranie głównym otwiera się Safari (wyjście z apki) i wymaga internetu — dla
scenariusza „raz na kilka tygodni nie znam ćwiczenia" to uczciwy kompromis.

---

## P6 — zgłoszenia Kamila (sesja 27.07.2026, wieczór III — Opus 5)

Sześć zadań z jednej rozmowy + screena zakładki Progres. Trzy z nich (**P6-2**, **P6-3**,
**P6-5**) dotyczą tego samego komponentu (`RestTimer`) i **muszą iść w tej kolejności**,
bo P6-2 przebudowuje jego stan, a P6-3/P6-5 dokładają się do już przebudowanego.

**Kolejność wdrażania (zależności):** P6-6 (izolowany layout) → P6-2 (przebudowa timera) →
P6-3 → P6-5 → P6-4 → P6-1 (największe, osobne dwa etapy). Każde zadanie = osobny commit.

**Prompt dla Sonneta (kopiuj-wklej, jedno zadanie na raz):**
```
Wdróż zadanie P6-1 z POMYSLY.md. Trzymaj się sekcji "Zasady implementacji" oraz
"Wspólne pułapki P3/P4/P5/P6" (wszystkie nadal obowiązują). Po skończeniu odhacz
zadanie w POMYSLY.md, uruchom npm test + npm run build i zrób commit.
```

### Wspólne pułapki P6 (przeczytaj RAZ)

1. **`RestTimer` ma DWA warianty i DWA miejsca renderowania**: pigułka (`variant="pill"`,
   `TrainScreen.tsx:1396`, tryb listy) i panel (`variant="panel"`, `TrainScreen.tsx:1300`,
   tryb skupienia). Każda zmiana zachowania timera musi zostać sprawdzona **w obu układach**
   (przełącznik „Tryb skupienia" na ekranie wyboru dnia).
2. **Zmiana zakładki ODMONTOWUJE ekran.** `App.tsx:73-77` renderuje warunkowo
   (`{tab === "train" && <TrainScreen />}`) — nie ma `hidden`, nie ma routera. Każdy stan
   Reacta w `TrainScreen` (w tym `useState` w `RestTimer`) **ginie przy kliknięciu w Progres**
   i wraca do wartości początkowych. To nie jest domysł, to bezpośrednia przyczyna P6-2.
3. **`npm test` to czysty node przez esbuild — bez Reacta, bez DOM-u, bez `window`.**
   Nowy moduł w `src/lib/` jest bundlowany do testu w całości, więc **żadnego dotykania
   `localStorage`/`window` na poziomie modułu** (tylko w funkcjach, za `typeof window !== "undefined"`),
   inaczej `npm test` wysypie się przy imporcie.
4. **iOS: nie ma wibracji i nie ma powiadomień w tle** — patrz sekcja „Odrzucone". Nie
   próbuj tego naprawiać przez Web Push / Notification; P6-2 rozwiązuje realny problem
   (gubienie czasu), a nie ten nierozwiązywalny (dźwięk przy zgaszonym ekranie).
5. **Bundle: dziś ~368 KB** (`docs/index.html`). Limit z P5 zostaje: po P6 nie więcej niż
   **420 KB**. Sprawdź `ls -l docs/index.html` po buildzie i zapisz rozmiar w commicie.
6. Bez nowych zależności, ikony z `lucide-react`, teksty po polsku, mobile-first (sprawdź
   przy szerokości **320 px**, nie tylko 390).

---

### [ ] P6-1. Animowane ludziki pokazują NIE TEN ruch, co nazwa ćwiczenia

**Zgłoszenie Kamila:** „te ludziki pokazują głupoty, to nie są te ruchy co w nazwie
ćwiczenia. Są to randomowe ruchy nie pokazujące prawdziwego ćwiczenia."

**To są TRZY niezależne przyczyny naraz — napraw wszystkie, bo każda z osobna wystarczy,
żeby animacja wyglądała losowo.**

**Przyczyna 1 (bug, i to on daje efekt „losowości"): tułów animuje się w INNYM tempie niż
kończyny.** `ExerciseAnim.tsx:26-35` (`rootVars`) ustawia `--ax/--ay/--ar/--bx/--by/--br`,
ale **nie ustawia `--dur`**. `jointVars` (`:18-24`) ustawia `--dur` na każdym stawie osobno.
CSS `.tt-root` (`index.css:157-160`) czyta `animation: tt-root var(--dur, 2.4s)` — nie
dziedziczy niczego od dzieci, więc **root zawsze jedzie 2,4 s**, a stawy np. 2,6 s (przysiad),
2,0 s (wiosłowanie), 1,8 s (uginanie), 2,2 s (OHP). Dwie animacje o różnych okresach i
`alternate` rozjeżdżają się w fazie w sposób nieokresowy → biodra jadą w dół, gdy kolana się
prostują, ręka wyciska, gdy tors wraca. Dokładnie „randomowy ruch". Zgodne tylko
`bench_press` (2400 ms = fallback) — i tylko ono wygląda dziś sensownie.
**Fix:** przekaż `durationMs` również w `rootVars` (albo ustaw `--dur` raz na `<svg>`, a w
`jointVars` nie ustawiaj go wcale — czysto przez dziedziczenie). To jednolinijkowa poprawka
i ona ma iść PIERWSZA, przed jakimkolwiek strojeniem kątów.

**Przyczyna 2: mapowania-proxy w `guide.ts` świadomie pokazują inny ruch.** Etap P5-3a
zaimplementował 6 wzorców i podpiął pod nie ~17 ćwiczeń „na oko":
`incline_db → bench_press` (:47), `lunges → squat` (:69), `hipthrust → hinge` (:102),
`pulldown → row_bent` (:133), `lateral → press_overhead` (:154), `french → curl` (:184).
Wznosy bokiem **naprawdę** pokazują wyciskanie nad głowę, a francuz — uginanie bicepsa.
**Fix (zasada nadrzędna): lepiej BRAK animacji niż zła animacja.** Skasuj wszystkie proxy —
`pattern` zostaje tylko tam, gdzie wzorzec faktycznie odpowiada ruchowi. Zmień typ na
`pattern?: MovePatternId` i pokazuj `<ExerciseAnim>` tylko gdy jest; sekcja „Jak wykonać?"
z samym tekstem (kroki/błędy) zostaje i dalej ma sens.

**Przyczyna 3: fallback po partii mięśniowej rozlewa te 6 wzorców na ~90 ćwiczeń.**
`FALLBACK_PATTERN_BY_MUSCLE` (`guide.ts:203-212`) daje KAŻDEMU ćwiczeniu na triceps
wyciskanie leżąc, każdemu na plecy wiosłowanie w opadzie itd. Przy 90-pozycyjnej bazie
(P3-8) to jest maszyna do produkowania „głupot".
**Fix:** usuń `FALLBACK_PATTERN_BY_MUSCLE` całkowicie. Tekstowy `FALLBACK_GUIDE_TEXT`
(ogólne zasady wykonania) może zostać — ale bez animacji.

#### Etap A (najpierw, mały commit): naprawa + uczciwe mapowanie
1. Fix `--dur` (przyczyna 1).
2. `ExerciseGuide.pattern` → opcjonalny; wywal proxy i fallback po partii (przyczyny 2, 3).
   Po tym etapie animację mają TYLKO: `bench_bb`, `squat`, `deadlift`, `rdl`, `row_bb`,
   `row_db`, `ohp`, `curl_bb` (+ `bench_db` — ten sam ruch co `bench_bb`, tu proxy jest
   uczciwe, bo to dosłownie ta sama ścieżka ruchu innym sprzętem; ustaw `load: "dumbbell"`).
3. **Zweryfikuj te 9 wizualnie, nie „na oko w kodzie".** W repo jest Chromium + Playwright
   (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Zrób tymczasową stronę podglądu
   (`preview-anim.html` w rootcie, **nie commituj jej do `docs/`**), która renderuje wszystkie
   wzorce obok siebie w dwóch pozach (A i B, z `animation: none`), zrób screenshot i **obejrzyj
   go**. Poza A i poza B mają być rozpoznawalne jako początek i koniec danego ćwiczenia. Jeśli
   któraś nie jest — popraw kąty i powtórz. Bez tego kroku wracamy dokładnie tu, gdzie jesteśmy.
4. **Kill switch:** `Settings.showExerciseAnim?: boolean` (brak = `true`, więc bez bumpa
   `SCHEMA_VERSION` — pułapka 4 z P3) + przełącznik w „Więcej → Ustawienia": „Animacja
   ćwiczenia (ludzik)". Jeśli Kamilowi to nadal nie siada, wyłącza jednym kliknięciem i
   zostaje sam tekst. (Kontekst: P2-1 — heatmapa z ludzikiem — została wycofana z tego
   samego powodu. Escape hatch jest tani, brak escape hatcha kosztował już jedną funkcję.)

#### Etap B (osobny commit): dokończ wzorce, których naprawdę brakuje
Dopiero po zaakceptowaniu etapu A przez Kamila. Dorób i **wizualnie zweryfikuj** (ten sam
proces co wyżej, screenshot per wzorzec) pozostałe pozycje z `MovePatternId`, priorytetem
te, które są w planie i w dniu bonusowym: `lateral_raise`, `triceps_ext`, `pulldown`,
`calf_raise`, `crunch` (allahy), `plank`, `lunge`, `incline_press`, `face_pull`,
`hinge_hip` (hip thrust — to NIE jest hinge stojący, potrzebuje własnego wzorca z ławką).
Dopiero potem reszta (`fly`, `dip`, `pushup`, `pullup`, `row_seated`, `shrug`, `leg_press`,
`leg_curl`).

**Kryteria akceptacji:** (a) żadne ćwiczenie nie pokazuje animacji innego ruchu — albo
własny zweryfikowany wzorzec, albo nic; (b) tors i kończyny animują się zsynchronizowane
we WSZYSTKICH wzorcach; (c) screenshoty poz A/B każdego wzorca obejrzane przed commitem;
(d) przełącznik wyłączający animacje działa; (e) `npm test` + `npm run build` zielone,
bundle ≤ 420 KB.

---

### [ ] P6-2. Timer przerwy gubi czas przy zmianie zakładki i przy wyjściu z apki (NAJWAŻNIEJSZE)

**Zgłoszenie Kamila:** „Zatrzymuje się czas jak zmieniam kartę czy otwieram inną apkę […]
najbardziej właśnie to, że wygaszam ekran czy sprawdzam Messengera i licznik się zatrzymuje
podczas przerwy pomiędzy ćwiczeniami."

**To są dwa różne błędy z jednym źródłem: cały stan timera to `useState` w komponencie.**

- **Zmiana zakładki:** `App.tsx:73-77` renderuje ekrany warunkowo, więc wejście w Progres
  **odmontowuje `TrainScreen`**, a z nim `RestTimer` — `left`/`running` (`Gym.tsx:134-135`)
  przepadają. Po powrocie timer jest zresetowany do pełnej długości i zatrzymany. Czas nie
  „stoi" — on jest bezpowrotnie tracony.
- **Wyjście do innej apki / zgaszenie ekranu:** odliczanie stoi na `setInterval(…, 1000)`
  (`Gym.tsx:156-172`), który dekrementuje licznik o 1 na tick. iOS zawiesza timery JS
  w tle, więc po powrocie licznik pokazuje wartość sprzed wyjścia — apka „nie wie", że
  minęły 2 minuty.

**Fix — jedno źródło prawdy poza Reactem, liczone z zegara ściennego:**

1. **Nowy `src/lib/rest-timer.ts`** (czysty moduł, testowalny — pułapka 3):
   ```ts
   export interface RestTimerState {
     totalSec: number;
     endsAt: number | null;      // epoch ms; null = nie leci
     pausedLeftMs: number | null; // !== null = zapauzowany
     lastEndedAt: number | null;  // do komunikatu "skończona X temu"
   }
   export function remainingMs(s: RestTimerState, now: number): number;
   export function isRunning(s: RestTimerState): boolean;
   export function startState(totalSec: number, now: number): RestTimerState;
   export function pauseState(s, now), resumeState(s, now), resetState(s), stopState(s);
   ```
   Czas ZAWSZE liczony jako `endsAt - now`, nigdy przez dekrementację. Do tego cienka
   warstwa store (subskrypcja + `useSyncExternalStore`) i persystencja w `localStorage`
   pod `trening-app-rest-timer` — **cała za `typeof window !== "undefined"`**.
2. **Tick 250 ms** (nie 1000 — po powrocie z tła cyfra ma się poprawić natychmiast,
   a nie po sekundzie), uruchamiany tylko gdy timer leci. Do tego nasłuch
   `visibilitychange` + `pageshow` + `focus` → wymuszony przeliczenie ze świeżego `Date.now()`.
3. **`RestTimer` (`Gym.tsx:115+`) czyta ze store'u zamiast z `useState`.** `autostartKey`/
   `stopKey` znikają — `TrainScreen` woła bezpośrednio `restTimer.start(sec)` /
   `.stop()` (odpowiednio `updateSet` przy `done === true`, `TrainScreen.tsx:418-422`, i efekt
   przy zmianie ćwiczenia w trybie skupienia, `:310-316`).
4. **Pigułka widoczna na KAŻDEJ zakładce, dopóki przerwa leci.** Przenieś render pigułki
   z `TrainScreen.tsx:1392-1397` do `App.tsx` (obok `<Toaster>`), warunek: timer leci
   **lub** trwa draft treningu. Panel w trybie skupienia zostaje tam, gdzie jest.
   To jest bezpośrednia odpowiedź na „zmieniam kartę i tracę przerwę".
5. **Powrót po czasie:** jeśli przerwa skończyła się, gdy apka była w tle — po powrocie
   jeden `beep()` (gdy `settings.sound`), pigułka na zielono i tekst
   „Przerwa skończona X min temu" (tylko gdy < 10 min; powyżej po prostu wyzeruj).
   Uczciwie: **dźwięku przy zgaszonym ekranie nie da się dostarczyć** (patrz „Odrzucone" —
   brak SW i backendu pod Web Push). Naprawiamy to, że po powrocie czas jest PRAWDZIWY.
6. **(Opcjonalny spike, timebox 30 min, tylko jeśli 1-5 działa):** cichy, zapętlony bufor
   w tym samym `AudioContext` + `beep` zaplanowany na `ctx.currentTime + left` — bywa, że
   iOS utrzymuje sesję audio w tle i dźwięk jednak zagra. Jeśli nie działa na telefonie
   Kamila po pierwszej próbie — **wyrzuć kod i dopisz do „Odrzucone"**, nie drąż.

**Testy (`tests/logic.test.ts`):** `remainingMs` po „skoku zegara" o 5 min (symulacja tła)
= 0; pauza/wznowienie nie gubi i nie dodaje czasu; `startState` dwa razy pod rząd resetuje
do pełnej długości; stan odczytany z JSON-a (persystencja) daje ten sam wynik.

**Kryteria akceptacji:** (a) start przerwy → przejście na Progres i z powrotem → licznik
pokazuje realnie pozostały czas; (b) start przerwy → wyjście z PWA na 60 s → powrót:
licznik krótszy dokładnie o ~60 s (a nie o 0); (c) przerwa, która minęła w tle, po powrocie
jest zakończona z komunikatem, nie „zamrożona"; (d) pigułka widoczna na innych zakładkach
w trakcie przerwy; (e) oba układy loggera działają jak wcześniej.

---

### [ ] P6-3. Po zakończeniu treningu (i po ostatniej serii) timer nie ma czego odmierzać

**Zgłoszenie Kamila:** „Licznik na końcu jak zakończę trening po co? Już nie powinno
odmierzać czasu."

**Root cause:** `updateSet` (`TrainScreen.tsx:418-422`) startuje przerwę po **każdym**
zaznaczeniu serii — również po ostatniej serii ostatniego ćwiczenia, po której nie ma już
czego odpoczywać, tylko „Zakończ trening". Po P6-2 robi się to jeszcze bardziej widoczne,
bo timer przeżywa zmianę zakładki i zakończenie treningu.

**Fix:**
1. W `updateSet`: policz, czy po tym kliknięciu **wszystkie serie całego treningu** są
   zaliczone. Jeśli tak — **nie startuj przerwy** (i zatrzymaj trwającą). Zamiast pigułki
   pokaż w jej miejscu podpowiedź „Wszystko zrobione — zakończ trening".
2. W `finish()` (`TrainScreen.tsx:~540-589`) i w `cancel()` (`:591-593`) wywołaj
   `restTimer.stop()` — bezwarunkowo, na wejściu.
3. Na ekranie podsumowania (`TrainScreen.tsx:615+`) pigułka nie ma prawa się pojawić
   (po P6-2 pkt 4 warunek renderu w `App.tsx` musi to uwzględniać: brak draftu + timer
   zatrzymany = brak pigułki).

**Kryteria akceptacji:** zaznaczenie ostatniej serii ostatniego ćwiczenia nie odpala
odliczania; po „Zakończ trening" i po „Porzuć" nigdzie w apce nie widać lecącego timera;
przerwa uruchomiona ręcznie przyciskiem Start nadal działa normalnie.

---

### [ ] P6-4. Tryb skupienia: karta ćwiczenia znika za szybko (najbardziej w deloadzie)

**Zgłoszenie Kamila:** „Deload w widoku focus pokazuje się, ale szybko znika i przełącza
się na następną."

**Root cause:** auto-przejście do kolejnego ćwiczenia jest bezwarunkowym `setTimeout` na
**900 ms** po zaliczeniu ostatniej serii (`TrainScreen.tsx:445-452`). Nie da się go
anulować, nie ma żadnego sygnału, że zaraz nastąpi, i:
- w **deloadzie** serii jest o jedną mniej (`setsForMode`, `:110-113`) i **nie ma pytania
  o RIR** (`:1228` — warunek `draft.mode !== "deload"`), więc po ostatnim kliknięciu karta
  znika praktycznie natychmiast — dokładnie to, co Kamil opisuje;
- w sile/hipertrofii jest bug bliźniaczy, tylko mniej widoczny: pytanie „Ile zostało w baku
  (RIR)?" pojawia się dokładnie w tym samym momencie i **odjeżdża po 900 ms**, zanim da się
  odpowiedzieć. Autoregulacja z P4-4 jest w trybie skupienia praktycznie nie do wypełnienia.

**Fix — przejście świadome, nigdy niespodziewane:**
1. Wywal ślepy `setTimeout`. Po zaliczeniu ostatniej serii roboczej pokaż **w karcie**
   pasek: „Ćwiczenie zrobione" + duży przycisk **„Następne ćwiczenie ➜"**.
2. Jeśli tryb ≠ deload i RIR **nie jest jeszcze wybrany** — nie ma żadnego auto-przejścia,
   kropka. Wybór RIR (albo tap w „Następne") przechodzi dalej po ~600 ms.
3. Jeśli auto-przejście jednak leci (deload / RIR już wybrany), pokaż **widoczne odliczanie**
   („Następne za 3…2…1") z przyciskiem **„Zostań"**, a **każda interakcja z kartą**
   (scroll, tap w pole, +/-) je anuluje.
4. Wydłuż bazowe opóźnienie z 900 ms do **3 s**.

**Kryteria akceptacji:** w deloadzie po ostatniej serii karta zostaje na ekranie, dopóki
Kamil nie potwierdzi (albo nie minie widoczne odliczanie 3 s, które da się przerwać);
w sile pytanie o RIR da się spokojnie kliknąć w trybie skupienia; ręczna nawigacja
strzałkami/kropkami działa jak wcześniej.

---

### [ ] P6-5. „Zawsze 2:00" przed pierwszą serią — mimo że każde ćwiczenie ma własną przerwę

**Zgłoszenie Kamila:** „Włączam dany dzień i mam stały czas 2:00, i dopiero jak zrobię
ćwiczenie, to zaczyna lecieć poprawna przerwa. Po co to 2:00 zawsze? Widzę w ustawieniach
120 sekund przerwa, ale przecież różne ćwiczenia mają inne przerwy."

**Root cause (dwa, oba realne):**
1. `timerSeconds` startuje na `state.settings.restSeconds` (`TrainScreen.tsx:138`) i jest
   podmieniane na przerwę konkretnego ćwiczenia **dopiero** przy zaliczeniu serii (`:421`)
   albo przy zmianie ćwiczenia w trybie skupienia (`:314`). `startDay` wręcz **cofa** do
   globalnych 120 s (`:398`). W trybie listy przed pierwszym kliknięciem apka nie wie,
   „które ćwiczenie" — więc pokazuje wartość globalną. Wygląda to jak ustawienie sztywne,
   choć nim nie jest.
2. **Podejrzenie do zweryfikowania, prawdopodobne:** ćwiczenia w stanie Kamila mogą w ogóle
   nie mieć `restSeconds`. `mergeExerciseLibrary` (`seed.ts:643-650`) świadomie **nie dolewa
   pól z seeda** do ćwiczeń, które user już ma — a `restSeconds` doszło dopiero w commicie
   `8113617`/P0-3. Stan zapisany wcześniej ma te ćwiczenia **bez** `restSeconds`, więc każde
   z nich wpada na globalne 120 s i różnice per ćwiczenie nigdy nie działały.
   **Weryfikacja przed kodowaniem:** w apce → Plan → dowolne ćwiczenie → pole „Przerwa";
   jeśli pokazuje placeholder „domyślna (120 s)" zamiast konkretnej liczby — hipoteza
   potwierdzona.

**Fix:**
1. **Backfill (idempotentny, wzorem `historyTargetsSeeded` z BUG-1):** nowa flaga
   `AppState.restSecondsBackfilled?: boolean` + krok w `applyOneTimeSeeds` (`seed.ts:742-744`),
   który dla ćwiczeń o ID istniejącym w `SEED_EXERCISES` i **bez** własnego `restSeconds`
   kopiuje wartość z seeda. Nie dotyka ćwiczeń użytkownika spoza seeda ani tych, które już
   mają swoją wartość. `resetAll()` (`store.tsx`) ustawia flagę na `true`, jak pozostałe.
2. **Timer pokazuje przerwę ćwiczenia, przy którym jesteś** — również przed pierwszą serią:
   w trybie listy licz „bieżące ćwiczenie" jako **pierwsze z niezaliczoną serią** i z niego
   bierz `restSeconds`; ustaw to już w `startDay` (zamiast globalnych 120 s, `:398`).
3. **Pigułka w stanie spoczynku ma mówić, co pokazuje**: zamiast samego „2:00" —
   podpis `Przerwa: {nazwa skrócona ćwiczenia}` albo przynajmniej „gotowe: 2:00" innym
   kolorem niż odliczanie (dziś idle i running różnią się subtelnie).
4. **Etykieta w Ustawieniach** (`MoreScreen.tsx:496`): „Przerwa (s)" → „Domyślna przerwa (s)"
   + podpis „Używana tylko dla ćwiczeń bez własnej przerwy — te ustawisz w Planie".

**Kryteria akceptacji:** po wejściu w dzień timer pokazuje przerwę pierwszego ćwiczenia
(np. 3:00 przy przysiadzie, nie 2:00); po backfillu pole „Przerwa" w Planie ma konkretne
wartości dla ćwiczeń z seeda; ćwiczenia własne Kamila zostają nietknięte; `npm test` zielony
(dopisz test backfillu: brak pola → wartość z seeda, własna wartość → bez zmian, ćwiczenie
spoza seeda → bez zmian).

---

### [ ] P6-6. „(plan 9)" ucięte poza krawędź ekranu i nie wiadomo, co znaczy

**Zgłoszenie Kamila (zakreślone na screenie):** „co oznacza ten »plan« w nawiasie i dlaczego
jest taki sam jak te kolorowe cyfry (wykonane serie?)"

**Dwa problemy — jeden wizualny, jeden komunikacyjny.**

1. **Ucięty tekst.** Wiersz partii (`ProgressScreen.tsx:358-405`) to `flex justify-between`,
   gdzie lewy `<span>` ma `shrink-0`, a prawy nie może się zawinąć (jeden inline `<span>`
   z liczbą, zakresem i „(plan X, +Y)"). Przy dłuższej treści („Barki 10.5 / 5–12 (plan 10.5)")
   nie mieści się i wychodzi poza kartę — dokładnie to widać na screenie.
   **Fix:** prawa strona `min-w-0` + `text-right` + `flex-wrap` (albo: „(plan X)" jako
   osobna, mniejsza linia pod liczbą / obok paska postępu). **Sprawdź przy 320 px** dla
   najdłuższej etykiety („Bardzo wysoko" + partia „Tył uda" + wartości dwucyfrowe z połówką).
2. **Niejasne znaczenie.** P3-3 dodało „(plan X)" jako odpowiedź na wcześniejsze pytanie
   „czemu Plan i Wykonane są identyczne", ale sam nawias tego nie tłumaczy.
   **Fix:** w widoku „Wykonane (7 dni)" dopisz jedną linię legendy pod przełącznikami:
   „**Kolorowa liczba** = serie zrobione w ostatnich 7 dniach · **plan** = serie zaplanowane
   na tydzień. Równe wartości = zrobiłeś dokładnie to, co przewiduje plan."
   Krótko i uczciwie (§11) — bez straszenia, bez sugerowania, że to błąd.

**Kryteria akceptacji:** żadna wartość nie wychodzi poza kartę przy 320 px w obu widokach
(Plan / Wykonane) i obu metrykach (Serie / kg); legenda widoczna tylko w widoku „Wykonane";
liczby bez zmian (to zadanie NIE dotyka `logic.ts`).

---

## P6 — pomysły rozwojowe („level up", do decyzji Kamila)

Uszeregowane od największego zysku do najmniejszego. **Nic z tego nie wchodzi bez decyzji.**

### [ ] P6-7. Prawdziwy tryb offline (service worker) — REKOMENDACJA #1
**Problem, którego dziś nie widać, dopóki nie boli:** apka jest jednym plikiem z GitHub Pages,
ale **bez service workera**. Na siłowni w piwnicy, przy słabym LTE, Safari może po prostu nie
wczytać strony — a wtedy nie ma treningu (dane są lokalne, ale sam kod przychodzi z sieci).
Wake Lock i timer nie pomogą, jeśli apka się nie otworzy.
**Co zrobić:** `docs/sw.js` (~30 linii, cache-first dla `index.html`, aktualizacja w tle) +
rejestracja w `index.html`. **Koszt:** deliverable przestaje być dosłownie „jednym plikiem"
(§7 CLAUDE.md do poprawienia) i trzeba uważać na cache przy deployach (wersjonowana nazwa
cache'u, `skipWaiting`). **Zysk:** apka startuje bez internetu, natychmiast. Osobno warto
wiedzieć: SW to także jedyna droga, żeby kiedyś wrócić do tematu powiadomień — ale to nadal
wymaga serwera push, więc **nie** traktuj tego jako obietnicy.

### [ ] P6-8. Eksport historii do CSV — REKOMENDACJA #2
Jeden przycisk w „Więcej": `sessions` → plik CSV (data, dzień, ćwiczenie, seria, kg, powt.,
RIR, tonaż). ~40 linii, zero zależności, `Blob` + `<a download>`. Zysk: dane wychodzą z apki
do Excela/Numbers na dowolną analizę i są czytelne dla człowieka nawet za 5 lat, niezależnie
od tego, czy apka jeszcze istnieje. To najtańsze ubezpieczenie historii, jakie można dodać
(backup do Gista chroni przed utratą, ale zapisuje JSON pod format tej konkretnej wersji).

### [ ] P6-9. „Poprzednie 3 sesje" w karcie ćwiczenia — REKOMENDACJA #3
Dziś w loggerze jest „Ostatnio" (jedna sesja, P0-4). Trzy ostatnie w jednej linijce
(`62,5×8,8,7 · 60×8,8,8 · 60×8,7,7`) pokazują **kierunek**, a nie punkt — czyli dokładnie to,
czego potrzeba, żeby zdecydować „dokładam czy walczę o powtórzenia". Dane już są
(`lastByExercise`, `TrainScreen.tsx:177-191` — wystarczy zwrócić 3 zamiast 1), koszt to
jedna linia w UI, zero nowych mechanizmów.

### [ ] P6-10. Czas trwania treningu na żywo w nagłówku
Nagłówek loggera pokazuje serie i tonaż (`TrainScreen.tsx:1374-1376`), ale nie czas — a ten
jest liczony dopiero w podsumowaniu (`sessionDuration`). Po P6-2 masz już poprawny zegar
ścienny, więc „47 min" w nagłówku to ~10 linii. Uwaga: Kamil nie lubi liczników, które lecą
bez powodu (P6-3) — ten ma sens tylko w trakcie treningu i musi znikać razem z nim.

### [ ] P6-11. Tygodniowy „raport w jednej karcie" (dopięcie P4-7)
Cztery liczby (tonaż vs poprzedni tydzień, trafione dni, ćwiczenia w zastoju, saldo objętości
per partia) + JEDNA rekomendacja na następny tydzień. Spec leży gotowy w P4-7 — do rozważenia
dopiero po P6-1…P6-6, bo to nowy ekran, a nie naprawa istniejącego.

### Świadomie NIE rekomendowane (żeby nie wracać do tematu)
- **Powiadomienie o końcu przerwy w tle** — patrz „Odrzucone". P6-2 to maksimum możliwego
  bez serwera push.
- **Konto / sync w chmurze między urządzeniami** — Gist (P0-2) już to robi w 90%; reszta to
  backend i utrzymanie dla jednego użytkownika.
- **Zdjęcia/wideo techniki w apce** — rozwala budżet bundla (analiza w P5-3) i offline.
