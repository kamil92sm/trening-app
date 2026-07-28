// Instrukcje "Jak wykonać?" — PLECY. Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const BACK_GUIDES: Record<string, ExerciseGuide> = {
  row_bb: {
    setup: ["Opad tułowia ok. 45°, kolana lekko ugięte, sztanga chwytem nadgarstek prosto."],
    steps: [
      "Ciągnij sztangę do pępka, prowadząc łokciami blisko tułowia.",
      "Ściągnij łopatki na szczycie ruchu.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Prostowanie się przy każdym powtórzeniu (bujanie).", "Ciągnięcie samymi rękami bez pracy łopatek."],
    safety: "Utrzymuj stały kąt opadu tułowia — jego zmiana w trakcie serii to najczęstsza droga do bólu pleców.",
  },
  deadlift: {
    setup: ["Sztanga nad środkiem stóp, chwyt tuż za kolanami, plecy proste, biodra wyżej niż w przysiadzie."],
    steps: [
      "Nabierz powietrza, spnij cały tułów.",
      "Wypchnij podłogę stopami, prowadząc sztangę blisko goleni.",
      "Wyprostuj biodra na górze, bez przeprostu w plecach.",
      "Opuszczaj sztangę tym samym torem, zawiasując w biodrach.",
    ],
    mistakes: ["Zaokrąglanie pleców przy podłodze.", "Szarpanie sztangi zamiast płynnego wypchnięcia.", "Sztanga oddalająca się od nóg."],
    safety: "UWAGA NA PLECY — przy pierwszym sygnale zaokrąglenia przerwij serię, to nie jest powtórzenie warte ryzyka.",
  },
  pulldown: {
    setup: ["Usiądź, uda zablokowane pod wałkiem, chwyt szerszy niż barki."],
    steps: [
      "Ściągnij drążek do górnej części klatki, prowadząc łokciami w dół.",
      "Spnij plecy na dole ruchu.",
      "Wypuść drążek kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Odchylanie się mocno do tyłu i ciągnięcie masą ciała.", "Ciągnięcie za głowę zamiast przed nią."],
  },
  row_db: {
    setup: ["Oprzyj kolano i dłoń o ławkę, plecy równolegle do podłogi, hantel w drugiej ręce."],
    steps: [
      "Ciągnij hantel do biodra, prowadząc łokieć blisko tułowia.",
      "Ściągnij łopatkę na szczycie.",
      "Opuść hantel kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Skręcanie tułowia zamiast pracy ramienia.", "Zbyt szybkie opuszczanie ciężaru."],
  },
  pullup: {
    setup: ["Chwyć drążek nachwytem, szerzej niż barki, zwis na wyprostowanych ramionach."],
    steps: [
      "Zainicjuj ruch ściągnięciem łopatek w dół.",
      "Podciągnij się, aż broda znajdzie się nad drążkiem.",
      "Opuść się kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Huśtanie się i pomaganie sobie nogami (kipping).", "Zatrzymywanie się w połowie zakresu."],
  },
  chinup: {
    setup: ["Chwyć drążek podchwytem, dłonie blisko siebie, zwis na wyprostowanych ramionach."],
    steps: [
      "Zainicjuj ruch ściągnięciem łopatek.",
      "Podciągnij się, prowadząc łokcie blisko tułowia, aż broda minie drążek.",
      "Opuść się kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Huśtanie ciałem zamiast pracy pleców i bicepsa.", "Skracanie zakresu ruchu na górze lub dole."],
  },
  pulldown_neutral: {
    setup: ["Usiądź, uda zablokowane pod wałkiem, chwyt za uchwyty równoległe (dłonie zwrócone do siebie)."],
    steps: [
      "Ściągnij uchwyty do górnej części klatki, łokcie blisko tułowia.",
      "Spnij plecy na dole ruchu.",
      "Wypuść uchwyty kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Odchylanie tułowia zbyt mocno do tyłu.", "Ciągnięcie samymi ramionami bez pracy łopatek."],
  },
  row_cable: {
    setup: ["Usiądź, stopy oparte o platformę, chwyć uchwyt przy lekko ugiętych kolanach, plecy proste."],
    steps: [
      "Ciągnij uchwyt do brzucha, prowadząc łokcie blisko tułowia.",
      "Ściągnij łopatki na końcu ruchu.",
      "Wróć kontrolowanie do pełnego wyprostu ramion, bez zaokrąglania pleców.",
    ],
    mistakes: ["Bujanie tułowiem do przodu i do tyłu zamiast pracy ramion.", "Garbienie się przy powrocie."],
  },
  row_tbar: {
    setup: ["Stań okrakiem nad sztangą (lub w uchwycie T-bar), tułów pod kątem ok. 45°, plecy proste."],
    steps: [
      "Ciągnij ciężar do mostka/dolnej klatki, łokcie blisko tułowia.",
      "Ściągnij łopatki na szczycie ruchu.",
      "Opuść kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Prostowanie tułowia przy każdym powtórzeniu.", "Zaokrąglanie pleców pod obciążeniem."],
    safety: "Stały kąt tułowia przez całą serię — nie prostuj się, żeby „pomóc” sobie przy cięższych powtórzeniach.",
  },
  row_machine: {
    setup: ["Klatka oparta o poduszkę, chwyć uchwyty na wysokości klatki."],
    steps: [
      "Ciągnij uchwyty łokciami do tyłu, ściągając łopatki.",
      "Zatrzymaj na chwilę w pozycji ściągnięcia.",
      "Wróć kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Odrywanie klatki od poduszki.", "Ciągnięcie samymi dłońmi bez pracy łopatek."],
  },
  row_db_bent: {
    setup: ["Plecy proste, opad w biodrach ok. 45°, hantle zwisają przy prostych ramionach."],
    steps: [
      "Ciągnij oba hantle jednocześnie do bioder, łokcie blisko tułowia.",
      "Ściągnij łopatki na szczycie.",
      "Opuść hantle kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Prostowanie tułowia w trakcie serii.", "Szarpanie ciężaru zamiast płynnego ciągnięcia."],
    safety: "Utrzymuj stały kąt opadu — zmiana kąta pod obciążeniem to najczęstsza droga do bólu pleców.",
  },
  rack_pull: {
    setup: ["Sztanga oparta na podstawkach na wysokości kolan, chwyt tuż za kolanami, plecy proste."],
    steps: [
      "Nabierz powietrza, spnij cały tułów.",
      "Wyprostuj biodra i kolana jednocześnie, prowadząc sztangę blisko nóg.",
      "Wyprostuj się w pełni na górze, bez przeprostu w plecach.",
      "Opuść sztangę kontrolowanie z powrotem na podstawki.",
    ],
    mistakes: ["Zaokrąglanie pleców przy starcie.", "Zbyt duży ciężar kosztem pełnego wyprostu bioder na górze."],
    safety: "Mniejszy zakres niż martwy ciąg klasyczny kusi do przeładowania sztangi — dobieraj ciężar pod technikę, nie na odwrót.",
  },
  pulldown_straight: {
    setup: ["Stań lub usiądź przodem do wyciągu górnego, chwyć drążek prostymi ramionami nad głową."],
    steps: [
      "Prowadź ramiona w dół i lekko do tyłu, ruch tylko w barkach (łokcie prawie proste).",
      "Zatrzymaj drążek przy udach.",
      "Wróć kontrolowanie do pozycji nad głową.",
    ],
    mistakes: ["Zginanie łokci — zamienia izolację w wiosłowanie.", "Pomaganie sobie tułowiem."],
  },
  shrug_db: {
    setup: ["Stań prosto, hantle po bokach, ramiona swobodnie opuszczone."],
    steps: [
      "Unieś barki prosto w górę, jak najbliżej uszu.",
      "Zatrzymaj na chwilę w najwyższym punkcie.",
      "Opuść barki kontrolowanie do pozycji startowej.",
    ],
    mistakes: ["Kręcenie barkami w kółko zamiast ruchu w linii prostej.", "Pomaganie sobie uginaniem łokci."],
  },
  back_ext: {
    setup: ["Ułóż się biodrami na ławce do hiperekstensji, kostki zablokowane, tułów swobodnie opuszczony."],
    steps: [
      "Opuszczaj tułów w dół z prostym kręgosłupem, aż poczujesz rozciągnięcie tylnej części uda.",
      "Unieś tułów, prowadząc ruch z bioder, do linii prostej z nogami.",
      "Nie przeprostowuj kręgosłupa na górze ruchu.",
    ],
    mistakes: ["Przeprost pleców na szczycie (wyginanie do tyłu).", "Zginanie odcinka lędźwiowego zamiast pracy z bioder."],
  },
};
