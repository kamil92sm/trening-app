import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  /** kolor tła włączonego suwaka, np. "#a855f7" */
  accent?: string;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, className, accent, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        checked && !accent ? "bg-primary" : "bg-muted",
        className
      )}
      style={checked && accent ? { backgroundColor: accent } : undefined}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-foreground shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}
