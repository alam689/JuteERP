import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProduction } from '../../store/ProductionStore';
import { useAuth } from '../../auth/AuthContext';
import { ROUTE_LABEL, ROUTES, STAGES, productById, productsForStage, stageByCode, stageUoms } from '../../data/masters';
import { addDays, fmtDay, fmtNum, isoDate, uomLabel } from '../../lib/format';
import { packing } from '../../lib/calc';
import { OrderBadge, Progress, orderStatusLabel } from '../../components/ui';
import { IconPlus } from '../../components/Icons';
import type { OrderStatus, StageCode } from '../../types';

const STATUSES: OrderStatus[] = ['PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'];

export default function Orders() {
  const { orders, entries } = useProduction();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stage = (params.get('stage') ?? '') as StageCode | '';
  const status = (params.get('status') ?? 'OPEN') as OrderStatus | 'OPEN' | 'ALL';
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const produced = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.status === 'POSTED') m.set(e.orderId, (m.get(e.orderId) ?? 0) + e.goodQty);
    return m;
  }, [entries]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders
      .filter((o) => !stage || o.stage === stage)
      .filter((o) =>
        status === 'ALL' ? true : status === 'OPEN' ? !['CLOSED', 'CANCELLED'].includes(o.status) : o.status === status,
      )
      .filter((o) => {
        if (!term) return true;
        const p = productById(o.productId);
        return [o.docNo, p?.name, p?.code, o.contractRef, o.customer].some((x) => x?.toLowerCase().includes(term));
      })
      .sort((a, b) => stageByCode(a.stage).seq - stageByCode(b.stage).seq || a.plannedStart.localeCompare(b.plannedStart));
  }, [orders, stage, status, q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Production orders</h1>
          <p>Stage-wise orders. Each stage produces a stockable semi-finished lot (SRS FR-MFG-020).</p>
        </div>
        {can('production.order.create') && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus width={16} /> New order</button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body form-grid" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="f-stage">Stage</label>
            <select id="f-stage" className="select" value={stage} onChange={(e) => setFilter('stage', e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s.code} value={s.code}>{s.seq}. {s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" className="select" value={status} onChange={(e) => setFilter('status', e.target.value === 'OPEN' ? '' : e.target.value)}>
              <option value="OPEN">Open (not closed/cancelled)</option>
              <option value="ALL">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-q">Search</label>
            <input id="f-q" className="input" placeholder="Order no., product, contract…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="small muted">{rows.length} order{rows.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order no.</th><th>Stage</th><th>Product</th><th>Contract / customer</th>
                <th className="num">Planned</th><th style={{ minWidth: 140 }}>Produced</th><th>Dates</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const s = stageByCode(o.stage);
                const p = productById(o.productId);
                const done = produced.get(o.id) ?? 0;
                const pct = o.plannedQty ? (done / o.plannedQty) * 100 : 0;
                return (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/production/orders/${o.id}`)}>
                    <td className="nowrap"><a href={`/production/orders/${o.id}`} onClick={(e) => e.preventDefault()}>{o.docNo}</a></td>
                    <td className="nowrap">{s.seq}. {s.name}</td>
                    <td>{p?.name}<div className="small muted">{p?.code}</div></td>
                    <td>{o.contractRef ?? <span className="muted">Make-to-stock</span>}<div className="small muted">{o.customer ?? o.remarks}</div></td>
                    <td className="num nowrap">{fmtNum(o.plannedQty)} {uomLabel(stageUoms(s, p).outputUom)}</td>
                    <td><Progress pct={pct} /><span className="small muted">{fmtNum(done)} · {fmtNum(pct, 0)}%</span></td>
                    <td className="nowrap small">{fmtDay(o.plannedStart)} → {fmtDay(o.plannedEnd)}</td>
                    <td><OrderBadge status={o.status} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state">No orders match these filters.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <NewOrderModal defaultStage={stage || 'SEWING'} onClose={() => setCreating(false)} />}
    </>
  );
}

function NewOrderModal({ defaultStage, onClose }: { defaultStage: StageCode; onClose: () => void }) {
  const { createOrder } = useProduction();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const today = isoDate(new Date());
  const [stage, setStage] = useState<StageCode>(defaultStage);
  const products = productsForStage(stage);
  const [productId, setProductId] = useState(products[0].id);
  const [qty, setQty] = useState('');
  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 3));
  const [mto, setMto] = useState(true);
  const [contractRef, setContractRef] = useState('');
  const [customer, setCustomer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [release, setRelease] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = stageByCode(stage);
  const product = productById(productId);
  const qtyNum = Number(qty);
  const { outputUom } = stageUoms(s, product);
  const pack = product && outputUom === product.baseUom && qtyNum > 0 ? packing(qtyNum, product) : null;
  const routeStages = product ? ROUTES[product.route].map(stageByCode) : [];

  const onStage = (v: StageCode) => {
    setStage(v);
    const list = productsForStage(v);
    if (!list.some((p) => p.id === productId)) setProductId(list[0].id);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(qtyNum > 0)) return setError('Enter a planned quantity greater than zero.');
    if (end < start) return setError('Planned end date cannot be before the start date.');
    if (mto && !contractRef.trim()) return setError('Enter the sales contract number, or choose make-to-stock.');
    const order = createOrder(
      {
        productId, stage, plannedQty: qtyNum, plannedStart: start, plannedEnd: end,
        contractRef: mto ? contractRef.trim() : undefined, customer: mto ? customer.trim() || undefined : undefined,
        remarks: remarks.trim() || undefined, release,
      },
      user!.name,
    );
    navigate(`/production/orders/${order.id}`);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="new-order-title" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="card-head">
          <h3 id="new-order-title">New production order</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="card-body stack">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="o-stage">Stage / work centre</label>
              <select id="o-stage" className="select" value={stage} onChange={(e) => onStage(e.target.value as StageCode)}>
                {STAGES.map((x) => <option key={x.code} value={x.code}>{x.seq}. {x.name}{x.optionalFor ? ` (${x.optionalFor.toLowerCase()})` : ''}</option>)}
              </select>
              <span className="hint">{s.workCenter} · {products.length} product{products.length === 1 ? '' : 's'} use this stage</span>
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="o-product">Product</label>
              <select id="o-product" className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
              {product && (
                <span className="hint">
                  Route: {ROUTE_LABEL[product.route]} — {routeStages.map((x) => x.seq).join(' → ')}
                  {product.assumptions && <> · <span style={{ color: 'var(--warning)' }}>{product.assumptions}</span></>}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="o-qty">Planned quantity ({uomLabel(outputUom)})</label>
              <input id="o-qty" className="input" type="number" min={1} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              <span className="hint">Daily capacity ≈ {fmtNum(s.dailyTarget)}</span>
            </div>
            <div className="field">
              <label htmlFor="o-start">Planned start</label>
              <input id="o-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="o-end">Planned end</label>
              <input id="o-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {pack && product && (
            <div className="alert alert-info">
              Packing: {fmtNum(pack.packs)} {uomLabel(pack.packUom)} of {fmtNum(product.unitsPerPack)} {uomLabel(product.baseUom)}
              {pack.partialUnits ? ` (last one ${fmtNum(pack.partialUnits)} — partial)` : ''}
              {pack.fullContainers !== undefined && (
                <> · {pack.fullContainers} full 20′ container{pack.fullContainers === 1 ? '' : 's'}{pack.partialContainerPacks ? ` + ${pack.partialContainerPacks} ${uomLabel(pack.packUom)}` : ''}</>
              )}
              {' '}· net {fmtNum(pack.netKg)} kg
            </div>
          )}

          <div className="segmented" role="group" aria-label="Order type" style={{ alignSelf: 'start' }}>
            <button type="button" className={mto ? 'on' : ''} onClick={() => setMto(true)}>Make-to-order</button>
            <button type="button" className={!mto ? 'on' : ''} onClick={() => setMto(false)}>Make-to-stock</button>
          </div>
          {mto && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="o-contract">Sales contract no.</label>
                <input id="o-contract" className="input" placeholder="SC/JAL/2627/0000" value={contractRef} onChange={(e) => setContractRef(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="o-customer">Customer</label>
                <input id="o-customer" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="o-remarks">Remarks</label>
            <textarea id="o-remarks" className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          {can('production.order.release') && (
            <label className="check"><input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} /> Release to the floor immediately</label>
          )}
          {error && <div className="alert alert-bad" role="alert">{error}</div>}
          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create order</button>
          </div>
        </div>
      </form>
    </div>
  );
}
