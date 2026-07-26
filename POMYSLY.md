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

### [x] P2-1. Heatmapa mięśni (ludzik SVG) (2026-07-25; WYCOFANE 2026-07-26 na prośbę użytkownika — nie wracać)
**Weryfikacja Gemini:** fajny wizual, czysty frontend. **Spec:** nowy komponent
`MuscleMap.tsx`: uproszczona sylwetka przód/tył (własne SVG paths, ~10 regionów
zmapowanych na `Muscle`), fill wg `STATUS_COLORS[status]` z `weeklyMuscleVolume`.
Umieść nad listą w karcie Objętość; lista zostaje (dostępność). **Rozmiar:** M/L

### [ ] P2-2. Korelacja squash ↔ siła
**Weryfikacja Gemini:** ograniczona wartość naukowa przy n=1 i 1 meczu/tydz., ale tania:
**Spec:** `LineChart` += `markers?: number[]` (timestampy) — pionowe kreski;
w Progresie, dla wykresu ćwiczenia, pokaż kreski w dniach squasha ±1 dzień przed sesją.
Wniosek zostaw człowiekowi (bez automatycznych "%"). **Rozmiar:** S/M

### [x] P2-3. Paragon treningowy (obrazek do rolki) (2026-07-26; WYCOFANE 2026-07-26 wieczór na prośbę Kamila — patrz P2-6, nie wracać)
**Weryfikacja Gemini:** wykonalne BEZ html-to-image (nie dodawaj zależności!) —
rysuj ręcznie na `<canvas>` (1080×1350, ciemne tło, tonaż, czas, serie, rekordy,
progresje ↑). `canvas.toBlob` → `navigator.share({ files: [new File(...)] })`
(iOS 15+), fallback: link download. Guzik „Udostępnij" w podsumowaniu treningu.
**Rozmiar:** M
**WYCOFANE:** Kamil nie chce tej funkcji („nie jest mi potrzebna"). Usunięcie = zadanie P2-6.

### [ ] P2-4. Check-in gotowości (autoregulacja)
**Weryfikacja Gemini:** uczciwie — „szokowanie CUN" to bro-science, ale sama
autoregulacja (mniej serii przy słabym śnie/DOMS) jest zasadna. Wdrażamy lekko:
**Spec:** przy starcie dnia opcjonalny mini-panel (pomiń = brak kary): sen 1–5,
zakwasy 1–5. Jeśli sen ≤ 2 lub suma ≤ 4 → toast-sugestia: „Słaba regeneracja —
rozważ -1 serię w przysiadzie/MC, izolacje bez zmian". Zapisz odpowiedzi w
`Session` (+= `readiness?: {sleep:number; doms:number}`) — dane pod przyszłe analizy.
Bump wersji wg Zasad. **Rozmiar:** M

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

### [ ] P2-7. Losowanie dnia bonusowego pod niedotrenowaną partię/zestaw
**Pomysł Kamila (2026-07-26 wieczór):** „może losowanie bonusowego dnia na dany
zestaw/partię?" — zamiast jednego sztywnego składu bonusu, apka proponuje wariant pod partię,
która najbardziej kuleje.

**Status: POMYSŁ DO DOPRECYZOWANIA — NIE wdrażaj na ślepo.** Fable: kierunek sensowny, ale
„losowanie" i „pod partię" to dwa różne pomysły; przed kodem ustal z Kamilem, o który chodzi.
Dwie interpretacje:
- **(A) Deterministyczny dobór pod deficyt (rekomendowane):** policz `weeklyMuscleVolume`
  (`logic.ts`) z aktywnych dni, znajdź partie ze statusem `low`, i zaproponuj skład bonusu
  z ćwiczeń celujących w te partie (pula np. `SEED_EXERCISES` + user-owe, filtr po
  `primaryMuscle`). To NIE losowanie — to „bonus łata dziury", spójne z §11 (uczciwe
  framowanie) i z ideą P0-1 (bonus uzupełnia, nie dubluje).
- **(B) Losowy wariant dla urozmaicenia:** kilka gotowych „szablonów bonusu" (Ramiona / Nogi
  akcent / Core+tył) i przycisk „Wylosuj bonus na dziś" — mniej analityczne, bardziej dla
  odmiany. Ryzyko: kłóci się z podwójną progresją (progresja lubi powtarzalność ćwiczeń).

**Otwarte pytania do Kamila (zadać PRZED implementacją):**
1. Ma być pod deficyt (A) czy losowe dla odmiany (B)?
2. Ma nadpisywać stały skład dnia `bonus`, czy być jednorazową podpowiedzią „na dziś" w
   drafcie (jak „Użyj" w FEAT-1), bez ruszania planu i progresji?
3. Czy progresja ma podążać za wylosowanymi ćwiczeniami, czy bonus jest „poza progresją"
   (pump, cele nie rosną)?

**Szkic (dla wariantu A, gdy potwierdzony):** `logic.ts`: `suggestBonusExercises(state,
count=5): Exercise[]` — sortuj partie po `(actual - min)` rosnąco, wybierz ćwiczenia
pokrywające najsłabsze partie, unikaj dublowania ruchów z aktywnych dni. UI: w Treningu przy
dniu bonus przycisk „Dobierz pod słabe partie" → podmienia skład TYLKO w drafcie sesji
(nie w `state.days`), analogicznie do FEAT-1 „Użyj". Test w `tests/logic.test.ts`: przy
Łydki=`low` sugerowany skład zawiera ćwiczenie na łydki.
**Rozmiar:** M (po doprecyzowaniu)

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
