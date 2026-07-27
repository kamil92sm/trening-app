// P5-1: skala osi Y z podpisami na okrągłych wartościach ("nice numbers", wariant
// algorytmu Heckberta rozszerzony o krok 2,5 — patrz POMYSLY.md sekcja P5-1).

/** Zaokrąglenie zakresu do "ładnej" wartości: 1 / 2 / 2,5 / 5 / 10 × 10^n. */
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const base = Math.pow(10, exponent);
  const fraction = range / base;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 2.25) niceFraction = 2;
    else if (fraction < 3.75) niceFraction = 2.5;
    else if (fraction < 7.5) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 2.5) niceFraction = 2.5;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * base;
}

export interface Scale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
  decimals: number;
}

const FALLBACK_SCALE: Scale = { min: 0, max: 1, step: 1, ticks: [0, 1], decimals: 0 };

/**
 * Skala osi Y z podpisami na okrągłych wartościach zamiast równego podziału
 * rozciągniętej domeny (stary `niceTicks` w Charts.tsx). `minStep` to najmniejszy
 * sensowny krok w jednostce serii (kg → 0.5, sekundy planku → 1, % → 0.5).
 */
export function niceScale(min: number, max: number, maxTicks = 4, minStep = 0.5): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return FALLBACK_SCALE;

  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = Math.max(minStep * 2, Math.abs(lo) * 0.05);
    lo -= pad;
    hi += pad;
  }

  const range = hi - lo;
  const rawStep = range / Math.max(1, maxTicks - 1);
  const step = Math.max(minStep, niceNum(rawStep, true));

  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const count = Math.max(1, Math.round((niceMax - niceMin) / step));

  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    const v = Math.round(niceMin / step + i) * step;
    ticks.push(Math.round(v * 1e6) / 1e6);
  }

  // Krok bywa nieokrągłą wielokrotnością minStep (np. 2,5) — dziesiętne podpisy
  // potrzebne, gdy step ma niecałkowitą część, niezależnie od tego, czy step >= 1.
  const decimals = Number.isInteger(step) ? 0 : 1;

  return {
    min: Math.round(niceMin * 1e6) / 1e6,
    max: Math.round(niceMax * 1e6) / 1e6,
    step,
    ticks,
    decimals,
  };
}
