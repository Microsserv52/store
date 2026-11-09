"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { cartSchema, type CartLine } from "@/lib/contracts";

const key = "ms52-cart-v1";
const empty: CartLine[] = [];
let snapshot = "[]";
let parsed = empty;
const listeners = new Set<() => void>();
function read() {
  try {
    const raw = localStorage.getItem(key) || "[]";
    if (raw !== snapshot) {
      const result = cartSchema.safeParse(JSON.parse(raw));
      parsed = result.success ? result.data : empty;
      snapshot = raw;
    }
  } catch {
    parsed = empty;
  }
  return parsed;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function write(lines: CartLine[]) {
  const result = cartSchema.safeParse(lines);
  if (!result.success) return;
  localStorage.setItem(key, JSON.stringify(result.data));
  listeners.forEach((listener) => listener());
}
const CartContext = createContext<{
  lines: CartLine[];
  add: (id: string, quantity?: number) => void;
  update: (id: string, quantity: number) => void;
  clear: () => void;
}>({ lines: empty, add: () => {}, update: () => {}, clear: () => {} });
export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, read, () => empty);
  function update(id: string, quantity: number) {
    write(
      quantity <= 0
        ? lines.filter((line) => line.id !== id)
        : lines.map((line) => (line.id === id ? { ...line, quantity } : line)),
    );
  }
  function add(id: string, quantity = 1) {
    const found = lines.find((line) => line.id === id);
    if (found) update(id, Math.min(999, found.quantity + quantity));
    else write([...lines, { id, quantity }]);
  }
  return (
    <CartContext.Provider
      value={{ lines, add, update, clear: () => write([]) }}
    >
      {children}
    </CartContext.Provider>
  );
}
export const useCart = () => useContext(CartContext);
