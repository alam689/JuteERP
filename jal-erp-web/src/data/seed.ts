import type { ProductionOrder, ShiftCode, ShiftEntry, StageCode } from '../types';
import { DOWNTIME_REASONS, ROUTES, STAGES, productById, stageByCode } from './masters';
import { addDays, fiscalCode, isoDate } from '../lib/format';
import { computeEntryMetrics } from '../lib/calc';
import { mulberry32 } from '../lib/rng';

export interface ProductionState {
  orders: ProductionOrder[];
  entries: ShiftEntry[];
  seq: { order: number; entry: number };
}

/** Typical good-output share of input per stage, used only to generate demo history. */
const STAGE_YIELD: Record<StageCode, number> = {
  BATCHING: 0.972, CARDING: 0.958, DRAWING: 0.991, SPINNING: 0.966, WINDING: 0.991,
  WEAVING: 0.977, LAMINATION: 0.985, CUTTING: 0.986, SEWING: 0.993, INSPECTION: 0.992, PACKING: 0.998, FG_TRANSFER: 1,
};

export const orderDocNo = (n: number, d = new Date()) => `PRD/JAL/${fiscalCode(d)}/${String(n).padStart(5, '0')}`;
export const entryDocNo = (n: number, d = new Date()) => `SPE/JAL/${fiscalCode(d)}/${String(n).padStart(5, '0')}`;

/** Shifts of `date` that have finished by `now`. */
function completedShifts(date: string, now: Date): ShiftCode[] {
  const today = isoDate(now);
  const h = now.getHours();
  if (date < addDays(today, -1)) return ['A', 'B', 'C'];
  if (date === addDays(today, -1)) return h >= 6 ? ['A', 'B', 'C'] : ['A', 'B'];
  if (date === today) return h >= 22 ? ['A', 'B'] : h >= 14 ? ['A'] : [];
  return [];
}

