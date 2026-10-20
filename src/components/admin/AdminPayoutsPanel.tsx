'use client';

import React, { useState } from 'react';
import { formatINR } from '@/src/lib/date';
import { useToast } from '@/src/context/ToastContext';
import { api, useLoad, Spinner, ErrorNote, Empty, Badge, Modal, Field, StatCard, inputCls, btnPrimary, btnGhost, btnDanger, cardCls, fmtDate, fmtDateTime } from '@/src/components/seller/ui';

interface OverviewRow { sellerId: number; storeName: string; status: string; ownerEmail: string; hasPayoutDetails: boolean; available: number; pendingAdjustments: number; availableNet: number; onHold: number; inFulfilment: number; inPayout: number; paidOut: number; totalCommission: number; meetsMinimum: boolean }
interface Overview { settings: { payoutHoldDays: number; minPayoutAmount: number; defaultCommissionPercent: number }; sellers: OverviewRow[] }
interface PayoutRow { id: number; payoutNumber: string; sellerId: number; storeName: string; status: string; orderCount: number; grossAmount: number; commissionAmount: number; adjustmentsAmount: number; netAmount: number; method: string | null; reference: string | null; failureReason: string | null; createdAt: string; paidAt: string | null }
interface Report {
  payout: PayoutRow & { destination: Record<string, string | null> | null; notes: string | null };
  seller: { storeName: string };
  destinationFull?: { accountHolder: string | null; bankName: string | null; ifsc: string | null; accountNumber: string | null; upiId: string | null };
  lines: Array<{ orderNumber: string; productName: string; quantity: number; totalPrice: number; commissionPercent: number; commissionAmount: number; sellerEarning: number }>;
  adjustments: Array<{ id: number; reason: string; amount: number }>;
}
interface CommissionSettings { settings: { defaultCommissionPercent: number; payoutHoldDays: number; minPayoutAmount: number }; categories: Array<{ categoryId: number; name: string; commissionPercent: number | null }> }
interface CommissionReport { sellers: Array<{ sellerId: number; storeName: string; parcels: number; grossSales: number; commission: number; deliveredCommission: number; sellerEarnings: number }>; totals: { parcels: number; grossSales: number; commission: number; deliveredCommission: number; sellerEarnings: number } }

type View = 'balances' | 'payouts' | 'commission';

export default function AdminPayoutsPanel() {
  const [view, setView] = useState<View>('balances');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([['balances', 'Payable balances'], ['payouts', 'Payouts & settlements'], ['commission', 'Commission']] as Array<[View, string]>).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-full text-xs font-bold border ${view === v ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-brand-300 dark:text-neutral-950' : 'border-neutral-300 text-neutral-700 dark:border-white/15 dark:text-neutral-300'}`}>{l}</button>
        ))}
      </div>
      {view === 'balances' && <Balances onCreated={() => setView('payouts')} />}
      {view === 'payouts' && <Payouts />}
      {view === 'commission' && <Commission />}
    </div>
  );
}

