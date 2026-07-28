// Zbiera GUIDES per partia w jedną mapę id -> ExerciseGuide. Każde ID z
// SEED_EXERCISES (90 pozycji) ma bezpośredni wpis w dokładnie jednym z
// plików niżej — patrz tests/logic.test.ts dla testu pokrycia.
import type { ExerciseGuide } from "./types";
import { CHEST_GUIDES } from "./chest";
import { BACK_GUIDES } from "./back";
import { SHOULDER_GUIDES } from "./shoulders";
import { LEG_GUIDES } from "./legs";
import { GLUTE_GUIDES } from "./glutes";
import { ARM_GUIDES } from "./arms";
import { CORE_GUIDES } from "./core";
import { OTHER_GUIDES } from "./other";

export type { ExerciseGuide } from "./types";

export const GUIDES: Record<string, ExerciseGuide> = {
  ...CHEST_GUIDES,
  ...BACK_GUIDES,
  ...SHOULDER_GUIDES,
  ...LEG_GUIDES,
  ...GLUTE_GUIDES,
  ...ARM_GUIDES,
  ...CORE_GUIDES,
  ...OTHER_GUIDES,
};
