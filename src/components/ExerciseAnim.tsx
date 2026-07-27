// P5-3a: renderer animowanego ludzika — bez JS (samo CSS, patrz index.css),
// bez requestAnimationFrame (bateria, pułapka 2 z P4 o warstwach backdrop-blur).
import type { CSSProperties } from "react";
import type { Decor, Load, MovePattern, Pose } from "@/lib/anim-poses";

const LEN = {
  torso: 32,
  neck: 8,
  headR: 6,
  upperArm: 18,
  forearm: 16,
  hand: 3,
  thigh: 24,
  shank: 22,
  foot: 11,
};

function jointVars(a: number, b: number, durationMs?: number): CSSProperties {
  return {
    ["--a" as string]: `${a}deg`,
    ["--b" as string]: `${b}deg`,
    ...(durationMs ? { ["--dur" as string]: `${durationMs}ms` } : {}),
  } as CSSProperties;
}

function rootVars(a: Pose, b: Pose): CSSProperties {
  return {
    ["--ax" as string]: `${a.rootX}px`,
    ["--ay" as string]: `${a.rootY}px`,
    ["--ar" as string]: `${a.rootRot}deg`,
    ["--bx" as string]: `${b.rootX}px`,
    ["--by" as string]: `${b.rootY}px`,
    ["--br" as string]: `${b.rootRot}deg`,
  } as CSSProperties;
}

function LoadShape({ load }: { load: Load }) {
  if (load === "none") return null;
  if (load === "dumbbell") {
    return <rect x={-5} y={-2.5} width={10} height={5} rx={1.5} fill="#38bdf8" />;
  }
  // Sztanga / bar-back / bar-hip / wyciąg z boku to po prostu koło (POMYSLY.md P5-3).
  return <circle r={5} fill="#38bdf8" />;
}

function Decoration({ decor }: { decor: Decor[] }) {
  return (
    <>
      {decor.includes("floor") && (
        <line x1={6} y1={112} x2={114} y2={112} stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
      )}
      {decor.includes("bench-flat") && (
        <rect x={20} y={96} width={62} height={8} rx={2} fill="currentColor" fillOpacity={0.18} />
      )}
    </>
  );
}

/**
 * `<ExerciseAnim pattern={id} />` — szkielet z `MOVE_PATTERNS[pattern]`. Zwraca
 * `null`, gdy wzorzec jeszcze nie istnieje w bazie (etap 3b go doda) — UI po
 * prostu nie renderuje animacji, zamiast pustej klatki.
 */
export function ExerciseAnim({ pattern, size = 96 }: { pattern: MovePattern | undefined; size?: number }) {
  if (!pattern) return null;
  const { a, b, load, decor, durationMs } = pattern;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className="shrink-0 text-foreground/70"
      role="img"
      aria-label={pattern.label}
    >
      <Decoration decor={decor} />
      <g className="tt-root" style={rootVars(a, b)}>
        {/* noga: udo -> podudzie -> stopa */}
        <g className="tt-j" style={jointVars(a.hip, b.hip, durationMs)}>
          <line x1={0} y1={0} x2={0} y2={LEN.thigh} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          <g transform={`translate(0, ${LEN.thigh})`}>
            <g className="tt-j" style={jointVars(a.knee, b.knee, durationMs)}>
              <line x1={0} y1={0} x2={0} y2={LEN.shank} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
              <g transform={`translate(0, ${LEN.shank})`}>
                <g className="tt-j" style={jointVars(a.ankle, b.ankle, durationMs)}>
                  <line x1={0} y1={0} x2={0} y2={LEN.foot} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* tors -> [szyja+głowa], [ramię -> przedramię -> dłoń(+sprzęt)] */}
        <g className="tt-j" style={jointVars(a.torso, b.torso, durationMs)}>
          <line x1={0} y1={0} x2={0} y2={LEN.torso} stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
          <g transform={`translate(0, ${LEN.torso})`}>
            <g className="tt-j" style={jointVars(a.neck, b.neck, durationMs)}>
              <line x1={0} y1={0} x2={0} y2={LEN.neck} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={0} cy={LEN.neck + LEN.headR} r={LEN.headR} fill="currentColor" fillOpacity={0.85} />
            </g>
            <g className="tt-j" style={jointVars(a.shoulder, b.shoulder, durationMs)}>
              <line x1={0} y1={0} x2={0} y2={LEN.upperArm} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
              <g transform={`translate(0, ${LEN.upperArm})`}>
                <g className="tt-j" style={jointVars(a.elbow, b.elbow, durationMs)}>
                  <line x1={0} y1={0} x2={0} y2={LEN.forearm} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
                  <g transform={`translate(0, ${LEN.forearm})`}>
                    <LoadShape load={load} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
