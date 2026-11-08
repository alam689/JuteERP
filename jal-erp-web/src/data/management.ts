import { addDays, isoDate } from '../lib/format';

/**
 * Illustrative non-production figures for the management dashboard.
 * These stand in for the Sales, Commercial, Inventory and HR modules that are not built yet.
 * They are NOT actual company figures.
 */
const today = isoDate(new Date());

export const COMPANY = {
  name: 'Jute Alliance Limited',
  short: 'JAL',
  tagline: 'Reclaiming the Heritage',
  workforce: 2800,
  floorSqFt: 300000,
};

export const MGMT_KPIS = {
  fgStockBales: 1184,
  fgStockValueUsd: 386000,
  exportOnTimePct: 92.4,
  exportProceedsMtdUsd: 1_182_000,
  exportProceedsTargetUsd: 1_250_000,
  overdueExpCount: 2,
  overdueExpUsd: 74_600,
  attendancePct: 94.1,
  rawJuteStockDays: 18,
  containersShippedMtd: 21,
};

export interface ExportOrder {
  contract: string;
  customer: string;
  product: string;
  qtyBags: number;
  shippedBags: number;
  shipBy: string;
  terms: string;
  status: 'On track' | 'At risk' | 'Late' | 'Shipped';
}

export const EXPORT_ORDERS: ExportOrder[] = [
  { contract: 'SC/JAL/2627/0012', customer: 'CUST-EG-001 (Egypt)', product: "Standard B' Twill", qtyBags: 390000, shippedBags: 214500, shipBy: addDays(today, 12), terms: 'LC at sight · CFR', status: 'On track' },
  { contract: 'SC/JAL/2627/0016', customer: 'CUST-SD-001 (Sudan)', product: 'Standard Binola', qtyBags: 156000, shippedBags: 39000, shipBy: addDays(today, 9), terms: 'LC 90 days · FOB', status: 'At risk' },
  { contract: 'SC/JAL/2627/0017', customer: 'CUST-BE-001 (Belgium)', product: 'Hessian Cloth 40"', qtyBags: 0, shippedBags: 0, shipBy: addDays(today, 21), terms: 'CAD · CIF', status: 'On track' },
  { contract: 'SC/JAL/2627/0019', customer: 'CUST-AU-002 (Australia)', product: 'Heavy Cees', qtyBags: 58500, shippedBags: 0, shipBy: addDays(today, 18), terms: 'TT advance · FOB', status: 'On track' },
  { contract: 'SC/JAL/2627/0010', customer: 'CUST-GH-001 (Ghana)', product: 'Sugar Twills', qtyBags: 78000, shippedBags: 58500, shipBy: addDays(today, -2), terms: 'LC at sight · CFR', status: 'Late' },
  { contract: 'SC/JAL/2627/0008', customer: 'CUST-KE-001 (Kenya)', product: 'Sugar Twills', qtyBags: 78000, shippedBags: 78000, shipBy: addDays(today, -14), terms: 'LC at sight · FOB', status: 'Shipped' },
];

export const FG_STOCK_BY_PRODUCT = [
  { product: "B' Twill", bales: 512 },
  { product: 'Binola', bales: 214 },
  { product: 'Heavy Cees', bales: 96 },
  { product: 'Sugar Twills', bales: 188 },
  { product: 'Light Cees', bales: 74 },
  { product: 'Sand bags', bales: 100 },
];

export interface CommercialAlert {
  severity: 'bad' | 'warn' | 'info';
  title: string;
  detail: string;
}

export const COMMERCIAL_ALERTS: CommercialAlert[] = [
  { severity: 'bad', title: 'Shipment late — SC/JAL/2627/0010', detail: '19,500 bags (65 bales) pending; ship-by date passed 2 days ago.' },
  { severity: 'warn', title: 'Export LC expiring in 9 days', detail: 'LC for SC/JAL/2627/0016 — latest shipment date approaching.' },
  { severity: 'warn', title: '2 EXP forms overdue for realisation', detail: 'US$74,600 outstanding beyond the realisation period.' },
];
