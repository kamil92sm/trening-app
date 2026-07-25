// Autorskie, lekkie wykresy SVG — bez zależności zewnętrznych.

interface Point {
  x: number; // timestamp lub indeks
  y: number;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

export function LineChart({
  data,
  data2,
  height = 170,
  color = "#38bdf8",
  color2 = "#f59e0b",
  formatY = (y: number) => String(Math.round(y)),
  formatX,
}: {
  data: Point[];
  /** Opcjonalny drugi szereg — rysowany w tej samej skali osi Y co data */
  data2?: Point[];
  height?: number;
  color?: string;
  color2?: string;
  formatY?: (y: number) => string;
  formatX?: (x: number) => string;
}) {
  const width = 340;
  const pad = { l: 38, r: 10, t: 10, b: formatX ? 22 : 10 };

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Brak danych — zaloguj pierwszy trening.
      </div>
    );
  }

  const all = data2 ? [...data, ...data2] : data;
  const xs = all.map((d) => d.x);
  const ys = all.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const minY = Math.min(...ys) - (spanY || 1) * 0.15;
  const maxY = Math.max(...ys) + (spanY || 1) * 0.15;

  const px = (x: number) =>
    maxX === minX
      ? (pad.l + width - pad.r) / 2
      : pad.l + ((x - minX) / (maxX - minX)) * (width - pad.l - pad.r);
  const py = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (height - pad.t - pad.b);

  const toPath = (pts: Point[]) =>
    pts.map((d, i) => `${i === 0 ? "M" : "L"}${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(" ");
  const path = toPath(data);
  const path2 = data2 && data2.length > 0 ? toPath(data2) : null;
  const ticks = niceTicks(minY, maxY, 3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {ticks.map((t, i) => (
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
            {formatY(t)}
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
