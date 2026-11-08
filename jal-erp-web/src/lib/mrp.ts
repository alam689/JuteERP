import type { Bom, Product, Routing, StageCode, Uom } from '../types';
import { addDays } from './format';

/**
 * Single-level-at-a-time explosion along a product's routing (SRS FR-MFG-011).
 * Walks the routing backwards from the shipping pack: for each operation, the demand for its output item is
 * netted against stock on hand, the remaining quantity becomes a suggested production order, and the BOM of
 * that item adds demand for its inputs. Items that no operation in the routing produces become purchase
 * requisitions. Pass-through operations (inspection, FG transfer) carry demand with a loss allowance.
 */

export interface MrpRequest {
  productId: string;
  /** Quantity in the product's base unit (bags, yards, kg, cops). */
  qty: number;
  shipBy: string;
  contractRef?: string;
  customer?: string;
}

export interface MrpOrderLine {
  seq: number;
  stage: StageCode;
  workCenterId: string;
  itemId: string;
  uom: Uom;
  grossQty: number;
  stockUsed: number;
  netQty: number;
  start: string;
  end: string;
  passThrough: boolean;
  qcPoint: boolean;
}

export interface MrpPurchaseLine {
  itemId: string;
  uom: Uom;
  grossQty: number;
  stock: number;
  netQty: number;
}

export interface MrpResult {
  packs: number;
  orders: MrpOrderLine[];
  purchases: MrpPurchaseLine[];
  warnings: string[];
  /** Raw jute consumed by the plan, in kg. */
  rawJuteKg: number;
}

const roundUp = (qty: number, uom: Uom) => (uom === 'KG' || uom === 'YD' ? Math.ceil(qty * 10) / 10 : Math.ceil(qty - 1e-9));

export function runMrp(
  req: MrpRequest,
  product: Product,
  routing: Routing,
  boms: Bom[],
  stock: Record<string, number>,
  itemUom: (id: string) => Uom,
): MrpResult {
  const bomByOut = new Map(boms.map((b) => [b.outputItemId, b]));
  const produced = new Set(routing.ops.map((o) => o.outputItemId));
  const demand: Record<string, number> = {};
  const stockLeft: Record<string, number> = { ...stock };
  const warnings: string[] = [];
  const orders: MrpOrderLine[] = [];

  const packs = Math.ceil(req.qty / product.unitsPerPack);
  if (req.qty % product.unitsPerPack) {
    warnings.push(`${req.qty.toLocaleString('en-IN')} ${product.baseUom.toLowerCase()} is not a whole number of ${product.packUom.toLowerCase()}s — planned as ${packs} (last one partial).`);
  }
  demand[`PACK-${product.id}`] = packs;

  let endCursor = addDays(req.shipBy, -1);
  for (const op of [...routing.ops].reverse()) {
    const item = op.outputItemId;
    const uom = itemUom(item);
    const gross = demand[item] ?? 0;
    const end = endCursor;
    const start = addDays(end, -op.days);
    endCursor = start;
    if (gross <= 0) continue;

    const available = Math.max(0, stockLeft[item] ?? 0);
    const used = Math.min(available, gross);
    stockLeft[item] = available - used;
    const net = roundUp(gross - used, uom);

    if (op.passThrough) {
      demand[item] = net * (1 + (op.lossPct ?? 0) / 100);
    } else {
      const b = bomByOut.get(item);
      if (!b) warnings.push(`No BOM defined for ${item} (${op.stage}) — inputs not exploded.`);
      else if (net > 0) {
        for (const line of b.lines) {
          demand[line.itemId] = (demand[line.itemId] ?? 0) + net * line.qty * (1 + line.scrapPct / 100);
        }
      }
    }

    orders.push({ seq: op.seq, stage: op.stage, workCenterId: op.workCenterId, itemId: item, uom, grossQty: gross, stockUsed: used, netQty: net, start, end, passThrough: !!op.passThrough, qcPoint: op.qcPoint });
  }
  orders.sort((a, b) => a.seq - b.seq);

  const purchases: MrpPurchaseLine[] = Object.entries(demand)
    .filter(([id, q]) => q > 0 && !produced.has(id))
    .map(([id, q]) => {
      const uom = itemUom(id);
      const s = Math.max(0, stockLeft[id] ?? 0);
      return { itemId: id, uom, grossQty: q, stock: s, netQty: roundUp(Math.max(0, q - s), uom) };
    })
    .sort((a, b) => b.grossQty - a.grossQty);

  const rawJuteKg = purchases.filter((p) => p.itemId.startsWith('RJ-')).reduce((s, p) => s + p.grossQty, 0);
  return { packs, orders, purchases, warnings, rawJuteKg };
}
