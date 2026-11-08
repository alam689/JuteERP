import type { Machine, MachineState, Product, RouteCode, Stage, StageCode, Uom } from '../types';
import { hashString, mulberry32 } from '../lib/rng';

/**
 * Production stages per SRS Part 1 §1.5, plus lamination for laminated sand bags.
 * Line-level daily targets are illustrative planning figures (~50 t/day raw jute), not company data (SRS Q-13).
 */
export const STAGES: Stage[] = [
  { code: 'BATCHING', seq: 1, name: 'Raw Material Preparation', activities: 'Selection, batching and softening', workCenter: 'Batching House', inputUom: 'KG', outputUom: 'KG', outputItem: 'Batched jute', dailyTarget: 50000, wasteTypes: ['Root cuttings', 'Dust & sweepings'], wasteAlertPct: 3.0, hasRejects: false },
  { code: 'CARDING', seq: 2, name: 'Carding', activities: 'Fibre opening and carding', workCenter: 'Carding Section', inputUom: 'KG', outputUom: 'KG', outputItem: 'Card sliver', dailyTarget: 48500, wasteTypes: ['Card waste', 'Fly'], wasteAlertPct: 4.0, hasRejects: false },
  { code: 'DRAWING', seq: 3, name: 'Drawing', activities: 'Fibre alignment and drawing', workCenter: 'Drawing Section', inputUom: 'KG', outputUom: 'KG', outputItem: 'Drawn sliver', dailyTarget: 48000, wasteTypes: ['Sliver waste'], wasteAlertPct: 1.2, hasRejects: false },
  { code: 'SPINNING', seq: 4, name: 'Spinning', activities: 'Jute yarn production', workCenter: 'Spinning Section', inputUom: 'KG', outputUom: 'KG', outputItem: 'Jute yarn', dailyTarget: 46500, wasteTypes: ['Roving waste', 'Thread waste', 'Sweepings'], wasteAlertPct: 3.5, hasRejects: false },
  { code: 'WINDING', seq: 5, name: 'Winding', activities: 'Yarn winding — beams, rolls, spools and cops', workCenter: 'Winding & Beaming', inputUom: 'KG', outputUom: 'KG', outputItem: 'Cops / beams / rolls', dailyTarget: 46000, wasteTypes: ['Thread waste'], wasteAlertPct: 1.2, hasRejects: false },
  { code: 'WEAVING', seq: 6, name: 'Weaving', activities: 'Sacking, hessian and geo-mesh cloth production', workCenter: 'Loom Shed', inputUom: 'KG', outputUom: 'KG', outputItem: 'Woven cloth', dailyTarget: 45000, wasteTypes: ['Thread waste', 'Selvedge waste'], wasteAlertPct: 2.5, hasRejects: false },
  { code: 'LAMINATION', seq: 7, name: 'Lamination', activities: 'Poly film lamination of hessian cloth', workCenter: 'Lamination Unit', inputUom: 'KG', outputUom: 'KG', outputItem: 'Laminated cloth', dailyTarget: 5000, wasteTypes: ['Film trim', 'Cloth waste'], wasteAlertPct: 2.0, hasRejects: false, optionalFor: 'Laminated sand bags only' },
  { code: 'CUTTING', seq: 8, name: 'Cutting', activities: 'Fabric cutting according to bag size', workCenter: 'Cutting Section', inputUom: 'KG', outputUom: 'PCS', outputItem: 'Cut pieces', dailyTarget: 43500, wasteTypes: ['Cuttings'], wasteAlertPct: 2.0, hasRejects: false },
  { code: 'SEWING', seq: 9, name: 'Sewing', activities: 'Bag stitching and finishing', workCenter: 'Sewing Section', inputUom: 'PCS', outputUom: 'PCS', outputItem: 'Sewn bags', dailyTarget: 42500, wasteTypes: ['Thread waste'], wasteAlertPct: 0.8, hasRejects: true },
  { code: 'INSPECTION', seq: 10, name: 'Inspection', activities: 'Quality inspection and rejection', workCenter: 'Finishing & QC', inputUom: 'PCS', outputUom: 'PCS', outputItem: 'Passed goods', dailyTarget: 42000, wasteTypes: [], wasteAlertPct: 0.5, hasRejects: true },
  { code: 'PACKING', seq: 11, name: 'Packing', activities: 'Bale / roll preparation and identification', workCenter: 'Baling Section', inputUom: 'PCS', outputUom: 'BALE', outputItem: 'Bales / rolls', dailyTarget: 140, wasteTypes: ['Packing material scrap'], wasteAlertPct: 0.5, hasRejects: false },
  { code: 'FG_TRANSFER', seq: 12, name: 'Finished Goods', activities: 'Warehouse transfer', workCenter: 'FG Warehouse', inputUom: 'BALE', outputUom: 'BALE', outputItem: 'FG packs', dailyTarget: 140, wasteTypes: [], wasteAlertPct: 0.5, hasRejects: false },
];

