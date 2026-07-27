// Autorskie, lekkie wykresy SVG — bez zależności zewnętrznych.
import { niceScale } from "@/lib/scale";

interface Point {
  x: number; // timestamp lub indeks
  y: number;
}

export function LineChart({
  data,
  data2,
  projection,
  markers,
  goalY,
  nowX,
  height = 170,
  color = "#38bdf8",
  color2 = "#f59e0b",
  minTickStep = 0.5,
  formatY,
  formatX,
}: {
  data: Point[];
  /** Opcjonalny drugi szereg — rysowany w tej samej skali osi Y co data */
  data2?: Point[];
  /** Opcjonalna przerywana projekcja/trend — od ostatniego punktu `data` dalej, ten sam kolor, styl przerywany */
  projection?: Point[];
  /** Pionowe znaczniki (timestampy) — np. dni squasha (P2-2). Poza domeną X są pomijane. */
  markers?: number[];
  /** P4-9: pozioma przerywana linia celu (ta sama jednostka co `data.y`) — rozszerza domenę Y, jeśli cel jest poza zakresem danych. */
  goalY?: number;
  /** P5-2: znacznik "dziś" (timestamp) — pionowa przerywana linia, wchodzi też do domeny X. */
  nowX?: number;
  height?: number;
  color?: string;
  color2?: string;
  /** P5-1: najmniejszy sensowny krok osi Y w jednostce serii (kg → 0.5, sekundy → 1, % → 0.5). */
  minTickStep?: number;
  formatY?: (y: number) => string;
  formatX?: (x: number) => string;
}) {
  const width = 340;

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Brak danych — zaloguj pierwszy trening.
      </div>
    );
  }

  const all = [...data, ...(data2 ?? []), ...(projection ?? [])];
  const xs = nowX !== undefined ? [...all.map((d) => d.x), nowX] : all.map((d) => d.x);
  const ys = goalY !== undefined ? [...all.map((d) => d.y), goalY] : all.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const scale = niceScale(Math.min(...ys), Math.max(...ys), 4, minTickStep);
  const minY = scale.min;
  const maxY = scale.max;
  const fmtY = formatY ?? ((y: number) => y.toFixed(scale.decimals));

  // Podpisy z prawej strony osi Y bywają dłuższe niż sztywny margines (np. "1250" albo
  // "+12,5%") — licz szerokość marginesu z najdłuższego podpisu, inaczej wchodzi pod wykres.
  const maxLabelChars = Math.max(...scale.ticks.map((t) => fmtY(t).length), 1);
  const pad = { l: Math.max(26, 10 + maxLabelChars * 5.6), r: 10, t: 10, b: formatX ? 22 : 10 };

  const px = (x: number) =>
    maxX === minX
      ? (pad.l + width - pad.r) / 2
      : pad.l + ((x - minX) / (maxX - minX)) * (width - pad.l - pad.r);
  const py = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (height - pad.t - pad.b);

  const toPath = (pts: Point[]) =>
    pts.map((d, i) => `${i === 0 ? "M" : "L"}${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(" ");
  const path = toPath(data);
  const path2 = data2 && data2.length > 0 ? toPath(data2) : null;
  // Projekcja startuje OD ostatniego realnego punktu, żeby przerywana linia łączyła się bez przerwy.
  const projPath =
    projection && projection.length > 0 && data.length > 0
      ? toPath([data[data.length - 1], ...projection])
      : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {scale.ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={py(t)}
            y2={py(t)}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          <text x={pad.l - 5} y={py(t) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity={0.55}>
            {fmtY(t)}
          </text>
        </g>
      ))}
      {formatX && (
        <>
          <text x={pad.l} y={height - 6} fontSize="9" fill="currentColor" fillOpacity={0.55}>
            {formatX(minX)}
          </text>
          <text x={width - pad.r} y={height - 6} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity={0.55}>
            {formatX(maxX)}
          </text>
        </>
      )}
      {nowX !== undefined && nowX >= minX && nowX <= maxX && (
        <g>
          <line
            x1={px(nowX)}
            x2={px(nowX)}
            y1={pad.t}
            y2={height - pad.b}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 3"
          />
          <text
            x={Math.min(px(nowX), width - pad.r - 14)}
            y={pad.t + 8}
            fontSize="8.5"
            fill="currentColor"
            fillOpacity={0.55}
          >
            dziś
          </text>
        </g>
      )}
      {markers
        ?.filter((x) => x >= minX && x <= maxX)
        .map((x, i) => (
          <line
            key={`marker-${i}`}
            x1={px(x)}
            x2={px(x)}
            y1={pad.t}
            y2={height - pad.b}
            stroke="#a855f7"
            strokeOpacity={0.4}
            strokeDasharray="2 2"
          />
        ))}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={px(d.x)} cy={py(d.y)} r={3} fill={color} />
      ))}
      {path2 && (
        <path d={path2} fill="none" stroke={color2} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data2?.map((d, i) => (
        <circle key={i} cx={px(d.x)} cy={py(d.y)} r={3} fill={color2} />
      ))}
      {projPath && (
        <path
          d={projPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.5}
        />
      )}
      {projection?.map((d, i) => (
        <circle key={`proj-${i}`} cx={px(d.x)} cy={py(d.y)} r={2.5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
      ))}
      {goalY !== undefined && (
        <>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={py(goalY)}
            y2={py(goalY)}
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
          <text x={width - pad.r} y={py(goalY) - 3} textAnchor="end" fontSize="9" fill="#22c55e" fillOpacity={0.9}>
            cel {fmtY(goalY)}
          </text>
        </>
      )}
    </svg>
  );
}

export function BarChart({
  data,
  height = 150,
  color = "#38bdf8",
  formatValue = (v: number) => String(Math.round(v)),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const width = 340;
  const pad = { l: 8, r: 8, t: 16, b: 20 };

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Brak danych — zaloguj pierwszy trening.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (width - pad.l - pad.r) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - pad.t - pad.b);
        const x = pad.l + i * bw + bw * 0.15;
        const y = height - pad.b - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.7} height={Math.max(h, 1)} rx={3} fill={color} fillOpacity={0.85} />
            <text
              x={x + bw * 0.35}
              y={y - 4}
              textAnchor="middle"
              fontSize="8.5"
              fill="currentColor"
              fillOpacity={0.7}
            >
              {formatValue(d.value)}
            </text>
            <text
              x={x + bw * 0.35}
              y={height - 7}
              textAnchor="middle"
              fontSize="8.5"
              fill="currentColor"
              fillOpacity={0.55}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
