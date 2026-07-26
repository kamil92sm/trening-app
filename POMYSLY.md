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

### [ ] P3-2. Plus/minus przy ciężarze w loggerze (szybka korekta wagi)

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

### [ ] P3-5. Rozwijana miniaturka sztangi (układ talerzy) przy każdym ćwiczeniu w loggerze

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

### [ ] P3-6. Tryb skupienia — jedno ćwiczenie na ekran (przełącznik na ekranie wyboru dnia)

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

### [ ] P3-8. Rozszerzona baza ćwiczeń (~70 pozycji) + poprawka migracji, która ją w ogóle wpuści

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
