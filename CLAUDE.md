# CLAUDE.md — Aplikacja treningowa Kamila

Kontekst projektu do wznowienia pracy w dowolnej przyszłej sesji. Zawiera cel, stack,
model danych, kluczowe mechanizmy, dokładny plan treningowy, sposób budowania i wdrożenia
na iPhone oraz listę pomysłów na przyszłość. Wszystko po to, by dało się wrócić bez
odtwarzania rozmowy od zera.

---

## 1. Cel i idea

Osobista aplikacja treningowa (PWA, jeden plik HTML), która **zastępuje ręczne wklejanie
treningów do zewnętrznego czatu**. Sama liczy **podwójną progresję**: gdy wszystkie serie
robocze trafią w górny limit zakresu powtórzeń → dokłada ciężar i ustawia cel na następny
raz; w przeciwnym razie zostawia ciężar i każe walczyć o powtórzenia. Wykrywa też spadek
formy (sygnał deloadu). Do tego: historia, wykresy postępu, rekordy, licznik objętości
per partia, kalkulator talerzy, timer przerwy, waga ciała, log squasha, backup do pliku.

Jednostka to jeden trenujący (Kamil). Dane trzymane lokalnie w przeglądarce (localStorage),
bez backendu i bez kont.

---

## 2. Tech stack

- **React 19** + **TypeScript 5.7**
- **Vite 7** — dev server (`npm run dev`) ORAZ build pojedynczego pliku:
  `npm run build` = `tsc --noEmit` + `vite build` + `node scripts/singlefile.mjs`,
  który sklej dist/ w **jeden samodzielny `docs/index.html`** (serwowany przez GitHub Pages).
  **Parcel został wycofany** (a z nim gotcha z aliasem Radixa) — patrz §7.
- **Tailwind CSS 3.4** (+ `tailwindcss-animate`) — stylowanie
- **Własne lekkie komponenty UI** w `src/components/ui/*` (Button, Card, Input/Select,
  Switch, Dialog) — **bez Radix/shadcn**; mniej zależności, prostszy build. API wzorowane
  na shadcn, więc podmiana w przyszłości jest łatwa.
- **lucide-react** — ikony
- **Wykresy: autorskie SVG** (w `src/components/Charts.tsx`) — NIE recharts. Lekki
  `LineChart`, `BarChart`, `Sparkline` napisane ręcznie, zero zależności wykresowej.
- Alias ścieżek: `@/` → `src/` (tsconfig paths + alias w vite.config.ts)

Bez backendu, bez routera, bez zewnętrznego state managera — cały stan w jednym React
Context (`src/lib/store.tsx`).

---

## 3. Struktura plików

```
src/
├── App.tsx                    # Powłoka + dolna nawigacja (5 zakładek)
├── main.tsx                   # Bootstrap Reacta
├── index.css                  # Zmienne motywu (ciemny), tokeny kolorów
├── lib/
│   ├── types.ts               # Wszystkie typy (Exercise, WorkoutDay, Session, Muscle, AppState…)
│   ├── seed.ts                # Baza ćwiczeń, dni, cele startowe, wersja schematu, MIGRACJA
│   ├── logic.ts               # Silnik: progresja, e1RM, tonaż, OBJĘTOŚĆ per partia, talerze, formatery
│   └── store.tsx              # AppProvider + useStore: load/persist localStorage, wszystkie akcje
├── components/
│   ├── TrainScreen.tsx        # Wybór dnia + logger serii + podsumowanie po treningu
│   ├── ProgressScreen.tsx     # OBJĘTOŚĆ per partia + wykresy + tonaż tygodniowy + rekordy
│   ├── HistoryScreen.tsx      # Lista wykonanych treningów (rozwijalne) + Empty state
│   ├── PlanScreen.tsx         # Edytor dni (+ przełącznik dnia bonus) i bazy ćwiczeń
│   ├── MoreScreen.tsx         # Waga ciała, squash, kalkulator talerzy, ustawienia, backup
│   ├── Charts.tsx             # Autorskie wykresy SVG
│   ├── Gym.tsx                # PlateBar (wizualny kalkulator talerzy) + RestTimer
│   └── ui/                    # shadcn/ui (Radix)
└── hooks/use-toast.ts
```

---

## 4. Model danych (kluczowe typy — `src/lib/types.ts`)

- **`Exercise`**: `id, name, category, unit, perHand, isHold, repMin, repMax, targetSets,
  increment, rir, primaryMuscle?, secondaryMuscles?, note?, archived?, restSeconds?`
  - `unit`: `barbell | dumbbell | machine | cable | bodyweight`
  - `perHand`: dla hantli — ciężar liczony **na jedną rękę**, tonaż ×2
  - `isHold`: ćwiczenie na czas (plank) — `reps` oznaczają **sekundy**
  - `primaryMuscle` / `secondaryMuscles`: partie do licznika objętości (patrz §5.3)
  - `restSeconds?`: przerwa po serii tego ćwiczenia (brak = `settings.restSeconds`)
- **`Category`**: `Klatka, Plecy, Barki, Nogi, Pośladki, Łydki, Biceps, Triceps, Brzuch, Inne`
- **`Muscle`** (do objętości): `Klatka, Plecy, Barki, Nogi, Pośladki, Tył uda, Łydki, Biceps, Triceps, Brzuch`
- **`WorkoutDay`**: `id, name, short, exerciseIds[], optional?, active?, accent?`
  - `optional: true` = dzień bonusowy; `active` = czy włączony
- **`SetLog`**: `weight, reps, done`
- **`ExerciseLog`**: `exerciseId, targetWeight, sets[], note?`
- **`Session`**: `id, dayId, date(ISO), entries[], completed, mode?` — `mode?`: cel tygodnia
  (`"strength" | "hypertrophy"`), w którym zalogowano trening; brak = `"strength"` (patrz §5.7)
- **`BodyEntry`**: `date(YYYY-MM-DD), weight, waist?` — `waist` (cm) do wykresu rekompozycji
- **`AppState`**: `version, exercises[], days[], targets(exId→kg), hyperTargets?(exId→kg), sessions[], body[], squash[], settings, historySeeded?, historyTargetsSeeded?`
  - `settings`: `name, barWeight, plates[], restSeconds, sound, gistToken?, gistId?, autoBackup?, lastBackup?, gymProfiles?, activeGymProfileId?, volumeGoal?, trainingMode?`
  - `historySeeded?`: flaga jednorazowego dosiewu historii startowej (`history-seed.ts`)
  - `historyTargetsSeeded?`: flaga jednorazowego doganiania `targets` do progresji z historii
    sesji (`seed.ts: catchUpTargetsFromHistory`) — patrz §12 BUG-1
  - `hyperTargets?`: cele trybu hipertrofii, OSOBNE od `targets` (siła) — patrz §5.7

**localStorage key: `trening-app-v2`.** Schemat wersjonowany przez `SCHEMA_VERSION` (aktualnie **5**).
Wersje po 2: v3 = bonus 2.0 + zachowanie `targets` w migracji; v4 = `BodyEntry.waist`;
v5 = historia startowa (`src/lib/history-seed.ts`, dosiew przez `historySeeded`).
Nowsze mechanizmy nieopisane szczegółowo niżej: przerwa per ćwiczenie (`restSeconds`),
auto-backup do Gista (`src/lib/backup.ts`), paragon treningowy (`src/lib/receipt.ts`),
edycja sesji w Historii (`store.updateSession`), plateau breaker (`logic.detectPlateau`).

---

## 5. Kluczowe mechanizmy

### 5.1 Podwójna progresja — `computeProgression()` (logic.ts)
- Ciężar rośnie o `increment` dopiero, gdy **wszystkie** serie robocze (`targetSets`) osiągną
  `repMax`. Wtedy `nextWeight = current + increment` i wracasz do dołu zakresu.
- Jeśli **≥2 serie poniżej `repMin`** → sygnał „odbuduj powtórzenia" (deload), ciężar zostaje.
- Dla `isHold` (plank): próg to sekundy (`repMax`), progresja dokłada obciążenie.
- Progresja stosowana automatycznie przy `finishSession()` → aktualizuje `targets`.

### 5.2 Tonaż — `setVolume()/entryVolume()/sessionVolume()`
- `weight × reps × (perHand ? 2 : 1)`; `isHold` i serie niezaznaczone = 0.
- e1RM: **Epley** (`weight × (1 + reps/30)`), 1 powt. = ciężar.

### 5.3 Objętość tygodniowa per partia — `weeklyMuscleVolume()` (logic.ts)
- Metryka = **serie robocze / tydzień**. Partia główna = **1** seria, wspomagająca = **½**.
- Liczy z **aktywnych dni** (dzień `optional` tylko gdy `active`), każdy dzień = 1×/tydzień.
- Zakresy `MUSCLE_RANGES` (min–max serii): duże partie 10–20, małe 8–16.
- Status: `low` (bursztyn) / `ok` (zielony) / `high` (niebieski) / `veryhigh` (czerwony).
- Ćwiczenia użytkownika bez `primaryMuscle` dostają partię z kategorii przy zapisie.
- UI: karta na górze zakładki **Progres**; działa nawet bez zalogowanych treningów.

### 5.4 Dzień bonusowy (opcjonalny)
- W seedzie dzień `id: "bonus"`, `optional: true`, `active: false`.
- Przełącznik w **Plan → Dni treningowe** (fioletowy suwak) oraz skrót w **Progres**
  (`setDayActive(id, active)` w store).
- Wyłączony: nie widać go w Treningu i nie liczy się do objętości.

### 5.5 Migracja danych — `migrateState()` (seed.ts)
- Przy wczytaniu, jeśli `version !== SCHEMA_VERSION` **lub** znaleziono stary klucz
  `trening-app-v1`: podmienia **plan** (exercises/days/targets) na aktualny seed, ale
  **zachowuje** `sessions`, `body`, `squash`, `settings`. Chroni historię przy poprawkach planu.

### 5.6 Kalkulator talerzy — `platePlan(target, bar, plates)`
- Zwraca układ talerzy **na jedną stronę** + `ok`/leftover. Wizualizacja w `Gym.tsx` (`PlateBar`).

### 5.7 Tryb treningu: Siła / Hipertrofia / Deload (logic.ts, POMYSLY.md P0-5, P2-8)
- Przełącznik na ekranie wyboru dnia (Trening) — cel tygodnia, `settings.trainingMode`
  (`"strength" | "hypertrophy" | "deload"`, brak = `"strength"`), przełączalny w dowolnym momencie.
- **Plan (seed.ts) to źródło prawdy trybu siłowego — nietykalne.** Hipertrofia jest widokiem
  POCHODNYM liczonym w locie: `exerciseForMode(ex, mode)` — w hipertrofii podnosi zakres
  ciężkich ćwiczeń (bazowy `repMax ≤ 8`) do 8–12 powt. i RIR 2→1; ćwiczenia już w zakresie
  8+ dostają tylko RIR 1 (zakres bez zmian); `isHold` (plank) bez zmian; **wyjątek
  bezpieczeństwa: martwy ciąg klasyczny** zostaje na 6–8 powt./RIR 2 (nie schodzi na wysokie
  powtórzenia blisko upadku). `targetSets`/`increment`/`restSeconds` NIGDY nie zmieniane.
- Cel hipertrofii liczy `hyperTargetFor()`: jeśli zakres się nie zmienia → ten sam cel co
  siła; inaczej konwersja przez odwrócony Epley (`weightForReps()`) z e1RM ostatniej sesji
  (fallback: z bieżącego celu siłowego, gdy brak historii), zaokrąglona do `increment`.
  Wypracowana progresja hipertrofii cache'owana w `state.hyperTargets` (ma pierwszeństwo).
- `store.finishSession` liczy `computeProgression` na `exerciseForMode(ex, mode)` i zapisuje
  wynik do `targets` (siła) albo `hyperTargets` (hipertrofia) — **tryby nie psują sobie
  progresji nawzajem**, można przełączać się tydzień w tydzień.
- Podstawa naukowa (meta-analizy Robinson/Pelland/Schoenfeld/Currier/Grgic) i pełne
  uzasadnienie każdej decyzji: `POMYSLY.md` sekcja P0-5.
- **Deload** (trzeci tryb, P2-8) — też POCHODNY z planu siłowego, odpoczynek od obu pozostałych
  trybów: `exerciseForMode(ex, "deload")` zostawia zakres powtórzeń bez zmian, `rir: ex.rir + 2`.
  **Tnie OBJĘTOŚĆ, nie intensywność** (zmiana 07.08.2026, §18): `deloadTargetFor()` = 90%
  (`DELOAD_LOAD_FACTOR`) ZAWSZE celu siłowego (`targets`, nigdy hipertrofii), zaokrąglone do
  `increment`; `deloadSets(planned)` = połowa serii dnia w zaokrągleniu, min. 1 (3→2, 2→1).
  Wcześniej było odwrotnie (65% ciężaru, −1 seria) — patrz uzasadnienie w §18. **Progresja WYŁĄCZONA:** `finishSession` przy `mode==="deload"` nie
  zapisuje ani `targets`, ani `hyperTargets` — cele zamrożone, podsumowanie pokazuje jeden
  komunikat zamiast per-ćwiczeniowych kart progresji. `weeksSinceDeload()` + `detectPlateau`
  (≥3 ćwiczenia) napędzają bursztynowy nudge na ekranie wyboru dnia — sugestia, nie automat.

### 5.8 Prawdziwy offline — service worker (Etap 3, P6-7)
- `docs/sw.js` generowany PRZY KAŻDYM buildzie (`scripts/singlefile.mjs` z szablonu
  `scripts/sw-template.js`) — nazwa cache'u to hash treści zbudowanego `index.html`,
  więc nie trzeba pamiętać o ręcznym bumpie wersji przy deployu.
- Cache-first dla nawigacji (GET, `mode: "navigate"`) TEGO originu — offline/na słabym
  LTE apka wystartuje z cache'u natychmiast; sieć w tle odświeża cache pod kolejne
  wejście. Świadomie NIE dotyka zapytań do `api.github.com` (backup) ani żadnych
  innych zapytań spoza originu/metody GET — te zawsze idą normalnie do sieci.
  localStorage i draft treningu żyją poza Service Workerem, bez zmian.
  `skipWaiting()` + `clients.claim()` + kasowanie starych nazw cache w `activate` —
  aktualizacja nie wymaga ręcznego czyszczenia danych Safari.
- Rejestrowany tylko w buildzie produkcyjnym (`src/main.tsx`,
  `import.meta.env.PROD`), ścieżka względna `./sw.js` (apka żyje w podkatalogu
  GitHub Pages: `kamil92sm.github.io/trening-app/`, nie w katalogu głównym domeny).

---

## 6. Plan treningowy (źródło prawdy — seed.ts)

Ciężary = „na ten tydzień". Hantle podane jako ciężar na jedną rękę (2× = para).

**Pogrubienia = dosiew objętości z 07.08.2026 (wariant B, §19)** — serie liczone PER DZIEŃ
przez `WorkoutDay.setsOverride`, więc `Exercise.targetSets` w bazie ćwiczeń zostaje bez zmian.

