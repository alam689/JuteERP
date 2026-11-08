import { useMemo, useState } from 'react';
import { useProduction } from '../../store/ProductionStore';
import { STAGES, machineStatuses } from '../../data/masters';
import { SHIFT_TIMES, addDays, currentShift, fmtDate, fmtNum, fmtPct, isoDate, uomLabel } from '../../lib/format';
import { aggregate, inRange, posted, wasteOf, yieldOf } from '../../lib/metrics';
import { Badge, Card, attainTone } from '../../components/ui';
import type { ShiftCode } from '../../types';

const SHIFTS: ShiftCode[] = ['A', 'B', 'C'];

export default function DailyBoard() {
  const { entries } = useProduction();
  const today = isoDate(new Date());
  const live = currentShift();
  const [date, setDate] = useState(live.date);
  const [statusShift, setStatusShift] = useState<ShiftCode>(live.shift);

  const rows = useMemo(() => {
    const p = posted(entries);
    return STAGES.map((s) => {
      const perShift = SHIFTS.map((sh) => aggregate(p.filter((e) => e.stage === s.code && e.date === date && e.shift === sh)));
      const day = aggregate(inRange(p, date, date, s.code));
      return { stage: s, perShift, day };
    });
  }, [entries, date]);

  const machines = useMemo(() => machineStatuses(date, statusShift), [date, statusShift]);
  const counts = {
    RUNNING: machines.filter((m) => m.state === 'RUNNING').length,
    IDLE: machines.filter((m) => m.state === 'IDLE').length,
    DOWN: machines.filter((m) => m.state === 'DOWN').length,
  };
  const exceptions = machines.filter((m) => m.state !== 'RUNNING').sort((a, b) => (a.state === 'DOWN' ? -1 : 1) - (b.state === 'DOWN' ? -1 : 1));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Daily production board</h1>
          <p>Shift-wise output against target for every stage, and machine status on the floor.</p>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">←</button>
          <input type="date" className="input" style={{ width: 160 }} value={date} max={today} onChange={(e) => setDate(e.target.value || date)} aria-label="Board date" />
          <button className="btn btn-sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">→</button>
          {date !== live.date && <button className="btn btn-sm" onClick={() => setDate(live.date)}>Today</button>}
        </div>
      </div>

      <Card title={`Output by shift — ${fmtDate(date)}`} sub={`Shift A ${SHIFT_TIMES.A} · B ${SHIFT_TIMES.B} · C ${SHIFT_TIMES.C}`} className="mb">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Stage</th><th>Unit</th><th className="num">Target / shift</th>
                {SHIFTS.map((s) => <th key={s} className="num">Shift {s}</th>)}
                <th className="num">Day total</th><th className="num">Attainment</th><th className="num">Yield</th><th className="num">Wastage</th><th className="num">Downtime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ stage, perShift, day }) => {
                const shiftTarget = stage.dailyTarget / 3;
                const target = shiftTarget * (day.shifts || 1);
                const att = day.shifts ? (day.goodQty / target) * 100 : 0;
                return (
                  <tr key={stage.code}>
                    <td className="nowrap">{stage.seq}. {stage.name}</td>
                    <td>{uomLabel(stage.outputUom)}</td>
                    <td className="num">{fmtNum(shiftTarget)}</td>
                    {perShift.map((a, i) => {
                      const isLive = date === live.date && SHIFTS[i] === live.shift;
                      if (!a.shifts) return <td key={i} className="num muted">{isLive ? <Badge tone="info">Running</Badge> : '—'}</td>;
                      const pct = (a.goodQty / shiftTarget) * 100;
                      return (
                        <td key={i} className="num" style={{ color: pct < 90 ? 'var(--danger)' : pct < 98 ? 'var(--warning)' : undefined }}>
                          {fmtNum(a.goodQty)}
                        </td>
                      );
                    })}
                    <td className="num"><b>{fmtNum(day.goodQty)}</b></td>
                    <td className="num">{day.shifts ? <Badge tone={attainTone(att)}>{fmtPct(att)}</Badge> : '—'}</td>
                    <td className="num">{day.shifts ? fmtPct(yieldOf(day)) : '—'}</td>
                    <td className="num" style={{ color: day.shifts && wasteOf(day) > stage.wasteAlertPct ? 'var(--danger)' : undefined }}>
                      {day.shifts ? fmtPct(wasteOf(day), 2) : '—'}
                    </td>
                    <td className="num">{day.downMin ? `${fmtNum(day.downMin / 60, 1)} h` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginBottom: 0 }}>Attainment compares output with the target for the shifts reported so far.</p>
      </Card>

      <div style={{ height: 16 }} />

      <div className="grid two-col">
        <Card
          title="Machine status"
          sub={`${counts.RUNNING} running · ${counts.IDLE} idle · ${counts.DOWN} down`}
          actions={
            <div className="segmented" role="group" aria-label="Shift">
              {SHIFTS.map((s) => <button key={s} className={statusShift === s ? 'on' : ''} onClick={() => setStatusShift(s)}>Shift {s}</button>)}
            </div>
          }
        >
          <div className="legend" style={{ marginBottom: 12 }}>
            <span><i style={{ background: 'var(--success)' }} />Running</span>
            <span><i style={{ background: 'var(--warning)' }} />Idle</span>
            <span><i style={{ background: 'var(--danger)' }} />Down</span>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            {STAGES.map((s) => {
              const ms = machines.filter((m) => m.machine.stage === s.code);
              return (
                <div key={s.code}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>{s.seq}. {s.name} <span className="muted">· {s.workCenter}</span></div>
                  <div className="machine-grid">
                    {ms.map((m) => (
                      <div key={m.machine.id} className={`machine ${m.state}`} title={`${m.machine.name}: ${m.state.toLowerCase()}${m.reason ? ` — ${m.reason}` : ''}`}>
                        {m.machine.code}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Stoppages" sub="Machines not running in the selected shift">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Machine</th><th>Status</th><th>Reason</th><th className="num">For</th></tr></thead>
              <tbody>
                {exceptions.map((m) => (
                  <tr key={m.machine.id}>
                    <td>{m.machine.code}<div className="small muted">{m.machine.name}</div></td>
                    <td><Badge tone={m.state === 'DOWN' ? 'bad' : 'warn'}>{m.state === 'DOWN' ? 'Down' : 'Idle'}</Badge></td>
                    <td>{m.reason}</td>
                    <td className="num nowrap">{m.sinceMin} min</td>
                  </tr>
                ))}
                {exceptions.length === 0 && <tr><td colSpan={4} className="muted">All machines running.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="note">Machine status is simulated in this prototype. In the full ERP it comes from maintenance breakdown requests (CMMS) and, later, machine counters.</p>
        </Card>
      </div>
    </>
  );
}
