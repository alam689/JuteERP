import type { Product, Stage, Uom, WasteLine } from '../types';
import { stageUoms } from '../data/masters';

/** BR-MFG-002: output + waste may exceed input by at most this fraction (weighing tolerance). */
export const OUTPUT_TOLERANCE = 0.02;
/** Unaccounted (invisible) loss % above which a warning is shown. */
export const INVISIBLE_LOSS_ALERT_PCT = 3;

/** Kilograms per one unit of `uom` for the given product (SRS UOM conversions, FR-UOM-003/005). */
export function unitKg(uom: Uom, product?: Product): number {
  if (uom === 'KG') return 1;
  if (!product) return uom === 'BALE' ? 300 : 1;
  if (uom === product.packUom) return product.unitsPerPack * product.kgPerBase;
  return product.kgPerBase; // base unit (bag, yard, cop) or the unit used before packing
}

export interface EntryInput {
  inputQty: number;
  goodQty: number;
  rejectQty: number;
  waste: WasteLine[];
}

export interface EntryMetrics {
  inputKg: number;
  goodKg: number;
  rejectKg: number;
  wasteKg: number;
  yieldPct: number;
  wastePct: number;
  rejectPct: number;
  invisiblePct: number;
  errors: string[];
  warnings: string[];
}

/**
 * BR-MFG-001 stage yield and wastage:
 *   Yield %          = good output kg / input kg × 100
 *   Wastage %        = waste kg / input kg × 100
 *   Invisible loss % = 100 − yield − wastage − rejects
 */
export function computeEntryMetrics(stage: Stage, product: Product | undefined, e: EntryInput): EntryMetrics {
  const { inputUom, outputUom } = stageUoms(stage, product);
  const inputKg = e.inputQty * unitKg(inputUom, product);
  const goodKg = e.goodQty * unitKg(outputUom, product);
  const rejectKg = e.rejectQty * unitKg(outputUom, product);
  const wasteKg = e.waste.reduce((s, w) => s + (Number.isFinite(w.kg) ? w.kg : 0), 0);
  const pct = (kg: number) => (inputKg > 0 ? (kg / inputKg) * 100 : 0);
  const yieldPct = pct(goodKg);
  const wastePct = pct(wasteKg);
  const rejectPct = pct(rejectKg);
  const invisiblePct = inputKg > 0 ? 100 - yieldPct - wastePct - rejectPct : 0;

  const errors: string[] = [];
  const warnings: string[] = [];
  if (e.inputQty <= 0) errors.push('Enter the input quantity.');
  if (e.goodQty < 0 || e.rejectQty < 0 || e.waste.some((w) => w.kg < 0)) errors.push('Quantities cannot be negative.');
  if (inputKg > 0 && goodKg + rejectKg + wasteKg > inputKg * (1 + OUTPUT_TOLERANCE)) {
    errors.push(
      `Output, rejects and waste (${Math.round(goodKg + rejectKg + wasteKg).toLocaleString('en-IN')} kg) exceed input ` +
        `(${Math.round(inputKg).toLocaleString('en-IN')} kg) by more than ${OUTPUT_TOLERANCE * 100}%. Check the weights.`,
    );
  }
  if (inputKg > 0 && wastePct > stage.wasteAlertPct) {
    warnings.push(`Wastage ${wastePct.toFixed(2)}% is above the ${stage.wasteAlertPct}% alert level for ${stage.name}.`);
  }
  if (inputKg > 0 && invisiblePct > INVISIBLE_LOSS_ALERT_PCT) {
    warnings.push(`Unaccounted loss is ${invisiblePct.toFixed(2)}% (alert above ${INVISIBLE_LOSS_ALERT_PCT}%). Record any missing waste.`);
  }
  return { inputKg, goodKg, rejectKg, wasteKg, yieldPct, wastePct, rejectPct, invisiblePct, errors, warnings };
}

/** BR-UOM-001 packing calculation for a quantity in the product's base unit. */
export function packing(qtyBase: number, product: Product) {
  const perPack = product.unitsPerPack;
  const perCtr = product.packsPerCtr20;
  const packs = Math.ceil(qtyBase / perPack);
  return {
    packUom: product.packUom,
    packs,
    fullPacks: Math.floor(qtyBase / perPack),
    partialUnits: qtyBase % perPack,
    fullContainers: perCtr ? Math.floor(packs / perCtr) : undefined,
    partialContainerPacks: perCtr ? packs % perCtr : undefined,
    netKg: qtyBase * product.kgPerBase,
  };
}