**Nazwy dni (Zadanie 3, 28.07.2026): neutralna rotacja, nie sztywny kalendarz.**
Apka pokazuje „Trening 1 / Trening 2 / Trening 3" (`SEED_DAYS[i].name`), NIE
„Poniedziałek/Środa/Piątek" — nazwy dni sugerowały obowiązkowy kalendarz, którego
apka nie wymaga i nie egzekwuje (`nextDaySuggestion()` to tylko podpowiedź
rotacji, nie blokada). Nagłówki niżej (PONIEDZIAŁEK/ŚRODA/PIĄTEK) zostają jako
opis dla CZYTELNIKA tego dokumentu — to zwyczajowy rytm Kamila (trening co drugi
dzień roboczy), a nie nazwa, którą zobaczy w UI. **`id` dni (`mon`/`wed`/`fri`/
`bonus`) BEZ ZMIAN** — historia/rotacja/cele są z nimi powiązane przez `dayId`.

### PONIEDZIAŁEK ("Trening 1" w apce) — Góra + Pośladki
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Wyciskanie sztangi płasko | 3×5–8 | 45 kg |
| 2 | Hip Thrust ze sztangą | 3×8–12 | 57,5 kg |
| 3 | Wiosłowanie sztangą | 3×6–8 | 60 kg |
| 4 | Wznosy bokiem hantli | 3×12–15 | 2×9 kg |
| 5 | Uginanie bicepsa (sztanga) | **3**×10–12 | 17,5 kg |
| 6 | Allahy (brzuch) | 3×10–15 | 37,5 kg |

### ŚRODA ("Trening 2" w apce) — Ciężki Dół + Klatka Skos
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Przysiad ze sztangą | 3×5–8 | 65 kg |
| 2 | Martwy ciąg klasyczny | 2×5–6 | 77,5 kg |
| 3 | **Suwnica (wypychanie nogami)** | 3×10–12 | 120 kg |
| 4 | Wyciskanie hantli skos | 3×8–12 | 2×16 kg |
| 5 | Zakroki z hantlami | 3×10–12 | 2×14 kg |
| 6 | Wspięcia na palce | **4**×10–15 | 45 kg |
| 7 | Plank (deska) | 4×40 s | +10 kg |

### PIĄTEK ("Trening 3" w apce) — Góra II + Tył Ud
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Wyciskanie żołnierskie (OHP) | 3×6–8 | 32,5 kg |
| 2 | Ściąganie drążka | 3×8–10 | 50 kg |
| 3 | RDL z hantlami | 3×8–12 | 2×22,5 kg |
| 4 | Wyciskanie hantli płasko | 3×8–12 | 2×17,5 kg |
| 5 | Wiosłowanie hantlem | 2×10–12 | 20 kg |
| 6 | Francuz (triceps) | **3**×10–12 | 22,5 kg |

### BONUS (opcjonalny) — Uzupełnienie: tył barków, ramiona, łydki, core
Face pull (wyciąg) 3×12–15 · Uginanie młotkowe hantli 2×10–12 ·
Prostowanie ramion na wyciągu 2×10–12 · Wspięcia na palce siedząc 3×12–20 ·
Plank bokiem 3×30 s.
Cel: dobić partie niedotrenowane w planie 3-dniowym (tył barków, ramiona, łydki, core).

**Bonus NIE dzieli ani jednej pozycji z dniami głównymi** — celowo, to osobne
warianty ćwiczeń (młotkowe zamiast sztangi, wyciąg zamiast francuza, plank bokiem
zamiast allahów). Wcześniejsza wersja tej sekcji opisywała stary skład
(wznosy bokiem / uginanie sztangą / francuz / wspięcia / allahy / wiosłowanie
hantlem), który pokrywał się z planem głównym — nieaktualne od czasu rozbudowy
bazy ćwiczeń (P3-8), poprawione 07.08.2026.

---

## 7. Budowanie (lokalnie na Windows, komputer Kamila)

Źródła żyją w `C:\Users\kamil\OneDrive\Desktop\Aplikacja treningowa` (repo git).

```bash
npm install           # jednorazowo
npm run dev           # Vite dev server (podgląd na żywo)
npm run build         # tsc --noEmit + vite build + scripts/singlefile.mjs
```

`npm run build` produkuje deliverable jako **`docs/index.html`** (samodzielny plik,
~390 KB, wszystko inline: JS/CSS) **+ `docs/sw.js`** (Etap 3: service worker do
prawdziwego trybu offline — od tej sesji apka to już nie dosłownie "jeden plik", tylko
te dwa razem). Jak to działa:

1. **PWA head jest w źródłowym `index.html`** (root projektu) — meta Apple
   (`apple-mobile-web-app-capable`, `apple-mobile-web-app-title=Trening`, status-bar,
   `viewport-fit=cover`), ikona `apple-touch-icon` (sztanga, data-URI PNG) i manifest
   data-URI. Vite przenosi ten head do buildu bez zmian — nic nie trzeba dostrzykiwać.
2. **`scripts/singlefile.mjs`** bierze `dist/index.html` i inline'uje do niego JS i CSS
   (z escapem `</script>` w stringach), wynik zapisuje do `docs/index.html`. Ten sam
   skrypt liczy hash TREŚCI zbudowanego HTML i generuje `docs/sw.js` z
   `scripts/sw-template.js`, wstawiając hash jako wersję cache'u (`CACHE_NAME`) —
   każdy build z inną zawartością dostaje więc automatycznie nową nazwę cache'u.
3. **Service worker (`docs/sw.js`, §5.8)** cache'uje `index.html` (cache-first dla
   nawigacji tego originu), rejestrowany tylko w buildzie produkcyjnym
   (`src/main.tsx`, `import.meta.env.PROD`) pod ścieżką względną `./sw.js` (apka żyje
   w podkatalogu GitHub Pages, nie w katalogu głównym domeny).
4. `docs/` jest w gicie (to folder publikacji GitHub Pages), `dist/` w `.gitignore`.

Deploy = `npm run build` → commit (`docs/index.html` I `docs/sw.js` razem) → `git push`.
Pages aktualizuje się w 1–2 min.

---

## 8. Wdrożenie na iPhone (trwały zapis)

- Apka **dodana do ekranu głównego iOS NIE podlega 7-dniowemu kasowaniu danych** (oficjalne
  stanowisko WebKit). Przy regularnym używaniu (3×/tydz.) dane siedzą bezpiecznie.
- **Wdrożone (lipiec 2026):** repo **`kamil92sm/trening-app`** na GitHubie, Pages serwuje
  folder **`/docs`** z brancha `main`. Stały adres:
  **`https://kamil92sm.github.io/trening-app/`**
  → otwarte w Safari → Udostępnij → **Dodaj do ekranu początkowego**.
- **Dane są przypięte do adresu URL** (localStorage per origin). Zmiana adresu = apka pod
  nowym adresem widzi „pusto". Dlatego jeden stały adres + regularny **backup** (zakładka Więcej).

### Ograniczenia iOS / storage
- localStorage per origin; brak współdzielenia między `file://` a wersją z ekranu głównego.
- Limit ~50 MB (bez znaczenia — apka waży ~0,45 MB).
- Poza ekranem głównym: 7-dniowy limit script-writable storage → dane mogą zniknąć.

---

## 9. Testy (uruchamiane ad hoc w środowisku)

Silnik testowany bez przeglądarki przez esbuild→node (czysta logika):
- Progresja: 3×10 → +2,5 kg; 10/8/8 → brak; 2× poniżej min → deload; plank na czas → +obciążenie.
- Tonaż hantli ×2, e1RM Epley, kalkulator talerzy (składalne/nieskładalne).
- Objętość: Klatka 9 serii (3 dni), wzrost przy włączeniu bonusu (Łydki 3→6 itd.), statusy.
- Migracja: nowy plan + zachowane sesje/waga/squash/ustawienia, `version=2`.

Weryfikacja runtime = udany build (`tsc --noEmit` + Vite) + testy logiki + podgląd
`docs/index.html` w przeglądarce.

---

## 10. Znane ograniczenia i pomysły na przyszłość

Zrealizowane w tej sesji:
- ✅ Plan przepisany 1:1 ze screenów (3 dni + uwagi trenera jako cue).
- ✅ Dzień 4 (BONUS) — opcjonalny, włączany suwakiem.
- ✅ Licznik objętości per partia / tydzień (serie robocze, z zakresami i statusem).
- ✅ PWA meta + ikona, instrukcja wdrożenia na iPhone.
- ✅ Migracja chroniąca historię.

Otwarte pomysły (nie zrobione):
- [ ] Druga metryka objętości w **tonażu (kg/tydzień)** obok serii (funkcja liczy już `tonnage`).
- [ ] Edytowalne zakresy `MUSCLE_RANGES` per partia z poziomu UI.
- [ ] Auto-deload / auto-eksport (przypomnienie o backupie co X treningów).
- [ ] Plan na 4. dzień jako pełnoprawny wariant (nie tylko pump).
- [ ] Edycja `primaryMuscle`/`secondaryMuscles` w oknie ćwiczenia (dziś auto z kategorii).
- [ ] Historia jest lokalna — rozważyć eksport/synchro (np. plik + import na innym urządzeniu).

---

## 11. Konwencje / preferencje

- Interfejs i teksty **po polsku**, ciemny motyw, mobile-first (max-w-xl).
- Hantle: ciężar **na jedną rękę**, tonaż ×2.
- Uczciwe framowanie — bez zawyżania. Objętość „poniżej optimum" pokazywana wprost jako
  naturalny efekt planu pod siłę, nie jako błąd.
- Źródła żyją **lokalnie na komputerze Kamila** w tym folderze (repo git, push do
  `kamil92sm/trening-app`). Stary artefakt `trening-app.html` w root to zamrożona kopia
  pierwszej wersji — deliverable to `docs/index.html` z builda.
- Seed (ID ćwiczeń, dni, cele) został odtworzony **1:1 z oryginalnego bundla** — ID muszą
  zostać stabilne, bo historia w localStorage odwołuje się do nich.

---

## 12. Backlog — zgłoszenia Kamila (sesja 26.07.2026)

Sześć spraw ze screenów. Każda ma: **root cause**, **plik/linię**, **co zrobić**. Opisane
tak, by dało się naprawiać od zera z Sonnetem bez ponownej analizy.

### BUG-1 — ✅ NAPRAWIONE (26.07.2026) — Cele nie zaprogresowały mimo trafionego górnego zakresu (Wiosłowanie 60×8×8×8, Martwy 77,5×7×7)
- **To NIE jest błąd `computeProgression`.** Reguła podwójnej progresji działa poprawnie
  (`src/lib/logic.ts:129`). Problem: **historia startowa jest wstrzykiwana bezpośrednio jako
  `Session[]`** (`src/lib/history-seed.ts`) i **nigdy nie przechodzi przez `finishSession()`**
  (`src/lib/store.tsx:112`), a tylko `finishSession` przelicza progresję i zapisuje
  `d.targets[id] = nextWeight` (`store.tsx:120,126`). Dlatego `Ostatnio` pokazuje dane z
  dosiewu (np. `row_bb` 60×8×8×8 z `hist-w4-mon`), ale `targets["row_bb"]` = wartość z seeda (60).
- **Efekt dla Kamila:** pierwszy REALNY trening zakończony w apce policzy progresję normalnie
  (Wiosłowanie 3×8 → 62,5; Martwy 7≥6 → 80). Czyli apka „dogoni się" po pierwszym prawdziwym
  zapisie. Ale wizualnie teraz wygląda na zacięte.
- **Decyzja Kamila:** opcja (A), BEZ WYJĄTKU dla martwego ciągu — potraktować wszystkie ćwiczenia
  identycznie (77,5×7×7 przy `repMax=6` liczy się jak każde inne trafienie górnego zakresu → bump).
- **Fix wdrożony:** nowa funkcja `catchUpTargetsFromHistory()` w `src/lib/seed.ts` — dla każdego
  ćwiczenia znajduje najświeższą ukończoną sesję z zaliczoną serią, liczy `computeProgression()`
  na jej `targetWeight`/`sets` i **podnosi** `targets[id]` TYLKO gdy wynik jest WYŻSZY niż obecny
  cel (nigdy nie obniża — chroni ręcznie skalibrowane cele, np. `bench_db` zostaje na 17,5 kg mimo
  że czysta progresja z kroku 2 kg dałaby 17). Uruchamiane jednorazowo przez nową flagę
  `historyTargetsSeeded` (types.ts) w `applyOneTimeSeeds()` (`seedHistoryOnce` + `catchUpTargetsOnce`),
  podpięte we wszystkich trzech ścieżkach `migrateState()` — działa więc też dla Kamila na telefonie
  (stan już ma `historySeeded=true`, ale `historyTargetsSeeded` jest nowe i jeszcze nie ustawione,
  więc doliczy się przy pierwszym wczytaniu po aktualizacji). `resetAll()` w `store.tsx` ustawia obie
  flagi na `true`, żeby „Wyzeruj wszystko" nie doliczyło celów z historii, której już nie ma.
