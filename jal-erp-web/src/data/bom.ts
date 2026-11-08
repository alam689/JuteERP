import type { Bom, BomLine, Item, Product, Routing, RoutingOp, StageCode, WorkCenter } from '../types';
import { PRODUCTS } from './masters';

/**
 * Item hierarchy, default BOMs and routings for all 17 products.
 * Quantities and waste percentages are planning ESTIMATES typical for a jute mill — to be replaced by
 * JAL's spinning/weaving masters' figures in the Phase 1 workshops (SRS A-02, Q-13).
 */

// ---------- Work centres ----------

export const WORK_CENTERS: WorkCenter[] = [
  { id: 'BH', stage: 'BATCHING', name: 'Batching house' },
  { id: 'CD', stage: 'CARDING', name: 'Breaker & finisher cards' },
  { id: 'DF', stage: 'DRAWING', name: 'Drawing frames' },
  { id: 'SF-SACK', stage: 'SPINNING', name: 'Sacking spinning frames (coarse counts)' },
  { id: 'SF-HESS', stage: 'SPINNING', name: 'Hessian spinning frames (fine counts)' },
  { id: 'WD-BEAM', stage: 'WINDING', name: 'Beaming & weft cop winding (for looms)' },
  { id: 'WD-ROLL', stage: 'WINDING', name: 'Roll / spool winders (yarn for sale)' },
  { id: 'WD-COP', stage: 'WINDING', name: 'Precision cop winders (cops for sale)' },
  { id: 'LM-SACK', stage: 'WEAVING', name: 'Sacking looms' },
  { id: 'LM-HESS', stage: 'WEAVING', name: 'Hessian looms' },
  { id: 'LM-GEO', stage: 'WEAVING', name: 'Geo-mesh loom' },
  { id: 'LN', stage: 'LAMINATION', name: 'Lamination unit' },
  { id: 'CT', stage: 'CUTTING', name: 'Cutting section' },
  { id: 'SW', stage: 'SEWING', name: 'Herackle sewing lines' },
  { id: 'QC-BAG', stage: 'INSPECTION', name: 'Bag inspection tables' },
  { id: 'QC-CLOTH', stage: 'INSPECTION', name: 'Cloth inspection frame' },
  { id: 'BP', stage: 'PACKING', name: 'Baling press' },
  { id: 'RP', stage: 'PACKING', name: 'Roll packing' },
  { id: 'FG', stage: 'FG_TRANSFER', name: 'FG warehouse' },
];

export const workCentersForStage = (stage: StageCode) => WORK_CENTERS.filter((w) => w.stage === stage);
export const workCenterById = (id: string) => WORK_CENTERS.find((w) => w.id === id);

// ---------- Items ----------

const raw = (id: string, name: string, spec: string): Item => ({ id, name, type: 'RAW', uom: 'KG', kgPerUnit: 1, spec });
const semi = (id: string, name: string, spec?: string, uom: Item['uom'] = 'KG', kgPerUnit = 1): Item => ({ id, name, type: 'SEMI', uom, kgPerUnit, spec });
const pack = (id: string, name: string, uom: Item['uom'], kgPerUnit: number): Item => ({ id, name, type: 'PACK', uom, kgPerUnit });
const cons = (id: string, name: string, spec?: string): Item => ({ id, name, type: 'CONSUMABLE', uom: 'KG', kgPerUnit: 1, spec });

/** Batch recipes: which raw grades go into each jute mix. */
export const RECIPES: Record<string, { name: string; mix: { itemId: string; pct: number }[] }> = {
  SACK: { name: 'Sacking mix', mix: [{ itemId: 'RJ-TB', pct: 60 }, { itemId: 'RJ-WC', pct: 40 }] },
  HESS: { name: 'Hessian mix', mix: [{ itemId: 'RJ-WB', pct: 70 }, { itemId: 'RJ-TB', pct: 30 }] },
  WHITE: { name: 'White yarn mix', mix: [{ itemId: 'RJ-WA', pct: 60 }, { itemId: 'RJ-WB', pct: 40 }] },
};

