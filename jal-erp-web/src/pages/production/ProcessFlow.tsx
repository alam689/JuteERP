import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProduction } from '../../store/ProductionStore';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCTS, ROUTES, ROUTE_LABEL, ROUTE_ORDER, STAGES, machineStatuses } from '../../data/masters';
import { addDays, currentShift, fmtDate, fmtNum, fmtPct, isoDate, uomLabel } from '../../lib/format';
import { aggregate, inRange, posted, wasteOf, yieldOf } from '../../lib/metrics';
import { Badge, Card, Metric, Progress, attainTone } from '../../components/ui';

export default function ProcessFlow() {
  const { entries, orders } = useProduction();
  const { can } = useAuth();
  const navigate = useNavigate();
  const today = isoDate(new Date());
  const [date, setDate] = useState(addDays(today, -1));
  const live = currentShift();

  const rows = useMemo(() => {
    const p = posted(entries);
    const machines = machineStatuses(live.date, live.shift);
    return STAGES.map((s) => {
      const a = aggregate(inRange(p, date, date, s.code));
      const m = machines.filter((x) => x.machine.stage === s.code);
      return {
        stage: s,
        agg: a,
        attain: (a.goodQty / s.dailyTarget) * 100,
        yieldPct: yieldOf(a),
        wastePct: wasteOf(a),
        running: m.filter((x) => x.state === 'RUNNING').length,
        machines: m.length,
        activeOrders: orders.filter((o) => o.stage === s.code && (o.status === 'IN_PROGRESS' || o.status === 'RELEASED')).length,
      };
    });
  }, [entries, orders, date, live.date, live.shift]);

  // Overall weight yield from raw jute in to finished bags out.
  const rawIn = rows[0].agg.inputKg;
  const fgKg = rows.find((r) => r.stage.code === 'INSPECTION')!.agg.goodKg;
  const chainYield = rawIn ? (fgKg / rawIn) * 100 : 0;
  const totalWaste = rows.reduce((s, r) => s + r.agg.wasteKg, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Production process</h1>
          <p>Twelve stages from raw jute to finished goods (SRS §1.5); each product uses the subset shown under "Product routes". Select a stage to see its orders.</p>
        </div>
        <div className="actions">
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <label htmlFor="flow-date" style={{ margin: 0 }}>Production date</label>
            <input id="flow-date" type="date" className="input" style={{ width: 160 }} value={date} max={today} onChange={(e) => setDate(e.target.value || date)} />
          </div>
          {can('production.entry.create') && <Link className="btn btn-primary" to="/production/shift-entry">New shift entry</Link>}
        </div>
      </div>

      <div className="metrics" style={{ marginBottom: 16 }}>
        <Metric k="Raw jute batched" v={`${fmtNum(rawIn / 1000, 1)} t`} />
        <Metric k="Bags passed QC" v={fmtNum(rows.find((r) => r.stage.code === 'INSPECTION')!.agg.goodQty)} />
        <Metric k="Bales packed" v={fmtNum(rows.find((r) => r.stage.code === 'PACKING')!.agg.goodQty)} />
        <Metric k="Raw → bag yield" v={fmtPct(chainYield)} tone={chainYield >= 85 ? 'good' : chainYield >= 80 ? 'warn' : 'bad'} />
        <Metric k="Recorded waste" v={`${fmtNum(totalWaste / 1000, 2)} t`} />
        <Metric k="Machines running now" v={`${rows.reduce((s, r) => s + r.running, 0)} / ${rows.reduce((s, r) => s + r.machines, 0)}`} />
      </div>

      <div className="flow" style={{ marginBottom: 16 }}>
        {rows.map((r, i) => {
          const tone = r.agg.shifts ? attainTone(r.attain) : 'neutral';
          return (
            <button key={r.stage.code} className="card stage-card" onClick={() => navigate(`/production/orders?stage=${r.stage.code}`)}
              aria-label={`${r.stage.name}: view orders`}>
              {i < rows.length - 1 && <span className="arrow" aria-hidden>➜</span>}
              <div className="top">
                <span className="seq" style={r.stage.optionalFor ? { background: 'var(--accent)' } : undefined}>{r.stage.seq}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{r.stage.name}</div>
                  <div className="act">{r.stage.optionalFor ?? r.stage.activities}</div>
                </div>
              </div>
              <div>
                <div className="row" style={{ marginBottom: 4 }}>
                  <span className="muted">{r.stage.outputItem}</span>
                  <b>{fmtNum(r.agg.goodQty)} / {fmtNum(r.stage.dailyTarget)} {uomLabel(r.stage.outputUom)}</b>
                </div>
                <Progress pct={r.agg.shifts ? r.attain : 0} tone={tone} />
              </div>
              <div className="row"><span className="muted">Yield</span><b>{r.agg.shifts ? fmtPct(r.yieldPct) : '—'}</b></div>
              <div className="row">
                <span className="muted">Wastage</span>
                <b style={{ color: r.wastePct > r.stage.wasteAlertPct ? 'var(--danger)' : undefined }}>
                  {r.agg.shifts ? fmtPct(r.wastePct, 2) : '—'}
                </b>
              </div>
              <div className="row">
                <span className="muted">Machines running</span>
                <b>{r.running}/{r.machines}</b>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge tone={tone}>{r.agg.shifts ? `${fmtPct(r.attain, 0)} of target` : 'No entries'}</Badge>
                <Badge tone="info">{r.activeOrders} active order{r.activeOrders === 1 ? '' : 's'}</Badge>
              </div>
            </button>
          );
        })}
      </div>

      <Card title="Product routes" sub="Which stages each of the 17 products passes through (SRS FR-MFG-004). Stages 1–5 are shared by every product." className="mb">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Route</th>
                {STAGES.map((s) => <th key={s.code} className="num" title={s.name} style={{ textAlign: 'center' }}>{s.seq}</th>)}
                <th>Products</th>
              </tr>
            </thead>
            <tbody>
              {ROUTE_ORDER.map((r) => {
                const prods = PRODUCTS.filter((p) => p.route === r);
                return (
                  <tr key={r}>
                    <td className="nowrap"><b>{ROUTE_LABEL[r]}</b><div className="small muted">{ROUTES[r].length} stages</div></td>
                    {STAGES.map((s) => {
                      const on = ROUTES[r].includes(s.code);
                      return (
                        <td key={s.code} style={{ textAlign: 'center', padding: '6px 4px' }} title={on ? s.name : undefined}>
                          {on ? <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: s.optionalFor ? 'var(--accent)' : 'var(--primary)' }} /> : <span className="muted">·</span>}
                        </td>
                      );
                    })}
                    <td className="small">{prods.map((p) => p.name).join(' · ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {STAGES.map((s) => `${s.seq} ${s.name}`).join(' · ')}. Stage 7 (lamination) applies to laminated sand bags only; at stages 5 and 6 the
          work centre differs by product (cop winders vs roll winders; sacking, hessian and geo-mesh looms) but the stage is the same.
        </div>
      </Card>
      <div style={{ height: 16 }} />

      <div className="grid half">
        <Card title="Material flow" sub={`${fmtDate(date)} · kilograms in → good output`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Stage</th><th className="num">Input kg</th><th className="num">Good kg</th><th className="num">Waste kg</th><th className="num">Rejects</th><th className="num">Unaccounted</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const invisible = r.agg.inputKg ? 100 - r.yieldPct - r.wastePct - (r.agg.rejectKg / r.agg.inputKg) * 100 : 0;
                  return (
                    <tr key={r.stage.code}>
                      <td>{r.stage.seq}. {r.stage.name}</td>
                      <td className="num">{fmtNum(r.agg.inputKg)}</td>
                      <td className="num">{fmtNum(r.agg.goodKg)}</td>
                      <td className="num">{fmtNum(r.agg.wasteKg)}</td>
                      <td className="num">{r.stage.hasRejects ? fmtNum(r.agg.rejectQty) : '—'}</td>
                      <td className="num">{r.agg.inputKg ? fmtPct(invisible, 2) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="How yield is measured" sub="Business rule BR-MFG-001">
          <div className="chain" style={{ marginBottom: 14 }}>
            {['Raw jute lot', 'Batched jute', 'Sliver', 'Yarn', 'Cloth', 'Cut pieces', 'Bags', 'Bales', 'FG warehouse'].map((s, i, a) => (
              <span key={s} style={{ display: 'contents' }}>
                <span className="step">{s}</span>
                {i < a.length - 1 && <span className="arr">→</span>}
              </span>
            ))}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><b>Yield %</b> = good output kg ÷ input kg × 100</li>
            <li><b>Wastage %</b> = recorded waste kg ÷ input kg × 100 (card waste, caddis, thread waste, cuttings…)</li>
            <li><b>Unaccounted loss %</b> = 100 − yield − wastage − rejects. An alert is raised above 3%.</li>
            <li>Count-based units are converted to kilograms per product: bags by bag weight (B' Twill 1,020 g, Binola 907 g…), cloth by oz/sq yd and width, cops at ≈215 g, packs by units per bale or roll.</li>
            <li>Each stage's output is received as a new lot linked to its input lots, so a bale can be traced back to raw jute suppliers.</li>
          </ul>
          <p className="note">Machine running status is simulated for the current shift ({live.shift}); in production it would come from CMMS breakdown records or machine counters.</p>
        </Card>
      </div>
    </>
  );
}
