// Instrukcje "Jak wykonać?" — INNE (poza jedną partią wiodącą). Patrz src/lib/guides/types.ts.
import type { ExerciseGuide } from "./types";

export const OTHER_GUIDES: Record<string, ExerciseGuide> = {
  farmer_walk: {
    setup: ["Chwyć hantle po jednym w każdej ręce, stań prosto, barki ściągnięte w tył."],
    steps: [
      "Spnij brzuch, trzymaj tors pionowo, barki z dala od uszu.",
      "Idź krótkim, szybkim krokiem, nie bujając ciężarami na boki.",
      "Utrzymuj napięcie chwytu i tułowia przez cały czas trwania marszu.",
    ],
    mistakes: ["Garbienie się pod ciężarem zamiast trzymania pleców prosto.", "Zbyt długie, niestabilne kroki."],
  },
};
