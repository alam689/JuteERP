import type { ShiftEntry, StageCode } from '../types';
import { STAGES } from '../data/masters';
import { addDays } from './format';

export interface Agg {
  goodQty: number;
  rejectQty: number;
  inputKg: number;
  goodKg: number;
  rejectKg: number;
  wasteKg: number;
  runMin: number;
  downMin: number;
  shifts: number;
}

const empty = (): Agg => ({ goodQty: 0, rejectQty: 0, inputKg: 0, goodKg: 0, rejectKg: 0, wasteKg: 0, runMin: 0, downMin: 0, shifts: 0 });

export const posted = (entries: ShiftEntry[]) => entries.filter((e) => e.status === 'POSTED');

export function aggregate(entries: ShiftEntry[]): Agg {
  const a = empty();
  for (const e of entries) {
    a.goodQty += e.goodQty;
    a.rejectQty += e.rejectQty;
    a.inputKg += e.inputKg;
    a.goodKg += e.goodKg;
    a.rejectKg += e.rejectKg;
    a.wasteKg += e.waste.reduce((s, w) => s + w.kg, 0);
    a.runMin += e.runMinutes;
    a.downMin += e.downtimeMinutes;
    a.shifts += 1;
  }
  return a;
}

export const yieldOf = (a: Agg) => (a.inputKg ? (a.goodKg / a.inputKg) * 100 : 0);
export const wasteOf = (a: Agg) => (a.inputKg ? (a.wasteKg / a.inputKg) * 100 : 0);
export const availabilityOf = (a: Agg) => (a.runMin + a.downMin ? (a.runMin / (a.runMin + a.downMin)) * 100 : 0);

export function inRange(entries: ShiftEntry[], from: string, to: string, stage?: StageCode) {
  return entries.filter((e) => e.date >= from && e.date <= to && (!stage || e.stage === stage));
}

export function byStage(entries: ShiftEntry[]): Map<StageCode, Agg> {
  const m = new Map<StageCode, Agg>();
  for (const s of STAGES) m.set(s.code, aggregate(entries.filter((e) => e.stage === s.code)));
  return m;
}

/** Daily series of a stage's good output for the last `days` days ending `to`. */
export function dailySeries(entries: ShiftEntry[], stage: StageCode, to: string, days: number) {
  const out: { date: string; actual: number; shifts: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(to, -i);
    const a = aggregate(entries.filter((e) => e.stage === stage && e.date === date));
    out.push({ date, actual: a.goodQty, shifts: a.shifts });
  }
  return out;
}

export function downtimeByReason(entries: ShiftEntry[]) {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.downtimeMinutes > 0) {
      const r = e.downtimeReason ?? 'Unspecified';
      m.set(r, (m.get(r) ?? 0) + e.downtimeMinutes);
    }
  }
  return [...m.entries()].map(([reason, minutes]) => ({ reason, hours: minutes / 60 })).sort((a, b) => b.hours - a.hours);
}
