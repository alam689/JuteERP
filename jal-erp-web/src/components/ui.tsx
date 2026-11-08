import type { ReactNode } from 'react';
import type { OrderStatus } from '../types';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'primary' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''}`}>{children}</span>;
}

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PLANNED: 'neutral', RELEASED: 'info', IN_PROGRESS: 'primary', COMPLETED: 'good', CLOSED: 'neutral', CANCELLED: 'bad',
};
const ORDER_LABEL: Record<OrderStatus, string> = {
  PLANNED: 'Planned', RELEASED: 'Released', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CLOSED: 'Closed', CANCELLED: 'Cancelled',
};
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_TONE[status]}>{ORDER_LABEL[status]}</Badge>;
export const orderStatusLabel = (s: OrderStatus) => ORDER_LABEL[s];

/** Tone for an attainment % against target (≥ 98 good, ≥ 90 warn). */
export const attainTone = (pct: number): Tone => (pct >= 98 ? 'good' : pct >= 90 ? 'warn' : 'bad');

export function Progress({ pct, tone }: { pct: number; tone?: Tone }) {
  return (
    <div className={`progress ${tone === 'warn' || tone === 'bad' ? tone : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function KpiCard({ label, value, unit, sub, tone = 'neutral' }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className={`card kpi ${tone}`}>
      <div className="label">{label}</div>
      <div className="value num">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = '' }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Metric({ k, v, tone }: { k: string; v: ReactNode; tone?: Tone }) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
