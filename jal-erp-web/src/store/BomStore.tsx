import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Bom, Routing } from '../types';
import { DEFAULT_STOCK, buildDefaultBoms, buildDefaultRoutings } from '../data/bom';
import { readJson, writeJson } from '../lib/storage';

const STORE_KEY = 'jal.bom.v3';

interface BomState {
  boms: Bom[];
  routings: Routing[];
  stock: Record<string, number>;
}

type Action =
  | { type: 'replace'; state: BomState }
  | { type: 'bom'; bom: Bom }
  | { type: 'routing'; routing: Routing }
  | { type: 'stock'; itemId: string; qty: number };

function reducer(s: BomState, a: Action): BomState {
  switch (a.type) {
    case 'replace':
      return a.state;
    case 'bom':
      return { ...s, boms: s.boms.some((b) => b.id === a.bom.id) ? s.boms.map((b) => (b.id === a.bom.id ? a.bom : b)) : [...s.boms, a.bom] };
    case 'routing':
      return { ...s, routings: s.routings.map((r) => (r.productId === a.routing.productId ? a.routing : r)) };
    case 'stock':
      return { ...s, stock: { ...s.stock, [a.itemId]: a.qty } };
  }
}

const defaults = (): BomState => ({ boms: buildDefaultBoms(), routings: buildDefaultRoutings(), stock: { ...DEFAULT_STOCK } });

interface BomValue extends BomState {
  bomFor: (outputItemId: string) => Bom | undefined;
  routingFor: (productId: string) => Routing | undefined;
  saveBom: (bom: Bom) => void;
  saveRouting: (routing: Routing) => void;
  setStock: (itemId: string, qty: number) => void;
  resetDefaults: () => void;
}

const Ctx = createContext<BomValue | null>(null);

export function BomProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => readJson<BomState>('local', STORE_KEY) ?? defaults());
  useEffect(() => writeJson('local', STORE_KEY, state), [state]);

  const bomFor = useCallback((id: string) => state.boms.find((b) => b.outputItemId === id), [state.boms]);
  const routingFor = useCallback((id: string) => state.routings.find((r) => r.productId === id), [state.routings]);

  const value = useMemo<BomValue>(
    () => ({
      ...state,
      bomFor,
      routingFor,
      saveBom: (bom) => dispatch({ type: 'bom', bom }),
      saveRouting: (routing) => dispatch({ type: 'routing', routing }),
      setStock: (itemId, qty) => dispatch({ type: 'stock', itemId, qty }),
      resetDefaults: () => dispatch({ type: 'replace', state: defaults() }),
    }),
    [state, bomFor, routingFor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBom(): BomValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBom must be used inside BomProvider');
  return v;
}
