import { useState, type InputHTMLAttributes } from "react";
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
}

// Wewnętrzny surowy string zamiast sterowania bezpośrednio liczbą — pozwala
// wyczyścić pole do pusta i wpisać przecinek, zanim wartość jest parsowalna.
export function NumberField({ value, onChange, fallback, decimal, ...props }: NumberFieldProps) {
  const [raw, setRaw] = useState(() => formatNum(value));
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
        if (n !== null) onChange(n);
      }}
      onBlur={() => {
        const n = parseNum(raw) ?? fallback;
        onChange(n);
        setRaw(formatNum(n));
      }}
      {...props}
    />
  );
}
