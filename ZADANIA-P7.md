# P7 — zgłoszenia Kamila (sesja 26.08.2026), seria I

Skrypt wykonawczy dla Sonneta. Cztery zadania, **każde osobnym commitem**, w kolejności
P7-4 → P7-1 → P7-2 → P7-3 (P7-3 jest największe i dotyka najwięcej plików, więc idzie
na koniec; pozostałe są od siebie niezależne).

> **Seria II screenów dojdzie osobno** — nie zamykaj tematu po tych czterech zadaniach,
> dopisz sekcję „seria II" niżej, gdy dostaniesz kolejne zgłoszenia.

## Zanim zaczniesz

```bash
npm install      # node_modules nie ma w tej gałęzi — bez tego `npm test` i `npm run build` padną
npm test         # baseline: 388 testów, WSZYSTKIE TESTY OK
```

Gałąź: `claude/app-fixes-script-xdkhta` (już aktywna, czysta, == `main`).
Deploy: `npm run build` → commit `docs/index.html` **i** `docs/sw.js` razem → push.

**Pułapka nr 1 (dotyczy P7-3):** `migrateState()` w ścieżce „aktualny schemat" (`seed.ts`,
szukaj gałęzi zwracającej stan z `old.exercises`/`old.days`) przykrywa seed danymi
użytkownika. Sama zmiana `SEED_DAYS`/`SEED_EXERCISES` **nie dotrze do telefonu Kamila**.
Każda zmiana planu/ustawień potrzebuje jednorazowej migracji z własną flagą w `AppState`
(wzorzec: `planVolumeBumpSeeded`, `rdlTargetFixed`). **Bez bumpa `SCHEMA_VERSION`** —
wszystkie nowe pola są opcjonalne.

**Pułapka nr 2:** `resetAll()` w `store.tsx` musi ustawiać KAŻDĄ nową flagę migracji na
`true`, żeby „Wyzeruj wszystko" nie dosiewało z powrotem rzeczy, których już nie ma.

**Pułapka nr 3:** nie zmieniaj sygnatur funkcji, na których stoi 388 istniejących testów.
Nowe zachowania wpinaj **opcjonalnym parametrem** — brak parametru = dokładnie dzisiejsze
zachowanie. Ten sam chwyt co sufit projekcji (§21.2 w CLAUDE.md).

---

## P7-4 — brak czasu treningu w podsumowaniu i w Historii

### Objaw
Screen 5 (Historia): `Trening 3 · Góra II + Tył Ud · 8 sie 2026 · 17 serii · 6800 kg` —
**bez `· N min`**, podczas gdy starsze sesje mają: 6 sie `· 75 min`, 4 sie `· 58 min`,
1 sie `· 63 min`, 29 lip `· 76 min`. To samo w podsumowaniu zaraz po treningu (screen 3/4:
pasek pod nagłówkiem pokazuje samo `6.8 t`, bez `min` i bez `kg/min`).

### Root cause
`sessionDuration()` — `src/lib/logic.ts:539-544`:

```ts
export function sessionDuration(session: Session): number | null {
  if (!session.finishedAt) return null;
  const minutes = (new Date(session.finishedAt).getTime() - new Date(session.date).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return null;
  return Math.round(minutes);
}
```

Liczy `finishedAt − date`, a **`date` to moment KLIKNIĘCIA w dzień**, nie moment pierwszej
serii: `TrainScreen.startDay` (`src/components/TrainScreen.tsx:436`) robi
`setDraft({ ..., date: new Date().toISOString(), ... })`. Draft żyje w localStorage
(`DRAFT_KEY`, `TrainScreen.tsx:57` + efekt `:264-271`), więc przeżywa zamknięcie apki.

