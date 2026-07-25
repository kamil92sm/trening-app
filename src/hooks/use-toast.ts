import { useEffect, useState } from "react";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l([...items]);
}

export function toast(title: string, description?: string) {
  const item: ToastItem = { id: nextId++, title, description };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== item.id);
    emit();
  }, 3000);
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
