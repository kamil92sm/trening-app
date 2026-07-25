// Paragon treningowy — rysowany ręcznie na <canvas>, bez zależności (żadnego html-to-image).
import type { ProgressionStatus } from "./logic";
import { fmtKg } from "./logic";

export interface ReceiptItem {
  name: string;
  resultText: string;
  status: ProgressionStatus;
}

export interface ReceiptData {
  dayName: string;
  dateIso: string;
  durationMin: number;
  doneSets: number;
  totalSets: number;
  volume: number;
  items: ReceiptItem[];
}

const W = 1080;
const H = 1350;
const PAD = 64;

const COLORS = {
  bg: "#0b1120",
  card: "#131b2e",
  border: "#232c42",
  fg: "#e5e9f0",
  muted: "#8b93a7",
  up: "#22c55e",
  hold: "#38bdf8",
  deload: "#f59e0b",
};

const STATUS_MARK: Record<ProgressionStatus, string> = { up: "↑", hold: "→", deload: "⚠" };
const STATUS_COLOR: Record<ProgressionStatus, string> = {
  up: COLORS.up,
  hold: COLORS.hold,
  deload: COLORS.deload,
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmtDatePl(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

export function drawReceipt(canvas: HTMLCanvasElement, data: ReceiptData): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";

  // Nagłówek
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TRENING PWA", PAD, 110);

  ctx.fillStyle = COLORS.fg;
  ctx.font = "800 76px system-ui, sans-serif";
  ctx.fillText(data.dayName, PAD, 200);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "400 34px system-ui, sans-serif";
  ctx.fillText(fmtDatePl(data.dateIso), PAD, 250);

  // Statystyki
  const statsY = 300;
  const statsH = 170;
  roundedRect(ctx, PAD, statsY, W - PAD * 2, statsH, 20);
  ctx.fillStyle = COLORS.card;
  ctx.fill();

  const stats: [string, string][] = [
    ["TONAŻ", `${(data.volume / 1000).toFixed(1)} t`],
    ["SERIE", `${data.doneSets}/${data.totalSets}`],
    ["CZAS", `${data.durationMin} min`],
  ];
  const colW = (W - PAD * 2) / 3;
  stats.forEach(([label, value], i) => {
    const cx = PAD + colW * i + colW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(label, cx, statsY + 62);
    ctx.fillStyle = COLORS.fg;
    ctx.font = "700 52px system-ui, sans-serif";
    ctx.fillText(value, cx, statsY + 122);
  });

  // Lista ćwiczeń
  let y = statsY + statsH + 80;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("PROGRESJA", PAD, y);
  y += 40;

  const rowH = 84;
  for (const item of data.items) {
    roundedRect(ctx, PAD, y, W - PAD * 2, rowH - 16, 16);
    ctx.fillStyle = COLORS.card;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.fg;
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.textAlign = "left";
    const name = item.name.length > 26 ? `${item.name.slice(0, 25)}…` : item.name;
    ctx.fillText(name, PAD + 32, y + (rowH - 16) / 2 + 12);

    ctx.fillStyle = STATUS_COLOR[item.status];
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${item.resultText} ${STATUS_MARK[item.status]}`, W - PAD - 32, y + (rowH - 16) / 2 + 12);

    y += rowH;
    if (y > H - 160) break;
  }

  // Stopka
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "400 26px system-ui, sans-serif";
  ctx.fillText("kamil92sm.github.io/trening-app", W / 2, H - 60);
}

/** Wyeksportuj canvas jako PNG i podziel się nim (iOS 15+) albo pobierz jako plik */
export async function shareReceipt(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  const file = new File([blob], filename, { type: "image/png" });
  const canShareFiles =
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // Anulowanie arkusza udostępniania (AbortError) = świadoma decyzja
      // użytkownika — NIE pobieraj pliku na siłę. Dopiero realny błąd/brak
      // wsparcia dla plików spada do fallbacku poniżej.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