export function buildSeed(now = new Date()): ProductionState {
  const rnd = mulberry32(20260705);
  const today = isoDate(now);
  const orders: ProductionOrder[] = [];
  const entries: ShiftEntry[] = [];
  let orderSeq = 0;
  let entrySeq = 0;
  const createdAt = new Date(now.getTime() - 20 * 86400000).toISOString();

  const addOrder = (o: Omit<ProductionOrder, 'id' | 'docNo' | 'createdAt' | 'createdBy' | 'history'>) => {
    orderSeq += 1;
    const order: ProductionOrder = {
      ...o,
      id: `po-${orderSeq}`,
      docNo: orderDocNo(orderSeq, now),
      createdAt,
      createdBy: 'Production Manager',
      history: [{ at: createdAt, by: 'Production Manager', action: 'Created' }],
    };
    if (o.status !== 'PLANNED') order.history.push({ at: createdAt, by: 'Production Manager', action: 'Released' });
    orders.push(order);
    return order;
  };

  // One running order per stage of the sacking route for the main B' Twill programme (MTO, export contract).
  const running = new Map<StageCode, ProductionOrder>();
  for (const s of ROUTES.SACKING.map(stageByCode)) {
    running.set(
      s.code,
      addOrder({
        productId: 'JAL-SB-001',
        stage: s.code,
        plannedQty: s.dailyTarget * 21,
        plannedStart: addDays(today, -15),
        plannedEnd: addDays(today, 6),
        status: 'IN_PROGRESS',
        contractRef: 'SC/JAL/2627/0012',
        customer: 'CUST-EG-001 (Egypt)',
      }),
    );
  }

  // Other orders in different lifecycle states.
  addOrder({ productId: 'JAL-SB-005', stage: 'SEWING', plannedQty: 58500, plannedStart: addDays(today, 4), plannedEnd: addDays(today, 7), status: 'PLANNED', contractRef: 'SC/JAL/2627/0019', customer: 'CUST-AU-002 (Australia)' });
  addOrder({ productId: 'JAL-SB-002', stage: 'CUTTING', plannedQty: 39000, plannedStart: addDays(today, 1), plannedEnd: addDays(today, 3), status: 'RELEASED', contractRef: 'SC/JAL/2627/0016', customer: 'CUST-SD-001 (Sudan)' });
  addOrder({ productId: 'JAL-YRN-002', stage: 'SPINNING', plannedQty: 120000, plannedStart: addDays(today, 3), plannedEnd: addDays(today, 8), status: 'PLANNED', remarks: 'Make-to-stock — white yarn replenishment' });
  addOrder({ productId: 'JAL-HC-001', stage: 'WEAVING', plannedQty: 64000, plannedStart: addDays(today, 2), plannedEnd: addDays(today, 6), status: 'RELEASED', contractRef: 'SC/JAL/2627/0017', customer: 'CUST-BE-001 (Belgium)', remarks: '32 bales × 2,000 yd — one 20′ FCL' });
  addOrder({ productId: 'JAL-SND-001', stage: 'LAMINATION', plannedQty: 8000, plannedStart: addDays(today, 1), plannedEnd: addDays(today, 3), status: 'RELEASED', contractRef: 'SC/JAL/2627/0021', customer: 'CUST-US-001 (USA)', remarks: 'Laminated hessian for 20,000 sand bags' });
  addOrder({ productId: 'JAL-SLV-001', stage: 'PACKING', plannedQty: 400, plannedStart: addDays(today, 2), plannedEnd: addDays(today, 4), status: 'PLANNED', remarks: 'Sliver rolls (≈13 kg each) — make-to-stock' });
  const done = addOrder({ productId: 'JAL-SB-006', stage: 'PACKING', plannedQty: 260, plannedStart: addDays(today, -24), plannedEnd: addDays(today, -18), status: 'CLOSED', contractRef: 'SC/JAL/2627/0008', customer: 'CUST-KE-001 (Kenya)' });
  done.history.push({ at: createdAt, by: 'Production Manager', action: 'Completed' }, { at: createdAt, by: 'Factory Head', action: 'Closed' });

  // Posted shift history for the last 14 days.
  for (let d = 14; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const shift of completedShifts(date, now)) {
      for (const s of STAGES) {
        const order = running.get(s.code);
        if (!order) continue;
        const product = productById(order.productId);
        const shiftTarget = s.dailyTarget / 3;
        let perf = 0.86 + rnd() * 0.17;
        let downtime = Math.round(rnd() * 45);
        let reason: string | undefined = downtime > 0 ? DOWNTIME_REASONS[Math.floor(rnd() * DOWNTIME_REASONS.length)] : undefined;
        // A loom-shed breakdown three days ago, rippling into cutting.
        if (d === 3 && shift === 'B' && (s.code === 'WEAVING' || s.code === 'CUTTING')) {
          perf = 0.68;
          downtime = 165;
          reason = s.code === 'WEAVING' ? 'Breakdown' : 'No material';
        }
        const goodQty = Math.round(shiftTarget * perf);
        const y = STAGE_YIELD[s.code] - rnd() * 0.006;

        const outUnit = s.outputUom === 'KG' ? 1 : s.outputUom === 'PCS' ? 1.02 : 306;
        const inUnit = s.inputUom === 'KG' ? 1 : s.inputUom === 'PCS' ? 1.02 : 306;
        const goodKg = goodQty * outUnit;
        const inputKg = goodKg / y;
        const inputQty = Math.round(inputKg / inUnit);
        const lossKg = inputKg - goodKg;
        const rejectQty = s.hasRejects ? Math.round((lossKg * 0.7) / outUnit) : 0;
        const wasteKgTotal = s.hasRejects ? lossKg * 0.2 : lossKg * 0.82;
        const waste = s.wasteTypes.map((type, i, arr) => ({
          type,
          kg: Math.round((wasteKgTotal * (i === 0 ? 0.65 : 0.35 / Math.max(1, arr.length - 1))) * 10) / 10,
        }));

        const m = computeEntryMetrics(s, product, { inputQty, goodQty, rejectQty, waste });
        entrySeq += 1;
        const ts = new Date(`${date}T${shift === 'A' ? '13:50' : shift === 'B' ? '21:50' : '05:50'}:00`).toISOString();
        entries.push({
          id: `se-${entrySeq}`,
          docNo: entryDocNo(entrySeq, now),
          orderId: order.id,
          stage: s.code,
          date,
          shift,
          supervisor: `Shift ${shift} In-charge — ${s.workCenter}`,
          inputQty,
          goodQty,
          rejectQty,
          waste: waste.length ? waste : [],
          inputKg: m.inputKg,
          goodKg: m.goodKg,
          rejectKg: m.rejectKg,
          runMinutes: 480 - downtime,
          downtimeMinutes: downtime,
          downtimeReason: reason,
          status: 'POSTED',
          createdAt: ts,
          createdBy: 'Line Supervisor',
          postedAt: ts,
        });
      }
    }
  }

  return { orders, entries, seq: { order: orderSeq, entry: entrySeq } };
}
