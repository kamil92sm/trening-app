// Instrukcje "Jak wykonać?" — BICEPS I TRICEPS. Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const ARM_GUIDES: Record<string, ExerciseGuide> = {
  // ── Biceps ──
  curl_bb: {
    setup: ["Stań prosto, sztanga chwytem podchwytem, łokcie blisko tułowia."],
    steps: [
      "Uginaj ramiona, unosząc sztangę bez ruchu w barkach.",
      "Spnij biceps na szczycie.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Bujanie tułowiem, żeby „pomóc” sztandze.", "Wysuwanie łokci do przodu w trakcie ruchu."],
  },
  hammer_curl: {
    setup: ["Stań prosto, hantle po bokach, chwyt neutralny (dłonie zwrócone do siebie)."],
    steps: [
      "Uginaj ramiona, unosząc hantle bez zmiany chwytu, łokcie blisko tułowia.",
      "Spnij przedramię i biceps na szczycie.",
      "Opuść hantle kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Bujanie tułowiem zamiast czystego zgięcia w łokciu.", "Wysuwanie łokci do przodu."],
  },
  curl_db: {
    setup: ["Stań prosto, hantle po bokach, łokcie przy tułowiu."],
    steps: [
      "Uginaj ramiona, unosząc hantle (naprzemiennie lub razem), obracając nadgarstek na zewnątrz.",
      "Spnij biceps na szczycie.",
      "Opuść hantle kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Bujanie ciałem, żeby wyrzucić ciężar.", "Ruch w barkach zamiast izolacji w łokciu."],
  },
  curl_incline_db: {
    setup: ["Usiądź na ławce nachylonej ok. 45-60°, plecy oparte, ramiona swobodnie zwisają za tułowiem."],
    steps: [
      "Uginaj ramiona, unosząc hantle bez odrywania barków od oparcia.",
      "Spnij biceps na szczycie, czując pełne rozciągnięcie na starcie.",
      "Opuść hantle kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Unoszenie barków z oparcia przy trudniejszych powtórzeniach.", "Zbyt duży ciężar skracający zakres na dole."],
  },
  curl_preacher: {
    setup: ["Usiądź, pachy oparte o poduszkę modlitewnika, chwyt sztangi podchwytem."],
    steps: [
      "Uginaj ramiona, unosząc sztangę, bez odrywania pach od poduszki.",
      "Spnij biceps na szczycie.",
      "Opuść sztangę kontrolowanie do prawie pełnego wyprostu.",
    ],
    mistakes: ["Odrywanie pach od poduszki, żeby oszukać ruch.", "Gwałtowne opuszczanie ciężaru na dole."],
  },
  curl_cable: {
    setup: ["Stań przodem do wyciągu dolnego, chwyć drążek/uchwyty podchwytem, łokcie przy tułowiu."],
    steps: [
      "Uginaj ramiona, unosząc uchwyt, czując stały opór linki.",
      "Spnij biceps na szczycie.",
      "Opuść kontrolowanie do pełnego wyprostu, łokcie nieruchome przez cały ruch.",
    ],
    mistakes: ["Wysuwanie łokci do przodu w trakcie ciągnięcia.", "Bujanie tułowiem."],
  },
  curl_concentration: {
    setup: ["Usiądź, łokieć oparty o wewnętrzną stronę uda tej samej ręki, hantel zwisa swobodnie."],
    steps: [
      "Uginaj ramię, unosząc hantel, bez ruchu łokcia względem uda.",
      "Spnij biceps na szczycie.",
      "Opuść hantel kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Odrywanie łokcia od uda w trakcie ruchu.", "Bujanie tułowiem, żeby pomóc unieść ciężar."],
  },
  curl_reverse: {
    setup: ["Stań prosto, sztanga chwytem nachwytem (grzbiety dłoni do góry), łokcie przy tułowiu."],
    steps: [
      "Uginaj ramiona, unosząc sztangę, nadgarstki utrzymane w linii prostej z przedramieniem.",
      "Spnij na szczycie.",
      "Opuść sztangę kontrolowanie do pełnego wyprostu.",
    ],
    mistakes: ["Zginanie nadgarstków zamiast utrzymania ich prosto.", "Zbyt duży ciężar — to ćwiczenie jest z natury słabsze niż klasyczne uginanie."],
  },

  // ── Triceps ──
  french: {
    setup: ["Sztanga/hantle nad klatką przy wyprostowanych ramionach, łokcie skierowane w sufit."],
    steps: [
      "Ugnij łokcie, opuszczając ciężar w stronę czoła.",
      "Zatrzymaj łokcie w miejscu przez cały ruch.",
      "Wyprostuj ramiona, pracują tylko przedramiona.",
    ],
    mistakes: ["Rozjeżdżające się łokcie na boki.", "Zbyt duży ciężar kosztem zakresu ruchu."],
  },
  pushdown: {
    setup: ["Stań przodem do wyciągu górnego, chwyć drążek nachwytem, łokcie przyklejone do boków."],
    steps: [
      "Prostuj ramiona w dół, nie ruszając łokciami.",
      "Zatrzymaj na chwilę w pełnym wyproście.",
      "Wróć kontrolowanie do zgięcia ok. 90° w łokciu.",
    ],
    mistakes: ["Odrywanie łokci od tułowia i pchanie całym ciałem.", "Urywanie górnej części zakresu ruchu."],
  },
  bench_close_bb: {
    setup: ["Połóż się na ławce, chwyt na szerokość barków, łokcie blisko tułowia."],
    steps: [
      "Opuszczaj sztangę kontrolowanie do dolnej części klatki, łokcie ślizgają się blisko boków.",
      "Dotknij klatki lekko, bez odbicia.",
      "Wypchnij sztangę w górę, prostując głównie w łokciach.",
    ],
    mistakes: ["Zbyt szeroki chwyt (robi się z tego zwykłe wyciskanie klatki).", "Rozjeżdżające się łokcie na boki."],
  },
  dip_triceps: {
    setup: ["Chwyć poręcze, wypchnij się na wyprostowane ramiona, tors utrzymuj pionowo."],
    steps: [
      "Opuszczaj się, prowadząc łokcie blisko tułowia (nie na zewnątrz).",
      "Zejdź do kąta ok. 90° w łokciach.",
      "Wypchnij się z powrotem do pełnego wyprostu ramion.",
    ],
    mistakes: ["Pochylanie tułowia do przodu (przenosi pracę na klatkę).", "Zbyt głębokie schodzenie kosztem barków."],
    safety: "Przy bólu w przednim barku skróć zakres ruchu.",
  },
  dip_bench: {
    setup: ["Dłonie na krawędzi ławki za sobą, nogi wyprostowane przed sobą, biodra blisko ławki."],
    steps: [
      "Opuszczaj biodra w dół, zginając łokcie do tyłu.",
      "Zejdź do kąta ok. 90° w łokciach.",
      "Wypchnij się z powrotem do wyprostowanych ramion.",
    ],
    mistakes: ["Odsuwanie bioder daleko od ławki (obciąża barki).", "Zbyt szybkie, niekontrolowane powtórzenia."],
  },
  pushdown_rope: {
    setup: ["Stań przodem do wyciągu górnego, chwyć linę, łokcie przyklejone do boków."],
    steps: [
      "Prostuj ramiona w dół, rozchylając końce liny na końcu ruchu.",
      "Zatrzymaj na chwilę w pełnym wyproście.",
      "Wróć kontrolowanie, łokcie nieruchome.",
    ],
    mistakes: ["Odrywanie łokci od tułowia.", "Brak rozchylenia liny na dole (traci się skurcz triceps)."],
  },
  overhead_ext_cable: {
    setup: ["Stań tyłem do wyciągu dolnego, chwyć linę/uchwyt oburącz nad głową, łokcie wysoko."],
    steps: [
      "Prostuj ramiona do góry, łokcie nieruchome przez cały ruch.",
      "Zatrzymaj na chwilę w pełnym wyproście.",
      "Wróć kontrolowanie, czując rozciągnięcie tricepsa za głową.",
    ],
    mistakes: ["Ruch w łokciach do przodu/tyłu zamiast pracy w jednym miejscu.", "Nadmierne wyginanie pleców."],
  },
  skullcrusher_db: {
    setup: ["Połóż się na ławce, hantle nad klatką przy wyprostowanych ramionach, łokcie skierowane w sufit."],
    steps: [
      "Ugnij łokcie, opuszczając hantle przy skroniach.",
      "Utrzymaj łokcie nieruchomo przez cały ruch.",
      "Wyprostuj ramiona, pracują tylko przedramiona.",
    ],
    mistakes: ["Rozjeżdżające się łokcie na boki.", "Ruch w barkach zamiast izolacji w łokciu."],
  },
  kickback_db: {
    setup: ["Opad tułowia ok. 45°, ramię górne równoległe do podłogi, łokieć zgięty pod kątem 90°."],
    steps: [
      "Prostuj przedramię w tył, utrzymując ramię górne nieruchomo.",
      "Zatrzymaj na chwilę w pełnym wyproście.",
      "Wróć kontrolowanie do kąta 90° w łokciu.",
    ],
    mistakes: ["Ruch całym ramieniem zamiast tylko przedramieniem.", "Prostowanie pleców zamiast utrzymania opadu tułowia."],
  },
};