- **Zweryfikowane** (świeży stan, `sessionCount=9` po dosiewie historii):
  `row_bb: 60→62,5`, `deadlift: 77,5→80`, `bench_db: 17,5` (bez zmian — ochrona przed obniżką),
  `bench_bb/hipthrust/rdl/plank/curl_bb/squat/ohp`: bez zmian (już zgodne). Potwierdzone też w UI
  (ekran Trening → Środa → „Martwy ciąg klasyczny … cel 80 kg").

### BUG-2 — ✅ NAPRAWIONE (26.07.2026) — Pole „Przyrost (kg)" (i „Cel") nie da się wyczyścić / wpisać przecinka
- **Root cause:** inputy są `type="number"` sterowane liczbą z `parseFloat(e.target.value) || 0`.
  Skasowanie pola → `parseFloat("") = NaN` → `|| 0` → wskakuje `0`, którego nie da się usunąć;
  przecinek w `type=number` bywa odrzucany, a `parseFloat` i tak czyta tylko kropkę.
- **Pliki/linie:** `src/components/PlanScreen.tsx:322-326` (Cel) i `:330-339` (Przyrost);
  ten sam antywzorzec jest też w polach serie/powt./RIR (`:290-316,343+`).
- **Fix wdrożony:** nowy komponent `NumberField` w `src/components/PlanScreen.tsx` — trzyma
  lokalny surowy string (`type="text" inputMode="decimal|numeric"`), pozwala na pusty string
  i przecinek podczas pisania, parsuje (`parseNum`, obsługuje przecinek i kropkę) i commituje
  liczbę do stanu na każdy poprawny keystroke; przy `onBlur` pustą/niepoprawną wartość zamienia
  na `fallback`. Podmienione pola: Serie, Powt. min, Powt. max, Cel, Przyrost, RIR. Zweryfikowane
  end-to-end w przeglądarce (wyczyszczenie → wpisanie z przecinkiem → zapis → ponowne otwarcie).

### FEAT-1 — ✅ WDROŻONE — MVP (26.07.2026) — „Tryb innej siłowni": przelicz cele wg dostępnych obciążeń
- **Czego chciał Kamil:** wchodzi na obcą siłownię (inne hantle/talerze), wpisuje dostępny sprzęt,
  a apka przelicza cel na dziś do najbliższej realizowalnej wartości; profil ma zostać na stałe,
  bo może tam wracać.
- **Model danych:** nowy typ `GymProfile` (`types.ts`) — `{ id, name, barWeight, plates[], weightStep? }`.
  `Settings.gymProfiles?: GymProfile[]` (lista dodatkowych siłowni) + `Settings.activeGymProfileId?`
  (który jest aktywny; brak = siłownia domowa czyli `settings.barWeight/plates`).
- **Logika (`logic.ts`):**
  - `achievableWeights(bar, plates)` — wszystkie osiągalne ciężary całkowite (subset-sum talerzy ×2
    strony + gryf), dokładne (nie heurystyka).
  - `nearestAchievable(target, bar, plates)` — najbliższy z powyższej listy; remis rozstrzyga na
    korzyść mniejszej wartości.
  - `snapToStep(target, step)` — zaokrąglenie do wielokrotności kroku (sprzęt bez talerzy: hantle/
    maszyny/wyciągi, gdzie apka nie modeluje realnych skoków stosu per siłownia).
  - `suggestedWeightForProfile(ex, target, profile)` — dysponent: `unit==="barbell"` → talerze
    profilu (dokładnie), reszta → `weightStep` profilu (przybliżenie), `null` gdy brak różnicy/profilu.
- **Store (`store.tsx`):** `addGymProfile`, `updateGymProfile`, `deleteGymProfile`,
  `setActiveGymProfile` — CRUD + przełącznik, w `settings` więc persystentne (localStorage).
- **UI:**
  - `MoreScreen.tsx` — nowa karta „Siłownie": select aktywnej siłowni, lista profili (edytuj/usuń),
    inline formularz dodawania (Nazwa, Gryf, Krok hantli/maszyn, Talerze). „Kalkulator talerzy" pod
    spodem automatycznie używa gryfu/talerzy aktywnego profilu zamiast domowych.
  - `TrainScreen.tsx` — pod opisem każdego ćwiczenia w trakcie treningu: gdy aktywny profil daje
    inną sugestię niż zapisany cel, pokazuje pasek „{nazwa siłowni}: sugerowany X kg (zamiast Y)"
    z przyciskiem **Użyj**. Kliknięcie nadpisuje `entry.targetWeight` i wagę wszystkich jeszcze
    niezaliczonych serii TYLKO w bieżącym drafcie sesji — **nie rusza** stałego `state.targets[id]`,
    więc progresja na domowej siłowni jest bezpieczna niezależnie od tego, co się dzieje na wyjeździe.
  - Numeryczne pola formularza profilu (Gryf, Krok) używają współdzielonego `NumberField`
    (`src/components/ui/number-field.tsx`, wydzielony z fixa BUG-2) — bez ryzyka odtworzenia tego
    samego buga w nowym formularzu.
- **Świadomie POZA MVP** (do rozważenia później, jeśli okaże się potrzebne):
  - `weightStep` to jeden globalny krok dla WSZYSTKICH maszyn/hantli danego profilu — nie modeluje
    osobnych skoków stosu per ćwiczenie/maszyna (rzeczywiste siłownie różnią się tu bardziej niż
    talerze). Wystarczające jako przybliżenie, nie dokładne.
  - Brak automatycznego powrotu do „Domowa" — trzeba ręcznie przełączyć po powrocie, inaczej
    Kalkulator talerzy i sugestie w Treningu nadal będą liczyć wg obcego sprzętu.
  - „Użyj" nie zmienia `ex.increment` ani stałego celu — progresja wypracowana na wyjeździe NIE
    przenosi się automatycznie na domową siłownię po powrocie (to świadomy wybór ochronny, patrz wyżej).
- **Zweryfikowane w przeglądarce:** dodanie profilu „Siłownia u rodziców" (gryf 20, talerze
  20/15/10/5, krok 2) → poprawne sugestie dla sztangi (dokładny dobór z talerzy, w tym remisy) i
  hantli/wyciągu (krok), „Użyj" poprawnie nadpisuje draft bez ruszania `state.targets`, Kalkulator
  talerzy przełącza się razem z aktywnym profilem. 8 nowych testów w `tests/logic.test.ts` (52/52 OK).

### BUG-3 — ✅ CZĘŚCIOWO NAPRAWIONE (26.07.2026) — Backup „Bad credentials" mimo działającego wczoraj tokena
- **Diagnoza:** apka wysyła token poprawnie (`src/lib/backup.ts:19` — `Authorization: Bearer <token>`).
  „Bad credentials" to **odpowiedź 401 od GitHuba** = to GitHub odrzuca token, nie apka go gubi
  (kropki w polu = token wciąż zapisany w localStorage). Token **nie jest** wpychany do buildu
  (żyje tylko w localStorage per origin), więc to nie wyciek z repo.
- **Najczęstsze przyczyny (po stronie GitHuba):**
  1. **Fine-grained token wygasł** (mają datę ważności; przy krótkim terminie potrafi paść z dnia
     na dzień). — najbardziej prawdopodobne.
  2. Token **odwołany** przez GitHub secret-scanning, jeśli gdziekolwiek trafił publicznie.
  3. Zgubione/zmienione uprawnienie „Gists: Read and write".
- **Możliwy współudział apki (do utwardzenia):** jeśli token wklejony z **spacją/nową linią**,
  nagłówek staje się `Bearer ghp_xxx\n` → 401. Fix: `token.trim()` przy zapisie i w `headers()`
  (`backup.ts:19`). Warto dodać, ale nie tłumaczy „działało wczoraj → nie dziś".
- **Rozwiązanie dla Kamila:** wygenerować **nowy** fine-grained token (uprawnienie tylko
  „Gists: Read and write", data ważności „No expiration" albo długa), wkleić, „Backup teraz".
  Gist ID (`789659…`) zostaje — nowy token wejdzie na ten sam gist.
- **Do zrobienia w kodzie:** (a) `token.trim()`; (b) czytelniejszy komunikat błędu z podpowiedzią
  „token wygasł/odwołany — wygeneruj nowy"; (c) opcjonalnie przycisk „Test tokena" (GET /gists).
- **Fix wdrożony (26.07.2026):** (a) `token.trim()` w `headers()` (`backup.ts:19-25`) oraz przy
  zapisie w `MoreScreen.tsx` (pole GitHub token); (b) `apiError()` w `backup.ts` — przy odpowiedzi
  401 apka pokazuje teraz „Token odrzucony przez GitHub (wygasł/odwołany/stracił uprawnienie) —
  wygeneruj nowy" zamiast surowego „Bad credentials". (c) test tokena — NIE zrobione (opcjonalne).
  **To NIE naprawia samego problemu z tokenem Kamila** — musi wygenerować nowy fine-grained token
  na GitHubie (patrz „Rozwiązanie dla Kamila" wyżej); trim/komunikat to zabezpieczenie na przyszłość.

### INFO-1 — ✅ WDROŻONE (26.07.2026) — Słupki „Objętość tygodniowa": skąd te bursztynowe (low)
- **Logika (`weeklyMuscleVolume`, `logic.ts`):** liczy **serie robocze zaplanowane / tydzień
  z aktywnych dni planu** — NIE z historii treningów. Partia główna = `targetSets` serii,
  wspomagająca = `×0,5`. Każdy aktywny dzień = 1×/tydzień. Zakresy domyślne (hipertroficzne,
  `MUSCLE_RANGES_HYPERTROPHY`) — duże partie 10–20, małe 8–16. Status: `<min` = bursztyn `low`.
  Plan 3-dniowy pod SIŁĘ daje mało serii/partię (np. Klatka = 9 < 10 → `low`) — to oczekiwane
  i uczciwe (§11), NIE błąd.
- **(a) Druga metryka — wykonane serie z ostatnich 7 dni:** nowa `actualWeeklyMuscleVolume(state,
  goal, nowIso?)` w `logic.ts` — liczy z **faktycznie ukończonych `sessions`** w oknie 7 dni
  (dziś + 6 wstecz), tylko zaliczone (`done`) serie, ta sama waga partia główna/wspomagająca.
  `ProgressScreen.tsx` dostał przełącznik **Plan / Wykonane (7 dni)** nad listą partii —
  przełącza `volumes` między `weeklyMuscleVolume` (plan) a `actualWeeklyMuscleVolume` (realia).
  Widok jest lokalny (nie persystowany) — domyślnie zawsze startuje na „Plan".
- **(b) Cel: Siła / Hipertrofia:** nowy typ `VolumeGoal` (`"strength" | "hypertrophy"`),
  `Settings.volumeGoal?` (persystowane, domyślnie hipertrofia — brak zmiany dla obecnych
  użytkowników). `MUSCLE_RANGES_STRENGTH` (duże 5–12, małe 5–10) obok istniejącego
  `MUSCLE_RANGES_HYPERTROPHY` (`MUSCLE_RANGES` zostaje jako alias hipertrofii dla wstecznej
  zgodności), wybór przez `muscleRangesFor(goal)`. `weeklyMuscleVolume`/`actualWeeklyMuscleVolume`
  przyjmują `goal` jako opcjonalny param (domyślnie hipertrofia — wywołania bez tego argumentu,
  w tym istniejące testy, działają bez zmian). Przełącznik **Cel: Siła / Cel: Hipertrofia** obok
  Plan/Wykonane w `ProgressScreen.tsx`, zapisuje przez `store.updateSettings({volumeGoal})`.
  **Świadomie NIE wymuszone na zielono wszędzie** — zakresy siłowe są niższe, ale realistyczne;
  partie z faktycznie niskim bezpośrednim udziałem (np. Łydki bez dnia bonusowego: 3 serie <
  min 5) nadal pokazują `low` nawet w trybie siłowym. To zamierzone (uczciwe framowanie, §11).
- **Zweryfikowane:** plan Kamila (3 dni, bonus wyłączony) w trybie siła: 9/10 partii `ok`
  (zielone), tylko Łydki `low` — kontrastuje z hipertrofią, gdzie 8/10 partii jest `low`.
  3 nowe testy w `tests/logic.test.ts`.

### FEAT-2 — ✅ WDROŻONE (26.07.2026) — Wykres liniowy urywa się na ostatnim treningu; brak estymacji w przód
- **Fix:** nowa funkcja `projectHistory(history: HistoryPoint[], count = 3)` w `logic.ts` —
  regresja liniowa (najmniejsze kwadraty) e1RM po ostatnich do 6 punktach historii, odstęp
  między projektowanymi punktami = średni odstęp między sesjami tego ćwiczenia (cała historia).
  Zwraca `[]` gdy historia < 2 punkty (za mało danych na trend). Przy zastoju/spadku formy trend
  to odzwierciedla (płasko/w dół) — bez sztucznego podkręcania w górę, zgodnie z §11.
- **`LineChart`** (`Charts.tsx`) dostał opcjonalny prop `projection?: Point[]` — rysowany jako
  **przerywana linia** (`strokeDasharray="5 4"`, `opacity=0.5`, ten sam kolor co `data`) startująca
  OD ostatniego realnego punktu (żeby się wizualnie łączyła), z pustymi kółkami zamiast pełnych.
  Domena osi Y/X automatycznie rozszerza się o punkty projekcji.
- **`ProgressScreen.tsx`**: `projectHistory(history, 3)` → `projectionData` → `LineChart
  projection={projectionData}`, plus podpis pod wykresem gdy projekcja istnieje: „Przerywana
  linia: szacunek na kolejne treningi przy utrzymaniu dotychczasowego tempa — nie prognoza,
  ekstrapolacja trendu."
- **Zweryfikowane:** SVG zawiera dwie ścieżki (`path`) — solidną (dane) i przerywaną (projekcja,
  `stroke-dasharray="5 4"`, `opacity="0.5"`). 4 nowe testy w `tests/logic.test.ts` (w tym trend
  liniowy +5/tydzień ekstrapolowany poprawnie, odstęp = średni odstęp historii).

---

## 13. Backlog P3 — zgłoszenia Kamila (sesja 26.07.2026, wieczór II)

Osiem zadań (P3-1…P3-8) + jedno opcjonalne (P3-9) rozpisane w **`POMYSLY.md`,
sekcja „P3"** — z root cause'ami, numerami linii i kryteriami akceptacji:
bug check-inu gotowości (Sen zaznacza Zakwasy), zwijany panel gotowości, +/− przy
ciężarze w loggerze, wyjaśnienie „Plan vs Wykonane (7 dni)" (identyczne liczby to
zbieżność danych, nie błąd), rozmiar pól z datą, rozwijana miniaturka talerzy przy
ćwiczeniu, tryb skupienia (jedno ćwiczenie na ekran, suwak na ekranie wyboru dnia),
kolorowe tagi partii i rozszerzenie bazy ćwiczeń do ~90 pozycji.

⚠️ Przy rozszerzaniu bazy: `migrateState()` w ścieżce „aktualny schemat"
(`seed.ts:270`) przykrywa seed tablicą `old.exercises`, więc **samo dopisanie
ćwiczeń do `SEED_EXERCISES` nie dotrze do istniejącego stanu** — potrzebny jest
merge biblioteki (P3-8 krok 1), nie bump `SCHEMA_VERSION`.

---

## 14. Backlog P5 — zgłoszenia Kamila (sesja 27.07.2026, wieczór II)

Trzy tematy rozpisane w **`POMYSLY.md`, sekcja „P5"** (spec + pliki/linie + testy +
kryteria akceptacji, do wdrożenia pojedynczo przez Sonneta):