// -----------------------------------------------------------------------
function Balances({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api<Overview>('/api/admin/payouts/overview'), []);
  const [busy, setBusy] = useState<number | null>(null);
  const [adjust, setAdjust] = useState<OverviewRow | null>(null);

  async function create(r: OverviewRow) {
    if (!confirm(`Create a payout of ${formatINR(r.availableNet)} for ${r.storeName}?\n\nThis locks their payable orders into a settlement. Mark it paid after the transfer.`)) return;
    setBusy(r.sellerId);
    try {
      await api('/api/admin/payouts', { method: 'POST', body: JSON.stringify({ sellerId: r.sellerId }) });
      toast.success('Payout created. Transfer the money, then mark it paid.');
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create payout'); await reload(); }
    finally { setBusy(null); }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;
  const totalDue = data.sellers.reduce((a, s) => a + Math.max(0, s.availableNet), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Payable now" value={formatINR(totalDue)} tone="green" />
        <StatCard label="On hold" value={formatINR(data.sellers.reduce((a, s) => a + s.onHold, 0))} sub={`${data.settings.payoutHoldDays}-day return window`} />
        <StatCard label="Awaiting delivery" value={formatINR(data.sellers.reduce((a, s) => a + s.inFulfilment, 0))} />
        <StatCard label="Minimum payout" value={formatINR(data.settings.minPayoutAmount)} />
      </div>
      {data.sellers.length === 0 ? <div className={cardCls}><Empty>No seller earnings yet.</Empty></div> : (
        <div className={`${cardCls} overflow-hidden`}><div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10">
              <tr><th className="py-3 px-4">Seller</th><th className="py-3 px-3 text-right">Payable</th><th className="py-3 px-3 text-right">Adjust.</th><th className="py-3 px-3 text-right">On hold</th><th className="py-3 px-3 text-right">In fulfilment</th><th className="py-3 px-3 text-right">Paid out</th><th className="py-3 px-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {data.sellers.map((r) => (
                <tr key={r.sellerId}>
                  <td className="py-3 px-4"><p className="font-bold text-neutral-950 dark:text-white">{r.storeName}</p><p className="text-[11px] text-neutral-500">{r.ownerEmail}{!r.hasPayoutDetails && <span className="text-red-600 font-bold"> · no payout details</span>}</p></td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600">{formatINR(r.availableNet)}</td>
                  <td className={`py-3 px-3 text-right ${r.pendingAdjustments < 0 ? 'text-red-600' : ''}`}>{r.pendingAdjustments ? formatINR(r.pendingAdjustments) : '—'}</td>
                  <td className="py-3 px-3 text-right">{formatINR(r.onHold)}</td>
                  <td className="py-3 px-3 text-right">{formatINR(r.inFulfilment)}</td>
                  <td className="py-3 px-3 text-right">{formatINR(r.paidOut)}</td>
                  <td className="py-3 px-3"><div className="flex justify-end gap-1.5">
                    <button className={btnGhost} onClick={() => setAdjust(r)}>Adjust</button>
                    <button className={btnPrimary} disabled={busy === r.sellerId || !r.meetsMinimum || !r.hasPayoutDetails} title={!r.hasPayoutDetails ? 'Seller has no payout details' : !r.meetsMinimum ? 'Below minimum payout' : ''} onClick={() => create(r)}>Create payout</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      {adjust && <AdjustModal row={adjust} onClose={() => setAdjust(null)} onDone={async () => { setAdjust(null); await reload(); }} />}
    </div>
  );
}

function AdjustModal({ row, onClose, onDone }: { row: OverviewRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n !== 0 && reason.trim().length >= 5;
  async function submit() {
    setBusy(true);
    try {
      await api('/api/admin/adjustments', { method: 'POST', body: JSON.stringify({ sellerId: row.sellerId, amount: n, reason: reason.trim() }) });
      toast.success('Adjustment recorded; it applies to the next payout.');
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Adjustment: ${row.storeName}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-neutral-500">Positive = credit the seller, negative = deduct. It is included in their next payout and shown in their settlement report.</p>
        <Field label="Amount (₹, whole number)"><input type="number" step={1} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-250 or 500" /></Field>
        <Field label="Reason"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={busy || !valid} onClick={submit}>Record adjustment</button></div>
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------
function Payouts() {
  const [status, setStatus] = useState('ALL');
  const [open, setOpen] = useState<number | null>(null);
  const { data, error, loading, reload } = useLoad(() => api<{ payouts: PayoutRow[] }>(`/api/admin/payouts?status=${status}`), [status]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'PROCESSING', 'PAID', 'FAILED'].map((s) => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${status === s ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-brand-300 dark:text-neutral-950' : 'border-neutral-300 text-neutral-700 dark:border-white/15 dark:text-neutral-300'}`}>{s[0] + s.slice(1).toLowerCase()}</button>)}
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : !data || data.payouts.length === 0 ? <div className={cardCls}><Empty>No payouts yet.</Empty></div> : (
        <div className={`${cardCls} overflow-hidden`}><div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10"><tr><th className="py-3 px-4">Payout</th><th className="py-3 px-3">Seller</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Orders</th><th className="py-3 px-3 text-right">Commission</th><th className="py-3 px-3 text-right">Net</th><th className="py-3 px-3 text-right"></th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {data.payouts.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4"><p className="font-bold">{p.payoutNumber}</p><p className="text-[11px] text-neutral-500">{fmtDate(p.createdAt)}</p></td>
                  <td className="py-3 px-3">{p.storeName}</td>
                  <td className="py-3 px-3"><Badge status={p.status} /></td>
                  <td className="py-3 px-3 text-right">{p.orderCount}</td>
                  <td className="py-3 px-3 text-right">{formatINR(p.commissionAmount)}</td>
                  <td className="py-3 px-3 text-right font-bold">{formatINR(p.netAmount)}</td>
                  <td className="py-3 px-3 text-right"><button className={btnGhost} onClick={() => setOpen(p.id)}>{p.status === 'PROCESSING' ? 'Settle' : 'Report'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      {open !== null && <PayoutModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

function PayoutModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api<Report>(`/api/admin/payouts/${id}`), [id]);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [failReason, setFailReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      await api(`/api/admin/payouts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(ok);
      await reload();
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }

  const p = data?.payout;
  const d = data?.destinationFull;
  return (
    <Modal title="Settlement" onClose={onClose} wide>
      {loading && !data ? <Spinner /> : error ? <ErrorNote message={error} /> : p && data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-bold">{p.payoutNumber} · {data.seller.storeName}</p><p className="text-xs text-neutral-500">Created {fmtDateTime(p.createdAt)}{p.paidAt ? ` · Paid ${fmtDateTime(p.paidAt)} via ${p.method} (${p.reference})` : ''}</p></div>
            <div className="flex items-center gap-2"><Badge status={p.status} /><a className={btnGhost} href={`/api/admin/payouts/${id}?format=csv`} download>CSV</a></div>
          </div>
          {p.failureReason && <ErrorNote message={`Failed: ${p.failureReason}`} />}

          {p.status === 'PROCESSING' && d && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs space-y-1 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
              <p className="font-bold">Transfer {formatINR(p.netAmount)} to:</p>
              <p>{d.accountHolder} · {d.bankName}</p>
              <p>Account <b>{d.accountNumber || '—'}</b> · IFSC <b>{d.ifsc || '—'}</b>{d.upiId ? <> · UPI <b>{d.upiId}</b></> : null}</p>
            </div>
          )}

          <div className="overflow-x-auto max-h-60 overflow-y-auto"><table className="w-full text-left text-xs">
            <thead className="text-neutral-500 uppercase text-[10px] border-b border-neutral-200 dark:border-white/10"><tr><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Commission</th><th className="py-2 text-right">Seller</th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {data.lines.map((l, i) => <tr key={i}><td className="py-1.5 pr-3 font-bold">{l.orderNumber}</td><td className="py-1.5 pr-3">{l.productName} × {l.quantity}</td><td className="py-1.5 pr-3 text-right">{formatINR(l.totalPrice)}</td><td className="py-1.5 pr-3 text-right">{l.commissionPercent}% · {formatINR(l.commissionAmount)}</td><td className="py-1.5 text-right font-bold">{formatINR(l.sellerEarning)}</td></tr>)}
              {data.adjustments.map((a) => <tr key={`a${a.id}`}><td colSpan={4} className="py-1.5 font-bold">Adjustment: {a.reason}</td><td className={`py-1.5 text-right font-bold ${a.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatINR(a.amount)}</td></tr>)}
            </tbody>
          </table></div>

          <div className="border-t border-neutral-200 pt-3 space-y-1 dark:border-white/10">
            <div className="flex justify-between"><span>Gross</span><b>{formatINR(p.grossAmount)}</b></div>
            <div className="flex justify-between"><span>Platform commission</span><b>{formatINR(p.commissionAmount)}</b></div>
            {p.adjustmentsAmount !== 0 && <div className="flex justify-between"><span>Adjustments</span><b>{formatINR(p.adjustmentsAmount)}</b></div>}
            <div className="flex justify-between text-base"><span className="font-bold">Net to seller</span><b className="text-emerald-600">{formatINR(p.netAmount)}</b></div>
          </div>

          {p.status === 'PROCESSING' && (
            <div className="grid sm:grid-cols-2 gap-4 border-t border-neutral-200 pt-4 dark:border-white/10">
              <div className="space-y-2">
                <p className="font-bold">Mark as paid</p>
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="OTHER">Other</option></select>
                <input className={inputCls} placeholder="UTR / reference number" value={reference} onChange={(e) => setReference(e.target.value)} />
                <button className={btnPrimary} disabled={busy || reference.trim().length < 3} onClick={() => patch({ action: 'MARK_PAID', method, reference: reference.trim() }, 'Payout marked as paid')}>Confirm paid</button>
              </div>
              <div className="space-y-2">
                <p className="font-bold">Transfer failed?</p>
                <input className={inputCls} placeholder="Reason (e.g. invalid IFSC)" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
                <button className={btnDanger} disabled={busy || failReason.trim().length < 3} onClick={() => { if (confirm('Release these earnings back to the seller\'s balance?')) void patch({ action: 'MARK_FAILED', reason: failReason.trim() }, 'Payout marked failed; earnings released'); }}>Mark failed &amp; release</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// -----------------------------------------------------------------------
function Commission() {
  const toast = useToast();
  const settings = useLoad(() => api<CommissionSettings>('/api/admin/settings/commission'), []);
  const [form, setForm] = useState<{ pct: string; hold: string; min: string } | null>(null);
  const [catDraft, setCatDraft] = useState<Record<number, string>>({});
  const [range, setRange] = useState({ from: '', to: '' });
  const qs = `${range.from ? `from=${range.from}&` : ''}${range.to ? `to=${range.to}` : ''}`;
  const report = useLoad(() => api<CommissionReport>(`/api/admin/reports/commission?${qs}`), [range.from, range.to]);

  const s = settings.data?.settings;
  const f = form ?? (s ? { pct: String(s.defaultCommissionPercent), hold: String(s.payoutHoldDays), min: String(s.minPayoutAmount) } : null);

  async function save() {
    if (!f) return;
    try {
      await api('/api/admin/settings/commission', { method: 'PATCH', body: JSON.stringify({ defaultCommissionPercent: Number(f.pct), payoutHoldDays: Number(f.hold), minPayoutAmount: Number(f.min) }) });
      toast.success('Settings saved. Commission changes affect new orders only.');
      setForm(null);
      await settings.reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
  }

  async function saveCat(id: number, clear = false) {
    const raw = catDraft[id];
    try {
      await api(`/api/admin/settings/commission/categories/${id}`, { method: 'PUT', body: JSON.stringify({ commissionPercent: clear ? null : Number(raw) }) });
      toast.success(clear ? 'Category override removed' : 'Category rate saved');
      setCatDraft((d) => { const n = { ...d }; delete n[id]; return n; });
      await settings.reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
  }

  return (
    <div className="space-y-5">
      {settings.error && <ErrorNote message={settings.error} onRetry={settings.reload} />}
      {settings.loading && !settings.data ? <Spinner /> : f && (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className={`${cardCls} p-5 space-y-3`}>
            <h3 className="font-bold">Marketplace settings</h3>
            <p className="text-xs text-neutral-500">Rate precedence: <b>seller override → category override → platform default</b>. The rate is snapshotted on every order item when it is placed.</p>
            <Field label="Default commission (%)"><input type="number" min={0} max={100} step={0.01} className={inputCls} value={f.pct} onChange={(e) => setForm({ ...f, pct: e.target.value })} /></Field>
            <Field label="Payout hold (days after delivery)"><input type="number" min={0} max={90} className={inputCls} value={f.hold} onChange={(e) => setForm({ ...f, hold: e.target.value })} /></Field>
            <Field label="Minimum payout (₹)"><input type="number" min={0} className={inputCls} value={f.min} onChange={(e) => setForm({ ...f, min: e.target.value })} /></Field>
            <button className={btnPrimary} disabled={!form} onClick={save}>Save settings</button>
          </section>
          <section className={`${cardCls} p-5`}>
            <h3 className="font-bold mb-2">Category overrides</h3>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {settings.data?.categories.map((c) => {
                const draft = catDraft[c.categoryId];
                return (
                  <li key={c.categoryId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{c.name}</span>
                    <input type="number" min={0} max={100} step={0.01} className={`${inputCls} !w-24 !py-1`} placeholder={`${s?.defaultCommissionPercent}`} value={draft ?? (c.commissionPercent === null ? '' : String(c.commissionPercent))} onChange={(e) => setCatDraft((d) => ({ ...d, [c.categoryId]: e.target.value }))} />
                    <span className="text-xs">%</span>
                    <button className={btnGhost} disabled={draft === undefined || draft === ''} onClick={() => saveCat(c.categoryId)}>Save</button>
                    {c.commissionPercent !== null && <button className={btnGhost} onClick={() => saveCat(c.categoryId, true)} title="Use default">✕</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <section className={`${cardCls} p-5 space-y-3`}>
        <div className="flex flex-wrap items-end gap-3">
          <h3 className="font-bold mr-auto">Commission report</h3>
          <Field label="From"><input type="date" className={inputCls} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="To (exclusive)"><input type="date" className={inputCls} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          <a className={btnGhost} href={`/api/admin/reports/commission?${qs}${qs ? '&' : ''}format=csv`} download>Download CSV</a>
        </div>
        {report.loading && !report.data ? <Spinner /> : report.error ? <ErrorNote message={report.error} onRetry={report.reload} /> : report.data && (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="text-neutral-500 uppercase text-[10px] border-b border-neutral-200 dark:border-white/10"><tr><th className="py-2 pr-3">Seller</th><th className="py-2 pr-3 text-right">Orders</th><th className="py-2 pr-3 text-right">Gross sales</th><th className="py-2 pr-3 text-right">Commission</th><th className="py-2 pr-3 text-right">of which delivered</th><th className="py-2 text-right">Seller earnings</th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {report.data.sellers.map((r) => <tr key={r.sellerId}><td className="py-2 pr-3 font-bold">{r.storeName}</td><td className="py-2 pr-3 text-right">{r.parcels}</td><td className="py-2 pr-3 text-right">{formatINR(r.grossSales)}</td><td className="py-2 pr-3 text-right">{formatINR(r.commission)}</td><td className="py-2 pr-3 text-right">{formatINR(r.deliveredCommission)}</td><td className="py-2 text-right">{formatINR(r.sellerEarnings)}</td></tr>)}
              <tr className="font-bold"><td className="py-2 pr-3">Total</td><td className="py-2 pr-3 text-right">{report.data.totals.parcels}</td><td className="py-2 pr-3 text-right">{formatINR(report.data.totals.grossSales)}</td><td className="py-2 pr-3 text-right">{formatINR(report.data.totals.commission)}</td><td className="py-2 pr-3 text-right">{formatINR(report.data.totals.deliveredCommission)}</td><td className="py-2 text-right">{formatINR(report.data.totals.sellerEarnings)}</td></tr>
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