export const stageByCode = (code: StageCode) => STAGES.find((s) => s.code === code)!;

/** Upstream stages measured in kilograms. */
export const isWeightStage = (s: Stage) => s.outputUom === 'KG';

// ---------- Routes ----------

const FIBRE: StageCode[] = ['BATCHING', 'CARDING', 'DRAWING'];
const YARN: StageCode[] = [...FIBRE, 'SPINNING', 'WINDING'];
const CLOTH: StageCode[] = [...YARN, 'WEAVING', 'INSPECTION', 'PACKING', 'FG_TRANSFER'];
const BAG: StageCode[] = [...YARN, 'WEAVING', 'CUTTING', 'SEWING', 'INSPECTION', 'PACKING', 'FG_TRANSFER'];

export const ROUTES: Record<RouteCode, StageCode[]> = {
  SLIVER: [...FIBRE, 'PACKING', 'FG_TRANSFER'],
  YARN: [...YARN, 'PACKING', 'FG_TRANSFER'],
  COPS: [...YARN, 'PACKING', 'FG_TRANSFER'],
  CLOTH,
  GEO: CLOTH,
  SACKING: BAG,
  SAND_BAG: BAG,
  SAND_BAG_LAM: [...YARN, 'WEAVING', 'LAMINATION', 'CUTTING', 'SEWING', 'INSPECTION', 'PACKING', 'FG_TRANSFER'],
};

export const ROUTE_LABEL: Record<RouteCode, string> = {
  SLIVER: 'Sliver',
  YARN: 'Yarn / twine',
  COPS: 'Yarn cops',
  CLOTH: 'Hessian cloth',
  GEO: 'Geo soil saver',
  SACKING: 'Sacking bags',
  SAND_BAG: 'Sand bags',
  SAND_BAG_LAM: 'Sand bags — laminated',
};

export const ROUTE_ORDER: RouteCode[] = ['SLIVER', 'YARN', 'COPS', 'CLOTH', 'GEO', 'SACKING', 'SAND_BAG', 'SAND_BAG_LAM'];

/** Units per stage that differ from the sacking-bag defaults. [input, output] */
const ROUTE_UOMS: Partial<Record<RouteCode, Partial<Record<StageCode, [Uom, Uom]>>>> = {
  SLIVER: { PACKING: ['KG', 'ROLL'], FG_TRANSFER: ['ROLL', 'ROLL'] },
  YARN: { PACKING: ['KG', 'ROLL'], FG_TRANSFER: ['ROLL', 'ROLL'] },
  COPS: { WINDING: ['KG', 'PCS'], PACKING: ['PCS', 'BALE'] },
  CLOTH: { WEAVING: ['KG', 'YD'], INSPECTION: ['YD', 'YD'], PACKING: ['YD', 'BALE'] },
  GEO: { WEAVING: ['KG', 'YD'], INSPECTION: ['YD', 'YD'], PACKING: ['YD', 'ROLL'], FG_TRANSFER: ['ROLL', 'ROLL'] },
};

/** Input/output units of a stage for a given product (falls back to the stage defaults). */
export function stageUoms(stage: Stage, product?: Product): { inputUom: Uom; outputUom: Uom } {
  const o = product && ROUTE_UOMS[product.route]?.[stage.code];
  return o ? { inputUom: o[0], outputUom: o[1] } : { inputUom: stage.inputUom, outputUom: stage.outputUom };
}

export const routeStages = (route: RouteCode): Stage[] => ROUTES[route].map(stageByCode);
export const productUsesStage = (p: Product, stage: StageCode) => ROUTES[p.route].includes(stage);