const bagProducts = PRODUCTS.filter((p) => ['SACKING', 'SAND_BAG', 'SAND_BAG_LAM'].includes(p.route));

export const ITEMS: Item[] = [
  raw('RJ-TA', 'Raw jute — Tossa A', 'Tossa, grade A'),
  raw('RJ-TB', 'Raw jute — Tossa B', 'Tossa, grade B'),
  raw('RJ-WA', 'Raw jute — White A', 'White, grade A'),
  raw('RJ-WB', 'Raw jute — White B', 'White, grade B'),
  raw('RJ-WC', 'Raw jute — White C', 'White, grade C'),
  cons('CH-OIL', 'Batching oil emulsion', 'JBO emulsion'),
  cons('TH-SEW', 'Sewing thread', 'Jute/poly thread'),
  cons('YN-STR-B', 'Stripe yarn — blue', 'Dyed jute yarn'),
  cons('YN-STR-G', 'Stripe yarn — green', 'Dyed jute yarn'),
  cons('YN-STR-M', 'Stripe yarn — magenta', 'Dyed jute yarn'),
  cons('PK-PE', 'PE lamination film', '25 µ'),
  pack('PK-STRAP', 'Iron strapping', 'KG', 1),
  pack('PK-LABEL', 'Bale label', 'PCS', 0.005),
  pack('PK-WRAP', 'Hessian wrapper', 'KG', 1),
  pack('PK-TUBE', 'Paper cop tube', 'PCS', 0.02),
  pack('PK-CORE', 'Roll core', 'PCS', 0.5),

  ...Object.entries(RECIPES).map(([k, r]) => semi(`BJ-${k}`, `Batched jute — ${r.name}`, r.mix.map((m) => `${m.pct}% ${m.itemId}`).join(' + '))),
  ...Object.keys(RECIPES).map((k) => semi(`CS-${k}`, `Card sliver — ${RECIPES[k].name}`)),
  ...Object.keys(RECIPES).map((k) => semi(`DS-${k}`, `Drawn sliver — ${RECIPES[k].name}`)),

  semi('Y-SACK-WARP', 'Yarn — sacking warp', '8 lbs / 1 ply'),
  semi('Y-SACK-WEFT', 'Yarn — sacking weft', '10 lbs / 1 ply'),
  semi('Y-HESS-WARP', 'Yarn — hessian warp', '7 lbs / 1 ply'),
  semi('Y-HESS-WEFT', 'Yarn — hessian weft', '8 lbs / 1 ply'),
  semi('Y-GEO', 'Yarn — geo mesh', '10 lbs / 1 ply'),
  semi('Y-28', 'Yarn — sacking 28 lbs', '28 lbs / 1 ply'),
  semi('Y-SPECIAL', 'Yarn — white special', '9–60 lbs / 1 ply'),
  semi('Y-36W', 'Yarn — twine white 36 lbs', '36 lbs / 1 ply'),
  semi('Y-16', 'Yarn — twine 16/18 lbs', '16–18 lbs / 1 ply'),
  semi('Y-COP', 'Yarn — for cops', '16–28 lbs / 1 ply'),

  semi('WY-SACK', 'Prepared yarn — sacking beams & cops', 'warp beam + weft cops'),
  semi('WY-HESS', 'Prepared yarn — hessian beams & cops', 'warp beam + weft cops'),
  semi('WY-GEO', 'Prepared yarn — geo beams & cops'),

  semi('CL-SACK-6x8', 'Sacking cloth 6 × 8', "B' Twill construction"),
  semi('CL-SACK-6x7', 'Sacking cloth 6 × 7', 'Binola construction'),
  semi('CL-SACK-8x8', 'Sacking cloth 8 × 8', 'Light Cees / Sugar Twills'),
  semi('CL-SACK-8x9', 'Sacking cloth 8 × 9', 'Heavy Cees'),
  semi('CL-HESS-40', 'Hessian cloth 40" 10 oz 11 × 12', undefined, 'YD', 0.315),
  semi('CL-HESS-45', 'Hessian cloth 45" 9 oz 9 × 10', undefined, 'YD', 0.319),
  semi('CL-HESS-SAND', 'Hessian cloth for sand bags 11 × 12', '36.5" repeat'),
  semi('CL-GEO-48', 'Geo mesh cloth 48"', '6.5 × 4.5 per 10 cm', 'YD', 0.553),
  semi('LCL-SAND', 'Laminated hessian cloth', 'PE laminated'),

  ...bagProducts.map((p) => semi(`CP-${p.id}`, `Cut pieces — ${p.name}`, p.spec.size, 'PCS', p.kgPerBase)),

  // Finished products and their shipping packs
  ...PRODUCTS.map<Item>((p) => ({ id: p.id, name: p.name, type: 'FG', uom: p.baseUom, kgPerUnit: p.kgPerBase, spec: p.spec.weight ?? p.spec.count })),
  ...PRODUCTS.map<Item>((p) => ({ id: `PACK-${p.id}`, name: `${p.packUom === 'BALE' ? 'Bale' : 'Roll'} — ${p.name}`, type: 'FG', uom: p.packUom, kgPerUnit: p.kgPerBase * p.unitsPerPack, spec: `${p.unitsPerPack} ${p.baseUom.toLowerCase()}` })),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: string) => ITEM_BY_ID.get(id);

