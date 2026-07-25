// Heatmapa partii mięśniowych — uproszczona sylwetka przód/tył, własne SVG.
import type { Muscle } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, type MuscleVolume } from "@/lib/logic";

interface RegionProps {
  muscle: Muscle;
  volumes: MuscleVolume[];
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}

function Region({ muscle, volumes, x, y, w, h, rx = 4 }: RegionProps) {
  const v = volumes.find((vv) => vv.muscle === muscle);
  const status = v?.status ?? "low";
  return (
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={STATUS_COLORS[status]} fillOpacity={0.85}>
      <title>
        {muscle}: {v?.sets ?? 0} serii/tydz. ({STATUS_LABELS[status]})
      </title>
    </rect>
  );
}

export function MuscleMap({ volumes }: { volumes: MuscleVolume[] }) {
  return (
    <svg viewBox="0 0 300 210" className="mx-auto w-full max-w-xs">
      {/* PRZÓD */}
      <g>
        <text x="60" y="12" textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.5}>
          Przód
        </text>
        <circle cx="60" cy="26" r="11" fill="currentColor" fillOpacity={0.12} />
        <Region muscle="Barki" volumes={volumes} x={28} y={40} w={16} h={11} rx={5} />
        <Region muscle="Barki" volumes={volumes} x={76} y={40} w={16} h={11} rx={5} />
        <Region muscle="Klatka" volumes={volumes} x={44} y={40} w={32} h={26} rx={6} />
        <Region muscle="Biceps" volumes={volumes} x={24} y={50} w={9} h={24} rx={4} />
        <Region muscle="Biceps" volumes={volumes} x={87} y={50} w={9} h={24} rx={4} />
        <Region muscle="Brzuch" volumes={volumes} x={47} y={68} w={26} h={24} rx={5} />
        <Region muscle="Nogi" volumes={volumes} x={42} y={94} w={15} h={48} rx={6} />
        <Region muscle="Nogi" volumes={volumes} x={63} y={94} w={15} h={48} rx={6} />
        <rect x={42} y={144} width={15} height={32} rx={5} fill="currentColor" fillOpacity={0.08} />
        <rect x={63} y={144} width={15} height={32} rx={5} fill="currentColor" fillOpacity={0.08} />
      </g>

      {/* TYŁ */}
      <g transform="translate(160,0)">
        <text x="60" y="12" textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity={0.5}>
          Tył
        </text>
        <circle cx="60" cy="26" r="11" fill="currentColor" fillOpacity={0.12} />
        <Region muscle="Plecy" volumes={volumes} x={44} y={40} w={32} h={30} rx={6} />
        <Region muscle="Triceps" volumes={volumes} x={24} y={52} w={9} h={24} rx={4} />
        <Region muscle="Triceps" volumes={volumes} x={87} y={52} w={9} h={24} rx={4} />
        <Region muscle="Pośladki" volumes={volumes} x={45} y={72} w={30} h={18} rx={6} />
        <Region muscle="Tył uda" volumes={volumes} x={42} y={92} w={15} h={40} rx={6} />
        <Region muscle="Tył uda" volumes={volumes} x={63} y={92} w={15} h={40} rx={6} />
        <Region muscle="Łydki" volumes={volumes} x={42} y={134} w={15} h={42} rx={5} />
        <Region muscle="Łydki" volumes={volumes} x={63} y={134} w={15} h={42} rx={5} />
      </g>
    </svg>
  );
}