// ---------- Machines ----------

const MACHINE_GROUPS: { stage: StageCode; prefix: string; label: string; count: number }[] = [
  { stage: 'BATCHING', prefix: 'BL', label: 'Batching line', count: 2 },
  { stage: 'CARDING', prefix: 'CD', label: 'Card (breaker/finisher)', count: 8 },
  { stage: 'DRAWING', prefix: 'DF', label: 'Drawing frame', count: 6 },
  { stage: 'SPINNING', prefix: 'SF', label: 'Spinning frame', count: 12 },
  { stage: 'WINDING', prefix: 'WD', label: 'Winding machine', count: 6 },
  { stage: 'WEAVING', prefix: 'LM', label: 'Loom', count: 24 },
  { stage: 'LAMINATION', prefix: 'LN', label: 'Lamination machine', count: 1 },
  { stage: 'CUTTING', prefix: 'CT', label: 'Cutting machine', count: 3 },
  { stage: 'SEWING', prefix: 'SW', label: 'Sewing machine', count: 12 },
  { stage: 'INSPECTION', prefix: 'IT', label: 'Inspection table', count: 4 },
  { stage: 'PACKING', prefix: 'BP', label: 'Baling press', count: 2 },
  { stage: 'FG_TRANSFER', prefix: 'FD', label: 'FG dock', count: 1 },
];

export const MACHINES: Machine[] = MACHINE_GROUPS.flatMap((g) =>
  Array.from({ length: g.count }, (_, i) => {
    const code = `${g.prefix}-${String(i + 1).padStart(2, '0')}`;
    return { id: code, code, name: `${g.label} ${i + 1}`, stage: g.stage };
  }),
);

export const machinesForStage = (stage: StageCode) => MACHINES.filter((m) => m.stage === stage);

export const DOWNTIME_REASONS = ['Breakdown', 'No material', 'Power failure', 'Changeover', 'No operator', 'Preventive maintenance'];

export interface MachineStatus {
  machine: Machine;
  state: MachineState;
  reason?: string;
  sinceMin?: number;
}

/** Deterministic illustrative machine status for a given date and shift (stands in for live CMMS/PLC data). */
export function machineStatuses(date: string, shift: string): MachineStatus[] {
  const rnd = mulberry32(hashString(`${date}-${shift}`));
  return MACHINES.map((m) => {
    const r = rnd();
    if (r < 0.07) {
      const reasons = ['Breakdown', 'Breakdown', 'Power failure', 'Preventive maintenance'];
      return { machine: m, state: 'DOWN', reason: reasons[Math.floor(rnd() * reasons.length)], sinceMin: 10 + Math.floor(rnd() * 170) };
    }
    if (r < 0.16) {
      const reasons = ['No material', 'Changeover', 'No operator'];
      return { machine: m, state: 'IDLE', reason: reasons[Math.floor(rnd() * reasons.length)], sinceMin: 5 + Math.floor(rnd() * 60) };
    }
    return { machine: m, state: 'RUNNING' };
  });
}

// ---------- Products ----------

const HEMMED = 'Hemmed at mouth, side Herackle sewn';
const OZ_TO_KG = 0.0283495;
/** kg per running yard of cloth from oz/sq yd and width in inches. */
const clothKgPerYd = (oz: number, widthIn: number) => +(oz * (widthIn / 36) * OZ_TO_KG).toFixed(3);

/**
 * Product masters from JAL's 17 listed items (SRS FR-PRD-009): the duplicate Sugar Twills entry is
 * consolidated and the sand bag is split into laminated / unlaminated variants, giving 17 masters.
 * `specConfirmed` is true only where weight and packing come from the customer list.
 */
