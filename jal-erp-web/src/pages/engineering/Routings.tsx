import { useEffect, useState } from 'react';
import { useBom } from '../../store/BomStore';
import { useAuth } from '../../auth/AuthContext';
import { itemById, workCenterById, workCentersForStage } from '../../data/bom';
import { PRODUCTS, ROUTE_LABEL, stageByCode } from '../../data/masters';
import { uomLabel } from '../../lib/format';
import { Badge, Card } from '../../components/ui';
import type { RoutingOp } from '../../types';

export default function Routings() {
  const { routings, routingFor, saveRouting, bomFor } = useBom();
  const { can } = useAuth();
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const routing = routingFor(productId);
  const [ops, setOps] = useState<RoutingOp[]>(routing?.ops ?? []);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setOps(routing?.ops ?? []); setSaved(false); }, [routing]);

  const product = PRODUCTS.find((p) => p.id === productId)!;
  const dirty = JSON.stringify(ops) !== JSON.stringify(routing?.ops ?? []);
  const update = (i: number, patch: Partial<RoutingOp>) => setOps((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const totalDays = ops.reduce((s, o) => s + o.days, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Routings</h1>
          <p>Operation sequence per product with the work centre at each stage (SRS FR-MFG-004). Winding and weaving differ by product family.</p>
        </div>
      </div>

      <div className="grid two-col">
        <Card title={product.name} sub={`${ROUTE_LABEL[product.route]} route · ${ops.length} operations · ${totalDays} planning days end-to-end`}
          actions={
            <select className="select" style={{ width: 300 }} value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Product">
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          }>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Stage</th><th>Work centre</th><th>Produces</th><th>BOM</th><th className="num" style={{ width: 80 }}>Days</th><th>QC</th></tr></thead>
              <tbody>
                {ops.map((o, i) => {
                  const it = itemById(o.outputItemId);
                  const b = bomFor(o.outputItemId);
                  const wcs = workCentersForStage(o.stage);
                  return (
                    <tr key={i}>
                      <td>{o.seq}</td>
                      <td className="nowrap">{stageByCode(o.stage).seq}. {stageByCode(o.stage).name}</td>
                      <td>
                        {can('production.order.create') && wcs.length > 1 ? (
                          <select className="select" value={o.workCenterId} onChange={(e) => update(i, { workCenterId: e.target.value })} aria-label={`Work centre for ${o.stage}`}>
                            {wcs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        ) : workCenterById(o.workCenterId)?.name}
                      </td>
                      <td>{it?.name ?? o.outputItemId}<div className="small muted">{it?.spec}{it ? ` · ${uomLabel(it.uom)}` : ''}</div></td>
                      <td>{o.passThrough ? <Badge tone="neutral">pass-through {o.lossPct ? `−${o.lossPct}%` : ''}</Badge> : b ? <Badge tone="good">{b.lines.length} inputs</Badge> : <Badge tone="bad">missing</Badge>}</td>
                      <td className="num">
                        {can('production.order.create') ? <input className="input num" type="number" min={0} step={1} value={o.days} onChange={(e) => update(i, { days: Number(e.target.value) })} aria-label="Days" /> : o.days}
                      </td>
                      <td>
                        <input type="checkbox" checked={o.qcPoint} disabled={!can('production.order.create')} onChange={(e) => update(i, { qcPoint: e.target.checked })} aria-label="QC point" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {can('production.order.create') && (
            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              {saved && !dirty && <span className="small" style={{ color: 'var(--success)' }}>Saved.</span>}
              <button className="btn" disabled={!dirty} onClick={() => setOps(routing?.ops ?? [])}>Discard</button>
              <button className="btn btn-primary" disabled={!dirty} onClick={() => { saveRouting({ productId, ops }); setSaved(true); }}>Save routing</button>
            </div>
          )}
        </Card>

        <Card title="All products" sub="Operations and lead time by route">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th>Route</th><th className="num">Ops</th><th className="num">Days</th></tr></thead>
              <tbody>
                {routings.map((r) => {
                  const p = PRODUCTS.find((x) => x.id === r.productId)!;
                  return (
                    <tr key={r.productId} className="clickable" onClick={() => setProductId(r.productId)} style={r.productId === productId ? { background: 'var(--primary-soft)' } : undefined}>
                      <td>{p.name}</td>
                      <td className="small">{ROUTE_LABEL[p.route]}</td>
                      <td className="num">{r.ops.length}</td>
                      <td className="num">{r.ops.reduce((s, o) => s + o.days, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
