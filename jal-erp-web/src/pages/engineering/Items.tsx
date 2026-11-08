import { useMemo, useState } from 'react';
import { useBom } from '../../store/BomStore';
import { useAuth } from '../../auth/AuthContext';
import { ITEMS, itemById } from '../../data/bom';
import { PRODUCTS, STAGES, stageByCode } from '../../data/masters';
import { fmtNum, uomLabel } from '../../lib/format';
import { Badge, Card, type Tone } from '../../components/ui';
import type { Bom, BomLine, ItemType } from '../../types';

const TYPE_LABEL: Record<ItemType, string> = { RAW: 'Raw material', SEMI: 'Semi-finished', FG: 'Finished', PACK: 'Packaging', CONSUMABLE: 'Consumable' };
const TYPE_TONE: Record<ItemType, Tone> = { RAW: 'warn', SEMI: 'info', FG: 'good', PACK: 'neutral', CONSUMABLE: 'neutral' };

interface TreeRow { depth: number; itemId: string; qtyPerUnit: number; stage?: string; scrapPct: number }

export default function Items() {
  const { boms, bomFor, stock } = useBom();
  const { can } = useAuth();
  const [type, setType] = useState<ItemType | ''>('');
  const [q, setQ] = useState('');
  const [treeProduct, setTreeProduct] = useState(PRODUCTS[0].id);
  const [editing, setEditing] = useState<Bom | null>(null);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ITEMS.filter((i) => (!type || i.type === type) && (!t || [i.id, i.name, i.spec].some((x) => x?.toLowerCase().includes(t))));
  }, [type, q]);

  /** Flatten the multi-level BOM of one pack of the product, with cumulative quantity per pack. */
  const tree = useMemo(() => {
    const rows: TreeRow[] = [];
    const walk = (itemId: string, qty: number, depth: number, scrapPct: number) => {
      const b = bomFor(itemId);
      rows.push({ depth, itemId, qtyPerUnit: qty, stage: b ? stageByCode(b.stage).name : undefined, scrapPct });
      if (!b || depth > 10) return;
      for (const l of b.lines) walk(l.itemId, qty * l.qty * (1 + l.scrapPct / 100), depth + 1, l.scrapPct);
    };
    walk(`PACK-${treeProduct}`, 1, 0, 0);
    return rows;
  }, [treeProduct, bomFor]);
  const product = PRODUCTS.find((p) => p.id === treeProduct)!;
  const rawKg = tree.filter((r) => r.itemId.startsWith('RJ-')).reduce((s, r) => s + r.qtyPerUnit, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Items &amp; bills of material</h1>
          <p>Item hierarchy and multi-level BOMs (SRS FR-PRD-001, FR-MFG-003). Quantities are planning estimates until confirmed by the mill.</p>
        </div>
      </div>

      <Card title="BOM explorer" sub="Everything that goes into one shipping pack of the selected product, with cumulative quantity" className="mb"
        actions={
          <select className="select" style={{ width: 320 }} value={treeProduct} onChange={(e) => setTreeProduct(e.target.value)} aria-label="Product">
            {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        }>
        <div className="metrics" style={{ marginBottom: 12 }}>
          <div className="metric"><div className="k">Per pack</div><div className="v">{fmtNum(product.unitsPerPack)} {uomLabel(product.baseUom)}</div></div>
          <div className="metric"><div className="k">Pack weight</div><div className="v">{fmtNum(product.unitsPerPack * product.kgPerBase)} kg</div></div>
          <div className="metric"><div className="k">Raw jute per pack</div><div className="v">{fmtNum(rawKg)} kg</div></div>
          <div className="metric"><div className="k">Raw jute per {uomLabel(product.baseUom).replace(/s$/, '')}</div><div className="v">{fmtNum((rawKg / product.unitsPerPack) * 1000)} g</div></div>
          <div className="metric"><div className="k">Overall yield</div><div className="v">{fmtNum(((product.unitsPerPack * product.kgPerBase) / rawKg) * 100, 1)}%</div></div>
          <div className="metric"><div className="k">BOM levels</div><div className="v">{Math.max(...tree.map((r) => r.depth))}</div></div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="table">
            <thead><tr><th>Item</th><th>Type</th><th>Made at</th><th className="num">Qty per pack</th><th className="num">Scrap %</th><th /></tr></thead>
            <tbody>
              {tree.map((r, i) => {
                const it = itemById(r.itemId);
                const b = bomFor(r.itemId);
                return (
                  <tr key={i}>
                    <td style={{ paddingLeft: 12 + r.depth * 18 }}>
                      <span className="muted small" style={{ marginRight: 6 }}>{r.depth ? '└' : ''}</span>
                      {it?.name ?? r.itemId} <span className="small muted">{it?.spec}</span>
                    </td>
                    <td>{it && <Badge tone={TYPE_TONE[it.type]}>{TYPE_LABEL[it.type]}</Badge>}</td>
                    <td className="small">{r.stage ?? <span className="muted">purchased</span>}</td>
                    <td className="num">{fmtNum(r.qtyPerUnit, r.qtyPerUnit < 10 ? 3 : 1)} {it ? uomLabel(it.uom) : ''}</td>
                    <td className="num">{r.depth ? `${r.scrapPct}%` : ''}</td>
                    <td>{b && can('production.order.create') && <button className="btn btn-sm" onClick={() => setEditing(b)}>Edit BOM</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ height: 16 }} />

      <Card title="Item master" sub={`${ITEMS.length} items · ${boms.length} BOMs`}
        actions={
          <div className="actions">
            <select className="select" value={type} onChange={(e) => setType(e.target.value as ItemType | '')} aria-label="Item type">
              <option value="">All types</option>
              {(Object.keys(TYPE_LABEL) as ItemType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <input className="input" style={{ width: 220 }} placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </div>
        }>
        <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>UOM</th><th className="num">kg / unit</th><th className="num">Stock</th><th>BOM</th></tr></thead>
            <tbody>
              {items.map((i) => {
                const b = bomFor(i.id);
                return (
                  <tr key={i.id}>
                    <td className="nowrap small">{i.id}</td>
                    <td>{i.name}<div className="small muted">{i.spec}</div></td>
                    <td><Badge tone={TYPE_TONE[i.type]}>{TYPE_LABEL[i.type]}</Badge></td>
                    <td>{uomLabel(i.uom)}</td>
                    <td className="num">{fmtNum(i.kgPerUnit, 3)}</td>
                    <td className="num">{stock[i.id] !== undefined ? fmtNum(stock[i.id]) : <span className="muted">—</span>}</td>
                    <td className="nowrap">
                      {b ? (
                        <>
                          <span className="small">{stageByCode(b.stage).name} · {b.lines.length} line{b.lines.length === 1 ? '' : 's'}</span>{' '}
                          {can('production.order.create') && <button className="btn btn-sm" onClick={() => setEditing(b)}>Edit</button>}
                        </>
                      ) : <span className="muted small">{i.type === 'RAW' || i.type === 'PACK' || i.type === 'CONSUMABLE' ? 'purchased' : '—'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <BomEditor bom={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BomEditor({ bom, onClose }: { bom: Bom; onClose: () => void }) {
  const { saveBom } = useBom();
  const [lines, setLines] = useState<BomLine[]>(bom.lines.map((l) => ({ ...l })));
  const [stage, setStage] = useState(bom.stage);
  const [note, setNote] = useState(bom.note ?? '');
  const [addId, setAddId] = useState('');
  const out = itemById(bom.outputItemId);
  const candidates = ITEMS.filter((i) => i.id !== bom.outputItemId && !i.id.startsWith('PACK-') && !lines.some((l) => l.itemId === i.id));
  const totalKg = lines.reduce((s, l) => s + l.qty * (1 + l.scrapPct / 100) * (itemById(l.itemId)?.kgPerUnit ?? 0), 0);

  const update = (i: number, patch: Partial<BomLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = lines.length > 0 && lines.every((l) => l.qty > 0 && l.scrapPct >= 0);

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <h3>BOM — {out?.name}</h3>
            <div className="sub">Inputs per 1 {out ? uomLabel(out.uom).replace(/s$/, '') : 'unit'} of output · output weight {out ? fmtNum(out.kgPerUnit, 3) : '—'} kg</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="card-body stack">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="b-stage">Produced at stage</label>
              <select id="b-stage" className="select" value={stage} onChange={(e) => setStage(e.target.value as Bom['stage'])}>
                {STAGES.map((s) => <option key={s.code} value={s.code}>{s.seq}. {s.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="b-note">Note</label>
              <input id="b-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Input item</th><th className="num" style={{ width: 130 }}>Net qty</th><th className="num" style={{ width: 110 }}>Scrap %</th><th className="num">Gross kg</th><th /></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const it = itemById(l.itemId);
                  return (
                    <tr key={l.itemId}>
                      <td>{it?.name ?? l.itemId}<div className="small muted">{it?.spec} · {it ? uomLabel(it.uom) : ''}</div></td>
                      <td className="num"><input className="input num" type="number" min={0} step="0.001" value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} aria-label={`Quantity of ${it?.name}`} /></td>
                      <td className="num"><input className="input num" type="number" min={0} step="0.1" value={l.scrapPct} onChange={(e) => update(i, { scrapPct: Number(e.target.value) })} aria-label={`Scrap % of ${it?.name}`} /></td>
                      <td className="num">{fmtNum(l.qty * (1 + l.scrapPct / 100) * (it?.kgPerUnit ?? 0), 3)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Total input weight</td><td className="num">{fmtNum(totalKg, 3)} kg</td><td /></tr>
              </tfoot>
            </table>
          </div>
          {out && totalKg < out.kgPerUnit && (
            <div className="alert alert-warn">Inputs weigh less than the output ({fmtNum(totalKg, 3)} kg vs {fmtNum(out.kgPerUnit, 3)} kg) — check quantities.</div>
          )}
          <div className="actions">
            <select className="select" style={{ maxWidth: 360 }} value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Add input item">
              <option value="">Add input item…</option>
              {candidates.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.name}</option>)}
            </select>
            <button className="btn" disabled={!addId} onClick={() => { setLines((ls) => [...ls, { itemId: addId, qty: 1, scrapPct: 0 }]); setAddId(''); }}>Add</button>
          </div>
          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid} onClick={() => { saveBom({ ...bom, stage, lines, note: note || undefined }); onClose(); }}>Save BOM</button>
          </div>
        </div>
      </div>
    </div>
  );
}