export const PRODUCTS: Product[] = [
  { id: 'JAL-SB-001', code: 'JAL-SB-001', name: "Standard B' Twill Sacking Bag", category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 1.02, packUom: 'BALE', unitsPerPack: 300, packsPerCtr20: 65, specConfirmed: true,
    spec: { size: '44" × 26.5"', weight: '1,020 g (2.25 lbs)', porterShots: '6 × 8', stitching: HEMMED, stripes: '3 blue stripes in middle', packing: '300 bags per iron-bound bale · 65 bales per 20′ FCL' } },
  { id: 'JAL-SB-002', code: 'JAL-SB-002', name: 'Standard Binola Sacking Bag', category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 0.907, packUom: 'BALE', unitsPerPack: 300, packsPerCtr20: 70, specConfirmed: true,
    spec: { size: '44" × 26.5"', weight: '907 g (2.00 lbs)', porterShots: '6 × 7', stitching: HEMMED, stripes: '3 blue stripes in middle', packing: '300 bags per bale · 70 bales per 20′ FCL' } },
  { id: 'JAL-SB-003', code: 'JAL-SB-003', name: 'Light Cees Sacking Bag', category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 1.02, packUom: 'BALE', unitsPerPack: 400, packsPerCtr20: 42, specConfirmed: true,
    spec: { size: '43" × 29"', weight: '1,020 g (2.25 lbs)', porterShots: '8 × 8', stitching: HEMMED, stripes: '2 green stripes in middle', packing: '400 bags per bale · 42 bales per 20′ FCL' } },
  { id: 'JAL-SB-004', code: 'JAL-SB-004', name: 'Cut Size Binola Sacking Bag', category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 0.79, packUom: 'BALE', unitsPerPack: 300, packsPerCtr20: 75, specConfirmed: true,
    spec: { size: '38" × 26"', weight: '790 g (1.74 lbs)', porterShots: '6 × 7', stitching: HEMMED, stripes: '3 blue stripes in middle', packing: '300 bags per bale · 75 bales per 20′ FCL' } },
  { id: 'JAL-SB-005', code: 'JAL-SB-005', name: 'Heavy Cees Sacking Bag', category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 1.02, packUom: 'BALE', unitsPerPack: 400, packsPerCtr20: 45, specConfirmed: true,
    spec: { size: '40" × 28"', weight: '1,020 g (2.25 lbs)', porterShots: '8 × 9', stitching: HEMMED, stripes: '2 green stripes in middle', packing: '400 bags per bale · 45 bales per 20′ FCL' } },
  { id: 'JAL-SB-006', code: 'JAL-SB-006', name: 'Sugar Twills Sacking Bag', category: 'Sacking Bag', route: 'SACKING', baseUom: 'PCS', kgPerBase: 1.134, packUom: 'BALE', unitsPerPack: 400, packsPerCtr20: 40, specConfirmed: true,
    spec: { size: '48" × 28"', weight: '1,134 g (2.5 lbs)', porterShots: '8 × 8', stitching: HEMMED, stripes: '2 magenta stripes in middle', packing: '400 bags per bale · 40 bales per 20′ FCL' } },

  { id: 'JAL-HC-001', code: 'JAL-HC-001', name: 'Hessian Cloth 40" — 10 oz', category: 'Hessian Cloth', route: 'CLOTH', baseUom: 'YD', kgPerBase: clothKgPerYd(10, 40), packUom: 'BALE', unitsPerPack: 2000, packsPerCtr20: 32, specConfirmed: true,
    spec: { size: '40" width', weight: '10 oz per sq yd', porterShots: '11 × 12', packing: '2,000 yd per iron-bound bale · 32 bales per 20′ FCL' },
    assumptions: 'Customer list says "220′ FCL" — read as 20′. kg/yd derived from oz and width.' },
  { id: 'JAL-HC-002', code: 'JAL-HC-002', name: 'Hessian Cloth 45" — 9 oz', category: 'Hessian Cloth', route: 'CLOTH', baseUom: 'YD', kgPerBase: clothKgPerYd(9, 45), packUom: 'BALE', unitsPerPack: 1000, packsPerCtr20: 60, specConfirmed: true,
    spec: { size: '45" width', weight: '9 oz per sq yd', porterShots: '9 × 10', packing: '1,000 yd per iron-bound bale · 60 bales per 20′ FCL' },
    assumptions: 'Customer list says "120′ FCL" — read as 20′. kg/yd derived from oz and width.' },

  { id: 'JAL-SND-001', code: 'JAL-SND-001', name: 'Hessian Sand Bag — Laminated', category: 'Sand Bag', route: 'SAND_BAG_LAM', baseUom: 'PCS', kgPerBase: 0.4, packUom: 'BALE', unitsPerPack: 400, specConfirmed: false,
    spec: { size: '36.5" × 23"', porterShots: '11 × 12', stitching: 'Herackle sewn, selvedge mouth', other: 'Poly-laminated hessian' },
    assumptions: 'Bag weight (≈400 g) and 400 bags per bale assumed — not in customer list.' },
  { id: 'JAL-SND-002', code: 'JAL-SND-002', name: 'Hessian Sand Bag — Unlaminated', category: 'Sand Bag', route: 'SAND_BAG', baseUom: 'PCS', kgPerBase: 0.37, packUom: 'BALE', unitsPerPack: 400, specConfirmed: false,
    spec: { size: '36.5" × 23"', porterShots: '11 × 12', stitching: 'Herackle sewn, selvedge mouth' },
    assumptions: 'Bag weight (≈370 g) and 400 bags per bale assumed — not in customer list.' },

  { id: 'JAL-GEO-001', code: 'JAL-GEO-001', name: 'Geo Jute Soil Saver', category: 'Geo Product', route: 'GEO', baseUom: 'YD', kgPerBase: 0.553, packUom: 'ROLL', unitsPerPack: 75, packsPerCtr20: 216, specConfirmed: true,
    spec: { size: '48" width · mesh 6.5 × 4.5 per 10 cm', weight: '1.22 lbs per yd', packing: '75 yd per roll · 216 rolls per 20′ FCL' },
    assumptions: '1.22 lbs read as per running yard.' },

  { id: 'JAL-YRN-001', code: 'JAL-YRN-001', name: 'Sacking Jute Yarn 28 lbs / 1 ply', category: 'Jute Yarn', route: 'YARN', baseUom: 'KG', kgPerBase: 1, packUom: 'ROLL', unitsPerPack: 50, packsPerCtr20: 216, specConfirmed: false,
    spec: { count: '28 lbs / 1 ply', packing: '216 rolls per 20′ FCL' }, assumptions: 'Roll weight (50 kg) assumed — not in customer list.' },
  { id: 'JAL-YRN-002', code: 'JAL-YRN-002', name: 'White Jute Yarn (Special)', category: 'Jute Yarn', route: 'YARN', baseUom: 'KG', kgPerBase: 1, packUom: 'ROLL', unitsPerPack: 50, specConfirmed: false,
    spec: { count: '9 to 60 lbs / 1 ply' }, assumptions: 'Roll weight (50 kg) and packing assumed.' },
  { id: 'JAL-YRN-003', code: 'JAL-YRN-003', name: 'Jute Yarn / Twine White 36 lbs', category: 'Jute Yarn', route: 'YARN', baseUom: 'KG', kgPerBase: 1, packUom: 'ROLL', unitsPerPack: 50, specConfirmed: false,
    spec: { count: '36 lbs / 1 ply' }, assumptions: 'Roll weight (50 kg) and packing assumed.' },
  { id: 'JAL-YRN-004', code: 'JAL-YRN-004', name: 'Jute Yarn / Twine 16 & 18 lbs', category: 'Jute Yarn', route: 'YARN', baseUom: 'KG', kgPerBase: 1, packUom: 'ROLL', unitsPerPack: 50, specConfirmed: false,
    spec: { count: '16 lbs / 1 ply and 18 lbs / 1 ply' }, assumptions: 'Roll weight (50 kg) and packing assumed.' },

  { id: 'JAL-COP-001', code: 'JAL-COP-001', name: '28/1 Jute Yarn Cops', category: 'Yarn Cops', route: 'COPS', baseUom: 'PCS', kgPerBase: 0.215, packUom: 'BALE', unitsPerPack: 500, specConfirmed: false,
    spec: { count: '16 to 28 lbs / 1 ply', size: '10"–11" length · 1.5" dia', weight: '200–230 g per cop' }, assumptions: '500 cops per bale assumed — not in customer list.' },

  { id: 'JAL-SLV-001', code: 'JAL-SLV-001', name: 'Jute Sliver Roll', category: 'Semi-finished', route: 'SLIVER', baseUom: 'KG', kgPerBase: 1, packUom: 'ROLL', unitsPerPack: 13, specConfirmed: true,
    spec: { size: '22" roll dia', weight: '12–14 kg per roll' }, assumptions: 'Rolls per container not given.' },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);

/** Products whose route passes through the given stage. */
export const productsForStage = (stage: StageCode): Product[] => PRODUCTS.filter((p) => productUsesStage(p, stage));
