import { useRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "./input";

function parseNum(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && raw.trim() !== "" ? n : null;
}

function formatNum(n: number): string {
  return String(n).replace(".", ",");
}

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  value: number;
  onChange: (n: number) => void;
  fallback: number;
  decimal?: boolean;
  /** Zero renderowane jako PUSTE pole (logger: ćwiczenia z masą własną mają
   *  ciężar 0, a "0" w polu wygląda jak wpisana wartość, nie jak brak). */
  emptyWhenZero?: boolean;
  /** Pole nadąża za zmianą `value` Z ZEWNĄTRZ (steppery −/+, `setWeightWithSync`,
   *  sugestia siłowni). Domyślnie WYŁĄCZONE: pola w Planie/Więcej/Progresie są
   *  jedynym źródłem swojej wartości, więc nie potrzebują synchronizacji, a jej
   *  brak = dokładnie zachowanie sprzed tej zmiany. Synchronizacja nigdy nie
   *  walczy z pisaniem: gdy wpisany tekst parsuje się do TEJ SAMEJ liczby co
   *  `value`, surowy tekst zostaje nietknięty (dzięki temu "36," w trakcie
   *  pisania nie zamienia się w "36"). */
  syncExternal?: boolean;
}

// Wewnętrzny surowy string zamiast sterowania bezpośrednio liczbą — pozwala
// wyczyścić pole do pusta i wpisać przecinek, zanim wartość jest parsowalna.
export function NumberField({
  value,
  onChange,
  fallback,
  decimal,
  emptyWhenZero,
  syncExternal,
  ...props
}: NumberFieldProps) {
  const fmt = (n: number) => (emptyWhenZero && n === 0 ? "" : formatNum(n));
  const [raw, setRaw] = useState(() => fmt(value));
  const lastValue = useRef(value);

  // Dostrojenie stanu do zmienionego propa W TRAKCIE RENDEROWANIA (udokumentowany
  // wzorzec Reacta) — useEffect dawałby jedną klatkę ze starą liczbą w polu.
  if (syncExternal && lastValue.current !== value) {
    lastValue.current = value;
    const n = parseNum(raw);
    if (n === null || Math.abs(n - value) > 1e-9) setRaw(fmt(value));
  }

  const pattern = decimal ? /^\d*[.,]?\d*$/ : /^\d*$/;
  return (
    <Input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        if (!pattern.test(v)) return;
        setRaw(v);
        const n = parseNum(v);
        if (n !== null) {
          lastValue.current = n;
          onChange(n);
        }
      }}
      onBlur={() => {
        const n = parseNum(raw) ?? fallback;
        lastValue.current = n;
        onChange(n);
        setRaw(fmt(n));
      }}
      {...props}
    />
  );
}
