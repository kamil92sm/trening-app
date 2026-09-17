# P9 — zgłoszenia Kamila (sesja 17.09.2026): deload, rekordy, obca siłownia

> ## ✅ WDROŻONE W CAŁOŚCI (17.09.2026)
> Wszystkie osiem zadań zrobione, każde osobnym commitem, w kolejności z tego
> skryptu. **P9-3 wdrożony w wariancie (A)** — decyzja Kamila. Podsumowanie,
> zmierzone liczby i to, czego świadomie NIE ruszono: `CLAUDE.md` §29.
> Ten plik zostaje jako zapis diagnozy (root cause'y i liczby sprzed poprawek).
>
> Jedyna rzecz z tego skryptu, której NIE zrobiono: `weightStep` dla My Fitness
> Place — wymaga realnego skoku stosu od Kamila, nie zgadywania w seedzie.
> Formularz profilu (Więcej → Siłownie) ma to pole, więc da się ustawić bez buildu.

Skrypt wykonawczy dla Sonneta. **Wszystkie diagnozy niżej są ZWERYFIKOWANE** na kodzie
i policzone skryptami na świeżym stanie (`migrateState(null)` — seed + historia startowa,
9 sesji). Przy każdym zadaniu jest liczba, którą musisz umieć odtworzyć PRZED poprawką.

Kolejność: **P9-1 → P9-2 → P9-5 → P9-4 → P9-6 → P9-3 → P9-7 → P9-8**.
Każde zadanie **osobnym commitem**. P9-3 jest decyzją treningową (patrz „Do potwierdzenia
przez Kamila") — nie wdrażaj go bez odpowiedzi.

## Zanim zaczniesz

```bash
npm install      # node_modules nie ma w gałęzi — bez tego `npm test` i `npm run build` padną
npm test         # baseline: 518 testów, "WSZYSTKIE TESTY OK"
```

Gałąź: `claude/deload-records-verification-e7fndt` (już aktywna, == `main`).
Deploy: `npm run build` → commit `docs/index.html` **i** `docs/sw.js` razem → push.

**Pułapka 1 (migracje):** `migrateState()` w ścieżce „aktualny schemat" (`seed.ts`) przykrywa
seed danymi użytkownika — sama zmiana `SEED_*` **nie dotrze do telefonu Kamila**. Każda
zmiana planu/ustawień potrzebuje jednorazowej migracji z własną flagą w `AppState`
(wzorzec: `planVolumeBumpSeeded`, `rdlTargetFixed`, `hyperTargetsUnified`).
**Bez bumpa `SCHEMA_VERSION`** — nowe pola opcjonalne.

**Pułapka 2:** `resetAll()` w `store.tsx` ustawia KAŻDĄ nową flagę migracji na `true`.

**Pułapka 3:** nie zmieniaj sygnatur, na których stoi 518 testów. Nowe zachowania wpinaj
**opcjonalnym parametrem** — brak parametru = dzisiejsze zachowanie.

**Pułapka 4 (nowa, dotyczy P9-4):** `personalBests` / `isSetRecord` / `compareSetToReference`
NIE dostają dziś trybu tygodnia. Nie dokładaj `TrainingMode` do ich sygnatur — gate'uj
w wywołującym (`TrainScreen`), tak jak `TrainScreen` gate'uje dziś karty progresji
(`summarySession?.mode === "deload"`).

---

## P9-1 — obca siłownia sugeruje CIĘŻSZY ciężar niż cel (i to w deloadzie)

### Objaw (screen 4)
Deload, „Trening 1" zrobiony w My Fitness Place. Uginanie bicepsa: `cel 15,5 kg`, a pod
spodem niebieski pasek: **„My Fitness Place: sugerowany 20 kg (zamiast 15,5 kg)"**
z przyciskiem „Użyj". Kamil: *„Dlaczego my fitness sugerowany 20 jak ostatnio miałem 15,5
a tu mam deload i daje mi większy ciężar? Why?"*. Ma rację — to +29% w tygodniu, którego
całym sensem jest zejście z obciążenia.

### Root cause (ZWERYFIKOWANY)
`nearestAchievable(target, bar, plates)` (`src/lib/logic.ts:1693`) wybiera najbliższy
element `achievableWeights()` (`:1680`), a ta lista **zaczyna się od samego gryfu** —
nie ma w niej niczego lżejszego niż `bar`. Profil My Fitness Place ma `barWeight: 20`
(`seed.ts`, `MY_FITNESS_PLACE_PROFILE`), więc dla celu 15,5 kg „najbliższy osiągalny"
to dosłownie pusty gryf:

```
nearestAchievable(15.5, 20, [25,20,15,10,5,2.5,1.25]) = 20
suggestedWeightForProfile(curl_bb, 15.5, MFP)        = 20   // = barWeight
suggestedWeightForProfile(bench_bb|row_bb|ohp|french|hipthrust, 15.5, MFP) = 20
```

`suggestedWeightForProfile` (`:1712`) nie ma ŻADNEGO ograniczenia „nie w górę" — zwraca
sugestię, gdy tylko różni się od celu. Kamil robi uginanie na krótkim/łamanym gryfie,
którego apka nie modeluje, więc każdy cel poniżej 20 kg dostaje tę sugestię.

**Dowód niespójności wewnątrz jednej karty:** ten sam przypadek („cel lżejszy niż gryf")
jest już świadomie WYCISZONY dla rysunku talerzy — `TrainScreen.tsx:1287-1292`, komentarz
z §26.4: *„Cel lżejszy niż gryf … nie niesie żadnej informacji do działania"*. Na screenie 4
widać dokładnie to: karta uginania **nie ma** paska talerzy, ale **ma** niebieską sugestię
20 kg. Dwie części tej samej karty rozstrzygają ten sam przypadek odwrotnie.

### Co zrobić
W `suggestedWeightForProfile` (`logic.ts:1712`):

1. Gałąź `barbell`: policz `nearestAchievable` jak dotąd, ale **odrzuć sugestię w górę
   większą niż `ex.increment`**. Gdy najbliższy osiągalny przekracza `target + ex.increment`,
   weź **największy osiągalny ≤ target**; gdy takiego nie ma (cel lżejszy niż gryf) →
   zwróć `null` (spójnie z PlateBar).
2. Gałąź `weightStep` (hantle/maszyny): to samo — `snapToStep` może zaokrąglić w górę
   o pół kroku i to jest OK, ale wynik nigdy nie może przekroczyć `target + ex.increment`;
   inaczej schodzimy krokiem w dół.
3. Deload: sugestia **w górę względem celu deloadu nie ma sensu nigdy**. Najprościej
   przekazać z `TrainScreen` opcjonalną flagę (albo po prostu nie renderować paska, gdy
   `draft.mode === "deload" && gymSuggestion > entry.targetWeight`). Wybierz jedno
   i opisz w komentarzu — wolę gate w `logic.ts` przez opcjonalny 4. parametr
   `allowHeavier = true`, bo wtedy reguła stoi w jednym miejscu i da się ją przetestować.

**NIE** ruszaj `nearestAchievable` ani `achievableWeights` — stoją na nich testy z FEAT-1
i rozgrzewka (`warmupPlan`). Zmiana idzie WYŁĄCZNIE w `suggestedWeightForProfile`.

### Testy (dopisz do `tests/logic.test.ts`)
- `suggestedWeightForProfile(curl_bb, 15.5, MFP) === null` (cel lżejszy niż gryf).
- cel 51 kg przy gryfie 20 i talerzach z 1,25 → sugestia 52,5 (w górę o ≤ increment, OK).
- cel 51 kg przy profilu BEZ małych talerzy (np. `[25,20,15,10,5]`, skok 10 kg) →
  sugestia 50, nie 60.
- hantle: `weightStep: 2`, cel 15,5 → 16 (w górę o 0,5 ≤ increment) — bez zmian.
- deload/`allowHeavier: false`: cel 15,5 → nigdy nic > 15,5.

### Kryterium akceptacji
Na screenie 4 karta uginania bicepsa w deloadzie **nie pokazuje żadnego niebieskiego paska**
(tak jak nie pokazuje paska talerzy). Żadna sugestia w apce nie jest wyższa od celu
o więcej niż `increment` ćwiczenia.

---

## P9-2 — deload schodzi do 71% celu zamiast ~90% (podwójne podłogowanie)

### Objaw
Nie zgłoszony wprost, ale wypadł z weryfikacji przy pytaniu Kamila „po deloadzie wracają
mi obciążenia?". Deload z definicji (§18.1, `DELOAD_LOAD_FACTOR = 0.9`) ma dawać **~90%**
celu. Realnie, na świeżym stanie:

```
bench_db      cel 17,5 → deload 12,5 = 71%
ohp_db        cel 14   → deload 10   = 71%
lateral_cable cel 7,5  → deload 5    = 67%
row_db_bent   cel 16   → deload 12,5 = 78%
kb_swing      cel 16   → deload 12   = 75%
…razem 23 ćwiczenia z bazy schodzą poniżej 85% celu
```

### Root cause (ZWERYFIKOWANY)
`deloadTargetFor` (`logic.ts:1083`) podłogowuje **DWA RAZY**:

```ts
const floored = Math.floor((strengthTarget * DELOAD_LOAD_FACTOR) / inc) * inc;   // 1. do increment
return isDumbbellSnappable(ex) && ladder.length > 0
  ? snapLoadDown(floored, ladder)                                                 // 2. w dół po drabince
  : floored;
```

Dla `bench_db`: cel 17,5 · `increment` 2 · drabinka Well Fitness `[…,10; 12,5; 15; 17,5…]`.
`0,9 × 17,5 = 15,75` → podłoga do 2 → **14** → `snapLoadDown(14, drabinka)` → **12,5**.
Gdyby snapować po drabince **prosto z 15,75**, wynik to **15 = 86%** — wartość, która
istnieje jako realny hantel i mieści się w założeniu „nigdy powyżej 90%".
`increment` nie ma tu żadnej roli: przy drabince to ona jest zbiorem realnych ciężarów,
a nie wielokrotności kroku.

### Co zrobić
```ts
const raw = strengthTarget * DELOAD_LOAD_FACTOR;
if (isDumbbellSnappable(ex) && ladder.length > 0) return snapLoadDown(raw, ladder);
return Math.floor(raw / inc) * inc;
```
Czyli: **drabinka zamiast `increment`, nie po nim.** Gwarancja z §20.2 („nigdy powyżej
`DELOAD_LOAD_FACTOR`") zostaje — `snapLoadDown` tylko schodzi.

### Czego NIE ruszać
Ćwiczenia BEZ drabinki (sztanga, maszyny, wyciągi) dalej podłogują do `increment` i przy
zgrubnym kroku wypadają nisko (`lateral_cable`: cel 7,5, krok 2,5 → 5 = 67%; jedyną
alternatywą byłoby 7,5, czyli 100%, czyli brak deloadu). To jest **granulacja sprzętu,
nie błąd** — §20.5 rozstrzygnęło to samo dla zakroków (86%). Zostaw i **dopisz jedno
zdanie do komentarza funkcji**, żeby następna weryfikacja nie zgłaszała tego znowu.

### Testy
- `deloadTargetFor` dla `bench_db` z drabinką Well Fitness = **15** (było 12,5).
- Regresja §20.2: dla ŻADNEGO ćwiczenia z bazy `deloadTargetFor ≤ 0,9 × cel` (test już
  jest — musi dalej przechodzić).
- Nowy test odwrotny: dla każdego ćwiczenia **z drabinką** wynik ≥ `0,8 × cel`
  (po poprawce spełnione; przed poprawką `bench_db` i `ohp_db` go łamią).
- `isHold` (plank) bez zmian — obciążenie zostaje (istniejący test).

---

## P9-5 — plank: obciążenia nie widać NIGDZIE w loggerze (root cause dwóch zgłoszeń)

### Objaw (screeny 1 i 2)
Screen 1: *„Też przy planku powinien chyba być rekord jak jest nowa waga i czas"*.
Screen 2: seria 2 = `15 × 35 s`, obok bursztynowe **„ost. 40"** — *„No ostatnio 40 ale
przecież waga mniejsza była"*.

### Root cause (ZWERYFIKOWANY)
Dla `isHold` apka **nie pokazuje obciążenia w ani jednym miejscu, które Kamil widzi
podczas serii**:

1. `fmtLastEntries` (`logic.ts:1790`) dla `isHold` robi dosłownie
   `e.sets.map(s => s.reps).join("/")` — **waga jest wycinana**. Stąd
   `Ostatnie: 40/40/40/40 · 40/40/40/35 · 40/40/40/40` bez ani jednego „kg".
2. Kratka `ost. N` (`TrainScreen.tsx:1573`) też pokazuje same sekundy.
3. Pełny zapis (`fmtKg(ref.weight) × reps s`) jest WYŁĄCZNIE w `title` kratki —
   czyli w tooltipie, którego na iPhonie **nie da się wywołać**.

Skutki dokładnie takie, jak na screenach:
- Kamil nie ma jak sprawdzić, czy „waga była mniejsza" — i dlatego pyta.
- Reguła rekordu dla planku jest już poprawna (P7-6, `isSetRecord`, `logic.ts:754`):
  sprawdzone, `40 s @ 15 kg` przy rekordzie `40 s @ 10 kg` **zwraca `"hold"`**,
  a przy rekordzie `40 s @ 15 kg` zwraca `null`. Brak PR na screenie 1 oznacza więc,
  że rekord JUŻ stoi na 15 kg — ale apka nie daje tego jak zobaczyć, więc wygląda
  na zepsutą.
- Bursztyn na screenie 2 oznacza `compareSetToReference → "worse"`, a ta funkcja dla
  `isHold` zwraca cokolwiek innego niż `"incomparable"` **tylko przy IDENTYCZNYM
  obciążeniu** (`logic.ts:792-800`). Czyli wg danych apki referencja też szła na 15 kg.
  Kamil nie ma jak tego zweryfikować — i to jest tu jedyny realny problem.

### Co zrobić
1. `fmtLastEntries`, gałąź `isHold`: dopisz obciążenie **tą samą regułą, co dla reszty** —
   jednolite → raz z przodu (`15×40/40/40/40`), różne → per seria
   (`15×40/15×40/10×40`). Ciężar 0 (plank bez obciążenia) pomiń, żeby nie robić
   `0×40/40/40`.
2. Kratka `ost. N` dla `isHold`: gdy obciążenie referencji **różni się** od dzisiejszego,
   pokaż je w kratce (`ost. 40 @ 10`), a nie tylko w `title`. Gdy jest takie samo —
   zostaje `ost. 40` (bez szumu). Uwaga na szerokość: kratka jest `hidden xs:inline-block`
   (breakpoint `xs: 360px`, §23) — **zmierz 320/360/390/430 px i sprawdź, że nie ma
   poziomego scrolla**; jeśli się nie mieści, skróć do `ost. 40 (10 kg)` albo podnieś
   próg widoczności, ale NIE rozpychaj wiersza.
3. `Rekord: 40 s @ 15 kg` w „Pomoc i szczegóły" już jest (P7-7, `TrainScreen.tsx:1397`) —
   **sprawdź tylko, czy renderuje się dla planku** i czy `holdWeight` nie jest 0.

### Testy
- `fmtLastEntries` dla `isHold`: jednolity ciężar → `15×40/40/40`; różny → per seria;
  ciężar 0 → same sekundy (jak dziś).
- Istniejące testy `fmtLastEntries` dla nie-hold **muszą przejść bez zmian**.

### Kryterium akceptacji
Ze screena 1/2 da się odczytać, na jakim obciążeniu szedł każdy poprzedni plank, bez
wchodzenia w Historię i bez tooltipa.

---

## P9-4 — rekordy i porównania „ost. N" w tygodniu deloadu

### Objaw (screeny 3 i 4)
Kamil: *„Po co rekordy na deloadzie?"*. Na obu screenach z deloadu każda kratka `ost. N`
świeci **bursztynem** (`ost. 8`, `ost. 11`, `ost. 12`, `ost. 15`) — apka informuje, że
wypadł gorzej niż ostatnio, w tygodniu, którego CAŁYM SENSEM jest wypaść gorzej.

### Root cause (ZWERYFIKOWANY)
Cały aparat rekordów i porównań **nie zna trybu tygodnia** — w przeciwieństwie do kart
progresji, które deload już poprawnie wycisza (`TrainScreen.tsx:840`,
`summarySession?.mode === "deload"` → jeden komunikat zamiast kart):

| miejsce | plik:linia | gate na deload |
|---|---|---|
| toast „Rekord!" po zaliczeniu serii | `TrainScreen.tsx:533-542` | **brak** |
| plakietka `PR` + obwódka wiersza | `TrainScreen.tsx:1471-1482`, `:1577` | **brak** |
| karta „🏆 Rekordy tej sesji" w podsumowaniu | `TrainScreen.tsx:710-734`, `:825` | **brak** |
| kolor kratki `ost. N` | `TrainScreen.tsx:1550` | **brak** |

Do tego `referenceEntry` (`logic.ts:1423`) świadomie **pomija deloady jako punkt
odniesienia** — czyli w deloadzie apka porównuje lekki, celowo ścięty wynik z pełnym
tygodniem roboczym. Bursztyn jest wtedy gwarantowany i nie niesie żadnej informacji.

### Co zrobić
W `TrainScreen` (gate w wywołującym — patrz Pułapka 4), przy `draft.mode === "deload"`
/ `summarySession?.mode === "deload"`:

1. **Nie licz i nie pokazuj rekordów**: bez toastu, bez plakietki `PR`, bez obwódki,
   bez karty „🏆 Rekordy tej sesji" (`recordHits` zostaje pustą tablicą).
2. **Kratka `ost. N` zostaje, ale bez koloru** — sam tekst + istniejące kropkowane
   podkreślenie przy innym obciążeniu. Historia jest przydatna, ocena „gorzej" nie.
3. W pudełku deloadu na ekranie treningu (tam, gdzie dziś stoi komunikat o zamrożonych
   celach) dopisz **jedno zdanie**: że w tym tygodniu apka nie liczy rekordów ani
   porównań, bo lżejszy trening to plan, nie regres.

### Czego NIE ruszać
`personalBests` (`logic.ts:714`) dalej **liczy sesje deloadowe do rekordu życia** — wynik
jest wynikiem, a wykluczenie ich zaniżałoby rekord bez powodu. Zmiana dotyczy wyłącznie
**świętowania rekordu w trakcie deloadu**, nie samej definicji rekordu.

### Testy
Logika `logic.ts` się tu nie zmienia, więc testy jednostkowe są cienkie. Zweryfikuj
**w Chromium na zbudowanym `docs/index.html`**: włącz tryb Deload, zalicz serię dającą
rekord (np. plank na tym samym obciążeniu, dłużej niż rekord) → **brak toastu, brak PR,
brak karty w podsumowaniu**; przełącz na Hipertrofię, powtórz → wszystko wraca.
Opisz wynik w commicie.

---

## P9-6 — linia „Ostatnie:" miesza tygodnie deloadu z roboczymi, bez oznaczenia

### Objaw
Pochodna P9-5/P9-4, wyszła przy weryfikacji: `Ostatnie:` i kratka `ost. N` mogą mówić
o **dwóch różnych sesjach**, bez żadnego sygnału dla użytkownika.

### Root cause (ZWERYFIKOWANY)
- `lastEntries` (`logic.ts:1394`) — linia „Ostatnie:" — bierze 3 ostatnie ukończone sesje
  **łącznie z deloadami** (ma nawet pole `mode`, ale UI go nie używa, `TrainScreen.tsx:1327`).
- `referenceEntry` (`logic.ts:1423`) — kratka `ost. N`, `prefillRepsForEntry`, `progressGoal` —
  **pomija deloady**.

Po tygodniu deloadu pierwszy wpis w „Ostatnie:" to deload (niższy ciężar), a `ost. N`
i „Do skoku ciężaru" liczą się od sesji **przed** nim. Dwie liczby na jednym ekranie
opisują różne treningi i nic tego nie tłumaczy.

### Co zrobić
W linii „Ostatnie:" oznacz wpisy z deloadu — minimalnie, bez rozpychania: `ᴰ` albo
`(deload)` przy tym jednym wpisie, np. `40×12/12 ᴰ · 45×12/12/12 · 45×12/12/11`,
plus jedno słowo legendy w „Pomoc i szczegóły". `fmtLastEntries` dostaje opcjonalny
parametr (domyślnie wyłączony → istniejące testy bez zmian), bo `LastEntry.mode` już niesie
potrzebną informację.

### Testy
- `fmtLastEntries` z włączonym oznaczeniem: wpis `mode: "deload"` dostaje znacznik,
  pozostałe nie.
- Bez parametru: wynik **identyczny** jak dziś (istniejące testy).

---

## P9-3 — deload liczy się od celu SIŁOWEGO, a Kamil trenuje w hipertrofii

> **DECYZJA TRENINGOWA — nie wdrażaj bez potwierdzenia Kamila.** Diagnoza jest pewna,
> wybór rozwiązania nie.

### Objaw (screen 3)
Deload, „Trening 1". Wiosłowanie sztangą: `2×6–8 powt. · cel 55 kg · RIR 4`, a linia
`Ostatnie:` mówi `57,5×12/12/12 · 57,5×12/12/10 · 57,5×12/11/10`. Czyli tydzień „lżejszy"
to 55 kg × 8 po tygodniach 57,5 kg × 12 — **96% ciężaru przy 2/3 powtórzeń**, i do tego
w innym zakresie niż ten, w którym Kamil realnie trenuje.

### Root cause (ZWERYFIKOWANY)
Dwie rzeczy naraz, obie **zgodne z dzisiejszą specyfikacją** (§5.7, §18.1) — to nie
jest regres, tylko skutek, którego nikt nie policzył na liczbach:

1. `deloadTargetFor` (`logic.ts:1083`) bierze **zawsze `state.targets`** (cel siłowy),
   nigdy `hyperTargets`. Dla ćwiczeń, którym hipertrofia ZMIENIA zakres (bazowy
   `repMax ≤ 8`), cel hipertrofii jest osobny i NIŻSZY — deload liczy się wtedy od
   liczby, na której Kamil nie trenował od tygodni:

   | ćwiczenie | cel siły | cel hipertrofii | deload | deload/hipertrofia |
   |---|---|---|---|---|
   | `row_bb`   | 62,5 | 57,5 | 55   | **96%** |
   | `bench_bb` | 45   | 42,5 | 40   | **94%** |
   | `deadlift` | 80   | 75   | 70   | **93%** |
   | `squat`    | 65   | 62,5 | 57,5 | **92%** |
   | `ohp`      | 32,5 | 30   | 27,5 | **92%** |

   Dla ćwiczeń z niezmienionym zakresem (hip thrust, uginanie, allahy — po P8-1 mają
   JEDEN cel) wszystko jest poprawne: 86–89%.

2. `exerciseForMode(ex, "deload")` (`logic.ts:972-981`) zwraca **bazowy** zakres
   powtórzeń, czyli siłowy. Kamil trenuje `row_bb` w 8–12, a tydzień deloadu każe mu
   robić 6–8. To nie jest „lżejsza wersja jego treningu", tylko inny trening.

Razem: tydzień deloadu dla ruchów ciężkich daje **~95% roboczego ciężaru** i mniej
powtórzeń — czyli bliżej tygodnia siłowego niż odpoczynku.

### Do potwierdzenia przez Kamila (zadaj to pytanie, zanim ruszysz kod)
Co ma znaczyć deload, gdy tydzień wcześniej był w Hipertrofii:
- **(A)** lżejsza wersja TEGO, co realnie robił: `deloadTargetFor` liczy od
  `targetForMode(state, ex, poprzedni tryb)` (czyli od `hyperTargetFor`, gdy ostatnie
  sesje były hipertroficzne), a zakres powtórzeń zostaje zakresem TAMTEGO trybu
  (`row_bb` 8–12 @ ~52 kg zamiast 6–8 @ 55 kg). **To jest moja rekomendacja** — jest
  spójne z tym, co Kamil widzi w „Ostatnie:", i realnie tnie zmęczenie.
- **(B)** zostaje jak jest (deload = odpoczynek od OBU trybów, liczony od siły, §5.7) —
  wtedy trzeba to **napisać wprost w pudełku deloadu**, bo dziś wygląda jak błąd.

### Jeśli (A)
- „Poprzedni tryb" = tryb ostatniej ukończonej sesji poza deloadem (masz to już
  w `referenceEntry`/`lastEntries` → pole `mode`). Nowa funkcja
  `modeBeforeDeload(state): TrainingMode` w `logic.ts`, domyślnie `"strength"`.
- `deloadTargetFor` dostaje **opcjonalny** parametr `baseMode` (brak = dzisiejsze
  zachowanie, żeby 518 testów nie wymagało przestrojenia).
- `exerciseForMode(ex, "deload")` musi wtedy umieć nałożyć deload NA tryb bazowy —
  najprościej `exerciseForMode(exerciseForMode(ex, baseMode), "deload")`, z zachowaniem
  `rir: min(4, rir + 2)` liczonego od RIR tamtego trybu.
- Testy: `row_bb` po tygodniach hipertrofii → deload 8–12 powt. i ciężar ≤ 0,9 ×
  celu hipertrofii; po tygodniach siły → dokładnie dzisiejszy wynik.

---

## P9-7 — plank: „ostatnio komplet, dziś powinien wskoczyć", a cel stoi (DIAGNOSTYKA)

### Objaw (screen 1)
`4×40 s · cel 15 kg`, `Ostatnie: 40/40/40/40 · 40/40/40/35 · 40/40/40/40`,
`Do skoku ciężaru: 4×40 s — ostatnio komplet, dziś powinien wskoczyć` (na zielono).
Jeśli ostatni trening był kompletem, to cel **powinien już być 20 kg** — a jest 15.

### Czego NIE znalazłem (sprawdzone, działa poprawnie)
```
computeProgression(plank, 15, 4×{40 s, done})
  → { status: "up", nextWeight: 20, message: "Wszystkie serie po 40 s — dokładasz obciążenie: 20 kg." }
```
i to samo w trybie siły, hipertrofii i deloadu. Migracja zakresu 30–40 s (P7-10) jest
w stanie (`repMin: 30, repMax: 40`), `hypertrophyKeepsRange(plank) === true`, więc
hipertrofia zapisuje progresję do `targets` (P8-1), nie do `hyperTargets`. Silnik jest OK.

### Hipotezy do sprawdzenia NA REALNYM STANIE KAMILA (nie da się rozstrzygnąć z kodu)
Poproś go o **backup JSON** (Więcej → Backup) i sprawdź w tej kolejności:
1. `targets.plank` i `hyperTargets.plank` — czy gdzieś nie stoi 20, którego widok nie czyta.
2. `mode` trzech ostatnich sesji z `plank`. Jeśli **najświeższa była deloadem**, cele są
   zamrożone (`store.tsx`, `finishSession` → `if (mode === "deload") return d`), a
   `referenceEntry` deloady pomija — więc „Do skoku ciężaru" liczy się od sesji sprzed
   deloadu i mówi „ostatnio komplet" o tygodniu, po którym progresja i tak nie zadziałała
   (bo zadziałała, a potem był deload… albo nie zadziałała wcale). **To jest najbardziej
   prawdopodobna przyczyna** i łączy się bezpośrednio z P9-6.
3. Liczba serii w tamtej sesji vs `targetSets` + `wed.setsOverride`. `progressGoal`
   (`logic.ts:1558`) tnie referencję `slice(0, modeEx.targetSets)`, więc sesja `40/40/40/40/35`
   (5 serii) daje „komplet" po 4 pierwszych — i `computeProgression` też, więc cel i tak
   powinien wskoczyć. Ale sprawdź, czy `targetSets` się w międzyczasie nie zmieniło.
4. Czy `plank` nie ma ręcznie ustawionego celu w Planie po tamtej sesji (`setTarget`
   nadpisuje bez pytania).

### Jeśli hipoteza 2 się potwierdzi
`progressGoal` musi rozróżniać „ostatnio komplet, cel jeszcze nie wskoczył" od
„ostatnio komplet, ale od tamtej pory był deload, który zamroził cele". Komunikat:
*„ostatnio komplet — cel wskoczy po pierwszym treningu poza deloadem"*. Dopisz test.

**Nie zgaduj i nie przepisuj silnika progresji na podstawie samego screena** — on liczy
dobrze, sprawdzone.

---

## P9-8 — inny sprzęt w My Fitness Place: ręczna korekta ciężaru nigdzie się nie zapisuje

### Objaw (screen 5)
Allahy (wyciąg), deload, sesja w My Fitness Place. `cel 37,5 kg`, a Kamil wpisuje ręcznie
**36,25** w obie serie: *„Allahy na my fitness place widzisz tam inne wpisałem inna wartość
bo jest inna"*. Ten stos ma inne skoki niż domowy i apka o tym nie wie.

### Root cause (ZWERYFIKOWANY) — korekta przepada z DWÓCH niezależnych powodów
1. **Sesja w innej siłowni niż siłownia dnia.** `sessionProgressionSummaries`
   (`store.tsx:191-192`): `adaptTargetToLoggedWeight = sessionGymId === sessionDay?.gymProfileId`.
   „Trening 1" (`mon`) nie ma `gymProfileId` (siłownia domowa), a Kamil przełączył sesję na
   My Fitness Place → adaptacja z §24.1 **wyłączona**. To jest świadoma ochrona z FEAT-1
   (§12) i działa zgodnie z projektem.
2. **Deload i tak nie zapisuje niczego.** `store.tsx`, `finishSession`:
   `if (mode === "deload") { …; return d; }` — cele zamrożone w całości.

Do tego My Fitness Place **nie ma `weightStep`** (`seed.ts`, `MY_FITNESS_PLACE_PROFILE` ma
tylko `barWeight`, `plates`, `dumbbells`), a `suggestedWeightForProfile` dla `unit: "cable"`
bez `weightStep` zwraca `null` — więc dla Allahów Kamil nie dostaje ŻADNEJ podpowiedzi
i musi wpisywać ręcznie za każdym razem.

### Co zrobić (MVP, bez przebudowy modelu)
1. **`weightStep` dla My Fitness Place** — uzupełnij profil o krok stosu wyciągu/maszyn.
   **Zapytaj Kamila o realną wartość** (36,25 sugeruje skok 1,25 albo stos w innych
   jednostkach); nie zgaduj w seedzie. Migracja jednorazowa z własną flagą (Pułapka 1),
   zachowawcza: ustawia `weightStep` tylko, gdy go nie ma.
2. **Ręczna korekta zapamiętana per siłownia.** Nowe, opcjonalne
   `GymProfile.weightOverrides?: Record<exerciseId, number>` — „na TEJ siłowni to ćwiczenie
   robię na X kg". Zapis: gdy sesja jest w siłowni **innej niż siłownia dnia**, a serie
   robocze poszły na jednym ciężarze różnym od celu (`loggedWorkingWeight` ≠ `null`) →
   zapisz do `weightOverrides` tej siłowni **zamiast** do `targets`. Odczyt: `startDay`
   ustawia `entry.targetWeight` z override'u, gdy sesja jest w tej siłowni.
   **`targets`/`hyperTargets` zostają nietknięte** — ochrona z §24.1 w mocy, zmienia się
   tylko to, że korekta nie ginie.
3. Deload: punkt 2 ma działać **też w deloadzie** (to nie jest progresja, tylko informacja
   o sprzęcie) — wyjmij ten jeden zapis przed `if (mode === "deload") return d`.
   Opisz to w komentarzu, bo to jedyny wyjątek od „deload nie zapisuje nic".

### Testy
- Sesja w siłowni ≠ siłownia dnia, serie na jednolitym 36,25 → `weightOverrides.crunch = 36,25`
  w profilu MFP, `targets.crunch` **bez zmian**.
- Ta sama sesja w deloadzie → override zapisany, cele dalej zamrożone.
- `startDay` dla sesji w MFP → `entry.targetWeight = 36,25`; dla sesji w domu → cel z `targets`.
- Serie na RÓŻNYCH ciężarach → brak zapisu override'u (`loggedWorkingWeight` = `null`).

---

## P9-9 — odpowiedź na pytanie „po deloadzie wracają mi obciążenia, na których skończyłem?"

**TAK. Zweryfikowane w kodzie, nic tu nie trzeba naprawiać** — ale trzeba to Kamilowi
POWIEDZIEĆ w apce, bo dziś nigdzie tego nie widać:

- `store.tsx`, `finishSession`: `if (mode === "deload") { … return d; }` — tydzień deloadu
  **nie zapisuje ani `targets`, ani `hyperTargets`**. Cele są zamrożone w całości.
- `deloadTargetFor` (`logic.ts:1083`) liczy cel deloadu **w locie** z zapisanego celu —
  niczego nie nadpisuje.
- `referenceEntry` (`logic.ts:1423`) i `prefillRepsForEntry` **pomijają tygodnie deloadu**,
  więc po powrocie logger porównuje się z ostatnim tygodniem ROBOCZYM, nie z deloadem.
- `detectPlateau` pomija okna zawierające deload (§17), więc tydzień lekki nie odpala
  fałszywego zastoju.

**Jedyny wyjątek do naprawy jest w P9-8:** w deloadzie nie zapisuje się też ręczna korekta
ciężaru (bo cały zapis jest wyłączony) — i to jest to, co Kamil zauważył przy Allahach.

### Co zrobić
Jedno zdanie w pudełku deloadu na ekranie wyboru dnia i w podsumowaniu sesji deloadowej:
*„Cele są zamrożone — po tym tygodniu wracasz dokładnie na ciężary, na których skończyłeś."*
Razem z jednym zdaniem z P9-4 (brak rekordów i porównań) to komplet informacji o tym,
czym jest deload w tej apce.

---

## Po wszystkim

```bash
npm test                 # 518 + nowe, wszystkie zielone
npm run build            # tsc --noEmit + vite + singlefile — bez błędów
```
Weryfikacja w Chromium na zbudowanym `docs/index.html`: 320/360/390/430 px bez poziomego
scrolla (P9-5 rusza wiersz serii!), zero błędów JS, ścieżka deloadu od wyboru dnia do
podsumowania. Commit `docs/index.html` **i** `docs/sw.js` razem.

Na koniec dopisz do `CLAUDE.md` sekcję **§27 — sesja 17.09.2026** w konwencji §17–§26:
co było, root cause, co jest, czego świadomie NIE ruszono i dlaczego.
