'use client';

import React, { useState } from 'react';
import { authFetch } from '@/src/lib/api';
import { formatINR } from '@/src/lib/date';

interface Detail {
  status: string;
  estimatedDeliveryDate: string;
  canCancel: boolean;
  returnEligibleUntil: string | null;
  timeline: { status: string; title: string; description: string; completed: boolean; occurredAt: string | null }[];
  parcels: { id: number; sellerName: string; status: string; carrier: string | null; trackingNumber: string | null }[];
  returnRequest: { status: string; reason: string; adminNote: string | null } | null;
  refunds: { amount: number; status: string; createdAt: string; processedAt: string | null }[];
}

const REASONS: [string, string][] = [
  ['DAMAGED', 'Item arrived damaged'], ['WRONG_ITEM', 'Wrong item received'],
  ['NOT_AS_DESCRIBED', 'Not as described'], ['NO_LONGER_NEEDED', 'No longer needed'], ['OTHER', 'Other'],
];
const REFUND_LABEL: Record<string, string> = { PENDING: 'Refund initiated', PROCESSING: 'Refund processing', PROCESSED: 'Refunded to your account', SUCCEEDED: 'Refunded to your account', COMPLETED: 'Refunded to your account', REFUNDED: 'Refunded to your account', FAILED: 'Refund delayed — retrying' };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function OrderTrackingPanel({ orderId, onChanged }: { orderId: number; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Detail | null>(null);
  const [msg, setMsg] = useState('');
  const [reason, setReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const j = await authFetch(`/api/orders/${orderId}`).then((r) => r.json()).catch(() => null);
    const order = j?.data?.order ?? j?.data;
    if (order) setD(order);
    else setMsg('Could not load tracking details.');
  };
  const toggle = async () => { const n = !open; setOpen(n); if (n && !d) await load(); };

  const act = async (url: string, body?: unknown) => {
    setBusy(true); setMsg('');
    try {
      const j = await authFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
      if (!j.success) throw new Error(j.error?.message || 'Something went wrong');
      setShowReturn(false); await load(); onChanged?.();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="p-5 bg-neutral-50/40 dark:bg-white/[0.03] space-y-3">
      <button onClick={toggle} className="text-xs font-bold text-neutral-800 underline dark:text-neutral-200">{open ? 'Hide tracking' : 'Track order'}</button>
      {open && !d && !msg && <p className="text-xs text-neutral-500">Loading…</p>}
      {msg && <p className="text-xs font-bold text-red-600">{msg}</p>}
      {open && d && (
        <div className="space-y-4 text-xs text-neutral-800 dark:text-neutral-200">
          {!['DELIVERED', 'CANCELLED', 'RETURNED'].includes(d.status) && d.estimatedDeliveryDate && (
            <p>Estimated delivery: <b>{d.estimatedDeliveryDate}</b></p>
          )}

          <ol className="relative border-l-2 border-neutral-200 dark:border-white/15 ml-2 space-y-4">
            {d.timeline.map((t) => (
              <li key={t.status} className="pl-5 relative">
                <span className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 ${t.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-neutral-300 dark:bg-[#17140b] dark:border-white/20'}`} />
                <p className={t.completed ? 'font-bold' : 'text-neutral-400'}>{t.title}</p>
                {t.completed && <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{fmt(t.occurredAt)} · {t.description}</p>}
              </li>
            ))}
          </ol>

          {d.parcels.some((p) => p.trackingNumber) && (
            <div className="space-y-1">
              {d.parcels.filter((p) => p.trackingNumber).map((p) => (
                <p key={p.id} className="rounded-lg bg-white border border-neutral-200 p-2 dark:bg-[#17140b] dark:border-white/10">
                  📦 {p.sellerName}: <b>{p.carrier || 'Carrier'}</b> · Tracking <b className="select-all">{p.trackingNumber}</b>{p.carrier === 'Delhivery' && (
                    <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://www.delhivery.com/track-v2/package/${p.trackingNumber}`}>Track live</a></>
                  )}
                </p>
              ))}
            </div>
          )}

          {d.returnRequest && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-300">
              Return {d.returnRequest.status === 'REQUESTED' ? 'under review' : d.returnRequest.status.toLowerCase()}
              {d.returnRequest.adminNote ? ` — ${d.returnRequest.adminNote}` : ''}
            </p>
          )}

          {d.refunds.map((r, i) => (
            <p key={i} className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-300">
              {REFUND_LABEL[r.status] || `Refund ${r.status.toLowerCase()}`}: <b>{formatINR(r.amount)}</b> · started {fmt(r.createdAt)}{r.processedAt ? ` · completed ${fmt(r.processedAt)}` : ''}
            </p>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            {d.canCancel && (
              <button disabled={busy} onClick={() => confirm('Cancel this order?') && act(`/api/orders/${orderId}/cancel`)} className="font-bold text-red-600 underline disabled:opacity-50">Cancel order</button>
            )}
            {d.returnEligibleUntil && !showReturn && (
              <button onClick={() => setShowReturn(true)} className="font-bold underline">Request return <span className="font-normal text-neutral-500">(until {new Date(d.returnEligibleUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span></button>
            )}
          </div>

          {showReturn && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:bg-[#17140b] dark:border-white/15">
                <option value="">Select a reason…</option>
                {REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button disabled={!reason || busy} onClick={() => act(`/api/orders/${orderId}/return`, { reason })} className="px-3 py-1.5 rounded-lg bg-neutral-950 text-white font-bold disabled:opacity-50 dark:bg-white dark:text-neutral-950">Submit</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
