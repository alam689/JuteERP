import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';
import { useProduction } from '../store/ProductionStore';
import { useAuth } from '../auth/AuthContext';
import { STAGES, machineStatuses, stageByCode } from '../data/masters';
import { COMMERCIAL_ALERTS, EXPORT_ORDERS, FG_STOCK_BY_PRODUCT, MGMT_KPIS } from '../data/management';
import { addDays, currentShift, fmtCompact, fmtDate, fmtDay, fmtNum, fmtPct, fmtUsd, isoDate } from '../lib/format';
import { aggregate, availabilityOf, byStage, dailySeries, downtimeByReason, inRange, posted, wasteOf, yieldOf } from '../lib/metrics';
import { CHART_VARS, useCssVars } from '../lib/theme';
import { Badge, Card, KpiCard, Progress, attainTone, type Tone } from '../components/ui';

type Period = 7 | 14;

export default function Dashboard() {
  const { entries } = useProduction();
  const { user } = useAuth();
  const c = useCssVars(CHART_VARS);
  const [period, setPeriod] = useState<Period>(7);

  const today = isoDate(new Date());
  const yesterday = addDays(today, -1);
  const monthStart = today.slice(0, 8) + '01';
  const live = currentShift();

  const data = useMemo(() => {
    const p = posted(entries);
    const sewing = stageByCode('SEWING');
    const packing = stageByCode('PACKING');

    const ySew = aggregate(inRange(p, yesterday, yesterday, 'SEWING'));
    const tSew = aggregate(inRange(p, today, today, 'SEWING'));
    const yPack = aggregate(inRange(p, yesterday, yesterday, 'PACKING'));

    const mtdSew = aggregate(inRange(p, monthStart, today, 'SEWING'));
    const mtdTarget = (sewing.dailyTarget / 3) * mtdSew.shifts;

    const periodFrom = addDays(yesterday, -(period - 1));
    const periodEntries = inRange(p, periodFrom, yesterday);
    const stageAgg = byStage(periodEntries);
    const weightStages = STAGES.filter((s) => s.code !== 'FG_TRANSFER');
    const totalWasteKg = weightStages.reduce((s, st) => s + stageAgg.get(st.code)!.wasteKg, 0);
    const rawInputKg = stageAgg.get('BATCHING')!.inputKg;

    const yAll = aggregate(inRange(p, yesterday, yesterday));
    const series = dailySeries(p, 'SEWING', yesterday, 14).map((d) => ({
      day: fmtDay(d.date),
      Actual: d.actual,
      Target: sewing.dailyTarget,
    }));

    const stageRows = weightStages.map((s) => {
      const a = stageAgg.get(s.code)!;
      return { stage: s.name, short: s.name.replace('Raw Material Preparation', 'Batching'), yield: yieldOf(a), waste: wasteOf(a), alert: s.wasteAlertPct };
    });

    const machines = machineStatuses(live.date, live.shift);
    const down = machines.filter((m) => m.state === 'DOWN');

    return {
      ySew, tSew, yPack, mtdSew, mtdTarget, sewing, packing,
      yAll, series, stageRows,
      overallWastePct: rawInputKg ? (totalWasteKg / rawInputKg) * 100 : 0,
      downtime: downtimeByReason(periodEntries),
      availability: availabilityOf(aggregate(periodEntries)),
      machines, down,
    };
  }, [entries, period, today, yesterday, monthStart, live.date, live.shift]);

  const ySewPct = (data.ySew.goodQty / data.sewing.dailyTarget) * 100;
  const mtdPct = data.mtdTarget ? (data.mtdSew.goodQty / data.mtdTarget) * 100 : 0;
  const proceedsPct = (MGMT_KPIS.exportProceedsMtdUsd / MGMT_KPIS.exportProceedsTargetUsd) * 100;

  const productionAlerts = useMemo(() => {
    const p = posted(entries);
    const list: { tone: Tone; title: string; detail: string }[] = [];
    for (const s of STAGES) {
      const a = aggregate(inRange(p, yesterday, yesterday, s.code));
      if (!a.shifts) continue;
      const att = (a.goodQty / s.dailyTarget) * 100;
      const w = wasteOf(a);
      if (att < 90) list.push({ tone: 'bad', title: `${s.name} at ${fmtPct(att)} of target`, detail: `Yesterday ${fmtNum(a.goodQty)} vs ${fmtNum(s.dailyTarget)} ${s.outputUom.toLowerCase()} planned.` });
      if (w > s.wasteAlertPct) list.push({ tone: 'warn', title: `${s.name} wastage ${fmtPct(w, 2)}`, detail: `Above the ${s.wasteAlertPct}% alert level yesterday.` });
    }
    const breakdowns = data.down.filter((m) => m.reason === 'Breakdown');
    if (breakdowns.length) {
      list.push({
        tone: 'bad',
        title: `${breakdowns.length} machine${breakdowns.length > 1 ? 's' : ''} broken down now`,
        detail: breakdowns.slice(0, 4).map((m) => m.machine.code).join(', ') + (breakdowns.length > 4 ? '…' : ''),
      });
    }
    return list;
  }, [entries, yesterday, data.down]);

  const alerts = [
    ...productionAlerts,
    ...COMMERCIAL_ALERTS.map((a) => ({ tone: a.severity as Tone, title: a.title, detail: a.detail })),
  ];
  const toneColor = (t: Tone) => (t === 'bad' ? c.danger : t === 'warn' ? c.warning : c.c3);

  const axis = { stroke: c['text-muted'], fontSize: 11, tickLine: false, axisLine: { stroke: c.border } };
  const tooltipStyle = { contentStyle: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 12 }, labelStyle: { color: c.text, fontWeight: 600 } };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name.split(' ')[0]}</h1>
          <p>{fmtDate(today)} · Live shift {live.shift} · Full-day figures are for yesterday ({fmtDate(yesterday)})</p>
        </div>
        <div className="actions">
          <span className="small muted">Period</span>
          <div className="segmented" role="group" aria-label="Analysis period">
            {([7, 14] as Period[]).map((p) => (
              <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p} days</button>
            ))}
          </div>
          <Link className="btn" to="/production/board">Daily board</Link>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Bags sewn — yesterday" value={fmtNum(data.ySew.goodQty)} unit="pcs" tone={attainTone(ySewPct)}
          sub={<><Badge tone={attainTone(ySewPct)}>{fmtPct(ySewPct)} of target</Badge> Today so far {fmtNum(data.tSew.goodQty)}</>} />
        <KpiCard label="Month-to-date attainment" value={fmtPct(mtdPct)} tone={attainTone(mtdPct)}
          sub={<>{fmtCompact(data.mtdSew.goodQty)} of {fmtCompact(data.mtdTarget)} bags</>} />
        <KpiCard label={`Process wastage — ${period} days`} value={fmtPct(data.overallWastePct, 2)}
          tone={data.overallWastePct > 15 ? 'bad' : data.overallWastePct > 13 ? 'warn' : 'good'} sub="Recorded waste as % of raw jute input (typical 10–14%)" />
        <KpiCard label={`Machine availability — ${period} days`} value={fmtPct(data.availability)}
          tone={data.availability >= 95 ? 'good' : data.availability >= 90 ? 'warn' : 'bad'}
          sub={<>{fmtNum(data.yAll.downMin / 60, 1)} downtime hrs yesterday · {data.down.length} down now</>} />
        <KpiCard label="Bales packed — yesterday" value={fmtNum(data.yPack.goodQty)} unit="bales"
          tone={attainTone((data.yPack.goodQty / data.packing.dailyTarget) * 100)}
          sub={<>≈ {fmtNum(data.yPack.goodQty / 65, 1)} × 20′ FCL at 65 bales</>} />
        <KpiCard label="Finished goods stock" value={fmtNum(MGMT_KPIS.fgStockBales)} unit="bales" sub={<>≈ {fmtUsd(MGMT_KPIS.fgStockValueUsd)} · illustrative</>} />
        <KpiCard label="Export proceeds — MTD" value={fmtUsd(MGMT_KPIS.exportProceedsMtdUsd)} tone={attainTone(proceedsPct)}
          sub={<>{fmtPct(proceedsPct)} of {fmtUsd(MGMT_KPIS.exportProceedsTargetUsd)} · {MGMT_KPIS.containersShippedMtd} containers</>} />
        <KpiCard label="Attendance today" value={fmtPct(MGMT_KPIS.attendancePct)} tone={MGMT_KPIS.attendancePct >= 95 ? 'good' : 'warn'}
          sub={<>{fmtNum(Math.round(2800 * MGMT_KPIS.attendancePct / 100))} of 2,800 · illustrative</>} />
      </div>

      <div className="grid two-col" style={{ marginBottom: 16 }}>
        <Card title="Daily sewing output vs target" sub="Bags per day, last 14 full days">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={c.border} vertical={false} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} width={48} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => fmtNum(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Actual" fill={c.c1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line dataKey="Target" stroke={c.c2} strokeWidth={2} dot={false} strokeDasharray="5 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Alerts & exceptions" sub={`${alerts.length} need attention`}>
          <div className="alert-list" style={{ maxHeight: 290, overflowY: 'auto' }}>
            {alerts.length === 0 && <div className="muted">No exceptions.</div>}
            {alerts.map((a, i) => (
              <div key={i} className="alert-item">
                <span className="dot" style={{ background: toneColor(a.tone) }} />
                <div>
                  <div className="t">{a.title}</div>
                  <div className="d">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid half" style={{ marginBottom: 16 }}>
        <Card title="Yield and wastage by stage" sub={`Last ${period} days · % of stage input weight`}
          actions={<Link className="btn btn-sm" to="/production">Process view</Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Stage</th><th className="num">Yield</th><th className="num">Wastage</th><th style={{ width: '32%' }}>Wastage vs alert</th></tr>
              </thead>
              <tbody>
                {data.stageRows.map((r) => {
                  const tone: Tone = r.waste > r.alert ? 'bad' : r.waste > r.alert * 0.85 ? 'warn' : 'good';
                  return (
                    <tr key={r.stage}>
                      <td>{r.stage}</td>
                      <td className="num">{fmtPct(r.yield)}</td>
                      <td className="num">{fmtPct(r.waste, 2)}</td>
                      <td><Progress pct={(r.waste / r.alert) * 100} tone={tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Downtime by reason" sub={`Hours, last ${period} days, all stages`}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.downtime} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={c.border} horizontal={false} />
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="reason" {...axis} width={130} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => `${fmtNum(v, 1)} h`} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {data.downtime.map((d) => (
                    <Cell key={d.reason} fill={d.reason === 'Breakdown' ? c.c4 : d.reason === 'Power failure' ? c.c2 : c.c3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid two-col">
        <Card title="Export order book" sub="Open and recent sales contracts · illustrative">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Contract</th><th>Customer</th><th>Product</th><th className="num">Qty (bags)</th><th style={{ minWidth: 120 }}>Shipped</th><th>Ship by</th><th>Status</th></tr>
              </thead>
              <tbody>
                {EXPORT_ORDERS.map((o) => {
                  const pct = o.qtyBags ? (o.shippedBags / o.qtyBags) * 100 : 0;
                  const tone: Tone = o.status === 'Late' ? 'bad' : o.status === 'At risk' ? 'warn' : o.status === 'Shipped' ? 'neutral' : 'good';
                  return (
                    <tr key={o.contract}>
                      <td className="nowrap">{o.contract}</td>
                      <td>{o.customer}<div className="small muted">{o.terms}</div></td>
                      <td>{o.product}</td>
                      <td className="num">{o.qtyBags ? fmtNum(o.qtyBags) : '—'}</td>
                      <td>{o.qtyBags ? <><Progress pct={pct} tone={tone === 'bad' ? 'bad' : undefined} /><span className="small muted">{fmtPct(pct, 0)}</span></> : <span className="small muted">Cloth (yards)</span>}</td>
                      <td className="nowrap">{fmtDay(o.shipBy)}</td>
                      <td><Badge tone={tone}>{o.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Finished goods by product" sub="Bales in FG warehouse · illustrative">
          <div style={{ height: 270 }}>
            <ResponsiveContainer>
              <BarChart data={FG_STOCK_BY_PRODUCT} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={c.border} vertical={false} />
                <XAxis dataKey="product" {...axis} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis {...axis} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => `${fmtNum(v)} bales`} />
                <Bar dataKey="bales" fill={c.c2} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="small muted">Raw jute cover: <b>{MGMT_KPIS.rawJuteStockDays} days</b> at current consumption.</div>
        </Card>
      </div>

      <p className="note">
        Production figures come from posted shift entries in this prototype (demo history plus anything you post). Export, stock,
        proceeds and attendance figures are illustrative placeholders until the Sales, Inventory, Commercial and HR modules are built —
        they are not actual company figures.
      </p>
    </>
  );
}
