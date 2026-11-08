import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ORDER_ACTIONS, useProduction, type OrderAction } from '../../store/ProductionStore';
import { useAuth } from '../../auth/AuthContext';
import { ROUTE_LABEL, ROUTES, machinesForStage, productById, stageByCode, stageUoms } from '../../data/masters';
import { fmtDate, fmtDateTime, fmtDay, fmtNum, fmtPct, uomLabel } from '../../lib/format';
import { aggregate, availabilityOf, wasteOf, yieldOf } from '../../lib/metrics';
import { packing } from '../../lib/calc';
import { Badge, Card, Metric, OrderBadge, Progress } from '../../components/ui';
import type { Permission } from '../../types';

const ACTION_PERM: Record<OrderAction, Permission> = {
  release: 'production.order.release', start: 'production.order.release', complete: 'production.order.close',
  close: 'production.order.close', cancel: 'production.order.release',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { orders, entries, transitionOrder, deleteDraft } = useProduction();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const order = orders.find((o) => o.id === id);
  const orderEntries = useMemo(
    () => entries.filter((e) => e.orderId === id).sort((a, b) => (b.date + b.shift).localeCompare(a.date + a.shift)),
    [entries, id],
  );

  if (!order) {
    return (
      <div className="empty-state">
        <h2>Order not found</h2>
        <p><Link to="/production/orders">Back to production orders</Link></p>
      </div>
    );
  }

  const stage = stageByCode(order.stage);
  const product = productById(order.productId);
  const { inputUom, outputUom } = stageUoms(stage, product);
  const postedEntries = orderEntries.filter((e) => e.status === 'POSTED');
  const a = aggregate(postedEntries);
  const pct = (a.goodQty / order.plannedQty) * 100;
  const drafts = orderEntries.length - postedEntries.length;
  const pack = product && outputUom === product.baseUom ? packing(order.plannedQty, product) : null;
  const routeSeq = product ? ROUTES[product.route].map((c) => stageByCode(c).seq) : [];
  const machineName = (mid?: string) => machinesForStage(order.stage).find((m) => m.id === mid)?.code ?? 'Line total';

  const act = (action: OrderAction) => {
    const r = transitionOrder(order.id, action, user!.name);
    setMsg(r.ok ? { tone: 'good', text: `Order ${ORDER_ACTIONS[action].past.toLowerCase()}.` } : { tone: 'bad', text: r.error });
  };

  const available = (Object.keys(ORDER_ACTIONS) as OrderAction[]).filter(
    (k) => (ORDER_ACTIONS[k].from as string[]).includes(order.status) && can(ACTION_PERM[k]),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link to="/production/orders">← Production orders</Link></div>
          <h1 style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {order.docNo} <OrderBadge status={order.status} />
          </h1>
          <p>{stage.seq}. {stage.name} · {stage.workCenter} · {product?.name}</p>
        </div>
        <div className="actions">
          {can('production.entry.create') && ['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
            <button className="btn btn-primary" onClick={() => navigate(`/production/shift-entry?order=${order.id}`)}>Add shift entry</button>
          )}
          {available.map((k) => (
            <button key={k} className={`btn ${k === 'cancel' ? 'btn-danger' : ''}`} onClick={() => act(k)}>{ORDER_ACTIONS[k].label}</button>
          ))}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.tone}`} role="status" style={{ marginBottom: 16 }}>{msg.text}</div>}

      <div className="metrics" style={{ marginBottom: 16 }}>
        <Metric k="Planned" v={`${fmtNum(order.plannedQty)} ${uomLabel(outputUom)}`} />
        <Metric k="Produced (good)" v={fmtNum(a.goodQty)} />
        <Metric k="Completion" v={fmtPct(pct)} tone={pct >= 100 ? 'good' : undefined} />
        <Metric k="Yield" v={a.shifts ? fmtPct(yieldOf(a)) : '—'} />
        <Metric k="Wastage" v={a.shifts ? fmtPct(wasteOf(a), 2) : '—'} tone={wasteOf(a) > stage.wasteAlertPct ? 'bad' : undefined} />
        <Metric k="Availability" v={a.shifts ? fmtPct(availabilityOf(a)) : '—'} />
        <Metric k="Shift entries" v={`${postedEntries.length}${drafts ? ` + ${drafts} draft` : ''}`} tone={drafts ? 'warn' : undefined} />
      </div>

      <div className="grid two-col" style={{ marginBottom: 16 }}>
        <Card title="Order details">
          <div className="form-grid">
            <Detail k="Product">{product?.code} — {product?.name}</Detail>
            <Detail k="Stage output">{stage.outputItem}</Detail>
            <Detail k="Order type">{order.contractRef ? 'Make-to-order' : 'Make-to-stock'}</Detail>
            <Detail k="Sales contract">{order.contractRef ?? '—'}</Detail>
            <Detail k="Customer">{order.customer ?? '—'}</Detail>
            <Detail k="Planned dates">{fmtDate(order.plannedStart)} → {fmtDate(order.plannedEnd)}</Detail>
            <Detail k="Created">{fmtDateTime(order.createdAt)} by {order.createdBy}</Detail>
            {product && (
              <Detail k="Route">
                {ROUTE_LABEL[product.route]} · stages {routeSeq.join(' → ')}
              </Detail>
            )}
          </div>
          {product && (
            <div style={{ marginTop: 14 }}>
              <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                Specification {product.specConfirmed ? <Badge tone="good">from customer list</Badge> : <Badge tone="warn">partly assumed</Badge>}
              </div>
              <div className="form-grid" style={{ gap: 8 }}>
                {Object.entries({ Size: product.spec.size, Weight: product.spec.weight, 'Porter × shots': product.spec.porterShots, Count: product.spec.count, Stripes: product.spec.stripes, Stitching: product.spec.stitching, Packing: product.spec.packing, Other: product.spec.other })
                  .filter(([, v]) => v)
                  .map(([k, v]) => <div key={k} className="small"><span className="muted">{k}: </span>{v}</div>)}
              </div>
              {product.assumptions && <div className="small" style={{ color: 'var(--warning)', marginTop: 6 }}>{product.assumptions}</div>}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Progress pct={pct} tone={pct > 100 ? 'warn' : undefined} />
            <div className="small muted" style={{ marginTop: 4 }}>
              {fmtNum(a.goodQty)} of {fmtNum(order.plannedQty)} {uomLabel(outputUom)} · remaining {fmtNum(Math.max(0, order.plannedQty - a.goodQty))}
            </div>
          </div>
          {pack && product && (
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              Packing plan: {fmtNum(pack.packs)} {uomLabel(pack.packUom)} of {fmtNum(product.unitsPerPack)} {uomLabel(product.baseUom)}
              {pack.fullContainers !== undefined && <> · {pack.fullContainers} full 20′ FCL{pack.partialContainerPacks ? ` + ${pack.partialContainerPacks} ${uomLabel(pack.packUom)}` : ''}</>}
              {' '}· net {fmtNum(pack.netKg)} kg
            </div>
          )}
          {order.remarks && <p className="small" style={{ marginBottom: 0 }}><b>Remarks:</b> {order.remarks}</p>}
        </Card>

        <Card title="History">
          <ul className="timeline">
            {[...order.history].reverse().map((h, i) => (
              <li key={i}><div><b>{h.action}</b><div className="small muted">{fmtDateTime(h.at)} · {h.by}</div></div></li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Shift entries" sub="Newest first. Drafts can be edited until posted.">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Entry no.</th><th>Date</th><th>Shift</th><th>Machine</th>
                <th className="num">Input ({uomLabel(inputUom)})</th><th className="num">Good ({uomLabel(outputUom)})</th>
                {stage.hasRejects && <th className="num">Rejects</th>}
                <th className="num">Waste kg</th><th className="num">Yield</th><th className="num">Downtime</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {orderEntries.slice(0, 60).map((e) => {
                const w = e.waste.reduce((s, x) => s + x.kg, 0);
                return (
                  <tr key={e.id}>
                    <td className="nowrap small">{e.docNo}</td>
                    <td className="nowrap">{fmtDay(e.date)}</td>
                    <td>{e.shift}</td>
                    <td className="small">{machineName(e.machineId)}</td>
                    <td className="num">{fmtNum(e.inputQty)}</td>
                    <td className="num">{fmtNum(e.goodQty)}</td>
                    {stage.hasRejects && <td className="num">{fmtNum(e.rejectQty)}</td>}
                    <td className="num">{fmtNum(w, 1)}</td>
                    <td className="num">{e.inputKg ? fmtPct((e.goodKg / e.inputKg) * 100) : '—'}</td>
                    <td className="num nowrap">{e.downtimeMinutes ? `${e.downtimeMinutes} min` : '—'}{e.downtimeReason && e.downtimeMinutes ? <div className="small muted">{e.downtimeReason}</div> : null}</td>
                    <td>{e.status === 'POSTED' ? <Badge tone="good">Posted</Badge> : <Badge tone="warn">Draft</Badge>}</td>
                    <td className="nowrap">
                      {e.status === 'DRAFT' && can('production.entry.create') && (
                        <>
                          <button className="btn btn-sm" onClick={() => navigate(`/production/shift-entry?entry=${e.id}`)}>Edit</button>{' '}
                          <button className="btn btn-sm btn-danger" onClick={() => deleteDraft(e.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orderEntries.length === 0 && (
                <tr><td colSpan={12}><div className="empty-state">No shift entries yet.</div></td></tr>
              )}
            </tbody>
            {postedEntries.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total posted</td>
                  <td className="num">{fmtNum(postedEntries.reduce((s, e) => s + e.inputQty, 0))}</td>
                  <td className="num">{fmtNum(a.goodQty)}</td>
                  {stage.hasRejects && <td className="num">{fmtNum(a.rejectQty)}</td>}
                  <td className="num">{fmtNum(a.wasteKg)}</td>
                  <td className="num">{fmtPct(yieldOf(a))}</td>
                  <td className="num">{fmtNum(a.downMin / 60, 1)} h</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {orderEntries.length > 60 && <p className="note">Showing the latest 60 of {orderEntries.length} entries.</p>}
      </Card>
    </>
  );
}

function Detail({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="small muted" style={{ fontWeight: 600 }}>{k}</span>
      <div>{children}</div>
    </div>
  );
}
