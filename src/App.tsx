import { useEffect, useState } from "react";
import { Dumbbell, TrendingUp, History, ClipboardList, Menu } from "lucide-react";
import { TrainScreen } from "@/components/TrainScreen";
import { ProgressScreen } from "@/components/ProgressScreen";
import { HistoryScreen } from "@/components/HistoryScreen";
import { PlanScreen } from "@/components/PlanScreen";
import { MoreScreen } from "@/components/MoreScreen";
import { useToasts, dismissToast } from "@/hooks/use-toast";
import { restTimer } from "@/hooks/use-rest-timer";
import { RestTimer, useShowRestPill } from "@/components/Gym";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "train" | "progress" | "history" | "plan" | "more";

const TABS: { id: Tab; label: string; icon: typeof Dumbbell }[] = [
  { id: "train", label: "Trening", icon: Dumbbell },
  { id: "progress", label: "Progres", icon: TrendingUp },
  { id: "history", label: "Historia", icon: History },
  { id: "plan", label: "Plan", icon: ClipboardList },
  { id: "more", label: "Więcej", icon: Menu },
];

// P4-1: dół zamiast góry — pod Dynamic Island toast zasłaniał dokładnie ten
// nagłówek/kartę, którego dotyczył. 132px = 60px nawigacja + 10px padding +
// 44px pigułka timera (GlobalRestPill niżej) + odstępy — toast nigdy nie
// nachodzi na timer w trakcie treningu (patrz "Wspólne pułapki P4" w POMYSLY.md).
const TOAST_BOTTOM_PX = 132;
const MAX_VISIBLE_TOASTS = 3;

function Toaster({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const toasts = useToasts().slice(-MAX_VISIBLE_TOASTS);
  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col-reverse gap-2 px-4"
      style={{ bottom: `${TOAST_BOTTOM_PX}px` }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="toast-enter pointer-events-auto rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
        >
          <p className="text-sm font-medium">{t.title}</p>
          {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
          {t.action && (
            <button
              type="button"
              className="mt-1.5 text-xs font-semibold text-primary underline underline-offset-2"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(t.action!.tab as Tab);
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// P6-2/P6-5: pigulka timera przerwy widoczna na KAZDEJ zakladce POZA Trening,
// dopoki przerwa leci/jest zapauzowana/skonczyla sie niedawno (useShowRestPill)
// - to bezposrednia odpowiedz na "zmieniam karte i tracę przerwę". Na samej
// zakladce Trening timer renderuje sie LOKALNIE (TrainScreen.tsx) - w trybie
// listy jako wlasna pigulka WIDOCZNA TEZ W SPOCZYNKU (P6-5: ma pokazywac
// przerwe biezacego cwiczenia od razu po wejsciu w dzien, nie dopiero po
// pierwszym kliknieciu), w trybie skupienia jako duzy panel. Globalna pigulka
// tutaj pokazywalaby sie wiec podwojnie, gdyby nie byla ukryta na tej zakladce.
function GlobalRestPill({ hidden }: { hidden: boolean }) {
  const show = useShowRestPill();
  if (hidden || !show) return null;
  return (
    // Tylko pozycjonowanie - wygląd (tło/border/cień/blur) należy WYŁĄCZNIE do
    // RestTimer variant="pill" (patrz komentarz w Gym.tsx, P6 Etap 2).
    <div
      className="fixed left-1/2 z-20 -translate-x-1/2"
      style={{ bottom: "78px" }} // tuż nad paskiem nawigacji (pasek ma teraz +10px paddingu)
    >
      <RestTimer variant="pill" />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("train");
  const { state } = useStore();

  // P6-2: dzwiek timera (beep w store'ze) idzie za ustawieniem "Dzwiek" -
  // synchronizowane tutaj, bo store zyje poza Reactem i nie ma wlasnego
  // dostepu do AppState.
  useEffect(() => {
    restTimer.setSound(state.settings.sound);
  }, [state.settings.sound]);

  return (
    // min-height = największy viewport + 1px: strona ZAWSZE ma minimalny scroll,
    // więc Safari na iOS nie rozwija swojego paska przy wejściu na krótkie
    // zakładki (Trening/Historia) — to rozwijanie zwężało viewport i „podnosiło"
    // dolną nawigację. Przy zwiniętym pasku Safari pozycja jest stała wszędzie.
    <div className="mx-auto flex min-h-full max-w-xl flex-col" style={{ minHeight: "calc(100lvh + 1px)" }}>
      <Toaster onNavigate={setTab} />
      <GlobalRestPill hidden={tab === "train"} />
      <main className="flex-1 pb-20">
        {tab === "train" && <TrainScreen />}
        {tab === "progress" && <ProgressScreen />}
        {tab === "history" && <HistoryScreen />}
        {tab === "plan" && <PlanScreen />}
        {tab === "more" && <MoreScreen />}
      </main>
      {/* Bez env(safe-area-inset-bottom) (pełne ~34px podnosiło pasek za wysoko
          w trybie standalone) — zamiast tego stałe 10px („2 mm"), żeby ikonki
          nie kleiły się do samej krawędzi / home indicatora. */}
      <nav
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "10px" }}
      >
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
                tab === id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={20} strokeWidth={tab === id ? 2.4 : 1.8} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
