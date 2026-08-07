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
  trybów: `exerciseForMode(ex, "deload")` zostawia zakres powtórzeń bez zmian, `rir: ex.rir + 2`
  (schodzisz ciężarem, nie powtórzeniami). Cel liczy `deloadTargetFor()` — 65% ZAWSZE celu
  siłowego (`targets`, nigdy hipertrofii), zaokrąglone do `increment`. Logger dobija o jedną
  serię mniej (min. 2). **Progresja WYŁĄCZONA:** `finishSession` przy `mode==="deload"` nie
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
| 5 | Uginanie bicepsa (sztanga) | 2×10–12 | 17,5 kg |
| 6 | Allahy (brzuch) | 3×10–15 | 37,5 kg |

### ŚRODA ("Trening 2" w apce) — Ciężki Dół + Klatka Skos
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Przysiad ze sztangą | 3×5–8 | 65 kg |
| 2 | Martwy ciąg klasyczny | 2×5–6 | 77,5 kg |
| 3 | Wyciskanie hantli skos | 3×8–12 | 2×16 kg |
| 4 | Zakroki z hantlami | 3×10–12 | 2×14 kg |
| 5 | Wspięcia na palce | 3×10–15 | 45 kg |
| 6 | Plank (deska) | 4×40 s | +10 kg |

### PIĄTEK ("Trening 3" w apce) — Góra II + Tył Ud
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Wyciskanie żołnierskie (OHP) | 3×6–8 | 32,5 kg |
| 2 | Ściąganie drążka | 3×8–10 | 50 kg |
| 3 | RDL z hantlami | 3×8–12 | 2×22 kg |
| 4 | Wyciskanie hantli płasko | 3×8–12 | 2×17,5 kg |
| 5 | Wiosłowanie hantlem | 2×10–12 | 20 kg |
| 6 | Francuz (triceps) | 2×10–12 | 22,5 kg |

### BONUS (opcjonalny) — Ramiona, Łydki i Core (Pump)
Wznosy bokiem 3×12–15 · Uginanie bicepsa 2×10–12 · Francuz 2×10–12 ·
Wspięcia na palce 3×10–15 · Allahy 3×10–15 · Wiosłowanie hantlem 2×10–12.
Cel: dobić partie niedotrenowane w planie 3-dniowym (barki, ramiona, łydki, core).

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
  **Nadpisanie jest PER DZIEŃ, nie globalne na ćwiczeniu** — dzień bonusowy dzieli
  z planem głównym te same pozycje, więc dołożenie serii w „Treningu 1" nie może
  po cichu rozdmuchać bonusu. Bez bumpa `SCHEMA_VERSION` (pole opcjonalne).
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
  2. ciężar bez zmian → **powtórzenia z ostatniego treningu, seria po serii**,
     przycięte do zakresu bieżącego trybu (12/11 wraca jako 12/11 — masz pobić
     swój wynik, nie zgadywać go od zera);
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
