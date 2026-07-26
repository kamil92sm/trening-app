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
- **`Session`**: `id, dayId, date(ISO), entries[], completed`
- **`BodyEntry`**: `date(YYYY-MM-DD), weight, waist?` — `waist` (cm) do wykresu rekompozycji
- **`AppState`**: `version, exercises[], days[], targets(exId→kg), sessions[], body[], squash[], settings, historySeeded?, historyTargetsSeeded?`
  - `settings`: `name, barWeight, plates[], restSeconds, sound, gistToken?, gistId?, autoBackup?, lastBackup?`
  - `historySeeded?`: flaga jednorazowego dosiewu historii startowej (`history-seed.ts`)
  - `historyTargetsSeeded?`: flaga jednorazowego doganiania `targets` do progresji z historii
    sesji (`seed.ts: catchUpTargetsFromHistory`) — patrz §12 BUG-1

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

---

## 6. Plan treningowy (źródło prawdy — seed.ts)

Ciężary = „na ten tydzień". Hantle podane jako ciężar na jedną rękę (2× = para).

### PONIEDZIAŁEK — Góra + Pośladki
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Wyciskanie sztangi płasko | 3×5–8 | 45 kg |
| 2 | Hip Thrust ze sztangą | 3×8–12 | 57,5 kg |
| 3 | Wiosłowanie sztangą | 3×6–8 | 60 kg |
| 4 | Wznosy bokiem hantli | 3×12–15 | 2×9 kg |
| 5 | Uginanie bicepsa (sztanga) | 2×10–12 | 17,5 kg |
| 6 | Allahy (brzuch) | 3×10–15 | 37,5 kg |

### ŚRODA — Ciężki Dół + Klatka Skos
| # | Ćwiczenie | Serie×Zakres | Ciężar |
|---|-----------|-------------|--------|
| 1 | Przysiad ze sztangą | 3×5–8 | 65 kg |
| 2 | Martwy ciąg klasyczny | 2×5–6 | 77,5 kg |
| 3 | Wyciskanie hantli skos | 3×8–12 | 2×16 kg |
| 4 | Zakroki z hantlami | 3×10–12 | 2×14 kg |
| 5 | Wspięcia na palce | 3×10–15 | 45 kg |
| 6 | Plank (deska) | 4×40 s | +10 kg |

### PIĄTEK — Góra II + Tył Ud
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

`npm run build` produkuje **jeden samodzielny plik `docs/index.html`** (~280 KB,
wszystko inline). Jak to działa:

1. **PWA head jest w źródłowym `index.html`** (root projektu) — meta Apple
   (`apple-mobile-web-app-capable`, `apple-mobile-web-app-title=Trening`, status-bar,
   `viewport-fit=cover`), ikona `apple-touch-icon` (sztanga, data-URI PNG) i manifest
   data-URI. Vite przenosi ten head do buildu bez zmian — nic nie trzeba dostrzykiwać.
2. **`scripts/singlefile.mjs`** bierze `dist/index.html` i inline'uje do niego JS i CSS
   (z escapem `</script>` w stringach), wynik zapisuje do `docs/index.html`.
3. `docs/` jest w gicie (to folder publikacji GitHub Pages), `dist/` w `.gitignore`.

Deploy = `npm run build` → commit → `git push`. Pages aktualizuje się w 1–2 min.

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
