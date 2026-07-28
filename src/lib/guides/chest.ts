// Instrukcje "Jak wykonać?" — KLATKA. Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const CHEST_GUIDES: Record<string, ExerciseGuide> = {
  bench_bb: {
    setup: ["Połóż się na ławce, stopy płasko na podłodze, łopatki ściągnięte i oparte."],
    steps: [
      "Zdejmij sztangę, opuszczaj ją kontrolowanie do dolnej części klatki.",
      "Dotknij klatki lekko, bez odbicia.",
      "Wypchnij sztangę w górę po tym samym torze, aż ramiona się wyprostują.",
    ],
    mistakes: ["Odbijanie sztangi od klatki.", "Unoszenie bioder z ławki.", "Rozjeżdżające się łokcie na bok."],
  },
  bench_db: {
    setup: ["Usiądź z hantlami na udach, połóż się, wprowadzając je nad barki."],
    steps: [
      "Opuszczaj hantle po łuku do wysokości klatki.",
      "Rozciągnij klatkę na dole, bez odbicia.",
      "Wyciśnij hantle w górę, zbliżając je nad klatką.",
    ],
    mistakes: ["Zbyt niskie schodzenie kosztem barków.", "Stukanie hantlami o siebie zamiast kontroli."],
  },
  incline_db: {
    setup: ["Ustaw ławkę na skos 30-45°, hantle startowo nad barkami."],
    steps: [
      "Opuszczaj hantle do górnej części klatki.",
      "Rozciągnij na dole, bez odbicia.",
      "Wyciśnij hantle w górę i lekko do środka.",
    ],
    mistakes: ["Zbyt duży kąt ławki (przechodzi w wyciskanie barków).", "Urywanie zakresu ruchu."],
  },
  bench_incline_bb: {
    setup: ["Ławka na skos 30-45°, chwyt nieco szerszy niż barki, łopatki ściągnięte i oparte."],
    steps: [
      "Zdejmij sztangę, opuszczaj kontrolowanie do górnej części klatki (nie do szyi).",
      "Dotknij klatki bez odbicia.",
      "Wypchnij sztangę w górę po tym samym torze, aż łokcie się wyprostują.",
    ],
    mistakes: [
      "Zbyt duży kąt ławki — robi się z tego wyciskanie barków, nie klatki.",
      "Sztanga schodząca do szyi zamiast do górnej klatki.",
    ],
  },
  dip_chest: {
    setup: ["Chwyć poręcze, wypchnij się na wyprostowane ramiona, pochyl tułów mocno do przodu."],
    steps: [
      "Opuszczaj się, prowadząc łokcie na zewnątrz i utrzymując pochylenie tułowia.",
      "Zejdź, aż barki znajdą się na wysokości łokci (lub do granicy komfortu barków).",
      "Wypchnij się z powrotem w górę tym samym torem.",
    ],
    mistakes: [
      "Tors pionowo — przenosi ciężar na triceps zamiast klatki.",
      "Zbyt głębokie schodzenie kosztem barków.",
    ],
    safety: "Przy bólu w przednim barku skróć zakres ruchu albo zamień na inne ćwiczenie klatki.",
  },
  pushup: {
    setup: ["Dłonie nieco szerzej niż barki, ciało w jednej linii od głowy po pięty, brzuch spięty."],
    steps: [
      "Opuszczaj tułów jednym kawałkiem, łokcie pod kątem ok. 45° do ciała.",
      "Zejdź, aż klatka zbliży się do podłogi.",
      "Wypchnij się z powrotem do pełnego wyprostu ramion.",
    ],
    mistakes: ["Biodra opadające lub zadzierane do góry.", "Łokcie odstające prosto na boki (obciąża barki)."],
  },
  fly_db: {
    setup: ["Leżąc na ławce, hantle nad klatką, łokcie lekko ugięte przez cały ruch."],
    steps: [
      "Opuszczaj hantle łukiem na boki, zachowując stały kąt w łokciach.",
      "Zejdź do wysokości klatki, czując rozciągnięcie, bez odbicia na dole.",
      "Ściągnij hantle z powrotem nad klatkę tym samym łukiem.",
    ],
    mistakes: [
      "Prostowanie/zginanie łokci w trakcie ruchu (zamienia się w wyciskanie).",
      "Zbyt duży ciężar kosztem zakresu i kontroli na dole.",
    ],
  },
  fly_cable: {
    setup: ["Uchwyty wyciągu górnego po obu stronach, mały krok do przodu, lekkie pochylenie tułowia."],
    steps: [
      "Prowadź ręce łukiem do przodu i do środka, łokcie lekko ugięte przez cały ruch.",
      "Ściśnij klatkę, gdy dłonie spotkają się przed tobą.",
      "Wróć kontrolowanie do pozycji rozciągnięcia.",
    ],
    mistakes: ["Ciągnięcie prostymi rękami jak przy wyciskaniu.", "Zbyt duży ciężar skracający zakres ruchu."],
  },
  press_machine: {
    setup: ["Ustaw siedzisko tak, by uchwyty były na wysokości klatki, plecy oparte o siedzisko."],
    steps: [
      "Chwyć uchwyty, łopatki ściągnięte i oparte o siedzisko.",
      "Wypchnij uchwyty do przodu, aż ramiona się wyprostują (bez blokowania łokci na siłę).",
      "Wróć kontrolowanie do pozycji startowej, czując rozciągnięcie klatki.",
    ],
    mistakes: ["Odrywanie pleców od siedziska podczas pchania.", "Urywanie ruchu na krótkim odcinku."],
  },
  pullover_db: {
    setup: ["Biodra nisko, oparte tylko barki o ławkę (poprzecznie), jeden hantel trzymany oburącz nad klatką."],
    steps: [
      "Opuszczaj hantel łukiem za głowę, trzymając lekko ugięte łokcie.",
      "Zejdź do granicy komfortnego rozciągnięcia klatki i najszerszych.",
      "Wróć tym samym łukiem nad klatkę.",
    ],
    mistakes: ["Zbyt niskie biodra bez kontroli tułowia.", "Zginanie łokci jak w wyciskaniu zamiast stałego łuku."],
  },
};
