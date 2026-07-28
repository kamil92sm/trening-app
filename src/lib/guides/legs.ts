// Instrukcje "Jak wykonać?" — NOGI (czworogłowe, tył uda, łydki). Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const LEG_GUIDES: Record<string, ExerciseGuide> = {
  squat: {
    setup: ["Sztanga na górnej części pleców, stopy na szerokość barków, lekko na zewnątrz."],
    steps: [
      "Nabierz powietrza, spnij brzuch.",
      "Zejdź w dół, prowadząc kolanami zgodnie z kierunkiem stóp.",
      "Zejdź do pełnej głębokości, zachowując proste plecy.",
      "Wstań, wypychając podłogę stopami.",
    ],
    mistakes: ["Zaokrąglanie dolnego odcinka pleców.", "Kolana zapadające się do środka.", "Podnoszenie pięt."],
    safety: "Nie walcz o powtórzenie kosztem techniki — przy wątpliwościach zejdź z ciężaru.",
  },
  lunges: {
    setup: ["Stań prosto, hantle po bokach, wzrok przed siebie."],
    steps: [
      "Zrób krok do przodu (lub w tył), opuszczając biodra pionowo w dół.",
      "Zejdź, aż tylne kolano zbliży się do podłogi.",
      "Wypchnij się z powrotem do pozycji startowej przez przednią stopę.",
    ],
    mistakes: ["Zbyt krótki krok — kolano wychodzi przed palce.", "Chwiejny balans z powodu zbyt wąskiego stawiania stóp."],
  },
  calf: {
    setup: ["Stań na maszynie/stopniu, pięty poza krawędzią, ciężar na barkach lub w rękach."],
    steps: [
      "Opuszczaj pięty jak najniżej, rozciągając łydki.",
      "Wypchnij się na palce, jak najwyżej.",
      "Zatrzymaj na chwilę na szczycie, wróć kontrolowanie w dół.",
    ],
    mistakes: ["Bujanie i odbijanie się zamiast kontrolowanego ruchu.", "Skracanie zakresu, zwłaszcza na dole."],
  },
  calf_seated: {
    setup: ["Usiądź, kolana pod wałkiem obciążenia, palce stóp na podeście, pięty poza krawędzią."],
    steps: [
      "Opuszczaj pięty jak najniżej.",
      "Wypchnij się na palce, jak najwyżej, spinając łydkę.",
      "Zatrzymaj na chwilę na górze, wróć kontrolowanie.",
    ],
    mistakes: ["Zbyt szybkie, bujane powtórzenia.", "Urywanie zakresu ruchu na dole."],
  },
  calf_press: {
    setup: ["Na suwnicy, stopy na dolnej platformie, pięty poza krawędzią, nogi wyprostowane."],
    steps: [
      "Opuszczaj pięty jak najniżej, rozciągając łydki.",
      "Wypchnij się na palce w pełnym zakresie.",
      "Zatrzymaj na chwilę na górze, wróć kontrolowanie.",
    ],
    mistakes: ["Zginanie kolan, żeby oszukać zakres ruchu.", "Odbijanie się od dolnej pozycji."],
  },
  front_squat: {
    setup: ["Sztanga oparta na przednich barkach, łokcie wysoko, chwyt na szerokość barków lub skrzyżowany."],
    steps: [
      "Nabierz powietrza, spnij brzuch, utrzymuj tors możliwie pionowo.",
      "Zejdź w dół, prowadząc kolanami zgodnie z kierunkiem stóp, łokcie cały czas wysoko.",
      "Zejdź do pełnej głębokości bez opadania tułowia do przodu.",
      "Wstań, wypychając podłogę stopami.",
    ],
    mistakes: ["Opadające łokcie (sztanga zsuwa się z barków).", "Pochylanie tułowia do przodu przy wstawaniu."],
    safety: "Jeśli łokcie nie utrzymują pozycji, zmniejsz ciężar — to pierwszy sygnał utraty kontroli nad sztangą.",
  },
  goblet_squat: {
    setup: ["Trzymaj hantel oburącz przy klatce, stopy na szerokość barków."],
    steps: [
      "Zejdź w głęboki przysiad, prowadząc kolanami na zewnątrz, łokcie mijają kolana od wewnątrz.",
      "Zejdź tak nisko, jak pozwala ruchomość, zachowując proste plecy.",
      "Wstań, wypychając podłogę stopami.",
    ],
    mistakes: ["Opadanie hantla do przodu (garbi plecy).", "Unoszenie pięt zamiast pełnego kontaktu stopy z podłogą."],
  },
  leg_press: {
    setup: ["Stopy na szerokość barków na platformie, plecy oparte o siedzisko."],
    steps: [
      "Odblokuj zabezpieczenia, opuszczaj platformę, prowadząc kolanami zgodnie z kierunkiem stóp.",
      "Zejdź do momentu, aż dolny odcinek pleców zaczyna odrywać się od siedziska — nie dalej.",
      "Wypchnij platformę z powrotem, nie blokując kolan na sztywno na górze.",
    ],
    mistakes: ["Blokowanie kolan na górze ruchu.", "Zbyt głębokie schodzenie kosztem odrywania bioder od siedziska."],
  },
  hack_squat: {
    setup: ["Plecy i barki przyklejone do oparcia, stopy na platformie na szerokość barków."],
    steps: [
      "Odblokuj zabezpieczenia, zejdź w dół, prowadząc kolanami zgodnie z kierunkiem stóp.",
      "Zejdź do pełnego, kontrolowanego zakresu.",
      "Wstań, wypychając platformę stopami, bez blokowania kolan na sztywno.",
    ],
    mistakes: ["Odrywanie pleców od oparcia.", "Zbyt szybkie, niekontrolowane opuszczanie."],
  },
  leg_ext: {
    setup: ["Usiądź, wałek oparty o podudzia tuż nad kostkami, plecy oparte o siedzisko."],
    steps: [
      "Prostuj nogi, unosząc wałek aż do pełnego wyprostu kolan.",
      "Zatrzymaj na chwilę na górze.",
      "Opuść kontrolowanie, bez odbicia na dole.",
    ],
    mistakes: ["Odbijanie ciężaru na dole zamiast kontroli.", "Odrywanie pleców od siedziska przy pchaniu."],
  },
  bulgarian_split: {
    setup: ["Tylna stopa oparta na podwyższeniu za tobą, przednia noga w wykroku, hantle po bokach."],
    steps: [
      "Opuszczaj biodra pionowo w dół, zginając przednie kolano.",
      "Zejdź, aż tylne kolano zbliży się do podłogi.",
      "Wypchnij się z powrotem, pracując głównie przednią nogą.",
    ],
    mistakes: ["Zbyt duży ciężar całego ciała na tylnej stopie zamiast przedniej nodze.", "Chwiejny balans przez zbyt wąskie ustawienie stóp."],
  },
  step_up: {
    setup: ["Stań przed skrzynią/stopniem na wysokości ok. kolana, hantle po bokach."],
    steps: [
      "Postaw całą stopę na skrzyni, przenieś na nią cały ciężar ciała.",
      "Wypchnij się w górę jedną nogą, bez odbijania się drugą od podłogi.",
      "Zejdź kontrolowanie tą samą nogą do pozycji startowej.",
    ],
    mistakes: ["Odbijanie się tylną nogą (odciąża pracującą nogę).", "Za wysoki stopień kosztem techniki."],
  },
  leg_curl_lying: {
    setup: ["Połóż się przodem, wałek oparty o łydki tuż nad piętami, biodra przyklejone do ławki."],
    steps: [
      "Zginaj kolana, prowadząc pięty w stronę pośladków.",
      "Zatrzymaj na chwilę w pozycji maksymalnego zgięcia.",
      "Wróć kontrolowanie do pełnego wyprostu nóg, bez odbicia.",
    ],
    mistakes: ["Unoszenie bioder z ławki przy ciągnięciu.", "Odbijanie ciężaru zamiast kontrolowanego powrotu."],
  },
  leg_curl_seated: {
    setup: ["Usiądź, wałek oparty o łydki tuż nad piętami, uda przypięte pasem."],
    steps: [
      "Zginaj kolana, prowadząc wałek w stronę siedziska.",
      "Zatrzymaj na chwilę w dolnej pozycji zgięcia.",
      "Wróć kontrolowanie do pełnego wyprostu nóg.",
    ],
    mistakes: ["Odrywanie ud od siedziska.", "Zbyt szybki, niekontrolowany powrót."],
  },
  nordic_curl: {
    setup: ["Klęknij, kostki zablokowane (partner lub sprzęt), tułów prosty od kolan w górę."],
    steps: [
      "Opadaj powoli do przodu, hamując ruch tylną częścią uda tak długo, jak się da.",
      "W momencie utraty kontroli złap się rękami o podłogę, amortyzując upadek.",
      "Wróć do pozycji startowej pomagając sobie rękami — to jedno z najtrudniejszych ćwiczeń, nie wstydź się dopomagać.",
    ],
    mistakes: ["Zginanie w biodrach zamiast utrzymania linii prostej tułowia i ud.", "Zbyt szybkie opadanie bez kontroli."],
    safety: "Bardzo wymagające dla tylnej części uda — zacznij od małego zakresu i pomocy rąk, buduj siłę stopniowo.",
  },
  good_morning: {
    setup: ["Sztanga na górnej części pleców (jak w przysiadzie), stopy na szerokość barków, lekkie zgięcie kolan."],
    steps: [
      "Zawiasuj w biodrach, odsuwając je do tyłu, z prostym kręgosłupem.",
      "Schodź, aż poczujesz mocne rozciągnięcie tylnej części uda.",
      "Wróć, wypychając biodra do przodu i prostując tułów.",
    ],
    mistakes: ["Zaokrąglanie pleców w trakcie schylania.", "Zginanie kolan zamiast pracy w biodrach."],
    safety: "Zacznij od małego ciężaru — to ćwiczenie mocno obciąża dolny odcinek pleców przy błędnej technice.",
  },
  rdl_bb: {
    setup: ["Sztanga przy udach, chwyt na szerokość barków, lekko ugięte kolana, plecy proste."],
    steps: [
      "Zawiasuj w biodrach, odsuwając je do tyłu, prowadząc sztangę blisko nóg.",
      "Schodź, aż poczujesz rozciągnięcie tylnej części uda, kolana prawie proste.",
      "Wróć, wypychając biodra do przodu.",
    ],
    mistakes: ["Zaokrąglanie pleców na dole.", "Sztanga oddalająca się od nóg (dodatkowe obciążenie na plecy)."],
    safety: "Schodź tylko do granicy, w której plecy zostają proste — dalej to już zaokrąglenie, nie zakres ruchu.",
  },
  deadlift_sumo: {
    setup: ["Szeroki rozstaw stóp, palce lekko na zewnątrz, chwyt sztangi między kolanami, plecy proste."],
    steps: [
      "Nabierz powietrza, spnij tułów, kolana w linii palców stóp.",
      "Wypchnij podłogę stopami, prowadząc sztangę blisko nóg.",
      "Wyprostuj biodra na górze, bez przeprostu w plecach.",
      "Opuszczaj sztangę tym samym torem, zawiasując w biodrach i kolanach.",
    ],
    mistakes: ["Kolana zapadające się do środka podczas wstawania.", "Zaokrąglanie pleców przy podłodze."],
    safety: "UWAGA NA PLECY — przy pierwszym sygnale zaokrąglenia przerwij serię.",
  },
  kb_swing: {
    setup: ["Stań nad kettlebell/hantlem, stopy nieco szerzej niż barki, chwyć ciężar oburącz."],
    steps: [
      "Zawiasuj w biodrach, przesuwając ciężar między nogi (hip hinge, nie przysiad).",
      "Wypchnij biodra gwałtownie do przodu, wyrzucając ciężar do wysokości barków.",
      "Pozwól ciężarowi opaść z powrotem, amortyzując ruch w biodrach.",
    ],
    mistakes: ["Podnoszenie ciężaru rękami zamiast wypychania biodrami.", "Zginanie kolan jak w przysiadzie zamiast zawiasowania."],
  },
};
