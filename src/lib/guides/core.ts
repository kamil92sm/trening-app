// Instrukcje "Jak wykonać?" — BRZUCH. Patrz src/lib/guides/types.ts.
// isHold (plank, side_plank, hollow_hold): "steps" opisują utrzymanie pozycji
// (sekundy), nie klasyczną koncentrykę/ekscentrykę pojedynczego powtórzenia.
import type { ExerciseGuide } from "./types";

export const CORE_GUIDES: Record<string, ExerciseGuide> = {
  crunch: {
    setup: ["Klęknij przodem do wyciągu górnego, chwyć linę po obu stronach głowy."],
    steps: [
      "Spnij brzuch i zwiń tułów w dół, prowadząc mostek w stronę bioder.",
      "Biodra pozostają nieruchome — ruch dzieje się tylko w kręgosłupie.",
      "Wróć kontrolowanie do pozycji startowej, nie tracąc napięcia brzucha.",
    ],
    mistakes: ["Ciągnięcie liny rękami zamiast zginania tułowia.", "Ruch biodrami do tyłu zamiast zwijania kręgosłupa."],
  },
  plank: {
    setup: ["Przedramiona i palce stóp na podłodze, łokcie pod barkami, ciało w jednej linii."],
    steps: [
      "Spnij brzuch i pośladki, jakbyś miał dostać w brzuch.",
      "Utrzymuj biodra na wysokości barków — ani zapadnięte, ani zadarte.",
      "Oddychaj spokojnie, utrzymując napięcie przez cały czas trwania serii.",
    ],
    mistakes: ["Opadające biodra (odciążają brzuch, obciążają plecy).", "Zadzieranie bioder zbyt wysoko."],
  },
  side_plank: {
    setup: ["Połóż się na boku, przedramię pod barkiem, nogi wyprostowane jedna na drugiej."],
    steps: [
      "Unieś biodra z podłogi, tworząc linię prostą od kostek po głowę.",
      "Spnij skos i boczne mięśnie tułowia (QL), nie pozwalając biodrom opaść.",
      "Oddychaj spokojnie, utrzymując pozycję przez cały czas trwania serii.",
    ],
    mistakes: ["Opadające biodra w trakcie trzymania.", "Obracanie tułowia do przodu lub do tyłu zamiast płaskiej linii."],
  },
  hanging_leg_raise: {
    setup: ["Zwis na drążku, chwyt nachwytem nieco szerzej niż barki, nogi wyprostowane."],
    steps: [
      "Unieś nogi kontrolowanym ruchem, prowadząc je jak najwyżej (do linii bioder lub wyżej).",
      "Zatrzymaj na chwilę na górze, spinając brzuch.",
      "Opuść nogi kontrolowanie, bez huśtania się na drążku.",
    ],
    mistakes: ["Huśtanie ciałem, żeby wyrzucić nogi w górę.", "Zginanie kolan zamiast pracy prostymi nogami (jeśli celujesz w pełny zakres)."],
  },
  leg_raise_lying: {
    setup: ["Połóż się na plecach, dłonie płasko pod pośladkami lub wzdłuż ciała, nogi wyprostowane."],
    steps: [
      "Unoś nogi razem, aż znajdą się pod kątem ok. 90° do podłogi.",
      "Zatrzymaj na chwilę na górze.",
      "Opuszczaj nogi kontrolowanie, utrzymując dolny odcinek pleców przyklejony do podłogi.",
    ],
    mistakes: ["Odrywanie dolnego odcinka pleców od podłogi przy opuszczaniu.", "Zbyt szybkie, bujane powtórzenia."],
  },
  ab_wheel: {
    setup: ["Klęknij, chwyć uchwyty kółka, ustaw je pod barkami, spnij brzuch."],
    steps: [
      "Wyjeżdżaj kółkiem do przodu, wydłużając ciało, tak daleko, jak utrzymasz spięty brzuch.",
      "Zatrzymaj się, zanim plecy zaczną się zapadać (uginać w dolnym odcinku).",
      "Wróć do pozycji startowej, ciągnąc kółko z powrotem siłą brzucha, nie bioder.",
    ],
    mistakes: ["Zapadanie się pleców na najdalszym punkcie wyjazdu.", "Zbyt duży zakres na start, zanim brzuch jest gotowy."],
    safety: "Zacznij od małego zakresu ruchu — pełne rollout to zaawansowany wariant, buduj do niego stopniowo.",
  },
  woodchop_cable: {
    setup: ["Stań bokiem do wyciągu ustawionego wysoko (lub nisko dla wariantu odwrotnego), chwyć uchwyt oburącz."],
    steps: [
      "Prowadź uchwyt po przekątnej od góry do dołu (lub odwrotnie), rotując tułów z biodrami.",
      "Zatrzymaj na końcu ruchu, spinając skosy.",
      "Wróć kontrolowanie do pozycji startowej, utrzymując napięcie brzucha.",
    ],
    mistakes: ["Ruch tylko rękami bez rotacji tułowia z bioder.", "Zbyt duży ciężar kosztem kontroli i tempa."],
  },
  russian_twist: {
    setup: ["Usiądź, tułów odchylony do tyłu ok. 45°, hantel/kettlebell trzymany oburącz przed sobą, opcjonalnie stopy nad podłogą."],
    steps: [
      "Skręcaj tułów na boki, dotykając ciężarem podłogi obok bioder.",
      "Utrzymuj biodra stabilne — ruch dzieje się w tułowiu, nie w nogach.",
      "Wykonuj skręty płynnie, bez szarpania.",
    ],
    mistakes: ["Zbyt szybkie, niekontrolowane skręty (ryzyko dla pleców).", "Skręcanie samymi rękami zamiast tułowiem."],
  },
  dead_bug: {
    setup: ["Połóż się na plecach, ręce wyciągnięte nad barki, kolana ugięte pod kątem 90° nad biodrami."],
    steps: [
      "Opuszczaj jednocześnie przeciwną rękę za głowę i przeciwną nogę w stronę podłogi.",
      "Zatrzymaj tuż przed podłogą, nie tracąc kontaktu dolnego odcinka pleców z matą.",
      "Wróć do pozycji startowej i powtórz na drugą stronę.",
    ],
    mistakes: ["Odrywanie dolnego odcinka pleców od podłogi.", "Zbyt szybkie tempo kosztem kontroli."],
  },
  hollow_hold: {
    setup: ["Połóż się na plecach, dolny odcinek pleców przyklejony do podłogi, ręce i nogi uniesione."],
    steps: [
      "Spnij brzuch, dociskając plecy mocno do maty.",
      "Utrzymuj ręce i nogi uniesione nad podłogą, tworząc łagodny łuk ciałem.",
      "Oddychaj spokojnie, utrzymując napięcie przez cały czas trwania serii.",
    ],
    mistakes: ["Odrywanie dolnego odcinka pleców od podłogi (przeprost).", "Zbyt niskie nogi ponad siły — lepiej wyżej i z kontrolą."],
  },
  pallof_press: {
    setup: ["Stań bokiem do wyciągu na wysokości klatki, chwyć uchwyt oburącz przy mostku."],
    steps: [
      "Wypychaj ręce prosto przed siebie, opierając się sile ciągnącej cię w bok.",
      "Zatrzymaj na chwilę w pełnym wyproście, utrzymując tułów prosto (bez rotacji).",
      "Wróć kontrolowanie do klatki, nie pozwalając liniom bioder się skręcić.",
    ],
    mistakes: ["Pozwalanie tułowiowi skręcić się w stronę wyciągu.", "Zbyt duży ciężar uniemożliwiający utrzymanie prostej sylwetki."],
  },
};
