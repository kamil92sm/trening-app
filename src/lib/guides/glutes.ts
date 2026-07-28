// Instrukcje "Jak wykonać?" — POŚLADKI. Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const GLUTE_GUIDES: Record<string, ExerciseGuide> = {
  hipthrust: {
    setup: ["Oprzyj górną część pleców o ławkę, sztanga nad biodrami, stopy płasko."],
    steps: [
      "Wypchnij biodra w górę, aż tułów i uda utworzą linię prostą.",
      "Spnij pośladki na górze przez chwilę.",
      "Opuść biodra kontrolowanie, bez odbicia od podłogi.",
    ],
    mistakes: ["Przeprost w dolnym odcinku pleców na górze ruchu.", "Zbyt płytki zakres."],
  },
  rdl: {
    setup: ["Hantle/sztanga przy udach, lekko ugięte kolana, plecy proste."],
    steps: [
      "Zawiasuj w biodrach, odsuwając je do tyłu.",
      "Schodź, prowadząc ciężar blisko nóg, aż poczujesz rozciągnięcie tylnej części uda.",
      "Wróć, wypychając biodra do przodu.",
    ],
    mistakes: ["Zginanie kolan zamiast pracy w biodrach.", "Zaokrąglanie pleców na dole."],
    safety: "Schodź tylko do granicy, w której plecy zostają proste — dalej to już zaokrąglenie, nie zakres ruchu.",
  },
  hipthrust_machine: {
    setup: ["Usiądź pod wałkiem obciążenia, górna część pleców oparta o siedzisko, stopy płasko."],
    steps: [
      "Wypchnij biodra w górę, aż tułów i uda utworzą linię prostą.",
      "Spnij pośladki na chwilę na górze.",
      "Opuść biodra kontrolowanie, bez odbicia.",
    ],
    mistakes: ["Zbyt płytki zakres ruchu.", "Pchanie samymi nogami zamiast wypychania biodrami."],
  },
  glute_bridge: {
    setup: ["Połóż się na plecach na podłodze, kolana ugięte, stopy płasko blisko pośladków, sztanga nad biodrami."],
    steps: [
      "Wypchnij biodra w górę, spinając pośladki.",
      "Zatrzymaj na chwilę w najwyższym punkcie.",
      "Opuść biodra kontrolowanie do podłogi.",
    ],
    mistakes: ["Przeprost pleców na górze zamiast pracy z pośladków.", "Zbyt szybkie, bujane powtórzenia."],
  },
  cable_kickback: {
    setup: ["Przypnij mankiet wyciągu do kostki, stań przodem do wyciągu, lekkie pochylenie tułowia, trzymaj się dla balansu."],
    steps: [
      "Prowadź nogę w tył i lekko w górę, spinając pośladek na końcu ruchu.",
      "Zatrzymaj na chwilę w skurczu.",
      "Wróć kontrolowanie do pozycji startowej, bez bujania tułowiem.",
    ],
    mistakes: ["Bujanie tułowiem, żeby wykopnąć nogę wyżej.", "Prostowanie pleców zamiast izolacji pośladka."],
  },
  abduction_machine: {
    setup: ["Usiądź, plecy oparte o siedzisko, zewnętrzna strona ud oparta o poduszki."],
    steps: [
      "Odwódź nogi na zewnątrz, pracując tylko w biodrach.",
      "Zatrzymaj na chwilę w najszerszej pozycji.",
      "Wróć kontrolowanie do pozycji startowej.",
    ],
    mistakes: ["Odrywanie pleców od siedziska.", "Bujanie ciałem, żeby dopchnąć ciężar."],
  },
};
