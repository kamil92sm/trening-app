// Instrukcje "Jak wykonać?" — BARKI. Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const SHOULDER_GUIDES: Record<string, ExerciseGuide> = {
  lateral: {
    setup: ["Stań prosto, hantle po bokach, lekko ugięte łokcie."],
    steps: [
      "Unieś hantle bokiem do wysokości barków, prowadząc łokciem.",
      "Zatrzymaj na chwilę na szczycie.",
      "Opuść hantle kontrolowanie, bez bujania ciałem.",
    ],
    mistakes: ["Zarzucanie ciężaru pędem tułowia.", "Unoszenie zbyt wysoko kosztem barku."],
  },
  ohp: {
    setup: ["Sztanga na wysokości obojczyków, chwyt nieco szerszy niż barki, pośladki i brzuch spięte."],
    steps: [
      "Wypchnij sztangę pionowo w górę, przesuwając głowę lekko do tyłu w połowie ruchu.",
      "Zablokuj ręce na górze, sztanga nad środkiem stopy.",
      "Opuść sztangę kontrolowanie do wysokości obojczyków.",
    ],
    mistakes: ["Nadmierne odchylanie się do tyłu.", "Wypychanie samymi barkami bez stabilizacji tułowia."],
    safety: "Trzymaj spięty brzuch i pośladki przez cały ruch — to chroni odcinek lędźwiowy przy wypychaniu nad głowę.",
  },
  face_pull: {
    setup: ["Wyciąg na wysokości twarzy, chwyt liny, lekki odkrok do tyłu."],
    steps: [
      "Ciągnij linę do twarzy, rozciągając ją na końcu ruchu.",
      "Łokcie prowadź wysoko, na wysokości barków.",
      "Wróć kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Ciągnięcie nisko, do klatki zamiast do twarzy.", "Zbyt duży ciężar kosztem zakresu ruchu."],
  },
  ohp_db: {
    setup: ["Usiądź lub stań, hantle na wysokości barków, dłonie zwrócone do przodu."],
    steps: [
      "Wypchnij hantle pionowo w górę, aż ramiona się wyprostują nad głową.",
      "Zbliż hantle nad głową, nie stukając nimi o siebie.",
      "Opuść hantle kontrolowanie do wysokości barków.",
    ],
    mistakes: ["Nadmierne odchylanie tułowia do tyłu.", "Wypychanie hantli zbyt daleko przed siebie zamiast pionowo."],
  },
  arnold_press: {
    setup: ["Usiądź, hantle przed barkami, dłonie zwrócone do siebie (chwyt jak w podchwycie do klatki)."],
    steps: [
      "Wypychaj hantle w górę, jednocześnie rotując nadgarstki na zewnątrz.",
      "Na górze ramiona wyprostowane, dłonie zwrócone do przodu.",
      "Wróć tym samym torem z rotacją, kontrolowanie, do pozycji startowej.",
    ],
    mistakes: ["Zbyt szybka rotacja bez kontroli ciężaru.", "Nadmierne odchylanie się do tyłu przy wypychaniu."],
  },
  lateral_cable: {
    setup: ["Stań bokiem do wyciągu dolnego, uchwyt w dalszej od wyciągu ręce, ręka przy boku."],
    steps: [
      "Unieś ramię bokiem do wysokości barku, prowadząc łokciem.",
      "Zatrzymaj na chwilę na szczycie.",
      "Opuść kontrolowanie, czując stały opór przez cały zakres.",
    ],
    mistakes: ["Zarzucanie ciężaru pędem tułowia.", "Odwracanie się tułowiem zamiast izolacji barku."],
  },
  rear_delt_db: {
    setup: ["Opad tułowia w biodrach ok. 90°, hantle zwisają pod klatką, łokcie lekko ugięte."],
    steps: [
      "Unieś hantle w bok i lekko w tył, prowadząc łokciami, nie dłońmi.",
      "Zatrzymaj na wysokości barków, ściągając łopatki.",
      "Opuść hantle kontrolowanie do pozycji startowej.",
    ],
    mistakes: ["Prostowanie tułowia, żeby pomóc sobie pędem.", "Unoszenie ramion w górę zamiast w tył."],
  },
  rear_delt_machine: {
    setup: ["Usiądź przodem do maszyny, klatka oparta o poduszkę, chwyć uchwyty przed sobą."],
    steps: [
      "Prowadź ramiona w tył i na boki, na wysokości barków.",
      "Ściągnij łopatki na końcu ruchu.",
      "Wróć kontrolowanie do pozycji startowej.",
    ],
    mistakes: ["Odrywanie klatki od poduszki.", "Zbyt duży ciężar skracający zakres ruchu."],
  },
  upright_row: {
    setup: ["Stań prosto, sztanga chwytem na szerokość barków, ręce przed udami."],
    steps: [
      "Unieś sztangę wzdłuż tułowia, prowadząc łokciami wyżej niż nadgarstki.",
      "Zatrzymaj na wysokości klatki piersiowej.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu ramion.",
    ],
    mistakes: ["Unoszenie sztangi zbyt wysoko (obciąża barki).", "Szarpanie ciężaru pędem tułowia."],
    safety: "Przy dyskomforcie w barku podczas ruchu w górę skróć zakres albo zamień na wznosy bokiem.",
  },
  front_raise_db: {
    setup: ["Stań prosto, hantle przed udami, chwyt neutralny lub pronowany."],
    steps: [
      "Unieś jeden lub oba hantle przodem do wysokości oczu.",
      "Zatrzymaj na chwilę na szczycie.",
      "Opuść hantle kontrolowanie, bez bujania tułowiem.",
    ],
    mistakes: ["Bujanie tułowiem, żeby wyrzucić ciężar.", "Unoszenie powyżej wysokości oczu kosztem barku."],
  },
  shrug_bb: {
    setup: ["Stań prosto, sztanga trzymana przed udami, chwyt na szerokość barków."],
    steps: [
      "Unieś barki prosto w górę, jak najbliżej uszu.",
      "Zatrzymaj na chwilę w najwyższym punkcie.",
      "Opuść barki kontrolowanie do pozycji startowej.",
    ],
    mistakes: ["Kręcenie barkami zamiast ruchu w linii prostej.", "Uginanie łokci, żeby pomóc sobie unieść ciężar."],
  },
};