/** Illustrative stock on hand of intermediates and materials (base units). */
export const DEFAULT_STOCK: Record<string, number> = {
  'RJ-TA': 42000, 'RJ-TB': 185000, 'RJ-WA': 31000, 'RJ-WB': 96000, 'RJ-WC': 128000, 'CH-OIL': 5200,
  'TH-SEW': 420, 'YN-STR-B': 310, 'YN-STR-G': 120, 'YN-STR-M': 60, 'PK-PE': 900,
  'PK-STRAP': 3100, 'PK-LABEL': 18000, 'PK-WRAP': 800, 'PK-TUBE': 12000, 'PK-CORE': 600,
  'DS-SACK': 2600, 'DS-HESS': 1400, 'Y-SACK-WARP': 1250, 'Y-SACK-WEFT': 900, 'Y-HESS-WARP': 700, 'Y-HESS-WEFT': 600,
  'WY-SACK': 800, 'CL-SACK-6x8': 1500, 'CL-SACK-8x8': 600, 'CL-HESS-40': 900,
  // Free (unallocated) finished stock; bales already allocated to contracts are excluded.
  'JAL-SB-001': 4200, 'PACK-JAL-SB-001': 12, 'PACK-JAL-SB-002': 30, 'PACK-JAL-SB-006': 20,
};

// ---------- Default BOMs ----------

const L = (itemId: string, qty: number, scrapPct = 0): BomLine => ({ itemId, qty, scrapPct });
const bom = (outputItemId: string, stage: StageCode, lines: BomLine[], note?: string, byproducts?: Bom['byproducts']): Bom =>
  ({ id: `BOM-${outputItemId}`, outputItemId, stage, lines, note, byproducts });

/** Cloth family per bag product: which sacking construction and stripe colour it uses. */
const BAG_CLOTH: Record<string, { cloth: string; stripe?: string; stripes: number }> = {
  'JAL-SB-001': { cloth: 'CL-SACK-6x8', stripe: 'YN-STR-B', stripes: 3 },
  'JAL-SB-002': { cloth: 'CL-SACK-6x7', stripe: 'YN-STR-B', stripes: 3 },
  'JAL-SB-003': { cloth: 'CL-SACK-8x8', stripe: 'YN-STR-G', stripes: 2 },
  'JAL-SB-004': { cloth: 'CL-SACK-6x7', stripe: 'YN-STR-B', stripes: 3 },
  'JAL-SB-005': { cloth: 'CL-SACK-8x9', stripe: 'YN-STR-G', stripes: 2 },
  'JAL-SB-006': { cloth: 'CL-SACK-8x8', stripe: 'YN-STR-M', stripes: 2 },
  'JAL-SND-001': { cloth: 'LCL-SAND', stripes: 0 },
  'JAL-SND-002': { cloth: 'CL-HESS-SAND', stripes: 0 },
};

