'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartLine {
  key: string;
  variantId?: number;
  packId?: number;
  name: string;
  detail?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  imageUrl?: string | null;
  slug: string;
  isPack: boolean;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  ready: boolean;
  add: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'plugin_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  // `ready` évite d'afficher un panier vide pendant l'hydratation.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* panier corrompu : on repart à vide */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* quota dépassé : sans effet fonctionnel */
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = line.isPack ? `pack-${line.packId}` : `variant-${line.variantId}`;
    setLines((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: Math.min(item.quantity + line.quantity, item.stock) }
            : item,
        );
      }
      return [...current, { ...line, key }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock)) } : item,
      ),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart doit être utilisé dans un CartProvider');
  return context;
}