- **P5-1 — oś Y wykresu pokazuje nieokrągłe / powtórzone liczby.** `niceTicks`
  (`Charts.tsx:8-12`) dzieli rozciągniętą o 15% domenę (`:57-59`) na równe kawałki
  i dopiero podpis jest zaokrąglany → `54/57/61/64`, a przy płaskiej serii
  `50/50/50/50`. Fix: nowy `src/lib/scale.ts` z `niceScale()` (algorytm „nice
  numbers": krok 1/2/2,5/5 × 10ⁿ), domena osi = domena skali, margines lewy liczony
  z długości podpisu.
- **P5-2 — przerywana projekcja startuje w przeszłości.** Punkt zaczepienia linii
  (ostatnia sesja) jest OK i zostaje; błędem są daty kropek: `projectHistory`
  (`logic.ts:760-778`) liczy `ostatnia sesja + k × średni odstęp`, więc po przerwie
  dłuższej niż odstęp pierwsze „przyszłe" kropki wypadają w przeszłości. Fix:
  opcjonalny `nowIso` przycinający kropki do przyszłości (**opcjonalny — inaczej
  padają 4 testy**, `tests/logic.test.ts:841-853`) + nowy prop `nowX` w `LineChart`
  rysujący pionową kreskę „dziś".
- **P5-3 — instrukcja wykonania ćwiczenia** (domyślnie zwinięta sekcja „Jak wykonać?"
  przy każdym ćwiczeniu w Treningu). **Nie GIF i nie filmik** — 90 ćwiczeń × 30-80 KB
  rozwaliłoby jednoplikowy bundle (dziś 368 KB) i offline. Zamiast tego animowany
  ludzik SVG generowany z kątów w stawach: ~18 wzorców ruchu × ~0,3 KB, animacja
  czystym CSS (jedna klatka kluczowa + zmienne CSS na staw, zero JS), do tego kroki /
  częste błędy per ćwiczenie. Trzy etapy: 3a silnik + 6 wzorców + wpięcie w Trening,
  3b pełna baza 90 ćwiczeń + Plan, 3c (opcjonalnie) link do YouTube zamiast osadzania.
  **Animowany ludzik CAŁKOWICIE USUNIĘTY (28.07.2026, Zadanie 1)** — mimo poprawki
  fazowania (P6-1 Etap A) użytkownik zdecydował, że koszt utrzymania (dedykowany
  wzorzec ruchu na każde z 90 ćwiczeń) i ryzyko pokazania złego ruchu przewyższają
  wartość wizualną. Sekcja „Jak wykonać?" zostaje, w 100% tekstowa, teraz z
  bezpośrednią instrukcją dla wszystkich 90 ćwiczeń (`src/lib/guides/`, Zadanie 2).

---

## 15. Backlog P6 — zgłoszenia Kamila (sesja 27.07.2026, wieczór III)

Sześć zadań + pięć pomysłów rozwojowych rozpisanych w **`POMYSLY.md`, sekcja „P6"**
(root cause z numerami linii, spec, kryteria akceptacji). Kolejność wdrażania:
**P6-6 → P6-2 → P6-3 → P6-5 → P6-4 → P6-1** (trzy zadania timera muszą iść po sobie,
bo P6-2 przebudowuje jego stan).

- **P6-1 — ludziki pokazują nie ten ruch.** Trzy przyczyny naraz: (a) `ExerciseAnim.tsx:26-35`
  nie ustawia `--dur` na `.tt-root`, więc tors jedzie 2,4 s, a stawy np. 2,6 s → animacja
  rozjeżdża się w fazie („randomowy ruch"); (b) mapowania-proxy w `guide.ts` (wznosy bokiem →
  wyciskanie nad głowę, francuz → uginanie); (c) `FALLBACK_PATTERN_BY_MUSCLE` (`guide.ts:203-212`)
  rozlewa 6 wzorców na 90 ćwiczeń. Zasada naprawy: **lepiej brak animacji niż zła animacja**
  + weryfikacja screenshotami przed commitem + kill switch w Ustawieniach.
  **Finalna decyzja (28.07.2026): ludzik CAŁKOWICIE usunięty**, nie tylko naprawiony —
  patrz §14 P5-3 i §16 Zadanie 1. `Settings.showExerciseAnim` (kill switch) też usunięty.
- **P6-2 — timer przerwy gubi czas** przy zmianie zakładki (`App.tsx:73-77` odmontowuje
  `TrainScreen`, stan `useState` w `RestTimer` przepada) i przy wyjściu z apki (`setInterval`
  dekrementujący co 1 s, `Gym.tsx:156-172`, jest w tle zawieszany). Fix: `src/lib/rest-timer.ts`
  ze stanem poza Reactem, czas liczony jako `endsAt - Date.now()`, persystencja w localStorage,
  pigułka widoczna na każdej zakładce. Dźwięku przy zgaszonym ekranie NIE da się dostarczyć
  (patrz „Odrzucone" w POMYSLY.md) — naprawiamy to, że po powrocie czas jest prawdziwy.
- **P6-3 — timer startuje po ostatniej serii treningu** (`TrainScreen.tsx:418-422` startuje
  przerwę po każdym zaznaczeniu) i przeżywa zakończenie. Fix: brak startu, gdy cały trening
  zaliczony + `stop()` w `finish()`/`cancel()`.
- **P6-4 — tryb skupienia przełącza ćwiczenie po 900 ms** bez ostrzeżenia i bez możliwości
  anulowania (`TrainScreen.tsx:445-452`); w deloadzie (brak pytania o RIR) karta znika
  natychmiast, w sile pytanie o RIR odjeżdża, zanim da się je kliknąć. Fix: przejście
  świadome (przycisk + widoczne odliczanie 3 s z „Zostań").
- **P6-5 — „zawsze 2:00" przed pierwszą serią.** `timerSeconds` startuje na globalnym
  `settings.restSeconds` (`TrainScreen.tsx:138`, cofane w `startDay`, `:398`); do tego
  prawdopodobny brak `restSeconds` w ćwiczeniach Kamila — `mergeExerciseLibrary`
  (`seed.ts:643-650`) świadomie nie dolewa pól z seeda do istniejących ćwiczeń, a pole
  doszło później. Fix: jednorazowy backfill (flaga `restSecondsBackfilled`) + timer pokazuje
  przerwę bieżącego ćwiczenia + poprawiona etykieta w Ustawieniach.
- **P6-6 — „(plan 9)" ucięte poza kartę i nieopisane** (`ProgressScreen.tsx:358-405`).
  Fix: `min-w-0` + zawijanie (sprawdzone przy 320 px) + jedna linia legendy w widoku
  „Wykonane (7 dni)".
- **Pomysły rozwojowe (P6-7…P6-11):** service worker = prawdziwy offline (rekomendacja #1),
  eksport historii do CSV (#2), „poprzednie 3 sesje" w karcie ćwiczenia (#3), czas treningu
  na żywo w nagłówku, tygodniowy raport (dopięcie P4-7).

---

## 16. Sesja 28.07.2026 — usunięcie ludzika, pełne instrukcje, neutralna rotacja, bonus w konsekwencji

Cztery zadania, każde osobnym commitem:

- **Zadanie 1 — animowany ludzik CAŁKOWICIE usunięty** (nie ukryty przełącznikiem —
  decyzja użytkownika ostateczna). Usunięte: `src/components/ExerciseAnim.tsx`,
  `src/lib/anim-poses.ts`, pola `pattern`/`loadOverride` z `ExerciseGuide`,
  `Settings.showExerciseAnim`, przełącznik w Więcej, CSS `.tt-j`/`.tt-root`. Powód:
  mimo poprawki fazowania (P6-1 Etap A) koszt utrzymania dedykowanego wzorca ruchu
  na KAŻDE z 90 ćwiczeń i ryzyko pokazania złego ruchu przewyższały wartość
  wizualną. „Jak wykonać?" zostaje, w 100% tekstowe. `seed.ts: normalizeSettings()`
  jednorazowo (a właściwie: przy KAŻDYM wczytaniu, bezpiecznie idempotentnie) usuwa
  historyczne `settings.showExerciseAnim` ze starych danych — bez bumpa `SCHEMA_VERSION`.
- **Zadanie 2 — bezpośrednia instrukcja tekstowa dla wszystkich 90 ćwiczeń z seeda.**
  `src/lib/guide.ts` rozbite na `src/lib/guides/{chest,back,shoulders,legs,glutes,arms,core,other}.ts`
  + `types.ts` + `index.ts`, po partii mięśniowej. Każdy `SEED_EXERCISES[i].id` ma
  bezpośredni wpis w `GUIDES` — fallback ogólny zostaje WYŁĄCZNIE dla ćwiczeń
  dodanych ręcznie przez użytkownika (poza seedem), i zależy od kategorii/jednostki
  sprzętu/`isHold`.
- **Zadanie 3 — nazwy dni zmienione na neutralne „Trening 1/2/3"** (zamiast
  Poniedziałek/Środa/Piątek) — zwyczajowy rytm Kamila to nadal pon/śr/pt, ale apka
  nie sugeruje już sztywnego kalendarza. `id` (`mon`/`wed`/`fri`/`bonus`) BEZ ZMIAN —
  historia/rotacja/cele są z nimi powiązane przez `dayId`. Migracja jednorazowa
  (`neutralDayLabelsSeeded`, bez bumpa `SCHEMA_VERSION`) nadpisuje `name` tylko raz,
  żeby późniejsza ręczna zmiana nazwy przez użytkownika nie była nadpisywana
  ponownie przy kolejnym wczytaniu. Tryb skupienia w nagłówku pokazuje `day.name`
  (było: `day.short` — błąd, poprawiony przy okazji).
- **Zadanie 4 — czwarta fioletowa kropka za trening bonusowy w „Konsekwencji".**
  `WeekAdherence` rozbite na `done`/`planned`/`bonusDone` (unikalne `dayId` w
  tygodniu — dwa zapisy tego samego dnia liczą się raz). Wcześniej wykonany bonus
  podbijał `done` bez podbicia `planned`, więc UI (renderujące dokładnie `planned`
  kropek) i raport tygodniowy („4 z 3 zaplanowanych") wyglądały na zepsute. Bonus
  nigdy nie jest wymagany do pełnego tygodnia (`done >= planned` nie liczy bonusu)
  ani nie wpływa na rekomendację „Najpierw domknij regularność".

---

## 17. Sesja 07.08.2026 — podwójna progresja domknięta (3 zgłoszenia Kamila)

Trzy nieścisłości ze zrzutów ekranu. Wspólny mianownik: apka liczyła progresję
poprawnie, ale **logger i komunikaty przeczyły temu, co policzyła** — prefill kazał
od razu powtarzać komplet na cięższej sztandze, a licznik zastoju nie widział
przyrostu powtórzeń.

### Zgłoszenie 1 — „Dodana seria ma zostać w planie tego dnia"
- **Było:** „Dodaj serię" dokładało serię tylko do bieżącego draftu; w przyszłym
  tygodniu dzień wracał do `ex.targetSets` z bazy ćwiczeń.
- **Model danych:** nowe `WorkoutDay.setsOverride?: Record<exId, number>` (`types.ts`).
  **Nadpisanie jest PER DZIEŃ, nie globalne na ćwiczeniu** — to samo ćwiczenie może
  stać w kilku dniach (dziś seed tego nie robi: bonus ma własne warianty, patrz §6,
  ale użytkownik dowolnie dokłada pozycje do dni w Planie), a dołożenie serii
  w „Treningu 1" nie może po cichu rozdmuchać innego dnia ani globalnej objętości
  tygodniowej. Bez bumpa `SCHEMA_VERSION` (pole opcjonalne).
- **Logika:** `plannedSets(day, ex)` i `exerciseForDay(ex, day)` w `logic.ts`
  (`exerciseForDay` podmienia `targetSets`, wynik idzie do `computeProgression`/
  `failedAtRirZero`). `weeklyMuscleVolume` liczy `plannedSets(day, ex)` zamiast
  `ex.targetSets`, więc objętość tygodniowa i `volumeProgressionSuggestions`
  (P4-5) same się dostrajają.
- **Store:** `setDaySets(dayId, exerciseId, sets)`; wartość równa `ex.targetSets`
  KASUJE nadpisanie (plan zostaje czysty, późniejsza zmiana bazy znów działa).
- **UI:** `TrainScreen.addSet` zapisuje nową liczbę serii do planu dnia + toast
  („od teraz N serie w dniu …"). `PlanScreen` dostał stepper −/N/+ per ćwiczenie
  per dzień. **Świadoma asymetria: `removeSet` NIE zapisuje się do planu** —
  gorszy dzień (zmęczenie, siłownia zamykana) nie może po cichu okroić programu;
  trwałe zmniejszenie robi się w Planie. Deload (`mode === "deload"`, ma celowo
  serię mniej) i ćwiczenie podmienione w drafcie nigdy nie ruszają planu.
- **Konsekwencja dla progresji (zamierzona):** 4 serie w planie = ciężar rośnie
  dopiero przy 4× górny limit, nie 3×.

### Zgłoszenie 2 i 3 — „Po skoku ciężaru ma wskoczyć dolna granica powtórzeń"
- **Tak, to jest poprawna reguła** — i tego właśnie brakowało. `computeProgression`
  liczyło dobrze i pisało „wracasz do 10 powt.", ale logger i tak wypełniał serie
  `repMax` (`TrainScreen.startDay`, stary komentarz „dążymy do maksimum powtórzeń”).
  Komunikat i pole przeczyły sobie nawzajem — stąd wrażenie, że „nie ma podwójnej
  progresji".
- **Fix:** `prefillRepsForEntry(state, ex, modeEx, targetWeight, setCount)` w `logic.ts`:
  1. `targetWeight` wyższy niż na ostatnim treningu → ciężar wskoczył → **`repMin`**
     (dolna granica, przez kolejne tygodnie dokładasz powtórzenia do `repMax`);
  2. ciężar bez zmian → **`repMax` w każdej serii** (SKORYGOWANE 07.08.2026, §22 —
     początkowo było „powtórzenia z ostatniego treningu", ale to duplikowało
     linię „Ostatnie:" zamiast pokazywać cel);
  3. brak historii → `repMin`.
  Tygodnie deloadu są pomijane jako punkt odniesienia (65% ciężaru fałszywie
  wyglądałoby jak „ciężar właśnie wzrósł" przy powrocie do normalnych obciążeń).
  Używane w `startDay` ORAZ `swapExercise`.

### Zgłoszenie 3b — „Zrobiłem 12 powtórzeń, a apka pisze zastój"
- **Root cause:** `detectPlateau` porównywało WYŁĄCZNIE `topWeight` i e1RM
  **najlepszej serii**. Przy zakresie 10–12 seria szczytowa stoi na 12 przez cały
  czas budowania powtórzeń w pozostałych seriach, więc 12/10 → 12/11 → 12/12 dawało
  trzy identyczne e1RM = „zastój" — dokładnie w treningu, który domknął progresję
  i podniósł ciężar.
- **Fix:** nowy `progressionPoints()` ocenia każdą z 3 ostatnich sesji w JEJ
  trybie tygodnia i przy JEJ liczbie serii roboczych (`exerciseForDay`). Zastojem
  **nie jest**: (a) ostatni trening z kompletem powtórzeń (`allAtTop` — ciężar
  rośnie w następnym treningu), (b) przyrost sumy powtórzeń w seriach roboczych
  w oknie 3 treningów, (c) okno zawierające tydzień deloadu. Reszta reguły
  (ten sam ciężar + e1RM w ±1%) bez zmian.

**Testy:** 26 nowych w `tests/logic.test.ts` (`plannedSets`/`exerciseForDay`/
override per dzień/objętość, 5× `detectPlateau` łącznie ze scenariuszem ze zrzutu,
6× `prefillRepsForEntry`). Zweryfikowane też end-to-end w Chromium na zbudowanym
`docs/index.html`: scenariusz Kamila (17,5×12/11 · 17,5×12/11 → dziś 12/12) daje
„nowy ciężar 18.75 kg, wracasz do 10 powt." BEZ banera zastoju, następny trening
startuje z 10/10, a „Dodaj serię" zapisuje `setsOverride: {curl_bb: 3}` w `mon`
zostawiając `bonus` nietknięty.

---

## 18. Sesja 07.08.2026 (II) — kalibracja silnika pod dane naukowe

Analiza silnika na realnych liczbach planu Kamila. **Wniosek nadrzędny: algorytm był
zdrowy, wąskim gardłem jest ZAWARTOŚĆ planu, nie logika.** Podstawa naukowa z
`POMYSLY.md` P0-5 (ciężar nieistotny przy bliskości upadku, RIR jako predyktor
ciągły, długie przerwy też dla hipertrofii, periodyzacja falująca) została
potwierdzona i NIE jest zmieniana. Wdrożone cztery korekty.

### 18.1 Deload tnie objętość, nie intensywność
- **Było:** 65% ciężaru, `max(2, serie - 1)`, RIR +2 — duże cięcie intensywności,
  minimalne cięcie objętości.
- **Dlaczego zmiana:** objętość jest głównym źródłem zmęczenia, a utrzymanie ciężaru
  blisko roboczego najlepiej chroni adaptację (meta-analiza taperów Bosquet i wsp.;
  praktyka Israetela/Helmsa). Zejście z ciężarem nie jest bezsensowne (odciąża stawy
  i tkankę łączną) — dlatego 90%, a nie 100%.
- **Jest:** `DELOAD_LOAD_FACTOR = 0.9` + `deloadSets(planned)` = połowa serii
  w zaokrągleniu, min. 1 (3→2, 2→1). `deloadTargetFor` i `setsForMode` w TrainScreen
  używają obu. **Uwaga praktyczna:** tydzień deloadu ma teraz WYŻSZY tonaż niż
  poprzednio (cięższa sztanga przy podobnej liczbie serii) — świadomy kompromis,
  fatyga spada przez serie i RIR +2, adaptacja jest lepiej chroniona.

### 18.2 RIR skalibrowany wg kosztu dojścia do granicy (`seed.ts: defaultRir`)
- **Było:** jednolite `rir: 2` dla KAŻDEGO ćwiczenia — ławka tak samo jak wznosy bokiem.
- **Jest:** izolacja jednostawowa → **1**, zwykłe compoundy → **2**, duże ruchy osiowe
  (`HEAVY_AXIAL_IDS`: martwy/sumo/rack pull/przysiad/przysiad przedni/good morning/RDL
  ze sztangą) → **3**. `isHold` bez zmian (0). Heurystyka „brak partii wspomagającej
  = izolacja" nie łapie rozpiętek/rear deltów/szrugsów/uginania nóg leżąc/hiperekstensji
  — stąd jawny `ISOLATION_IDS`. Jawny `rir` w `extra` nadal wygrywa.
- **Uzasadnienie:** bliskość upadku to ciągły predyktor hipertrofii, ale jej KOSZT jest
  bardzo różny — seria wznosów bokiem do granicy kosztuje niemal nic, seria przysiadów
  kosztuje dużo.
- **Backfill** `calibrateRirOnce` (flaga `rirCalibrated`, bez bumpa `SCHEMA_VERSION`) —
  `mergeExerciseLibrary` nie dolewa pól do istniejących ćwiczeń (pułapka z §13), więc bez
  tego nowe wartości nigdy nie dotarłyby do stanu Kamila. Rusza WYŁĄCZNIE ćwiczenia
  z dokładnie starą wartością domyślną (`rir === 2`); ręczne 0/1/3 i ćwiczenia spoza
  seeda zostają. Ograniczenie: nie da się odróżnić „wybrałem 2" od „tak było domyślnie".

### 18.3 Autoregulacja: druga strona RIR
- **Było:** zalogowany RIR napędzał tylko podwójny skok (RIR ≥3 + komplet) i ostrzeżenie
  przy RIR ≤1. Przypadek „ciężar za lekki" nie istniał — apka w nieskończoność pisała
  „walcz o powtórzenia".
- **Jest:** `easyAtRirHigh(ex, sets)` (lustro `failedAtRirZero`) = 3+ w zapasie ORAZ brak
  kompletu powtórzeń. `computeProgression` dostał 6. parametr `priorSessionEasyAtRir3`;
  dwa takie treningi z rzędu → status `hold`, ale komunikat mówi wprost „ciężar jest za
  lekki, dobij do repMax albo dołóż increment". Świadomie NIE podnosi ciężaru sam —
  decyzja należy do trenującego, jak przy `detectPlateau`.
- `prefillRepsForEntry` dokłada **+1 powtórzenie**, gdy referencyjna sesja skończyła się
  z RIR ≥3 (przycięte do `repMax`) — zamiast w kółko podstawiać ten sam wynik.

### 18.4 Objętość liczy serie ROBOCZE (hard sets)
- **Było:** `actualWeeklyMuscleVolume` liczyło każdą zaznaczoną serię tak samo.
- **Jest:** liczy tylko serie, które weszły w `repMin` zakresu **trybu, w którym zapisano
  sesję** (`exerciseForMode(ex, session.mode)`). Seria urwana na 4 powtórzeniach przy
  zakresie 10–12 nie jest bodźcem i zawyżała metrykę. Legenda w Progresie mówi o tym
  wprost. `tonnage` celowo BEZ zmian — to literalnie przeniesione kilogramy.

### 18.5 Zdiagnozowane, NIE wdrożone (decyzja treningowa Kamila)
Luki objętości/częstotliwości w planie 3-dniowym (bonus OFF), policzone z `weeklyMuscleVolume`:
**Nogi 6 serii @ 1×/tydz.** (zero udziału pomocniczego — martwy/RDL/hip thrust nie trenują
czworogłowych), **Łydki 3 @ 1×**, **Biceps 2 bezpośrednie @ 1×**, **Triceps 2 bezpośrednie
@ 1×**, Pośladki 3 bezpośrednie. Klatka (9 @ 3×) i Plecy (9 @ 2×) są obsłużone dobrze.
To zmiana treningu, nie kodu — biblioteka ma wszystko, co potrzebne (suwnica, hack squat,
prostowanie nóg, uginanie nóg, bułgarskie, calf press, warianty uginania/prostowania ramion).

**Drobiazgi do rozważenia:** Epley zawyża e1RM powyżej ~10 powt. (używany konsekwentnie,
więc błąd częściowo się znosi); stały `increment` w kg daje nierówny skok procentowy
(2,5 kg na ławce 45 kg = 5,5%); `volumeProgressionSuggestions` mogłoby po zmianie z §17
realnie dokładać serię do konkretnego dnia przez `setDaySets`.

**Testy:** 27 nowych w `tests/logic.test.ts` (deload 90%/połowa serii, `easyAtRirHigh`
w 4 wariantach, autoregulacja w `computeProgression`, prefill +1 przy RIR 3, hard sets,
8× kalibracja RIR + 2× backfill). Zweryfikowane w Chromium na zbudowanym `docs/index.html`:
stary stan z jednolitym `rir: 2` po wczytaniu daje lateral 1 / bench 2 / squat 3 /
deadlift 3 / plank 0, a tydzień deloadu startuje z 11 serii zamiast 17 i celem 40 kg
zamiast 45 na wyciskaniu.

---

## 19. Sesja 07.08.2026 (III) — wariant B: dosiew objętości do planu

Wdrożenie punktu 1 z analizy §18.5 (decyzja Kamila: „wdroż B"). Cel: domknąć
partie, które w planie 3-dniowym miały realnie za mało serii, BEZ dokładania
czwartego dnia i bez przebudowy podziału.

| Partia | Było | Jest | Jak |
|---|---|---|---|
| Nogi | 6 @ 1×/tydz. | **9** | + Suwnica 3×10–12 (120 kg) w „Treningu 2" |
| Łydki | 3 | **4** | Wspięcia na palce 3 → 4 serie |
| Biceps (bezpośr.) | 2 | **3** | Uginanie bicepsa 2 → 3 serie |
| Triceps (bezpośr.) | 2 | **3** | Francuz 2 → 3 serie |

Skutki uboczne (policzone, nie zaprojektowane): Pośladki 8,5 → 10 (`ok`),
Triceps łącznie 8 → 9 (`ok`). Klatka/Plecy/Barki/Brzuch bez zmian.

**Suwnica stoi TRZECIA** (`squat, deadlift, leg_press, incline_db, lunges, calf,
plank`) — czworogłowe dostają objętość jeszcze na świeżo, a maszyna jest
bezpieczna po ciężkim przysiadzie i martwym ciągu.

**Serie liczone PER DZIEŃ** (`WorkoutDay.setsOverride` z §17), NIE przez zmianę
`Exercise.targetSets` — dzięki temu baza ćwiczeń zostaje nietknięta i dołożenie
tego samego ćwiczenia do innego dnia nie odziedziczy podbitej liczby serii.
`SEED_DAYS` niosą teraz własne `setsOverride` (`mon: {curl_bb: 3}`,
`wed: {calf: 4}`, `fri: {french: 3}`).

**Migracja `applyPlanVolumeBumpOnce`** (flaga `planVolumeBumpSeeded`, bez bumpa
`SCHEMA_VERSION`) — `migrateState` w ścieżce „aktualny schemat" przykrywa seed
tablicą `old.days` (pułapka z §13), więc sama zmiana `SEED_DAYS` nie dotarłaby
do stanu Kamila. Migracja jest zachowawcza:
- ćwiczenie dokłada TYLKO gdy go w dniu nie ma (druga migracja nie duplikuje),
- liczbę serii podnosi TYLKO gdy jest niższa niż docelowa (ręczne 5 zostaje 5),
- cel suwnicy bierze z `SEED_TARGETS` wyłącznie gdy go jeszcze nie ma,
- po dosiewie usunięcie suwnicy z dnia jest TRWAŁE (flaga blokuje powrót).

**Czego NIE ruszono:** częstotliwości. Nogi/Łydki/Biceps/Triceps nadal 1×/tydz. —
podniesienie tego wymagałoby przebudowy podziału na dni, a przy rytmie „co drugi
dzień roboczy" dołożenie objętości do istniejącego dnia daje większość korzyści
mniejszym kosztem. Zostaje jako otwarty temat.

**Testy:** 14 nowych w `tests/logic.test.ts` (objętość po zmianie dla 5 partii,
kolejność ćwiczeń w środzie, migracja na starym stanie, cel suwnicy, idempotencja,
poszanowanie wyższej wartości użytkownika, trwałość usunięcia). Trzy testy z §17
przestrojone, bo `mon` niesie teraz nadpisanie w seedzie — bazą „bez nadpisania"
jest tam `bench_bb`. Zweryfikowane w Chromium: stan sprzed zmiany po wczytaniu
dostaje suwnicę na 3. pozycji z celem 120 kg, a „Trening 2" startuje z 22 seriami
zamiast 18.

---

## 20. Sesja 07.08.2026 (IV) — audyt weryfikacyjny całości

Pełny przegląd po §17–19 na prośbę Kamila. Testy jednostkowe i tak przechodziły,
więc audyt szedł NIEZALEŻNYMI ścieżkami: skrypty liczące silnik na wszystkich
90 ćwiczeniach i we wszystkich trybach, symulacja 10 tygodni progresji, przebieg
wszystkich ścieżek `migrateState`, round-trip backupu i E2E w Chromium na
zbudowanym `docs/index.html`. **Znalazł 4 realne błędy — wszystkie z §18/§19.**

### 20.1 Hipertrofia kasowała margines bezpieczeństwa dużych ruchów (NAJWAŻNIEJSZY)
`exerciseForMode(ex, "hypertrophy")` ustawiał **sztywne `rir: 1`**. Było to poprawne,
dopóki cała baza stała na RIR 2, ale po kalibracji z §18.2 oznaczało, że **przysiad
schodził z RIR 3 na RIR 1** — serie po 12 powtórzeń o włos od upadku, dokładnie
odwrotnie niż intencja kalibracji. Dotyczyło 6 z 7 ruchów osiowych (martwy ciąg
miał własną gałąź i był bezpieczny).
**Fix:** hipertrofia to KROK od bazy tego ćwiczenia — `Math.max(0, ex.rir - 1)`.
Izolacja 1→0, compound 2→1 (bez zmian względem starej reguły), osiowe 3→2.

### 20.2 Deload zaokrąglał ciężar W GÓRĘ do 100% celu
`deloadTargetFor` używało `Math.round`, więc przy zgrubnym kroku obciążenia wynik
wracał na pełny cel — **7 ćwiczeń nie schodziło z ciężaru w ogóle** (np. cel 10 kg
przy kroku 2,5). **Fix:** `Math.floor` (wynik NIGDY nie przekracza
`DELOAD_LOAD_FACTOR`) + `isHold` zostawia obciążenie bez zmian, bo przy kroku 5 kg
na celu 10 kg każde obniżenie to −50%; deload planku robi połowa serii (4→2).

### 20.3 „Przywróć plan dnia" nie przywracało liczby serii
`computeRestoredDayPlan` resetowało `exerciseIds`, ale zostawiało `day.setsOverride`
użytkownika — po przywróceniu dnia przysiad dalej miał ręczne 7 serii. Liczba serii
jest częścią PLANU, więc wraca razem ze składem. `targets` (wypracowana progresja)
nadal celowo nietknięte.

### 20.4 `zeroLoadSets` liczyło serie spoza filtra serii roboczych
Po zmianie z §18.4 wyjaśnienie „N serii z masą własną" mogło podać liczbę WYŻSZĄ
niż sam licznik serii partii. Liczone teraz z tych samych serii co `sets`.

### 20.5 Zgłoszenia, które okazały się NIE być błędami
- **„Cofnij zakończenie" nie działa** — działa. Playwright domyślnie odrzuca
  `confirm()`; po `dialog.accept()` sesja znika i cele wracają. Artefakt testu.
- **Fałszywy zastój w E2E** — zastój był UCZCIWY: test logował prefill 1:1, czyli
  powtarzał wynik sprzed tygodnia trzeci raz z rzędu (wznosy bokiem 15/15/12 →
  15/15/10 → 15/15/12). Dokładnie to, co reguła ma wykrywać.
- **Brak progresji w E2E** — również poprawne: powtórzenie wyniku nie domyka
  zakresu, więc ciężar zostaje. To jest sedno zmiany z §17.
- **Deload 86% na zakrokach** — granulacja kroku obciążenia (14 kg, krok 2 kg),
  nie błąd; reguła gwarantuje tylko „nigdy powyżej 90%".

### 20.6 Zweryfikowane bez zastrzeżeń
- **Symulacja 10 tygodni** (uginanie bicepsa 3×10–12): 10/10/10 → … → 12/12/12
  podnosi cel na 18,75 i prefill wraca na 10/10/10; drugi cykl kończy się na 20 kg.
  Zastój NIE odpala ani razu, gdy powtórzenia rosną; przy 12/11/11 w kółko odpala
  w 3. tygodniu. Deload zamraża cele i nie psuje prefillu po powrocie.
- **Wszystkie ścieżki `migrateState`** (null/undefined/`{}`/tekst/v2/v5/stan Kamila):
  brak wyjątków, idempotentne (3× migracja = ten sam wynik), zachowane cele, sesje,
  waga, squash, token i `restSeconds`; usunięcie suwnicy przez użytkownika trwałe,
  ręczne 5 serii i ręczny RIR 0 nienadpisane.
- **Backup:** `setsOverride` i nowe flagi przechodzą round-trip; backup BEZ nowych
  pól (starszy plik) importuje się i dostaje dosiew.
- **E2E w Chromium:** 5 zakładek renderuje się bez błędów JS, komplet powtórzeń
  podnosi 6 ciężarów i NIE pokazuje zastoju, cofnięcie czyści sesję i cele, następny
  tydzień startuje z `repMin` dla wszystkich 6 pozycji, „Dodaj serię" zapisuje do
  `mon` nie ruszając `bonus`, deload daje 88–89% ciężaru i połowę serii.

**Testy:** 357 (dopisane m.in. przysiad w hipertrofii zachowuje RIR 2, sufit RIR 4
w deloadzie, deload nigdy powyżej 90% dla ŻADNEGO ćwiczenia z bazy, isHold zostawia
obciążenie).

---

## 21. Sesja 07.08.2026 (V) — analiza danych + motywacja

Prośba Kamila: głębsza analiza i „ma mnie motywować trening". Analiza poszła po
REALNYCH danych z historii startowej (9 sesji, 6–24.07.2026), nie po samym silniku.

### 21.1 Co pokazały dane
- **Rosło:** RDL +40%, francuz +35%, ściąganie drążka +25%, wiosłowanie hantlem
  +14%, wspięcia +12,5%, zakroki +12%, martwy +10,8%, hip thrust +10%, OHP +9,2%,
  wiosłowanie sztangą +9%, przysiad +8,3% (e1RM, pierwsza vs ostatnia sesja).
- **Stało:** uginanie bicepsa 0%, wyciskanie hantli płasko 0%, wyciskanie sztangi
  płasko −0,4%, allahy −6,2%.
- **Tonaż:** stabilny 6,1–7,1 t/sesja, lekki trend w górę w „Treningu 1".
- **Interpretacja:** największe skoki to w dużej mierze DOBIERANIE ciężaru
  roboczego po przerwie (RDL 15→20 kg, francuz 17,5→22,5), nie przyrost siły.
  Podawanie ich jako „tempa" byłoby zawyżaniem (§11).

### 21.2 Sufit projekcji — obietnice, których plan nie dowiezie
Regresja liniowa na 3 tygodniach powrotu do formy dawała „ściąganie drążka
66,7 → 86,8 kg w trzy treningi" (+30%) i „RDL +43%". **Wykres, który obiecuje
i nie dowozi, zniechęca skuteczniej niż brak wykresu.**
`maxGainPerSession(ex)` = `increment × (1 + repMax/30)` — najszybszy przyrost
e1RM, jaki podwójna progresja FIZYCZNIE dowozi (jeden krok obciążenia na trening).
Sufit z mechaniki planu, nie z arbitralnego procentu. Podawany jako **opcjonalny**
parametr do `projectHistory`/`estimateGoalEta` (brak = dokładnie dawne zachowanie,
więc żaden istniejący test nie musiał się zmieniać), wpięty w `ProgressScreen`.
Działa TYLKO w górę — zastój i regres przechodzą bez zmian. Efekt: ściąganie
66,7 → 69,7 zamiast 86,8; martwy 95,6 → 99,9 zamiast 109,5.

### 21.3 „Ile już urosłeś" — motywacja bez prognoz
Nowa karta w Progresie + `progressSince(state, weeks, nowIso?)`: najstarszy punkt
historii w oknie N tygodni zestawiony z najnowszym, per ćwiczenie, posortowane po
procencie. Pokazuje WYŁĄCZNIE to, co realnie podniósł — czyli czegoś, czym nie da
się rozczarować, w przeciwieństwie do prognozy. Świadomie **nie przelicza na
„tempo na tydzień"** (patrz 21.1) i **pokazuje regres tak samo jak progres**.
Wyróżniona linia z największym skokiem („27,5 kg×8 zmieniło się w 30 kg×8 —
to już zrobione, nikt Ci tego nie zabierze").

### 21.4 „Ile brakuje" w Standardach siłowych
`StrengthRatio.toNext` — NAJBLIŻSZY nieosiągnięty próg i brakujące kilogramy e1RM.
Celowo liczy też próg DOLNY (referencyjny, nie steruje `level`): przy masie 88 kg
do średniozaawansowanego brakuje 27–36 kg (bez znaczenia motywacyjnego), a do progu
dolnego — OHP **1,6 kg**, przysiad **5,7 kg**. To jest kamień milowy w zasięgu
kilku tygodni, i to on popycha do roboty.

**Testy:** 371 łącznie (14 nowych: `progressSince` łącznie z regresem i oknem,
`toNext` dla progu dolnego/środkowego/braku, sufit projekcji w górę i brak wpływu
na trend spadkowy, `maxGainPerSession` dla `isHold`).

---

## 22. Sesja 07.08.2026 (VI) — pole loggera pokazuje CEL, nie przeszłość

**Zgłoszenie Kamila:** „skoro mam info ile zrobiłem powtórzeń ostatnio, to skąd
mam wiedzieć ile mam zrobić, jak mam stare dane z ostatniego treningu? Powinno
chyba pokazać tyle, ile powinienem zrobić, żeby był progres."

**Ma rację i to jest korekta MOJEGO przekroczenia zakresu z §17.** Pierwotne
zgłoszenie (§17, pkt 2–3) dotyczyło WYŁĄCZNIE przypadku „ciężar właśnie wskoczył"
— tam apka wrzucała `repMax`, a powinna `repMin`. Przypadek „ciężar bez zmian →
prefill = wynik z ostatniego treningu" dołożyłem z własnej inicjatywy i to on
okazał się błędny: linia **„Ostatnie: 30×11/9/8" już pokazuje historię**, więc
powtarzanie jej w polach serii marnowało jedyne miejsce, które mogło nieść cel.

### Zmiana w `prefillRepsForEntry`
- ciężar wskoczył → **`repMin`** (BEZ ZMIAN — to było pierwotne zgłoszenie)
- ciężar bez zmian → **`repMax`** (było: powtórzenia z ostatniego treningu)
- brak historii → **`repMin`** (BEZ ZMIAN — cykl startuje od dołu)

Usunięty bonus „+1 powtórzenie przy RIR ≥3" z §18.3 — dotyczył wyłącznie gałęzi
„ciężar bez zmian", która teraz zawsze pokazuje górny limit, więc był martwy.
Autoregulacja RIR w `computeProgression` (komunikat „ciężar jest za lekki")
zostaje bez zmian.

**Świadomy koszt:** przeklikanie serii bez edycji zapisze teraz komplet powtórzeń
i podniesie ciężar. Poprzedni wariant był pod tym względem bezpieczniejszy
(zapisywał powtórzenie zeszłego tygodnia), ale to zachowanie sprzed §17 i decyzja
użytkownika.

### Nowa linia „Do skoku ciężaru" (`progressGoal`)
`progressGoal(state, ex, modeEx)` → `{ repsPerSet, setCount, missingReps }` —
warunek skoku ciężaru i dystans z ostatniego treningu (seria niezalogowana liczy
się jako pełny brak). Liczone na ćwiczeniu w trybie tygodnia I przy liczbie serii
z planu TEGO dnia (`exerciseForDay`); w deloadzie ukryte (progresja wyłączona).

W karcie ćwiczenia pod „Ostatnie:":
- `Do skoku ciężaru: 3×10 powt. — ostatnio zabrakło 1 powt.`
- przy komplecie: `— ostatnio komplet, dziś powinien wskoczyć` (na zielono)

**Testy:** 377 (4 testy prefillu przestrojone na nową regułę, 6 nowych na
`progressGoal`). Zweryfikowane w Chromium na realnym scenariuszu ze zrzutu:
OHP „Do skoku ciężaru: 3×12 powt. — ostatnio zabrakło 8 powt.", pola 12/12/12;
ściąganie drążka „3×10 powt. — ostatnio zabrakło 1 powt.", pola 10/10/10.

---

## 23. Sesja 07.08.2026 (VII) — podpowiedź „ost. N" przy każdej serii

**Prośba Kamila:** przy każdym wierszu serii, w wolnym miejscu przed haczykiem,
pokazać dyskretnie ile zrobił w TEJ serii ostatnim razem.

### Co doszło
Kratka między polem powtórzeń a przyciskiem zaliczenia: `ost. 10`.
- **Treść: same powtórzenia.** Ciężar świadomie NIE wchodzi do wiersza — przy
  trzycyfrowym obciążeniu (`ost. 117,5×12`) wypychał haczyk poza ekran.
  Pełny zapis jest w linii „Ostatnie:" nad seriami oraz w `title` kratki.
- **Kropkowane podkreślenie**, gdy tamta seria szła na INNYM ciężarze niż
  dzisiejszy — sygnał „to nie jest porównanie jak z jak".
- **Kolor dopiero PO zaliczeniu serii** (zielony = pobiłeś, bursztynowy = mniej,
  szary = tyle samo). Przed zaliczeniem pole trzyma cel (górny limit, §22),
  więc kolorowanie od startu świeciłoby się na zielono w każdym wierszu.
- Seria bez odpowiednika w historii (np. dołożona czwarta) — bez kratki.
- Deload nie jest punktem odniesienia (`referenceEntry`).

### `referenceEntry()` — jedno źródło prawdy
Wydzielone z `prefillRepsForEntry` i `progressGoal`, które liczyły to samo
osobno: najnowsza ukończona sesja z tym ćwiczeniem POZA deloadem (a gdy są same
deloady — najnowszy, żeby nie zostawiać użytkownika bez odniesienia).

### Nowy breakpoint `xs: 360px` (tailwind.config.js)
Kratka nie mieści się na 320 px (iPhone SE 1. gen) — wiersz rozpychał stronę
do 382 px i haczyk wychodził poza ekran. **Zweryfikowane przez porównanie
z buildem sprzed zmiany: przy 320/360 px scrollWidth był równy szerokości okna,
więc przepełnienie wprowadziła ta kratka, nie istniejący układ.** Poniżej 360 px
kratka jest ukryta (`hidden xs:inline-block`) — historia zostaje w linii
„Ostatnie:". Zmierzone po poprawce: 320/360/390/430 px bez poziomego scrolla.

---

## 24. Sesja 07.08.2026 (VIII) — cel idzie za ciężarem, który realnie poszedł

**Zgłoszenie Kamila:** „RDL z hantlami zmień na 22,5 bo takie mam hantle na tej
siłowni, bo się nie zapisało a powinno — jak zmienię w danym treningu wagę, to
znaczy że nie było innej i ma dostosować."

### 24.1 Progresja liczy od ciężaru z loggera, nie z planu
**Było:** `setWeightWithSync` zmieniał wagę serii w drafcie, ale `entry.targetWeight`
(baza progresji) zostawał nietknięty, a `finishSession` liczył `computeProgression`
właśnie od niego. Efekt: cel 22 kg był fizycznie nieosiągalny (hantli 22 nie ma),
Kamil co trening podbijał na 22,5, po czym cel wracał do 22, a progresja liczyła
się od liczby, której nigdy nie podniósł (22 + 2 = 24, zamiast 22,5 + 2 = 24,5).

**Jest:** `loggedWorkingWeight(entry, targetSets)` — ciężar serii ROBOCZYCH, gdy
wszystkie mają ten sam; `null`, gdy się różnią (zejście w dół w trakcie ćwiczenia
to ratowanie serii, nie deklaracja nowego celu). `finishSession` używa go jako bazy
progresji: `loggedWeight ?? entry.targetWeight`.

**WYJĄTEK — obca siłownia.** Gdy `settings.activeGymProfileId` jest ustawione,
adaptacja jest wyłączona: korekta ciężaru mówi wtedy o TAMTYM sprzęcie, a nie
o docelowym obciążeniu, więc przeniesienie jej do `targets` zepsułoby progresję
po powrocie. To dokładnie ochrona zaprojektowana w FEAT-1 (§12) i zostaje.

### 24.2 Sam cel RDL: 22 → 22,5
`SEED_TARGETS.rdl` + jednorazowa migracja `fixRdlTargetOnce` (flaga
`rdlTargetFixed`, bez bumpa `SCHEMA_VERSION`). Rusza WYŁĄCZNIE cel równy dokładnie
starej wartości z seeda (22) — wypracowana progresja i ręcznie ustawiony cel
zostają. Bez niej §24.1 dogoniłby to samo, ale dopiero po jednej ukończonej sesji.

Przy okazji `applyOneTimeSeeds` rozwinięte z zagnieżdżonych wywołań w płaską
sekwencję — siedem dosiewów w jednym wyrażeniu przestało być czytelne.

### 24.3 Otwarte: krok obciążenia RDL
`increment` RDL to nadal **2 kg**, więc następny cel po 22,5 wypadnie na 24,5 —
a skoro na siłowni są hantle 22,5, to drabinka jest najpewniej co 2,5 kg
(22,5 → 25 → 27,5) i 24,5 też nie istnieje. Świadomie NIE zmienione bez potwierdzenia
Kamila (to parametr treningowy, nie błąd). Od §24.1 apka sama się dogoni po każdym
treningu, ale będzie się z tym szarpać co cykl.

**Testy:** 388 (5× `loggedWorkingWeight` łącznie z zejściem w dół i seriami ponad
plan, progresja 22,5 → 24,5 vs 22 → 24, 4× migracja celu RDL z ochroną
wypracowanego celu). Zweryfikowane w Chromium: na domowej siłowni cel 22 → 22,5
po wczytaniu, a po treningu na 22,5×12/12/12 → **24,5**; przy aktywnym profilu
obcej siłowni ten sam trening zostawia cel na planowej ścieżce (20 → 22).

---

## 25. Sesja 26.08.2026 — dziesięć zgłoszeń Kamila (trzy serie screenów, skrypt `ZADANIA-P7.md`)

Kamil przysłał trzy serie zrzutów ekranu w toku jednej sesji; każda seria dopisywała
kolejne zadania do `ZADANIA-P7.md` (root cause, plik/linia, testy, kryteria akceptacji)
zanim Sonnet zaczął wdrażać. Dziesięć zadań, **każde osobnym commitem**, w kolejności
P7-4 → P7-1 → P7-2 → P7-6 → P7-10 → P7-5 → P7-7 → P7-9 → P7-3 → P7-8. **Testy: 388 → 481**
(93 nowych), wszystkie zielone; `npm run build` bez błędów.

### 25.1 P7-4 — czas treningu liczony od pierwszej serii, nie od wejścia w dzień
`Session.date` to moment KLIKNIĘCIA w dzień, a nie start treningu — Kamil przegląda
plan z wyprzedzeniem, więc różnica bywała większa niż limit 240 min (§9: „apka
zostawiona otwarta na noc") i czas znikał całkowicie z podsumowania i Historii.
`Session.startedAt` / `Draft.firstSetAt` (moment PIERWSZEJ zaliczonej serii,
ustawiane raz w `updateSet`) — `sessionDuration()` liczy od niego z fallbackiem na
`date` dla starych sesji. `date` samo w sobie NIE zmienia znaczenia (klucz sortowania
Historii, okno tygodnia/cyklu) — tego świadomie nie ruszono. Podsumowanie tłumaczy
wprost, kiedy czas jest nieznany, zamiast po cichu go ukrywać.

### 25.2 P7-1 — „dziś powinien wskoczyć" mimo że ciężar już wskoczył
`progressGoal()` liczyło wyłącznie brakujące powtórzenia i nie sprawdzało, czy
dzisiejszy cel jest już WYŻSZY niż ciężar sesji referencyjnej — więc po komplecie,
który już podniósł cel, karta dalej pisała „ostatnio komplet, dziś powinien
wskoczyć", mimo że wskoczył wczoraj. Nowy współdzielony helper `weightVsReference()`
(używany też przez `prefillRepsForEntry`, a od P7-5/P7-10 także przez
`computeProgression`) rozstrzyga trzy przypadki: ciężar wskoczył (zielony, wprost
mówi o ile i na co dziś celujesz), ciężar niższy niż ostatnio (neutralny), ten sam
ciężar (jak dawniej — dystans w powtórzeniach). Działa też dla `isHold` (plank) —
porównanie idzie po obciążeniu, nie sekundach.

### 25.3 P7-2 — kolor kratki „ost. N" liczony z siły (e1RM), nie z powtórzeń
22,5×10 świeciło na bursztynowo wobec referencji 20×12, mimo że jest MOCNIEJSZE
(e1RM 30,0 > 28,0) — kolor liczył się z samych powtórzeń. Nowa
`compareSetToReference()` porównuje e1RM. Dla `isHold` (plank) przy RÓŻNYM
obciążeniu nie ma uczciwej wspólnej miary (40 s@10 kg vs 35 s@15 kg — dodatkowe kg
i sekundy nie mają ustalonego przelicznika) → wynik `"incomparable"`, kratka zostaje
bez koloru, tylko kropkowane podkreślenie jak dotąd. Przy tej samej okazji (dzielona
struktura `PersonalBests`) `isSetRecord` dla `isHold` dostał regułę DOMINACJI zamiast
porównania samych sekund: dłuższy czas wygrywa zawsze, przy remisie cięższe
obciążenie — bez tego plank na 15 kg nigdy nie dostawał PR wobec rekordu na 10 kg.
Podsumowanie sesji i toast po zaliczeniu serii pokazują teraz obciążenie przy
rekordzie planku („40 s @ 15 kg").

### 25.4 P7-10 — fałszywy „Spadek formy" po skoku ciężaru + zakres planku 30–40 s
„2+ serie poniżej minimum" odpalało deload NAWET gdy ciężar właśnie wskoczył — a to
jest oczekiwany, normalny skutek udanej progresji, nie regres. `computeProgression`
dostał opcjonalny 7. parametr `weightJustIncreased` (liczony przez
`store.finishSession` tym samym `weightVsReference` co P7-1): gdy prawda, „poniżej
minimum" zwraca `hold` z komunikatem „Pierwszy trening na nowym ciężarze", nie
`deload`. Plank miał dodatkowo WBUDOWANY wariant tego samego buga:
`repMin === repMax` (40==40) nie zostawiał ŻADNEJ przestrzeni na odbudowanie
wyniku, więc KAŻDY skok obciążenia gwarantował fałszywy spadek formy niezależnie od
powyższej poprawki. Zakres 30–40 s (migracja `setPlankRangeOnce`, zachowuje ręczną
zmianę użytkownika, bez bumpa `SCHEMA_VERSION`) naprawia to systemowo. Świadomie
NIE tknięte: `side_plank`/`hollow_hold`/`farmer_walk` mają ten sam kształt
(`repMin === repMax`), ale nie były zgłoszone — chroni je już sam wyjątek
`weightJustIncreased`. Przy okazji: komunikat deloadu mówił „odbuduj powtórzenia"
nawet dla ćwiczeń na czas — teraz „odbuduj czas" dla `isHold`.

### 25.5 P7-5 — „nowy ciężar" nigdy nie ≤ temu, co dziś realnie podniesiono
Podbicie ciężaru W TRAKCIE ćwiczenia (16,25×12 → 17,5×12/17,5×12) zostawia serie
robocze na różnych ciężarach. `loggedWorkingWeight` wtedy słusznie zwraca `null`,
ale `finishSession` cofał się do STAREGO celu z planu jako bazy progresji — komplet
liczył „awans" od 16,25, więc podsumowanie ogłaszało „nowy ciężar 17,5", czyli
dokładnie to, co Kamil już zrobił. `computeProgression` dostał opcjonalny 8.
parametr `mixedWorkingWeights`: gdy store wykryje rozjazd I najcięższa zaliczona
seria przewyższa stary cel, funkcja OD RAZU (przed `allAtTop`/`belowMin`) zwraca
`hold` z `nextWeight` = ta najcięższa seria i komunikatem „Serie szły na różnych
ciężarach — cel podniesiony do X kg. Domknij na nim komplet…". Cel dogania
rzeczywistość, ale NIE dokłada kolejnego kroku — trzeba jeszcze raz powalczyć
kompletem na jednym ciężarze. Wyłączone na obcej siłowni (jak cała adaptacja
z §24.1). Dodatkowo: dyskretny toast w loggerze od razu przy zmianie ciężaru
w `setWeightWithSync`, zanim dojdzie do podsumowania.

### 25.6 P7-7 — rekord życia widoczny w karcie ćwiczenia
„Dlaczego 65×8 to nie rekord?" — apka liczyła poprawnie (65 kg już było, e1RM 82,3
< rekord 87,5 z 62,5×12), ale bez tej informacji na ekranie brak PR wyglądał na
awarię. `PersonalBests` dostał `e1rmWeight`/`e1rmReps` (seria, która wypracowała
najwyższe e1RM — NIE ta najcięższa) i `holdWeight` (z P7-2/P7-6). „Pomoc i
szczegóły" pokazuje teraz `Rekord: 62,5 kg × 12 (e1RM 87,5 kg)`, dla `isHold`
`40 s @ 15 kg`. Pomijane całkowicie przy braku historii.

### 25.7 P7-9 — migracje celów pomijały `hyperTargets`
Wszystkie zrzuty ekranu Kamila mają plakietkę **Hipertrofia** — a `hyperTargetFor()`
NAJPIERW sięga po `state.hyperTargets` (§5.7), więc to ono jest jego realnym celem
roboczym, nie `targets` (siła). Dwa realne problemy: (1) `fixRdlTargetOnce` z §24.2
ruszało wyłącznie `targets.rdl` — `hyperTargets.rdl` zostawał na nieosiągalnych
22 kg, dlatego RDL dalej dawał „nowy ciężar 24 kg" mimo tamtej poprawki. Osobna
migracja `fixHyperRdlTargetOnce` (własna flaga `rdlHyperTargetFixed`, bo na już
zmigrowanym urządzeniu stara migracja się nie odpali) to dogania. (2) Gałąź
`migrateState()` dla starej wersji schematu w ogóle NIE przenosiła `hyperTargets`
— przy najbliższym bumpie `SCHEMA_VERSION` cała progresja hipertrofii Kamila
wyparowałaby. Teraz przenosi się dla ID ćwiczeń, które nadal istnieją w bazie
(ten sam wzorzec co `targets`), bez zostawiania pustego obiektu-śmiecia, gdy nie
ma czego przenosić.

### 25.8 P7-3 — drabinka hantli per siłownia + siłownia przypisana do dnia
`increment` to stała liczba kg — nic nie sprawdzało, czy suma w ogóle istnieje jako
hantel (22,5 + 2 = 24,5, cel wiosłowania hantlem 22 kg). Kamil ma **dwie stałe
siłownie przypisane do dni** (nie okazjonalny wyjazd): pon/pt **„Well Fitness"**
(hantle co 2,5 kg w górnym zakresie), śr **„My Fitness Place"** (co 2 kg) — stąd
zakroki 14 kg i wyciskanie hantli skos 16 kg (oba w środę) były zawsze POPRAWNE.
Istniejący `activeGymProfileId` (FEAT-1, §12) tego nie obsługiwał: wymaga ręcznego
przełączania i celowo wyłącza adaptację celu.

Nowe pola: `GymProfile.dumbbells`, `Settings.dumbbells` (drabinka domowa),
`WorkoutDay.gymProfileId`, `Session.gymProfileId`/`Draft.gymProfileId` (siłownia
NA CZAS TEGO TRENINGU, domyślnie z dnia, zmienialna przełącznikiem w nagłówku —
Kamil czasem robi trening dzień wcześniej gdzie indziej). `snapLoadUp` / `snapLoadDown`
/ `snapLoadDownFrom` / `snapLoadNearest` w `logic.ts` — progresja i cele hantlowe
snapują do najbliższego REALNEGO ciężaru zamiast liczyć „cel + krok" w próżni.
`computeProgression` (9. parametr `ladder`), `deloadTargetFor`, `hyperTargetFor`
dostały opcjonalną drabinkę — brak = dawne zachowanie, żaden z 388 istniejących
testów nie wymagał przestrojenia. `kb_swing` wyłączony z mapowania na drabinkę
hantli (kettlebelle mają własną: 4/8/12/16/20/24), sztanga nietknięta.

`store.finishSession` bierze drabinkę z dnia SESJI (`gymForDay`), nie z globalnego
`activeGymProfileId`. Adaptacja celu z §24.1 działa, gdy siłownia sesji zgadza się
z siłownią dnia; `settings.activeGymProfileId` zostaje wyłącznie domyślną wartością
Kalkulatora talerzy w Więcej — **nie steruje już progresją**. Steppery −/+ przy
ciężarze serii skaczą po drabince (`snapLoadUp`/`snapLoadDownFrom`), nie po
„cel ± krok".

Migracje (bez bumpa `SCHEMA_VERSION`): `seedGymLaddersOnce` dosiewa profil My
Fitness Place + `wed.gymProfileId` + drabinkę domową (usunięcie przez użytkownika
trwałe, ten sam wzorzec co §19); `snapDumbbellTargetsOnce` dociąga ISTNIEJĄCE cele
(`targets` I `hyperTargets` — współdzielony `mapTargets`, patrz §25.7) do drabinki
ICH DNIA, pomijając ćwiczenia stojące w dniach o różnych siłowniach (niejednoznaczne).
Zweryfikowane: `row_db` 22 → 22,5, `lunges`/`incline_db` bez zmian (już pasują do
drabinki co 2), wypracowany cel 26 (RDL) snapuje do najbliższego hantla (25), NIE
wraca do wartości z seeda.

⚠️ **Drabinki obu siłowni to WSTĘPNY DOMYSŁ** (Kamil nie podał jeszcze dokładnych
list ze stojaków) — `LADDER_WELL_FITNESS`/`LADDER_MY_FITNESS_PLACE` w `seed.ts`,
jawnie oznaczone w komentarzu. UI edycji drabinki (Więcej → Siłownie — dla domu
i każdego profilu; Plan → wybór siłowni dnia) jest częścią tego zadania celowo:
Kamil poprawi wartości sam, gdy poda realne liczby, bez czekania na kolejny build.

### 25.9 P7-8 — tydzień treningowy = cykl rotacji, nie kratka kalendarza
Kamil: „kliknę pierwszy trening, a jest niedziela — powinien mi rozpocząć nowy
tydzień, bo robię sobie trening wcześniej jeden dzień, jak mam czas". `weeklyAdherence`
/ `weeklyReport` / `weeksSinceDeload` stały na kalendarzowym poniedziałku
(`mondayOf`) — Trening 1 zrobiony w niedzielę wpadał do tygodnia, który już się
rozliczył, a Treningi 2/3 tego samego cyklu lądowały w PUSTYM nowym tygodniu.

Nowa `trainingCycles()` dzieli ukończone sesje na cykle rotacji: nowy cykl otwiera
pierwsza sesja w historii, przerwa >10 dni, albo pozycja dnia w kolejności planu
≤ pozycji poprzedniej sesji GŁÓWNEJ (rotacja się cofnęła albo pełny obieg wrócił
na początek) — Z WYJĄTKIEM natychmiastowego powtórzenia TEGO SAMEGO dnia
(identyczny `dayId` jak poprzednia sesja główna), traktowanego jak duplikat/redo,
nie nowy cykl (spójne z §16 Zadanie 4: „dwa zapisy tego samego dnia liczą się
raz"). Dzień bonusowy nigdy nie otwiera cyklu ani nie przesuwa punktu odniesienia
pozycji. `weeklyAdherence`/`weeklyReport`/`weeksSinceDeload` przepisane na cyklach
— zachowany kształt zwracanych danych (`WeekAdherence` dostał `endIso`/`cycleNumber`
do etykiety „Cykl N · 3–9 sie" zamiast daty poniedziałku; „Ten tydzień" → „Ten
cykl" w UI). `actualWeeklyMuscleVolume` ŚWIADOMIE zostaje na oknie 7 dni (§12
INFO-1) — to metryka fizjologiczna, nie rozliczenie planu. Migracja: żadna — cykle
liczą się z istniejących sesji w locie.

Zweryfikowane na realnym stanie (`migrateState(null)` z historią startową): 9 sesji
z trzech tygodni dzieli się na dokładnie 3 czyste cykle `[mon,wed,fri]`, każdy
3/3 — dokładnie taki kształt, jaki dałaby stara kalendarzowa logika dla regularnej
rotacji poniedziałek/środa/piątek, więc refaktor nie psuje typowego przypadku.

### 25.10 Nie jest błędem (odnotowane, nie naprawiane)
- Brak PR przy przysiadzie 65×8 — 65 kg już było (widać w „Ostatnie:"), e1RM 82,3
  niższy od rekordu 87,5. P7-7 wyjaśnia to wprost w karcie zamiast zostawiać zagadkę.
- Suwnica 80 kg przy celu 120 kg — cel dosiany przez migrację z §19 był zgadywany
  (Kamil nigdy jej nie robił); po tej sesji §24.1 sam ściągnie go do tego, co
  realnie poszło.
- Nagłówek podsumowania na dwóch zrzutach wyglądał na nachodzący na pasek statusu —
  podsumowanie to zwykły ekran, nie modal, więc nie ma tu oczywistego mechanizmu
  nakładania; najpewniej artefakt zrzutu zrobionego w trakcie przewijania. Nie
  ruszone bez potwierdzenia, że widać to na żywo.

**Testy:** 481 łącznie (93 nowych — `weightVsReference`/`progressGoal` P7-1,
`compareSetToReference`/`isSetRecord` dominacja P7-2/P7-6, `computeProgression`
warianty `weightJustIncreased`/`mixedWorkingWeights`/`ladder`, migracja zakresu
planku, `sessionDuration` od `startedAt`, migracje `hyperTargets`, `snapLoadUp/
Down/DownFrom/Nearest`, migracje drabinki hantli, `trainingCycles` — wszystkie
8 scenariuszy ze specyfikacji P7-8 wprost). `npm run build` bez błędów.

---

## 26. Sesja 27.08.2026 — rozjazd celów, powrót po przerwie, talerze na wierzchu

Zgłoszenie Kamila ze zrzutu: uginanie bicepsa, komplet **3×12 na 17,5 kg**,
a karta dalej pokazuje cel 17,5 i pisze „ostatnio komplet, ale cel się nie
zmienił — sprawdź ciężar w Planie". Cztery zmiany, każda osobnym commitem.

### 26.1 P8-1 — cele Siły i Hipertrofii przestają się rozjeżdżać (root cause zgłoszenia)
- **Było:** `hyperTargetFor()` czytało `state.hyperTargets` z **bezwarunkowym
  pierwszeństwem**. Dla ćwiczeń, którym hipertrofia NIE zmienia zakresu
  powtórzeń (uginanie bicepsa 10–12), obie liczby opisują dokładnie ten sam
  ciężar — §5.7 pkt 2 mówi to wprost, ale ta reguła była **nieosiągalna**,
  bo cache sprawdzał się przed nią. Wystarczył jeden tydzień w drugim trybie
  albo ręczna zmiana celu w Planie (`setTarget` pisze WYŁĄCZNIE do `targets`),
  żeby dwie kopie tego samego ciężaru rozeszły się **na zawsze** — żadna nie
  doganiała drugiej.
- **Odtworzone 1:1 w symulacji** na stanie z historią: cel siłowy 18,75 (po
  komplecie 3×12), karta w Hipertrofii 17,5 — razem z sąsiednim kafelkiem
  („Allahy: ciężar właśnie wskoczył z 40 na 42,5"), który wyglądał poprawnie
  i przez to sugerował, że silnik działa.
- **Jest:** `hypertrophyKeepsRange(ex)` rozstrzyga, czy cel jest JEDEN.
  Ćwiczenia, którym hipertrofia PODNOSI zakres (bazowy `repMax ≤ 8`, np.
  wyciskanie 5–8 → 8–12, martwy 5–6 → 6–8), zachowują własny cel liczony przez
  e1RM — tam rozdział jest zamierzony. `finishSession` i `setTarget` nie
  tworzą już drugiej kopii; `setTarget` **kasuje** cel hipertrofii (bez tego
  odesłanie „popraw w Planie" było w tym trybie ślepym zaułkiem).
- **Migracja `unifyHyperTargetsOnce`** (flaga `hyperTargetsUnified`, bez bumpa
  `SCHEMA_VERSION`) scala to, co już się rozjechało — bierze **wyższą** z dwóch
  wartości (obie opisują ten sam ciężar, więc dalej posunięta jest świeższa),
  potem kasuje wpis z `hyperTargets`. Idzie na KOŃCU `applyOneTimeSeeds`, po
  wszystkich dosiewach ruszających cele.

### 26.2 P8-2 — powrót po przerwie: tydzień rozruchowy zamiast czwartego trybu
Kamil: „2 tyg. nie byłem na siłce i w przyszłym tygodniu wracam — może dać
jakąś opcję treningu rozruchowego?". **Osobny tryb nie jest do tego potrzebny:**
Deload robi dokładnie to, czego trzeba po przerwie (~90% ciężaru, POŁOWA serii,
RIR +2, **cele zamrożone** — §18.1), więc tydzień nie cofa progresji i nie kładzie
zakwasami. Brakowało tylko tego, żeby apka sama go zaproponowała: dotychczasowy
nudge patrzył wyłącznie na `weeksSinceDeload`/`detectPlateau` i **przerw w
treningach nie widział wcale**.
- `daysSinceLastSession` (pełne doby, tylko sesje ukończone) + `BREAK_DAYS = 10`
  — ten sam próg, który `trainingCycles` uznaje za „przerwa = nowy cykl" (§25.9),
  żeby cała apka miała jedną definicję przerwy.
- `comebackSuggestion(state, mode)` → `null` przy braku historii, przerwie poniżej
  progu i gdy tydzień już stoi na deloadzie.
- Pudełko „N dni przerwy" + przycisk **„Włącz tydzień rozruchowy"** na ekranie
  wyboru dnia; **wyklucza** nudge deloadu (mówią o tym samym rozwiązaniu z dwóch
  powodów — dwa bursztynowe pudełka pod sobą to szum).

### 26.3 P8-3 — „Ostatnie:" pokazuje ciężar KAŻDEJ serii + uczciwy komunikat
- `fmtLastEntries` brało ciężar wyłącznie z **pierwszej** serii i doklejało do
  niego powtórzenia wszystkich — trening `17,5×12 / 16,25×12 / 16,25×12`
  wyglądał jak `17,5×12/12/12`, czyli jak domknięty komplet na jednym ciężarze.
  Teraz różne ciężary rozwijają się per seria; jednolity zapis bez zmian.
- `ProgressGoal.refMixedWeights` + trzeci wariant komunikatu: „ostatnio komplet,
  ale serie szły na różnych ciężarach; domknij go na X kg". Poprzednia treść
  („sprawdź ciężar w Planie") obwiniała ustawienia za decyzję, którą silnik
  podjął świadomie (`mixedWorkingWeights`, §25.5).
- Ostatni wariant (jednolity komplet, a cel nie drgnął) mówi wprost o realnej
  przyczynie: **edycja sesji w Historii nie przelicza progresji wstecz**
  (`store.updateSession` tylko podmienia sesję). To zostaje jako otwarty temat.

### 26.4 P8-4 — talerze widoczne od razu przy ćwiczeniu
Kamil: „często korzystam z tego obrazka ile talerzy założyć — fajnie mieć małe
widoczne przy ćwiczeniu, a nie w rozwijanej liście". Rysunek jest tym, po co
sięga się W TRAKCIE ładowania sztangi. `PlateBar` dostał wariant `inline` (sam
rysunek, 28 px, bez podpisu pod spodem), pasek „45 kg · 10 + 2,5 na stronę"
stoi pod opisem ćwiczenia. Rozgrzewka i reszta zostają pod „Pomoc i szczegóły".
Wariant „cel lżejszy niż gryf" (uginanie na krótkim gryfie, którego apka nie
modeluje) **nie jest pokazywany** — nie niesie informacji do działania;
„brakuje X kg" zostaje. Liczby talerzy formatowane po polsku (2,5 nie 2.5).

### 26.5 P8-5 — edycja treningu w Historii przelicza progresję
Ostatni otwarty temat z §26.3: `store.updateSession` tylko podmieniało sesję,
więc cele zostawały policzone ze STARYCH liczb — po poprawieniu wyniku karta
w Treningu twierdziła „ostatnio komplet, a cel nie drgnął" i nie dawało się
tego naprawić inaczej niż ręczną zmianą celu w Planie.
- `sessionProgressionSummaries(state, session)` — matematyka progresji
  wydzielona z `finishSession` bez zmiany zachowania, żeby edycja liczyła
  DOKŁADNIE to samo co zakończenie treningu. **Kontrakt:** `state.sessions`
  nie zawiera liczonej sesji (punkt odniesienia ciężaru i „poprzednia sesja"
  są czytane właśnie stamtąd) — `finishSession` spełnia to naturalnie,
  `updateSession` filtruje sesję i wszystko, co wydarzyło się po niej.
- `recomputeTargetsForEditedSession(state, session)` — czysta funkcja
  zwracająca listę zmian. Przelicza **wyłącznie** ćwiczenia, dla których
  edytowana sesja jest NAJŚWIEŻSZA: jeśli po niej był kolejny trening tego
  ćwiczenia, to on wyznaczył obecny cel. Pełne odtwarzanie historii w przód
  świadomie NIE jest robione — cele niosą też ręczne korekty z Planu i dosiewy
  migracji, więc „przeliczenie wszystkiego od zera" umiałoby wyzerować rzeczy,
  których żadna sesja nie tłumaczy. Deload (cele zamrożone, §18.1) i sesja
  nieukończona nie ruszają celów.
- Historia mówi wprost, co się zmieniło: „Zapisano — cel przeliczony ·
  Ściąganie drążka: 50 kg → 52,5 kg". Bez tego poprawka wyglądałaby na
  kosmetyczną, a po cichu ruszała ciężary na następny trening.

**Testy:** 518 (38 nowych; 5 testów P7-9 przestrojonych — niezmiennik „wartość
nie ginie" zostaje, zmieniło się pole docelowe). Zweryfikowane w Chromium na
zbudowanym `docs/index.html`: 320/360/390 px bez poziomego scrolla, zero błędów
JS, przycisk rozruchowy przełącza tydzień na deload (18 → 12 serii, cel
wyciskania 45 → 40 kg), a poprawka 9 → 10 powt. w Historii podnosi cel
ściągania drążka 50 → 52,5 kg z komunikatem o przeliczeniu.

---

## 27. Sesja 17.09.2026 — przecinek w loggerze, e1RM i procentowy krok progresji

Sesja weryfikacyjna (pięć zgłoszeń ze zrzutów → `ZADANIA-P9.md`, skrypt dla Sonneta,
NIEWDROŻONY) plus trzy poprawki zrobione od razu.

### 27.1 Przecinek w polach loggera (BUG-2, którego nigdy nie dokończono)
Pola ciężaru i powtórzeń w `TrainScreen` oraz w edycji sesji w `HistoryScreen` były
jedynymi, które zostały przy antywzorcu z §12 BUG-2: `type="number"` sterowany liczbą
z `parseFloat(...) || 0`. Plan i Więcej dostały `NumberField` w lipcu, logger nigdy.
**Zmierzone w Chromium na buildzie sprzed poprawki: wpisanie `36,25` daje w polu
`3625`** — przecinek jest po cichu wyrzucany, a do sesji wchodzi ciężar 100× za duży,
który dalej napędza progresję, tonaż i rekordy. Klawiaturę numeryczną z przecinkiem
widać na zrzucie Kamila (Allahy w My Fitness Place).

`NumberField` dostał dwa opcjonalne propy, **domyślnie wyłączone** (Plan/Więcej/Progres
bez zmian): `emptyWhenZero` (zero jako puste pole — ćwiczenia z masą własną) oraz
`syncExternal` (pole nadąża za zmianą wartości Z ZEWNĄTRZ: steppery −/+,
`setWeightWithSync`, „Użyj" przy sugestii siłowni, przełączenie sesji w Historii, gdzie
wiersze są kluczowane indeksem). Synchronizacja nie walczy z pisaniem — gdy wpisany
tekst parsuje się do tej samej liczby co wartość, surowy tekst zostaje nietknięty, więc
`36,` w trakcie pisania nie zamienia się w `36`.

### 27.2 e1RM: Epley tylko do 10 powtórzeń (§18.5 domknięte)
`repFactor(reps)`: do 10 powtórzeń **dokładnie Epley** (`1 + reps/30`), wyżej każde
kolejne powtórzenie liczy się o **połowę słabiej** (`/60`). Powód: Kamil trenuje
w Hipertrofii, czyli 8–12, więc zawyżenie dotyczyło WIĘKSZOŚCI jego serii roboczych.
Mnożnik: 5/8/10 powt. bez zmian, 11 −1,2%, 12 −2,4%, 15 −5,6%, 20 −10%.

Dlaczego nie gotowy wzór: Brzycki i Lander są powyżej 10 powtórzeń **jeszcze bardziej
agresywne** od Epleya (przy 15 odpowiednio +63,6% i +72%); Lombardi/O'Conner są
łagodniejsze, ale zrywają ciągłość z Epleyem także w zakresie siłowym, gdzie Epley jest
wiarygodny. Ta funkcja jest ciągła i monotoniczna, więc ma **dokładną odwrotność** —
`weightForReps` dzieli przez ten sam `repFactor`, którym mnoży `e1rm`. To warunek
konieczny: na odwrotności stoi cel hipertrofii (`hyperTargetFor`).

**Bez migracji** — e1RM nigdzie nie jest przechowywane, liczy się w locie z zapisanych
serii, więc cała historia przelicza się spójnie; zapisane cele to kilogramy, nie e1RM.
Rekordy na historii startowej: hip thrust 55×12 77,0 → 75,2, allahy 40×15 60,0 → 56,7,
wspięcia 45×15 67,5 → 63,7; ćwiczenia robione w zakresie siłowym (≤10 powt.) nietknięte.
Cele hipertrofii po zaokrągleniu do `increment` wychodzą **identyczne** (bench 42,5,
row 57,5, squat 62,5, OHP 30, martwy 75) — zmiana nie rusza ciężarów roboczych.
Uwaga przy czytaniu starszych sekcji: przykłady e1RM w §25.3 i §25.6 (`20×12 = 28,0`,
`62,5×12 = 87,5`) liczone są STARYM wzorem — dziś odpowiednio 27,3 i 85,4.

### 27.3 Procentowy krok progresji (`Exercise.incrementPercent`, opcjonalny)
Drugi drobiazg z §18.5. Gdy ustawiony, `increment` przestaje być krokiem progresji
i zostaje **granulacją** (najmniejsze, co da się dołożyć na tym sprzęcie), a krok liczy
`effectiveIncrement(ex, target)` z procentu ciężaru roboczego — dociągnięty do
najbliższej wielokrotności granulacji, nigdy poniżej jednej. Zaokrąglenie do
NAJBLIŻSZEJ, nie w górę. Wpięte w `computeProgression` (zwykły skok, podwójny przy
RIR 3, bezpiecznik „2 × krok ≤ 15% ciężaru") i w `maxGainPerSession` (opcjonalny drugi
parametr z celem). `deloadTargetFor`/`hyperTargetFor`/steppery w loggerze celowo dalej
używają `increment` — tam chodzi o granulację sprzętu, nie o krok progresji.
Brak wartości = dotychczasowe zachowanie, więc bez migracji.

**Policzone na planie Kamila: przy DZISIEJSZYCH ciężarach procent nie zmienia prawie
nic** — 3/4/5% daje ten sam krok co dziś dla wszystkich pozycji poza martwym ciągiem
przy 5% (2,5 → 5 kg). Powód: granulacja sprzętu (2,5 kg na sztandze, 1–2 kg na
hantlach) jest już grubsza niż 3–5% jego obecnych obciążeń. Funkcja działa więc
w przód — trzyma tempo, gdy ciężary urosną (przysiad przy 100 kg i 4% → 5 kg, suwnica
przy 160 kg i 4% → 7,5 kg). **Druga połowa zgłoszenia z §18.5 — „2,5 kg na ławce 45 kg
to 5,5%, za ostro" — NIE jest rozwiązywalna programowo:** mniej niż 2,5 kg nie da się
dołożyć do sztangi przy talerzach od 1,25 kg. To sprzęt, nie kod — z talerzami 0,5 kg
wystarczy ustawić „Przyrost (kg)" na 1 i dopisać 0,5 do listy talerzy.

### 27.4 Stan testów
518 → **542** (24 nowe: 12 na e1RM łącznie ze zgodnością z Epleyem do 10 powt.,
ciągłością w punkcie zgięcia, monotonicznością, „nigdy wyżej niż Epley" na 40
wartościach i dokładną odwrotnością; 12 na `effectiveIncrement` i progresję procentową).
Żaden z 518 istniejących nie wymagał przestrojenia — okazało się, że ani jeden nie
sprawdzał e1RM powyżej 10 powtórzeń. Poprawiona tylko NAZWA jednego testu i podpis
wykresu w Progresie (nie obiecuje już konkretnego wzoru).