export function buildDefaultBoms(): Bom[] {
  const out: Bom[] = [];

  // Fibre preparation per recipe
  for (const [k, r] of Object.entries(RECIPES)) {
    out.push(bom(`BJ-${k}`, 'BATCHING', [...r.mix.map((m) => L(m.itemId, m.pct / 100, 3)), L('CH-OIL', 0.03)], 'Batching: 3% root & dust loss; 3% emulsion add-on', [{ itemId: 'WASTE-ROOT', qty: 0.03 }]));
    out.push(bom(`CS-${k}`, 'CARDING', [L(`BJ-${k}`, 1, 4.5)], 'Card waste ≈ 4.5%'));
    out.push(bom(`DS-${k}`, 'DRAWING', [L(`CS-${k}`, 1, 1)], 'Sliver waste ≈ 1%'));
  }

  // Yarn by count (spinning)
  const spin = (y: string, ds: string) => out.push(bom(y, 'SPINNING', [L(ds, 1, 3.5)], 'Spinning waste ≈ 3.5%'));
  spin('Y-SACK-WARP', 'DS-SACK'); spin('Y-SACK-WEFT', 'DS-SACK'); spin('Y-28', 'DS-SACK'); spin('Y-COP', 'DS-SACK'); spin('Y-16', 'DS-SACK');
  spin('Y-HESS-WARP', 'DS-HESS'); spin('Y-HESS-WEFT', 'DS-HESS'); spin('Y-GEO', 'DS-HESS');
  spin('Y-SPECIAL', 'DS-WHITE'); spin('Y-36W', 'DS-WHITE');

  // Winding: prepared yarn for looms (warp beam + weft cops)
  out.push(bom('WY-SACK', 'WINDING', [L('Y-SACK-WARP', 0.52, 1), L('Y-SACK-WEFT', 0.48, 1)], 'Sacking: 52% warp / 48% weft'));
  out.push(bom('WY-HESS', 'WINDING', [L('Y-HESS-WARP', 0.5, 1), L('Y-HESS-WEFT', 0.5, 1)]));
  out.push(bom('WY-GEO', 'WINDING', [L('Y-GEO', 1, 1)]));

  // Weaving
  for (const c of ['CL-SACK-6x8', 'CL-SACK-6x7', 'CL-SACK-8x8', 'CL-SACK-8x9']) out.push(bom(c, 'WEAVING', [L('WY-SACK', 1, 2)], 'Weaving waste ≈ 2%'));
  out.push(bom('CL-HESS-SAND', 'WEAVING', [L('WY-HESS', 1, 2)]));
  out.push(bom('CL-HESS-40', 'WEAVING', [L('WY-HESS', 0.315, 2)], 'kg yarn per yard = cloth weight per yard'));
  out.push(bom('CL-HESS-45', 'WEAVING', [L('WY-HESS', 0.319, 2)]));
  out.push(bom('CL-GEO-48', 'WEAVING', [L('WY-GEO', 0.553, 2)]));
  out.push(bom('LCL-SAND', 'LAMINATION', [L('CL-HESS-SAND', 1, 1.5), L('PK-PE', 0.09)], 'PE film ≈ 90 g per kg cloth'));

  // Bags: cutting → sewing → packing
  for (const p of bagProducts) {
    const bc = BAG_CLOTH[p.id];
    out.push(bom(`CP-${p.id}`, 'CUTTING', [L(bc.cloth, p.kgPerBase, 1.5)], 'Cutting waste ≈ 1.5%'));
    const sew = [L(`CP-${p.id}`, 1, 0.5), L('TH-SEW', 0.012)];
    if (bc.stripe) sew.push(L(bc.stripe, 0.0025 * bc.stripes));
    out.push(bom(p.id, 'SEWING', sew, 'Thread ≈ 12 g per bag; stripe yarn woven in — recorded here for costing'));
  }

  // Yarn products: winding onto rolls / cops
  const windRoll = (p: string, y: string) => out.push(bom(p, 'WINDING', [L(y, 1, 1)], 'Winding waste ≈ 1%'));
  windRoll('JAL-YRN-001', 'Y-28'); windRoll('JAL-YRN-002', 'Y-SPECIAL'); windRoll('JAL-YRN-003', 'Y-36W'); windRoll('JAL-YRN-004', 'Y-16');
  out.push(bom('JAL-COP-001', 'WINDING', [L('Y-COP', 0.215, 1), L('PK-TUBE', 1)], '≈215 g yarn per cop'));

  // Packing: one pack ← units per pack + packing materials
  for (const p of PRODUCTS) {
    const src = p.route === 'CLOTH' ? (p.id === 'JAL-HC-001' ? 'CL-HESS-40' : 'CL-HESS-45') : p.route === 'GEO' ? 'CL-GEO-48' : p.route === 'SLIVER' ? 'DS-SACK' : p.id;
    const lines = [L(src, p.unitsPerPack)];
    if (p.packUom === 'BALE') lines.push(L('PK-STRAP', 2.1), L('PK-LABEL', 2));
    else lines.push(L('PK-CORE', 1), L('PK-WRAP', 0.4), L('PK-LABEL', 1));
    out.push(bom(`PACK-${p.id}`, 'PACKING', lines, `${p.unitsPerPack} ${p.baseUom.toLowerCase()} per ${p.packUom.toLowerCase()}`));
  }

  return out;
}

