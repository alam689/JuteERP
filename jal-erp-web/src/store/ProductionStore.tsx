import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { OrderStatus, ProductionOrder, ShiftEntry } from '../types';
import { buildSeed, entryDocNo, orderDocNo, type ProductionState } from '../data/seed';
import { productById, stageByCode } from '../data/masters';
import { computeEntryMetrics } from '../lib/calc';
import { readJson, writeJson } from '../lib/storage';

const STORE_KEY = 'jal.production.v3';

type Action =
  | { type: 'replace'; state: ProductionState }
  | { type: 'addOrders'; orders: ProductionOrder[] }
  | { type: 'updateOrder'; order: ProductionOrder }
  | { type: 'upsertEntry'; entry: ShiftEntry; orderUpdate?: ProductionOrder; bumpEntrySeq?: boolean }
  | { type: 'deleteEntry'; id: string };

function reducer(state: ProductionState, a: Action): ProductionState {
  switch (a.type) {
    case 'replace':
      return a.state;
    case 'addOrders':
      return { ...state, orders: [...a.orders, ...state.orders], seq: { ...state.seq, order: state.seq.order + a.orders.length } };
    case 'updateOrder':
      return { ...state, orders: state.orders.map((o) => (o.id === a.order.id ? a.order : o)) };
    case 'upsertEntry': {
      const exists = state.entries.some((e) => e.id === a.entry.id);
      const entries = exists ? state.entries.map((e) => (e.id === a.entry.id ? a.entry : e)) : [...state.entries, a.entry];
      const orders = a.orderUpdate ? state.orders.map((o) => (o.id === a.orderUpdate!.id ? a.orderUpdate! : o)) : state.orders;
      return { orders, entries, seq: { ...state.seq, entry: state.seq.entry + (a.bumpEntrySeq ? 1 : 0) } };
    }
    case 'deleteEntry':
      return { ...state, entries: state.entries.filter((e) => e.id !== a.id || e.status === 'POSTED') };
  }
}

export interface NewOrderInput {
  productId: string;
  stage: ProductionOrder['stage'];
  plannedQty: number;
  plannedStart: string;
  plannedEnd: string;
  contractRef?: string;
  customer?: string;
  remarks?: string;
  release: boolean;
}

export type EntryDraft = Omit<
  ShiftEntry,
  'id' | 'docNo' | 'status' | 'createdAt' | 'createdBy' | 'postedAt' | 'inputKg' | 'goodKg' | 'rejectKg'
> & { id?: string };

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

