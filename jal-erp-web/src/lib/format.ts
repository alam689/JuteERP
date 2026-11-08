import type { ShiftCode, Uom } from '../types';

const nf = (d: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtNum = (n: number, decimals = 0) => nf(decimals).format(Number.isFinite(n) ? n : 0);
export const fmtPct = (n: number, decimals = 1) => `${fmtNum(n, decimals)}%`;

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${fmtNum(n / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${fmtNum(n / 1_000, 1)}K`;
  return fmtNum(n);
}

export const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const UOM_LABEL: Record<Uom, string> = { KG: 'kg', PCS: 'pcs', YD: 'yd', ROLL: 'rolls', BALE: 'bales' };
export const uomLabel = (u: Uom) => UOM_LABEL[u];
export const fmtQty = (n: number, u: Uom) => `${fmtNum(n)} ${uomLabel(u)}`;

/** Local calendar date as YYYY-MM-DD. */
export const isoDate = (d: Date) => d.toLocaleDateString('en-CA');

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const fmtDateTime = (isoTs: string) =>
  new Date(isoTs).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const SHIFT_TIMES: Record<ShiftCode, string> = { A: '06:00–14:00', B: '14:00–22:00', C: '22:00–06:00' };

/** Shift running now and the calendar date it belongs to (C belongs to the date it starts). */
export function currentShift(now = new Date()): { date: string; shift: ShiftCode } {
  const h = now.getHours();
  if (h >= 6 && h < 14) return { date: isoDate(now), shift: 'A' };
  if (h >= 14 && h < 22) return { date: isoDate(now), shift: 'B' };
  if (h >= 22) return { date: isoDate(now), shift: 'C' };
  return { date: addDays(isoDate(now), -1), shift: 'C' };
}

/** Bangladesh fiscal year (July–June) code, e.g. 2627 for FY 2026-27. */
export function fiscalCode(d = new Date()): string {
  const y = d.getFullYear();
  const start = d.getMonth() >= 6 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}