**Kamil potwierdził: wchodzi w dzień dużo wcześniej, niż faktycznie zaczyna ćwiczyć**
(przegląda plan w domu / w drodze). Różnica przekracza 240 minut → funkcja zwraca `null`
→ czas znika CAŁKOWICIE. Limit 240 min był świadomą decyzją („apka zostawiona na noc"),
ale mierzy złą rzecz.

### Co zrobić

1. **`Draft` dostaje `firstSetAt?: string`** (`TrainScreen.tsx:60-67`).
   Ustawiane **raz**, przy pierwszym przełączeniu dowolnej serii na `done`. Miejsce:
   wewnątrz updatera w `updateSet` (`TrainScreen.tsx:460-466`), gdzie stan jest klonowany:

   ```ts
   const next = structuredClone(prev);
   const set = next.entries[entryIdx].sets[setIdx];
   Object.assign(set, patch);
   // Realny start roboty — od niego liczy się czas treningu (P7-4). Ustawiane
   // RAZ: odznaczenie pierwszej serii nie może cofać startu treningu.
   if (patch.done === true && !next.firstSetAt) next.firstSetAt = new Date().toISOString();
   return next;
   ```

   Idempotentne (`!next.firstSetAt`), więc podwójne wywołanie updatera w StrictMode nie
   szkodzi. **Nie** zeruj go przy `patch.done === false`.

2. **`Session` dostaje `startedAt?: string`** (`src/lib/types.ts`, obok `finishedAt:96`):

   ```ts
   /** Moment PIERWSZEJ zaliczonej serii — realny start treningu. `date` to moment
    *  wejścia w dzień i bywa o godziny wcześniejszy (P7-4). Brak = stara sesja. */
   startedAt?: string;
   ```

3. **`finish()`** (`TrainScreen.tsx:663-686`) przekazuje `startedAt: draft.firstSetAt`
   **w OBU miejscach**:
   - do `store.finishSession({ dayId, date, entries, mode, readiness, startedAt })`
   - do `setSummarySession({ ..., startedAt: draft.firstSetAt })` (`:678-686`)

   Jeśli tylko w jednym — podsumowanie i Historia pokażą różny czas dla tej samej sesji.

4. **`sessionDuration`** liczy od realnego startu, limit 240 min ZOSTAJE:

   ```ts
   const start = new Date(session.startedAt ?? session.date).getTime();
   const minutes = (new Date(session.finishedAt).getTime() - start) / 60000;
   ```

5. **`date` NIE zmienia znaczenia.** Jest kluczem sortowania Historii, oknem tygodnia
   (`weeklyAdherence`, `actualWeeklyMuscleVolume`, `weeksSinceDeload`, `progressSince`)
   i podstawą `referenceEntry`. **Nie podmieniaj `date` na `firstSetAt`** — przesunęłoby
   to sesje między tygodniami i rozjechało całą statystykę.

6. **Podsumowanie mówi wprost, gdy czasu nie ma** (`TrainScreen.tsx:729-740`). Dziś przy
   `duration === null` pasek po cichu pokazuje sam tonaż — to właśnie zmyliło Kamila.
   Dodaj drugą linijkę: `Czas nieznany — trening zaczęty ponad 4 h przed zakończeniem.`
   (tylko gdy `summarySession.startedAt` istnieje, a `sessionDuration` i tak dało `null`).

7. **Zweryfikuj `updateSession`** (`store.tsx`, edycja sesji w Historii): klonuje całą
   sesję, więc `startedAt` powinno przetrwać — potwierdź testem, nie założeniem.

### Testy (`tests/logic.test.ts`, ≥4 nowe)
- `startedAt` 18:00, `finishedAt` 19:15, `date` 14:00 → **75** (dziś: `null`)
- brak `startedAt` → zachowanie jak dziś (fallback na `date`, limit 240)
- `startedAt` późniejsze niż `finishedAt` (cofnięty zegar) → `null`
- ponad 240 min liczone OD `startedAt` → `null`
- round-trip przez `updateSession`: `startedAt` zachowane

### Kryterium akceptacji
Wejście w dzień o 14:00, pierwsza zaliczona seria o 18:00, zakończenie o 19:15 →
Historia i podsumowanie pokazują **75 min** (i gęstość `kg/min`). Sesje sprzed zmiany
zachowują się dokładnie jak dziś.

---

## P7-1 — „ostatnio komplet, dziś powinien wskoczyć" kłamie: ciężar JUŻ wskoczył

### Objaw
Screen 1, Wiosłowanie hantlem (zakreślone na czerwono):

```
2×10–12 powt. · cel 22 kg (na rękę) · RIR 1
Ostatnie: 20×12/12 · 20×12/10 · 20×12/8
Do skoku ciężaru: 2×12 powt. — ostatnio komplet, dziś powinien wskoczyć
```
…a pola serii pokazują **10** powtórzeń.

Kamil: „co to znaczy, że dziś komplet i powinien wskoczyć, jest jakby ucięte".

### Dlaczego to jest błąd, a nie tylko niezręczne zdanie
`fmtLastEntries` wypisuje sesje **od najnowszej** (`lastEntries` sortuje malejąco po dacie,
`logic.ts:1114-1128`). Czyli ostatni trening to `20×12/12` — **komplet przy `repMax` 12 na
2 seriach roboczych**. `finishSession` policzył więc progresję i cel poszedł **20 → 22**
(widać go w nagłówku). Ciężar **już wskoczył**. Zdanie „dziś powinien wskoczyć" jest
nieprawdą, a do tego przeczy polom serii, które słusznie trzymają `repMin` = 10 (§22).

### Root cause
`progressGoal()` — `src/lib/logic.ts:1218-1227`:

```ts
export function progressGoal(state: AppState, ex: Exercise, modeEx: Exercise): ProgressGoal | null {
  const ref = referenceEntry(state, ex.id);
  if (!ref || ref.sets.length === 0) return null;
  const working = ref.sets.slice(0, modeEx.targetSets);
  let missing = 0;
  for (let i = 0; i < modeEx.targetSets; i++) {
    missing += Math.max(0, modeEx.repMax - (working[i]?.reps ?? 0));
  }
  return { repsPerSet: modeEx.repMax, setCount: modeEx.targetSets, missingReps: missing };
}
```

Liczy **wyłącznie** brakujące powtórzenia i **nie porównuje dzisiejszego celu z ciężarem
sesji referencyjnej**. Tymczasem `prefillRepsForEntry` (`logic.ts:1166-1180`) ma dokładnie
to porównanie — i dlatego pola serii są poprawne, a zdanie nad nimi nie:

```ts
const refTop = Math.max(...ref.sets.map((s) => s.weight));
if (targetWeight > refTop + 1e-9) return fill(modeEx.repMin);
```

Renderowanie zdania: `TrainScreen.tsx:1164-1178` (dwa warianty: `missingReps > 0` albo
„ostatnio komplet, dziś powinien wskoczyć").

### Co zrobić

1. **Rozszerz `ProgressGoal`** (`logic.ts:1203-1209`):

   ```ts
   export interface ProgressGoal {
     repsPerSet: number;
     setCount: number;
     /** Ile powtórzeń zabrakło ostatnio — ma sens TYLKO przy weightVsRef === "same". */
     missingReps: number;
     /** Najcięższa seria sesji referencyjnej (punkt odniesienia). */
     refWeight: number;
     /** Dzisiejszy cel vs ciężar sesji referencyjnej. */
     weightVsRef: "up" | "same" | "down";
   }
   ```

2. **`progressGoal` dostaje 4. parametr `targetWeight: number`** (obowiązkowy — jest
   dokładnie JEDNO wywołanie: `TrainScreen.tsx:1045`). Logika:

   ```ts
   const refWeight = Math.max(...ref.sets.map((s) => s.weight));
   const weightVsRef =
     targetWeight > refWeight + 1e-9 ? "up" : targetWeight < refWeight - 1e-9 ? "down" : "same";
   // "Ile zabrakło" porównuje wynik z TYM SAMYM ciężarem. Po skoku (albo po zejściu
   // w dół) tamten wynik nie jest już punktem odniesienia — dlatego 0.
   const missingReps = weightVsRef === "same" ? missing : 0;
   ```

   `refWeight` bierz z **maksimum** serii referencyjnych (nie z pierwszej) — spójnie
   z `prefillRepsForEntry`.

3. **UI — trzy warianty zamiast dwóch** (`TrainScreen.tsx:1164-1178`):
   - `weightVsRef === "up"` → **zielone**:
     `— ciężar właśnie wskoczył z {fmtKg(refWeight)} na {fmtKg(entry.targetWeight)}, dziś celujesz w {repMin} {unit}`
     (zdanie zgadza się wreszcie z polami serii, które trzymają `repMin`)
   - `weightVsRef === "down"` → szare:
     `— ostatnio szło {fmtKg(refWeight)}, dziś lżej`
   - `weightVsRef === "same" && missingReps > 0` → jak dziś: `— ostatnio zabrakło N powt.`
   - `weightVsRef === "same" && missingReps === 0` → ten przypadek po zmianie jest już
     prawie niemożliwy (komplet ⇒ cel wzrósł). Zostaje tylko dla: sesji referencyjnej
     odrzuconej jako deload, ręcznie obniżonego celu w Planie, treningu na obcej siłowni
     (§24 wyłącza tam adaptację celu). Zmień tekst na uczciwy:
     `— ostatnio komplet, ale cel się nie zmienił — sprawdź ciężar w Planie`
     (kolor bursztynowy, nie zielony: to sygnał, że coś nie gra, a nie pochwała).

4. Zachowaj `null` przy braku historii (bez zmian).

### Testy (≥6 nowych)
- komplet 2×12 na 20 kg + dzisiejszy cel 22 → `weightVsRef: "up"`, `missingReps: 0`, `refWeight: 20`
- ten sam ciężar, 12/10 przy `repMax` 12 → `"same"`, `missingReps: 2`
- ten sam ciężar, komplet → `"same"`, `missingReps: 0` (przypadek „cel się nie zmienił")
- dzisiejszy cel niższy niż referencja → `"down"`, `missingReps: 0`
- `refWeight` z serii 20/22,5/20 → **22,5** (maksimum, nie pierwsza)
- brak historii → `null`
- seria niezalogowana w referencji liczy się jako pełny brak (istniejące zachowanie — nie zepsuj)

### Kryterium akceptacji
Scenariusz ze screena 1 (`Ostatnie: 20×12/12`, cel 22,5 po P7-3): karta pisze
**„ciężar właśnie wskoczył z 20 na 22,5 kg, dziś celujesz w 10 powt."**, pola serii mają 10,
i nigdzie nie pada „dziś powinien wskoczyć".

---

## P7-2 — kratka „ost. N" świeci na bursztynowo, choć seria była MOCNIEJSZA

### Objaw
Screen 2, zapytanie Kamila wprost: *„Dlaczego na żółto jest, jak zrobiłem większą wagę
ostatnio??"*

Wiosłowanie hantlem: dziś **22,5 × 10** (zaliczone), kratka `ost. 12` na **bursztynowo**
(= gorzej), a w TYM SAMYM wierszu odznaka **PR** i bursztynowy ring wokół wiersza.
Dwa bursztyny o przeciwnym znaczeniu w jednym wierszu.

Realnie: `e1RM(22,5; 10) = 30,0` vs `e1RM(20; 12) = 28,0` — dzisiejsza seria jest
**mocniejsza**. To samo na Francuzie (25×10 dziś vs 22,5×12 ostatnio → 33,3 vs 30,0).

### Root cause
`TrainScreen.tsx:1354-1358` — kolor liczony z samych powtórzeń, ciężar ignorowany:

```tsx
set.done && set.reps > refSets[si].reps && "text-green-400",
set.done && set.reps < refSets[si].reps && "text-amber-400",
set.done && set.reps === refSets[si].reps && "text-muted-foreground/70"
```

Bursztynowy ring wiersza to co innego i jest poprawny — `recordKind` (PR),
`TrainScreen.tsx:1288, 1296-1299`.

### Decyzja Kamila
**Porównuj SIŁĘ (e1RM), nie powtórzenia.** 22,5×10 vs 20×12 → zielone.

### Co zrobić

1. **Wyciągnij regułę z JSX do `logic.ts`** (obok `isSetRecord:603`) — jedna reguła
   porównania nie ma prawa żyć w klasach Tailwinda:

   ```ts
   export type SetComparison = "better" | "same" | "worse";

   /**
    * Ta seria vs ta sama seria z sesji referencyjnej. Dla `isHold` po sekundach;
    * inaczej po e1RM — cięższy hantel przy MNIEJSZEJ liczbie powtórzeń bywa
    * mocniejszą serią i nie wolno go pokazywać jako regres (zgłoszenie Kamila, P7-2).
    */
   export function compareSetToReference(ex: Exercise, set: SetLog, ref: SetLog): SetComparison
   ```

   - `isHold` → porównanie po `reps` (sekundy), ciężar bez znaczenia
   - inaczej: `e1rm(set.weight, set.reps)` vs `e1rm(ref.weight, ref.reps)`, obie strony
     **zaokrąglone do 0,1 kg** przed porównaniem (inaczej 30,0 vs 30,000000004 dałoby
     fałszywe „better")
   - `set.reps === 0 || set.weight === 0` → `"same"` (nic nie wpisano, nie ma co porównywać)

2. **`TrainScreen.tsx:1354-1358`** używa helpera: `better` → `text-green-400`,
   `worse` → `text-amber-400`, `same` → `text-muted-foreground/70`.
   Kolor nadal pojawia się **dopiero po `set.done`** (bez zmian, §23) — przed zaliczeniem
   pole trzyma cel, więc kolorowanie świeciłoby na zielono od startu.

3. **Kropkowane podkreślenie przy innym ciężarze ZOSTAJE** (`TrainScreen.tsx:1352-1353`) —
   teraz niesie sens „to porównanie po sile, nie po powtórzeniach".

4. **Rozszerz `title`** (`TrainScreen.tsx:1360`), żeby zieleń przy mniejszej liczbie
   powtórzeń nie wyglądała na błąd:
   `Ostatnio w tej serii: 20 kg × 12 powt. (e1RM 28,0) · dziś 22,5 × 10 (e1RM 30,0)`

5. **Świadomie NIE naprawiamy** (odnotuj w komentarzu, żeby ktoś tego nie „poprawiał"):
   `isSetRecord` zwraca `"weight"`, gdy `set.weight > best.weight` — więc bardzo ciężka,
   ale krótka seria (np. 25×3 przy rekordzie 20×12) może dostać **PR i jednocześnie
   bursztynową kratkę**. To jest uczciwe: najcięższy ciężar w życiu, ale słabsza seria.
   Tooltip to wyjaśnia.

### Testy (≥6 nowych)
| dziś | ostatnio | oczekiwane |
|---|---|---|
| 22,5×10 | 20×12 | `better` (scenariusz ze screena) |
| 25×10 | 22,5×12 | `better` (Francuz ze screena) |
| 20×10 | 20×12 | `worse` |
| 20×12 | 20×12 | `same` |
| plank 45 s (obciążenie 10) | 40 s (obciążenie 15) | `better` (isHold ignoruje ciężar) |
| 0 powt. | 20×12 | `same` |

### Kryterium akceptacji
Wiersz `22,5 × 10 | ost. 12 | PR` świeci na **zielono** i ma PR. Nie da się już dostać
wiersza jednocześnie bursztynowego („gorzej") i z odznaką PR **z powodu samej liczby
powtórzeń**.

---

## P7-3 — dwie siłownie, drabinka hantli; progresja proponuje nieistniejące ciężary

### Objaw
Screen 3/4 (podsumowanie), zakreślone: `RDL z hantlami — Wszystkie serie po 12 powt. —
nowy ciężar 24 kg, wracasz do 8 powt.`
Kamil: *„Robiłem 22,5, więc na 25 powinno wskoczyć, bo logiczne, że na tej siłce tak jest."*

To samo źródło co `cel 22 kg` przy Wiosłowaniu hantlem (screen 1) i co naprawa z §24
(cel RDL 22 → 22,5). Apka wciąż proponuje ciężary, których na stojaku nie ma.

### Root cause
`increment` to **stała liczba kg per ćwiczenie** i nic nie sprawdza, czy wynik dodawania
w ogóle istnieje jako hantel. `computeProgression` (`logic.ts:462` i `:470`):

```ts
let next = round25(targetWeight + ex.increment);          // 22,5 + 2 = 24,5
next = round25(targetWeight + 2 * ex.increment);          // podwójny skok przy RIR ≥3
```

Dla **sztangi** apka ma dokładny model osiągalnych ciężarów (`achievableWeights` /
`nearestAchievable`, `logic.ts:1332-1350`). Dla **hantli** ma tylko zgrubny `weightStep`
per profil siłowni (`snapToStep`, `logic.ts:1352`), używany WYŁĄCZNIE do podpowiedzi
w drafcie (`suggestedWeightForProfile:1364`) — **nigdy do progresji**.

> **Uwaga: `24 kg` na screenie to wynik z buildu SPRZED §24.** Service worker jest
> cache-first (§5.8), więc telefon Kamila był o jeden build w tyle. Na aktualnym kodzie
> ten sam trening da `24,5` — czyli nadal nieistniejący hantel. Zgłoszenie jest w pełni
> aktualne, tylko liczba w komunikacie będzie inna. Nie szukaj błędu w `loggedWorkingWeight`
> (§24.1) — działa poprawnie.

### Nowy kontekst od Kamila (tego NIE było w §24)
To są **dwie stałe siłownie przypisane do dni**, a nie „wyjazd":

| Dzień planu | Siłownia | Hantle |
|---|---|---|
| `mon` (Trening 1) i `fri` (Trening 3) | jego zwykła | co **2,5 kg** w górnym zakresie |
| `wed` (Trening 2) | **My Fitness Place** | co **2 kg** |

**Dlatego `lunges` 14 kg i `incline_db` 16 kg (oba w `wed`) są POPRAWNE — nie wolno
ich ruszyć.** Błędne są tylko ćwiczenia hantlowe z `mon`/`fri` (`rdl` 22,5, `row_db` 22,
`bench_db` 17,5, `lateral` 9).

Istniejący `activeGymProfileId` (FEAT-1, §12) tego nie obsłuży: wymaga ręcznego
przełączania przed każdym treningiem i **celowo wyłącza adaptację celu** (§24.1) —
co dla stałego rozkładu jest po prostu błędem.

**Decyzja Kamila: siłownia przypisana do dnia planu.**

### ⚠️ Dane do potwierdzenia PRZED implementacją
Dokładne drabinki nie zostały jeszcze podane. **Wartości niżej to wstępne domysły** —
zapytaj Kamila i podmień, zanim wejdą do seeda:

```ts
// DOMYSŁ — do potwierdzenia. Zwykła siłownia (mon/fri): lekkie co 1 kg (cel `lateral`
// to 9 kg, więc 9 musi istnieć), od 10 w górę co 2,5.
const LADDER_HOME = [1,2,3,4,5,6,7,8,9,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,40];
// DOMYSŁ — do potwierdzenia. My Fitness Place (wed): co 2 kg.
const LADDER_MYFITNESS = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
```

### Co zrobić — krok po kroku

#### Krok 1 — model danych (`src/lib/types.ts`)
```ts
export interface GymProfile {
  // …istniejące pola…
  /** Dostępne hantle (ciężar NA RĘKĘ), rosnąco. Pusto/brak = brak modelu, zachowanie jak dziś. */
  dumbbells?: number[];
}

export interface Settings {
  // …istniejące pola…
  /** Drabinka hantli siłowni domowej (odpowiednik `plates` dla sztangi). */
  dumbbells?: number[];
}

export interface WorkoutDay {
  // …istniejące pola…
  /** Siłownia, na której odbywa się ten dzień. Brak = domowa (settings.barWeight/plates/dumbbells). */
  gymProfileId?: string;
}
```
Wszystko opcjonalne → **bez bumpa `SCHEMA_VERSION`**.

#### Krok 2 — logika (`src/lib/logic.ts`)
```ts
/** Sprzęt siłowni danego dnia planu: profil z `day.gymProfileId` albo domowa (null). */
export function gymForDay(state: AppState, day: WorkoutDay | undefined): GymProfile | null

/** Drabinka hantli (na rękę) dla danej siłowni; `[]` = brak modelu. */
export function dumbbellLadder(state: AppState, profile: GymProfile | null): number[]

/** Pierwszy ciężar z drabinki OSTRO większy od `from` i ≥ `candidate`. Brak drabinki
 *  albo brak takiego ciężaru → `candidate` (zachowanie jak dziś). */
export function snapLoadUp(candidate: number, from: number, ladder: number[]): number

/** Największy ciężar z drabinki ≤ `candidate`; brak → `candidate`. */
export function snapLoadDown(candidate: number, ladder: number[]): number

/** Najbliższy z drabinki; remis na korzyść MNIEJSZEGO (jak `nearestAchievable:1345`). */
export function snapLoadNearest(candidate: number, ladder: number[]): number
```

`snapLoadUp` musi gwarantować **postęp**: `snapLoadUp(23, 22.5, [20,22.5,25]) === 25`
(nie 22,5), inaczej progresja utknie w miejscu na zawsze.

**`computeProgression` — nowy, OPCJONALNY 7. parametr `ladder?: number[]`.** Gdy podany,
niepusty, `ex.unit === "dumbbell"`, `!ex.isHold` i `ex.id` nie jest na liście wyjątków:
```ts
next = snapLoadUp(targetWeight + ex.increment, targetWeight, ladder);
// i tak samo dla podwójnego skoku przy RIR ≥3 (logic.ts:470):
next = snapLoadUp(targetWeight + 2 * ex.increment, targetWeight, ladder);
```
**Brak parametru = dokładnie dzisiejsze zachowanie** ⇒ żaden z 388 istniejących testów
nie wymaga przestrojenia.

**Wyjątek — kettlebell:**
```ts
// `kb_swing` ma unit "dumbbell" (apka nie modeluje kettlebelli osobno), ale kettlebelle
// idą po własnej drabince 4/8/12/16/20/24 i snapowanie do hantli dałoby bzdury.
const LADDER_EXEMPT_IDS = new Set(["kb_swing"]);
```

**`deloadTargetFor`** (`logic.ts:861-872`) — po `Math.floor(... / inc) * inc` dołóż
`snapLoadDown`. Gwarancja z §20.2 („nigdy powyżej `DELOAD_LOAD_FACTOR`") musi zostać —
`snapLoadDown` jej nie łamie, bo tylko schodzi.

**`hyperTargetFor`** (`logic.ts:823-836`) — po zaokrągleniu do `increment` dołóż
`snapLoadNearest`.

#### Krok 3 — skąd drabinka bierze się w każdym miejscu
- **`store.finishSession`** (`store.tsx:190-250`): profil z **dnia sesji**
  (`state.days.find(d => d.id === sessionData.dayId)` → `gymForDay` → `dumbbellLadder`),
  przekazany jako 7. parametr `computeProgression`. Nie z `activeGymProfileId`.
- **`TrainScreen`** (`:353-363`): dziś `activeGymProfile` liczone wyłącznie z
  `settings.activeGymProfileId`. Ma być: **profil dnia** jako podstawa, a ręczne
  `activeGymProfileId` jako NADPISANIE o wyższym priorytecie (ad hoc wyjazd).
  `activeBar`/`activePlates` (`:362-363`) idą za tym samym profilem.
- **Steppery −/+ przy ciężarze serii** (`TrainScreen.tsx:1305` i `:1323`): dziś
  `set.weight ± hEx.increment`. Mają skakać **po drabince** (`snapLoadUp` / lustro w dół),
  inaczej Kamil dalej ręcznie klika z 22,5 na 24,5 i z powrotem.
- **Kalkulator talerzy i `warmupPlan`** — bez zmian (sztanga, mają własny model).

#### Krok 4 — §24.1: adaptacja celu przy siłowni przypisanej do dnia
`store.tsx:209` jest dziś:
```ts
const adaptTargetToLoggedWeight = !state.settings.activeGymProfileId;
```
Profil **przypisany do dnia** to normalny sprzęt tego dnia, więc adaptacja MA działać.
Nowa reguła: wyłączaj adaptację tylko wtedy, gdy `settings.activeGymProfileId` jest
ustawione **i różni się** od `day.gymProfileId` — czyli faktycznie trenujesz gdzie indziej
niż zwykle w tym dniu. Ochrona z FEAT-1/§12 zostaje tam, gdzie ma sens.

#### Krok 5 — seed + migracja (bez bumpa `SCHEMA_VERSION`)
- `SEED_DAYS`: `wed.gymProfileId = "myfitness"`; profil `{ id: "myfitness", name: "My Fitness Place", barWeight, plates, dumbbells: LADDER_MYFITNESS }` do `settings.gymProfiles`.
- `settings.dumbbells = LADDER_HOME` w seedzie ustawień.
- **Migracja `seedGymLaddersOnce`** (flaga `gymLaddersSeeded` w `AppState`), zachowawcza:
  - profil `myfitness` dołóż **tylko gdy nie ma go po `id`** (drugi przebieg nie duplikuje)
  - `wed.gymProfileId` ustaw **tylko gdy pusty** (nie nadpisuj ręcznego wyboru)
  - `settings.dumbbells` dołóż **tylko gdy brak** (nie kasuj ręcznej listy)
  - **usunięcie profilu przez użytkownika ma być TRWAŁE** — flaga blokuje powrót (pułapka z §19)
- **Migracja `snapDumbbellTargetsOnce`** (flaga `dumbbellTargetsSnapped`): jednorazowo
  dociąga istniejące cele hantlowe do drabinki ICH dnia przez `snapLoadNearest`.
  Zasady bezpieczeństwa:
  - rusza **wyłącznie** ćwiczenia `unit === "dumbbell"` (i nie z `LADDER_EXEMPT_IDS`)
  - ćwiczenie stojące w **kilku dniach o różnych siłowniach** → **pomiń** (niejednoznaczne)
  - ćwiczenie w dniu **bez drabinki** → pomiń
  - u Kamila efekt: `row_db` **22 → 22,5** (naprawia „cel 22 kg" ze screena 1),
    `lunges` 14 i `incline_db` 16 **bez zmian** (pasują do drabinki co 2)
- **`resetAll()` w `store.tsx` ustawia OBIE nowe flagi na `true`** (pułapka nr 2).

#### Krok 6 — UI
- **`MoreScreen`, karta „Siłownie"** (`:349-440`): pole `Drabinka hantli (kg, po przecinku)`
  obok istniejącego „Talerze" — dla profili **i** dla siłowni domowej. Parsowanie takie
  samo jak talerzy; wartości sortuj rosnąco i deduplikuj przy zapisie.
- **`PlanScreen`, edycja dnia**: select `Siłownia tego dnia` (lista profili + „Domowa").
- **`TrainScreen`, nagłówek dnia**: dyskretna nazwa siłowni, gdy dzień ma przypisany profil
  (żeby było widać, wg jakiego sprzętu apka liczy).

### Testy (≥14 nowych)
- `snapLoadUp(24.5, 22.5, [20,22.5,25])` → `25`
- `snapLoadUp(23, 22.5, [20,22.5,25])` → `25` (nigdy nie zostaje na `from`)
- `snapLoadUp(50, 45, [20,22.5,25])` → `50` (poza drabinką → candidate)
- `snapLoadUp(x, y, [])` → `x` (brak drabinki → zachowanie jak dziś)
- `snapLoadDown` i `snapLoadNearest` (w tym remis → mniejsza wartość)
- `computeProgression` **bez** drabinki: `rdl` 22,5 + komplet → **24,5** (dowód wstecznej zgodności)
- `computeProgression` **z** drabinką `mon/fri`: `rdl` 22,5 + komplet → **25** ← scenariusz ze screena
- `computeProgression` **z** drabinką `wed`: `lunges` 14 + komplet → **16** (krok 2 zachowany)
- podwójny skok przy RIR ≥3 też snapuje do drabinki
- `kb_swing` pominięty (drabinka hantli go nie rusza)
- sztanga (`french` 22,5 → 25) nietknięta przez drabinkę hantli
- `deloadTargetFor` z drabinką: dla **każdego** ćwiczenia z bazy wynik ≤ 90% celu (rozszerz istniejący test z §20)
- migracja: idempotentna; profil dodany raz; usunięcie profilu trwałe; `row_db` 22 → 22,5;
  `lunges` 14 bez zmian; wypracowany cel spoza drabinki snapuje do najbliższego, a nie wraca do seeda
- `gymForDay` / `dumbbellLadder`: dzień bez `gymProfileId` → drabinka domowa

### Kryteria akceptacji
1. Trening RDL `22,5 × 12/12/12` → podsumowanie: **„nowy ciężar 25 kg, wracasz do 8 powt."**
2. `+` przy ciężarze 22,5 w loggerze daje **25**, nie 24,5. `−` daje **20**.
3. Wiosłowanie hantlem ma cel **22,5 kg**, nie 22 (screen 1).
4. Zakroki i wyciskanie hantli skos (`wed`) dalej chodzą **co 2 kg** — nic im się nie zmienia.
5. Trening zapisany w `wed` progresuje wg drabinki My Fitness Place, w `mon`/`fri` wg domowej,
   **bez żadnego ręcznego przełączania**.

---

## Do potwierdzenia przez Kamila (nie implementuj bez odpowiedzi)

1. **Dokładne drabinki hantli** obu siłowni (patrz „Dane do potwierdzenia" w P7-3).
2. **Nagłówek podsumowania na screenach 3/4** wygląda na nachodzący na pasek statusu
   („Podsgmowanie treningu" zlane z `19:09` i `Trening`), a przycisk `Zamknij` na
   `Cofnij zakończenie`. **Prawdopodobnie artefakt zrzutu zrobionego w trakcie
   przewijania** — podsumowanie to zwykły ekran (`TrainScreen.tsx:724+`), nie modal, więc
   nie ma tu oczywistego mechanizmu nakładania. **Nie ruszaj tego bez potwierdzenia**,
   że widać to na żywo, a nie tylko na zrzucie.

## Na koniec każdego zadania
```bash
npm test        # wszystkie testy OK, licznik urósł o nowe
npm run build   # tsc --noEmit + vite + singlefile
```
Commit osobno per zadanie, po polsku w treści opisu zmian.
**Nie zapomnij o `docs/index.html` I `docs/sw.js` w commicie** — bez nich telefon Kamila
nie dostanie zmian.
Po wszystkim: dopisz sekcję **§25** do `CLAUDE.md` (wzorzec §17–§24: co zmienione, dlaczego,
co świadomie zostawione).