// ---------- Default routings ----------

export function buildDefaultRoutings(): Routing[] {
  const op = (stage: StageCode, workCenterId: string, outputItemId: string, days: number, extra: Partial<RoutingOp> = {}): Omit<RoutingOp, 'seq'> =>
    ({ stage, workCenterId, outputItemId, days, qcPoint: false, ...extra });

  const fibre = (recipe: string) => [
    op('BATCHING', 'BH', `BJ-${recipe}`, 1),
    op('CARDING', 'CD', `CS-${recipe}`, 1),
    op('DRAWING', 'DF', `DS-${recipe}`, 1),
  ];
  const yarnPrep = (recipe: string, wy: string, sf: string, warp: string, weft: string) => [
    ...fibre(recipe),
    op('SPINNING', sf, warp, 2, { qcPoint: true }),
    op('SPINNING', sf, weft, 2),
    op('WINDING', 'WD-BEAM', wy, 1),
  ];
  const packOps = (p: Product, qcWc: string, packWc: string, lossPct: number) => [
    op('INSPECTION', qcWc, p.route === 'CLOTH' ? (p.id === 'JAL-HC-001' ? 'CL-HESS-40' : 'CL-HESS-45') : p.route === 'GEO' ? 'CL-GEO-48' : p.id, 1, { passThrough: true, lossPct, qcPoint: true }),
    op('PACKING', packWc, `PACK-${p.id}`, 1),
    op('FG_TRANSFER', 'FG', `PACK-${p.id}`, 1, { passThrough: true, lossPct: 0 }),
  ];

  return PRODUCTS.map((p) => {
    let ops: Omit<RoutingOp, 'seq'>[];
    switch (p.route) {
      case 'SLIVER':
        ops = [...fibre('SACK'), op('PACKING', 'RP', `PACK-${p.id}`, 1), op('FG_TRANSFER', 'FG', `PACK-${p.id}`, 1, { passThrough: true, lossPct: 0 })];
        break;
      case 'YARN': {
        const y = { 'JAL-YRN-001': ['SACK', 'Y-28', 'SF-SACK'], 'JAL-YRN-002': ['WHITE', 'Y-SPECIAL', 'SF-HESS'], 'JAL-YRN-003': ['WHITE', 'Y-36W', 'SF-HESS'], 'JAL-YRN-004': ['SACK', 'Y-16', 'SF-SACK'] }[p.id]!;
        ops = [...fibre(y[0]), op('SPINNING', y[2], y[1], 2, { qcPoint: true }), op('WINDING', 'WD-ROLL', p.id, 1), op('PACKING', 'RP', `PACK-${p.id}`, 1), op('FG_TRANSFER', 'FG', `PACK-${p.id}`, 1, { passThrough: true, lossPct: 0 })];
        break;
      }
      case 'COPS':
        ops = [...fibre('SACK'), op('SPINNING', 'SF-SACK', 'Y-COP', 2, { qcPoint: true }), op('WINDING', 'WD-COP', p.id, 1), op('PACKING', 'BP', `PACK-${p.id}`, 1), op('FG_TRANSFER', 'FG', `PACK-${p.id}`, 1, { passThrough: true, lossPct: 0 })];
        break;
      case 'CLOTH':
        ops = [...yarnPrep('HESS', 'WY-HESS', 'SF-HESS', 'Y-HESS-WARP', 'Y-HESS-WEFT'), op('WEAVING', 'LM-HESS', p.id === 'JAL-HC-001' ? 'CL-HESS-40' : 'CL-HESS-45', 3), ...packOps(p, 'QC-CLOTH', 'BP', 1)];
        break;
      case 'GEO':
        ops = [...fibre('HESS'), op('SPINNING', 'SF-HESS', 'Y-GEO', 2, { qcPoint: true }), op('WINDING', 'WD-BEAM', 'WY-GEO', 1), op('WEAVING', 'LM-GEO', 'CL-GEO-48', 3), ...packOps(p, 'QC-CLOTH', 'RP', 1)];
        break;
      case 'SACKING':
        ops = [...yarnPrep('SACK', 'WY-SACK', 'SF-SACK', 'Y-SACK-WARP', 'Y-SACK-WEFT'), op('WEAVING', 'LM-SACK', BAG_CLOTH[p.id].cloth, 3), op('CUTTING', 'CT', `CP-${p.id}`, 1), op('SEWING', 'SW', p.id, 2), ...packOps(p, 'QC-BAG', 'BP', 1)];
        break;
      case 'SAND_BAG':
        ops = [...yarnPrep('HESS', 'WY-HESS', 'SF-HESS', 'Y-HESS-WARP', 'Y-HESS-WEFT'), op('WEAVING', 'LM-HESS', 'CL-HESS-SAND', 3), op('CUTTING', 'CT', `CP-${p.id}`, 1), op('SEWING', 'SW', p.id, 2), ...packOps(p, 'QC-BAG', 'BP', 1)];
        break;
      case 'SAND_BAG_LAM':
        ops = [...yarnPrep('HESS', 'WY-HESS', 'SF-HESS', 'Y-HESS-WARP', 'Y-HESS-WEFT'), op('WEAVING', 'LM-HESS', 'CL-HESS-SAND', 3), op('LAMINATION', 'LN', 'LCL-SAND', 1), op('CUTTING', 'CT', `CP-${p.id}`, 1), op('SEWING', 'SW', p.id, 2), ...packOps(p, 'QC-BAG', 'BP', 1)];
        break;
    }
    return { productId: p.id, ops: ops.map((o, i) => ({ ...o, seq: i + 1 })) };
  });
}

export const WASTE_ITEMS: Item[] = [{ id: 'WASTE-ROOT', name: 'Root cuttings (by-product)', type: 'RAW', uom: 'KG', kgPerUnit: 1 }];