/** Allowed manual transitions (SRS FR-MFG-020). */
export const ORDER_ACTIONS = {
  release: { from: ['PLANNED'], to: 'RELEASED', label: 'Release', past: 'Released' },
  start: { from: ['RELEASED'], to: 'IN_PROGRESS', label: 'Start', past: 'Started' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED', label: 'Complete', past: 'Completed' },
  close: { from: ['COMPLETED'], to: 'CLOSED', label: 'Close', past: 'Closed' },
  cancel: { from: ['PLANNED', 'RELEASED'], to: 'CANCELLED', label: 'Cancel', past: 'Cancelled' },
} satisfies Record<string, { from: OrderStatus[]; to: OrderStatus; label: string; past: string }>;

export type OrderAction = keyof typeof ORDER_ACTIONS;

interface StoreValue extends ProductionState {
  createOrder: (input: NewOrderInput, by: string) => ProductionOrder;
  createOrders: (inputs: NewOrderInput[], by: string) => ProductionOrder[];
  transitionOrder: (id: string, action: OrderAction, by: string) => Result;
  saveEntry: (draft: EntryDraft, post: boolean, by: string) => Result<ShiftEntry>;
  deleteDraft: (id: string) => void;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => readJson<ProductionState>('local', STORE_KEY) ?? buildSeed());

  useEffect(() => writeJson('local', STORE_KEY, state), [state]);

  const createOrders = useCallback(
    (inputs: NewOrderInput[], by: string) => {
      const now = new Date().toISOString();
      const orders = inputs.map(({ release, ...rest }, i): ProductionOrder => {
        const n = state.seq.order + 1 + i;
        return {
          ...rest,
          id: `po-${n}-${Date.now()}`,
          docNo: orderDocNo(n),
          status: release ? 'RELEASED' : 'PLANNED',
          createdAt: now,
          createdBy: by,
          history: [{ at: now, by, action: 'Created' }, ...(release ? [{ at: now, by, action: 'Released' }] : [])],
        };
      });
      dispatch({ type: 'addOrders', orders });
      return orders;
    },
    [state.seq.order],
  );
  const createOrder = useCallback((input: NewOrderInput, by: string) => createOrders([input], by)[0], [createOrders]);

  const transitionOrder = useCallback(
    (id: string, action: OrderAction, by: string): Result => {
      const order = state.orders.find((o) => o.id === id);
      const rule = ORDER_ACTIONS[action];
      if (!order) return { ok: false, error: 'Order not found.' };
      if (!(rule.from as OrderStatus[]).includes(order.status)) return { ok: false, error: `Cannot ${rule.label.toLowerCase()} an order that is ${order.status}.` };
      if (action === 'complete' || action === 'close') {
        // BR-MFG-003: no unposted shift entries on close.
        const drafts = state.entries.filter((e) => e.orderId === id && e.status === 'DRAFT').length;
        if (drafts > 0) return { ok: false, error: `Post or delete the ${drafts} draft shift entr${drafts === 1 ? 'y' : 'ies'} first.` };
      }
      const now = new Date().toISOString();
      dispatch({
        type: 'updateOrder',
        order: { ...order, status: rule.to as OrderStatus, history: [...order.history, { at: now, by, action: rule.past }] },
      });
      return { ok: true, value: undefined };
    },
    [state.orders, state.entries],
  );

  const saveEntry = useCallback(
    (draft: EntryDraft, post: boolean, by: string): Result<ShiftEntry> => {
      const order = state.orders.find((o) => o.id === draft.orderId);
      if (!order) return { ok: false, error: 'Select a production order.' };
      if (!['RELEASED', 'IN_PROGRESS'].includes(order.status)) {
        return { ok: false, error: `Order ${order.docNo} is ${order.status}; entries need a released or in-progress order.` };
      }
      const stage = stageByCode(order.stage);
      const m = computeEntryMetrics(stage, productById(order.productId), draft);
      if (post && m.errors.length) return { ok: false, error: m.errors[0] };

      const now = new Date().toISOString();
      const existing = draft.id ? state.entries.find((e) => e.id === draft.id) : undefined;
      if (existing?.status === 'POSTED') return { ok: false, error: 'Posted entries cannot be changed.' };
      const isNew = !existing;
      const n = state.seq.entry + 1;
      const entry: ShiftEntry = {
        ...draft,
        stage: order.stage,
        id: existing?.id ?? `se-${n}-${Date.now()}`,
        docNo: existing?.docNo ?? entryDocNo(n),
        inputKg: m.inputKg,
        goodKg: m.goodKg,
        rejectKg: m.rejectKg,
        status: post ? 'POSTED' : 'DRAFT',
        createdAt: existing?.createdAt ?? now,
        createdBy: existing?.createdBy ?? by,
        postedAt: post ? now : undefined,
      };
      const orderUpdate =
        post && order.status === 'RELEASED'
          ? { ...order, status: 'IN_PROGRESS' as const, history: [...order.history, { at: now, by, action: 'Started (first shift entry posted)' }] }
          : undefined;
      dispatch({ type: 'upsertEntry', entry, orderUpdate, bumpEntrySeq: isNew });
      return { ok: true, value: entry };
    },
    [state.orders, state.entries, state.seq.entry],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      createOrder,
      createOrders,
      transitionOrder,
      saveEntry,
      deleteDraft: (id) => dispatch({ type: 'deleteEntry', id }),
      resetDemoData: () => dispatch({ type: 'replace', state: buildSeed() }),
    }),
    [state, createOrder, createOrders, transitionOrder, saveEntry],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useProduction(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useProduction must be used inside ProductionProvider');
  return ctx;
}
