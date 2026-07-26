import { useEffect, useState } from "react";

export interface ToastAction {
  label: string;
  /** Interpretowane przez App.tsx (id zakładki) — trzymane jako string, żeby
   * ten moduł nie zależał od typu Tab z App.tsx. */
  tab: string;
}

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  action?: ToastAction;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l([...items]);
}

export function toast(title: string, description?: string, action?: ToastAction) {
  const item: ToastItem = { id: nextId++, title, description, action };
  items = [...items, item];
  emit();
  // Toast z akcją zostaje dłużej — potrzeba chwili, żeby przeczytać i kliknąć guzik.
  setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, action ? 6000 : 3000);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): ToastItem[] {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}
