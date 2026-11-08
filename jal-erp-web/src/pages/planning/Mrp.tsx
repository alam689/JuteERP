import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBom } from '../../store/BomStore';
import { useProduction } from '../../store/ProductionStore';
import { useAuth } from '../../auth/AuthContext';
import { ITEMS, itemById, workCenterById } from '../../data/bom';
import { PRODUCTS, productById, stageByCode } from '../../data/masters';
import { addDays, fmtDay, fmtNum, isoDate, uomLabel } from '../../lib/format';
import { runMrp, type MrpRequest, type MrpResult } from '../../lib/mrp';
import { Badge, Card, Metric } from '../../components/ui';

export default function Mrp() {
  const { boms, routingFor, stock, setStock, resetDefaults } = useBom();
  const { createOrders } = useProduction();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const today = isoDate(new Date());

  const [productId, setProductId] = useState('JAL-SB-001');
  const [qty, setQty] = useState('19500');
  const [shipBy, setShipBy] = useState(addDays(today, 21));
  const [contractRef, setContractRef] = useState('SC/JAL/2627/0023');
  const [customer, setCustomer] = useState('');
  const [result, setResult] = useState<{ req: MrpRequest; res: MrpResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [stockQ, setStockQ] = useState('');

  const product = productById(productId)!;

  const run = (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setCreated(null);
    const q = Number(qty);
    if (!(q > 0)) return setError('Enter a quantity greater than zero.');
    if (shipBy <= today) return setError('Ship-by date must be after today.');
    const routing = routingFor(productId);
    if (!routing) return setError('No routing for this product.');
    const req: MrpRequest = { productId, qty: q, shipBy, contractRef: contractRef.trim() || undefined, customer: customer.trim() || undefined };
    setResult({ req, res: runMrp(req, product, routing, boms, stock, (id) => itemById(id)?.uom ?? 'KG') });
  };

  const toCreate = result?.res.orders.filter((o) => o.netQty > 0) ?? [];
  const create = () => {
    if (!result) return;
    const orders = createOrders(
      toCreate.map((o) => ({
        productId: result.req.productId, stage: o.stage, plannedQty: o.netQty, plannedStart: o.start, plannedEnd: o.end,
        contractRef: result.req.contractRef, customer: result.req.customer,
        remarks: `MRP: ${itemById(o.itemId)?.name ?? o.itemId} at ${workCenterById(o.workCenterId)?.name ?? o.workCenterId}`, release: false,
      })),
      user!.name,
    );
    setCreated(orders.length);
  };

  const stockRows = useMemo(() => {
    const t = stockQ.trim().toLowerCase();
    return ITEMS.filter((i) => !i.id.startsWith('PACK-') || stock[i.id] !== undefined)
      .filter((i) => i.type !== 'FG' || stock[i.id] !== undefined)
      .filter((i) => !t || [i.id, i.name].some((x) => x.toLowerCase().includes(t)));
  }, [stockQ, stock]);

  const late = result && result.res.orders.length ? result.res.orders[0].start < today : false;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>MRP — explode a contract</h1>
          <p>Turns a sales-contract line into stage-wise production orders and purchase requisitions, netted against stock (SRS FR-MFG-010/011).</p>
        </div>
      </div>

      <form className="card" style={{ marginBottom: 16 }} onSubmit={run} noValidate>
        <div className="card-body form-grid" style={{ alignItems: 'end' }}>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="m-product">Product</label>
            <select id="m-product" className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-qty">Quantity ({uomLabel(product.baseUom)})</label>
            <input id="m-qty" className="input num" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <span className="hint">{product.unitsPerPack} per {product.packUom.toLowerCase()}{product.packsPerCtr20 ? ` · ${product.packsPerCtr20 * product.unitsPerPack} per 20′ FCL` : ''}</span>
          </div>
          <div className="field">
            <label htmlFor="m-ship">Ship by</label>
            <input id="m-ship" className="input" type="date" value={shipBy} min={addDays(today, 1)} onChange={(e) => setShipBy(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="m-contract">Sales contract</label>
            <input id="m-contract" className="input" value={contractRef} onChange={(e) => setContractRef(e.target.value)} placeholder="Blank = make-to-stock" />
          </div>
          <div className="field">
            <label htmlFor="m-cust">Customer</label>
            <input id="m-cust" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Run MRP</button>
        </div>
        {error && <div className="card-body" style={{ paddingTop: 0 }}><div className="alert alert-bad" role="alert">{error}</div></div>}
      </form>

      {result && (
        <>
          <div className="metrics" style={{ marginBottom: 16 }}>
            <Metric k="Packs to ship" v={`${fmtNum(result.res.packs)} ${uomLabel(product.packUom)}`} />
            <Metric k="Stage orders" v={`${toCreate.length} of ${result.res.orders.length}`} />
            <Metric k="Covered by stock" v={result.res.orders.length - toCreate.length} tone="good" />
            <Metric k="Raw jute required" v={`${fmtNum(result.res.rawJuteKg / 1000, 1)} t`} />
            <Metric k="Purchase lines" v={result.res.purchases.filter((p) => p.netQty > 0).length} tone={result.res.purchases.some((p) => p.netQty > 0) ? 'warn' : 'good'} />
            <Metric k="Must start by" v={result.res.orders.length ? fmtDay(result.res.orders[0].start) : '—'} tone={late ? 'bad' : undefined} />
          </div>
          {late && <div className="alert alert-bad" style={{ marginBottom: 12 }}>Backward scheduling from the ship-by date starts in the past — the lead time does not fit. Move the ship-by date or use stock.</div>}
          {result.res.warnings.map((w) => <div key={w} className="alert alert-warn" style={{ marginBottom: 12 }}>{w}</div>)}

          <div className="grid two-col" style={{ marginBottom: 16 }}>
            <Card title="Suggested production orders" sub="Upstream first · gross demand, netted against stock on hand"
              actions={
                can('production.order.create') && toCreate.length > 0 && created === null ? (
                  <button className="btn btn-primary" onClick={create}>Create {toCreate.length} planned orders</button>
                ) : created !== null ? (
                  <button className="btn" onClick={() => navigate('/production/orders')}>View {created} created orders</button>
                ) : null
              }>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>#</th><th>Stage · work centre</th><th>Item</th><th className="num">Gross</th><th className="num">From stock</th><th className="num">To produce</th><th>Dates</th></tr></thead>
                  <tbody>
                    {result.res.orders.map((o) => {
                      const it = itemById(o.itemId);
                      return (
                        <tr key={o.seq} style={o.netQty === 0 ? { opacity: 0.55 } : undefined}>
                          <td>{o.seq}</td>
                          <td className="nowrap">{stageByCode(o.stage).name}<div className="small muted">{workCenterById(o.workCenterId)?.name}</div></td>
                          <td>{it?.name}{o.passThrough && <> <Badge tone="neutral">pass-through</Badge></>}{o.qcPoint && <> <Badge tone="info">QC</Badge></>}</td>
                          <td className="num">{fmtNum(o.grossQty, 0)}</td>
                          <td className="num">{o.stockUsed ? fmtNum(o.stockUsed, 0) : '—'}</td>
                          <td className="num"><b>{o.netQty ? `${fmtNum(o.netQty, 0)} ${uomLabel(o.uom)}` : 'covered'}</b></td>
                          <td className="nowrap small">{fmtDay(o.start)} → {fmtDay(o.end)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Purchase requisitions" sub="Materials no operation produces">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th className="num">Required</th><th className="num">Stock</th><th className="num">To buy</th></tr></thead>
                  <tbody>
                    {result.res.purchases.map((p) => {
                      const it = itemById(p.itemId);
                      return (
                        <tr key={p.itemId}>
                          <td>{it?.name ?? p.itemId}<div className="small muted">{it?.spec}</div></td>
                          <td className="num">{fmtNum(p.grossQty, 0)} {uomLabel(p.uom)}</td>
                          <td className="num">{fmtNum(p.stock, 0)}</td>
                          <td className="num">{p.netQty > 0 ? <b style={{ color: 'var(--warning)' }}>{fmtNum(p.netQty, 0)}</b> : <Badge tone="good">in stock</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="note">Raw jute is shown by grade per the batch recipe; in the full ERP these become purchase requisitions for the raw jute buyer (FR-PRC-012).</p>
            </Card>
          </div>
        </>
      )}

      <Card title="Stock on hand" sub="Intermediates and materials MRP nets against · illustrative, editable"
        actions={
          <div className="actions">
            <input className="input" style={{ width: 200 }} placeholder="Filter…" value={stockQ} onChange={(e) => setStockQ(e.target.value)} aria-label="Filter stock" />
            {can('production.order.create') && <button className="btn btn-sm" onClick={resetDefaults}>Reset BOMs, routings &amp; stock</button>}
          </div>
        }>
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="table">
            <thead><tr><th>Item</th><th>Type</th><th className="num" style={{ width: 160 }}>On hand</th></tr></thead>
            <tbody>
              {stockRows.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}<div className="small muted">{i.id} · {i.spec}</div></td>
                  <td className="small">{i.type}</td>
                  <td className="num">
                    {can('production.order.create') ? (
                      <input className="input num" type="number" min={0} value={stock[i.id] ?? 0} onChange={(e) => setStock(i.id, Number(e.target.value))} aria-label={`Stock of ${i.name}`} style={{ textAlign: 'right' }} />
                    ) : fmtNum(stock[i.id] ?? 0)}
                    <span className="small muted"> {uomLabel(i.uom)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
