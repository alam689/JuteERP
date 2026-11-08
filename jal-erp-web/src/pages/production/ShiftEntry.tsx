import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduction } from '../../store/ProductionStore';
import { useAuth } from '../../auth/AuthContext';
import { DOWNTIME_REASONS, machinesForStage, productById, stageByCode, stageUoms } from '../../data/masters';
import { SHIFT_TIMES, currentShift, fmtNum, fmtPct, isoDate, uomLabel } from '../../lib/format';
import { computeEntryMetrics } from '../../lib/calc';
import { Card, Metric } from '../../components/ui';
import type { ShiftCode, WasteLine } from '../../types';

const SHIFT_MINUTES = 480;

export default function ShiftEntryPage() {
  const { orders, entries, saveEntry } = useProduction();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = entries.find((e) => e.id === params.get('entry') && e.status === 'DRAFT');
  const live = currentShift();

  const openOrders = useMemo(
    () => orders.filter((o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS').sort((a, b) => stageByCode(a.stage).seq - stageByCode(b.stage).seq),
    [orders],
  );

  const [orderId, setOrderId] = useState(editing?.orderId ?? params.get('order') ?? openOrders[0]?.id ?? '');
  const [date, setDate] = useState(editing?.date ?? live.date);
  const [shift, setShift] = useState<ShiftCode>(editing?.shift ?? live.shift);
  const [machineId, setMachineId] = useState(editing?.machineId ?? '');
  const [inputQty, setInputQty] = useState(editing ? String(editing.inputQty) : '');
  const [goodQty, setGoodQty] = useState(editing ? String(editing.goodQty) : '');
  const [rejectQty, setRejectQty] = useState(editing ? String(editing.rejectQty) : '');
  const [waste, setWaste] = useState<Record<string, string>>({});
  const [downMin, setDownMin] = useState(editing ? String(editing.downtimeMinutes) : '0');
  const [downReason, setDownReason] = useState(editing?.downtimeReason ?? '');
  const [remarks, setRemarks] = useState(editing?.remarks ?? '');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const stage = order ? stageByCode(order.stage) : undefined;
  const product = order ? productById(order.productId) : undefined;
  const machines = order ? machinesForStage(order.stage) : [];
  const uoms = stage ? stageUoms(stage, product) : { inputUom: 'KG' as const, outputUom: 'KG' as const };

  // Reset waste lines when the stage changes; keep values when editing a draft.
  useEffect(() => {
    if (!stage) return;
    const fromDraft = editing && editing.orderId === orderId ? Object.fromEntries(editing.waste.map((w) => [w.type, String(w.kg)])) : {};
    setWaste(Object.fromEntries(stage.wasteTypes.map((t) => [t, fromDraft[t] ?? ''])));
    if (!machines.some((m) => m.id === machineId)) setMachineId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
  const wasteLines: WasteLine[] = Object.entries(waste).map(([type, kg]) => ({ type, kg: num(kg) }));
  const metrics = stage
    ? computeEntryMetrics(stage, product, { inputQty: num(inputQty), goodQty: num(goodQty), rejectQty: num(rejectQty), waste: wasteLines })
    : null;

  const duplicate = entries.find(
    (e) => e.id !== editing?.id && e.orderId === orderId && e.date === date && e.shift === shift && (e.machineId ?? '') === machineId,
  );
  const downtime = num(downMin);
  const extraErrors: string[] = [];
  if (downtime < 0 || downtime > SHIFT_MINUTES) extraErrors.push(`Downtime must be between 0 and ${SHIFT_MINUTES} minutes.`);
  if (downtime > 0 && !downReason) extraErrors.push('Select a downtime reason.');
  if (date > isoDate(new Date())) extraErrors.push('Production date cannot be in the future.');
  if (duplicate) extraErrors.push(`An entry already exists for this order, date, shift and machine (${duplicate.docNo}).`);
  const allErrors = [...(metrics?.errors ?? []), ...extraErrors];

  const submit = (post: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    setError(null);
    if (!order) return setError('Select a production order.');
    if (post && allErrors.length) return setError(allErrors[0]);
    if (!post && extraErrors.some((x) => x.startsWith('An entry already'))) return setError(extraErrors.find((x) => x.startsWith('An entry already'))!);
    const r = saveEntry(
      {
        id: editing?.id, orderId, stage: order.stage, date, shift, machineId: machineId || undefined,
        supervisor: user!.name, inputQty: num(inputQty), goodQty: num(goodQty), rejectQty: stage?.hasRejects ? num(rejectQty) : 0,
        waste: wasteLines.filter((w) => w.kg > 0), runMinutes: SHIFT_MINUTES - downtime, downtimeMinutes: downtime,
        downtimeReason: downtime > 0 ? downReason : undefined, remarks: remarks.trim() || undefined,
      },
      post,
      user!.name,
    );
    if (!r.ok) return setError(r.error);
    navigate(`/production/orders/${order.id}`, { replace: true });
  };

  if (openOrders.length === 0 && !editing) {
    return (
      <div className="empty-state">
        <h2>No released orders</h2>
        <p>Shift entries need a released or in-progress production order. <Link to="/production/orders">View orders</Link></p>
      </div>
    );
  }

  const tone = (v: number, alert: number) => (v > alert ? 'bad' : v > alert * 0.85 ? 'warn' : 'good');

  return (
    <form onSubmit={submit(true)} noValidate>
      <div className="page-head">
        <div>
          <h1>{editing ? `Edit draft ${editing.docNo}` : 'Shift production entry'}</h1>
          <p>Record output, consumption, waste and downtime for one shift (SRS FR-MFG-022). Posting updates stock and order progress.</p>
        </div>
      </div>

      <div className="grid two-col">
        <div className="stack">
          <Card title="Shift & order">
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="e-order">Production order</label>
                <select id="e-order" className="select" value={orderId} onChange={(e) => setOrderId(e.target.value)} disabled={!!editing}>
                  {openOrders.map((o) => {
                    const s = stageByCode(o.stage);
                    return <option key={o.id} value={o.id}>{s.seq}. {s.name} — {o.docNo} — {productById(o.productId)?.name}</option>;
                  })}
                </select>
                {stage && <span className="hint">{stage.workCenter} · {stage.activities} · output: {stage.outputItem}</span>}
              </div>
              <div className="field">
                <label htmlFor="e-date">Production date</label>
                <input id="e-date" className="input" type="date" value={date} max={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="e-shift">Shift</label>
                <select id="e-shift" className="select" value={shift} onChange={(e) => setShift(e.target.value as ShiftCode)}>
                  {(['A', 'B', 'C'] as ShiftCode[]).map((s) => <option key={s} value={s}>Shift {s} ({SHIFT_TIMES[s]})</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="e-machine">Machine</label>
                <select id="e-machine" className="select" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                  <option value="">Whole line / work centre</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {stage && (
            <Card title="Quantities" sub={uoms.inputUom !== uoms.outputUom ? `Input in ${uomLabel(uoms.inputUom)}, output in ${uomLabel(uoms.outputUom)}` : `All quantities in ${uomLabel(uoms.outputUom)}`}>
              <div className="form-grid">
                <NumField id="e-in" label={`Input (${uomLabel(uoms.inputUom)})`} value={inputQty} onChange={setInputQty}
                  hint={stage.code === 'BATCHING' ? 'Raw jute issued from lots' : 'Received from previous stage'} invalid={touched && num(inputQty) <= 0} />
                <NumField id="e-good" label={`Good output (${uomLabel(uoms.outputUom)})`} value={goodQty} onChange={setGoodQty}
                  hint={uoms.outputUom === stage.outputUom ? `Line shift target ≈ ${fmtNum(stage.dailyTarget / 3)}` : `${product?.name ?? ''} — ${uomLabel(uoms.outputUom)}`} />
                {stage.hasRejects && <NumField id="e-rej" label={`Rejected (${uomLabel(uoms.outputUom)})`} value={rejectQty} onChange={setRejectQty} hint="Sent to rework or scrap" />}
              </div>
              {stage.wasteTypes.length > 0 && (
                <>
                  <h4 style={{ margin: '18px 0 10px', fontSize: 13 }}>Waste by type (kg)</h4>
                  <div className="form-grid">
                    {stage.wasteTypes.map((t) => (
                      <NumField key={t} id={`w-${t}`} label={t} value={waste[t] ?? ''} onChange={(v) => setWaste((w) => ({ ...w, [t]: v }))} step="0.1" />
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          <Card title="Downtime">
            <div className="form-grid">
              <NumField id="e-down" label="Downtime (minutes)" value={downMin} onChange={setDownMin} hint={`Run time: ${Math.max(0, SHIFT_MINUTES - downtime)} of ${SHIFT_MINUTES} min`} />
              <div className="field">
                <label htmlFor="e-reason">Reason</label>
                <select id="e-reason" className="select" value={downReason} onChange={(e) => setDownReason(e.target.value)} disabled={downtime <= 0}
                  aria-invalid={touched && downtime > 0 && !downReason}>
                  <option value="">—</option>
                  {DOWNTIME_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="e-remarks">Remarks</label>
                <textarea id="e-remarks" className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. loom LM-07 warp breakage, mechanic called" />
              </div>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 76, alignSelf: 'start' }}>
          <Card title="Live check" sub="Business rules BR-MFG-001 / 002">
            {metrics && stage ? (
              <>
                <div className="metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <Metric k="Input" v={`${fmtNum(metrics.inputKg)} kg`} />
                  <Metric k="Good output" v={`${fmtNum(metrics.goodKg)} kg`} />
                  <Metric k="Yield" v={fmtPct(metrics.yieldPct)} />
                  <Metric k="Wastage" v={fmtPct(metrics.wastePct, 2)} tone={metrics.inputKg ? tone(metrics.wastePct, stage.wasteAlertPct) : undefined} />
                  {stage.hasRejects && <Metric k="Rejects" v={fmtPct(metrics.rejectPct, 2)} />}
                  <Metric k="Unaccounted" v={fmtPct(metrics.invisiblePct, 2)} tone={metrics.inputKg ? tone(metrics.invisiblePct, 3) : undefined} />
                  {uoms.outputUom === stage.outputUom && <Metric k="vs line shift target" v={fmtPct((num(goodQty) / (stage.dailyTarget / 3)) * 100, 0)} />}
                </div>
                {product && (uoms.outputUom !== 'KG' || uoms.inputUom !== 'KG') && (
                  <p className="small muted" style={{ marginBottom: 0 }}>
                    Converted at {product.kgPerBase < 1 ? `${Math.round(product.kgPerBase * 1000)} g` : `${fmtNum(product.kgPerBase, 3)} kg`} per {uomLabel(product.baseUom).replace(/s$/, '')}
                    {(uoms.outputUom === product.packUom || uoms.inputUom === product.packUom) && ` and ${fmtNum(product.unitsPerPack)} ${uomLabel(product.baseUom)} per ${uomLabel(product.packUom).replace(/s$/, '')}`}
                    {product.assumptions && <> — <span style={{ color: 'var(--warning)' }}>{product.assumptions}</span></>}.
                  </p>
                )}
                <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                  {touched && allErrors.map((m) => <div key={m} className="alert alert-bad">{m}</div>)}
                  {!touched && duplicate && <div className="alert alert-bad">{extraErrors.find((x) => x.startsWith('An entry'))}</div>}
                  {metrics.warnings.map((m) => <div key={m} className="alert alert-warn">{m}</div>)}
                  {metrics.inputKg > 0 && allErrors.length === 0 && metrics.warnings.length === 0 && <div className="alert alert-good">Figures balance within tolerance.</div>}
                </div>
              </>
            ) : (
              <div className="muted">Select an order.</div>
            )}
          </Card>

          {error && <div className="alert alert-bad" role="alert">{error}</div>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
            <button type="button" className="btn" onClick={() => submit(false)()}>Save draft</button>
            {can('production.entry.post') && <button type="submit" className="btn btn-primary">Post entry</button>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Posted entries are final; corrections are made by a reversal entry (SRS C-05).</p>
        </div>
      </div>
    </form>
  );
}

function NumField({ id, label, value, onChange, hint, invalid, step = '1' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; invalid?: boolean; step?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input num" type="number" min={0} step={step} inputMode="decimal" value={value}
        onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
