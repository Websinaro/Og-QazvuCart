'use client';

import React, { useState } from 'react';
import { formatINR } from '@/src/lib/date';
import { useToast } from '@/src/context/ToastContext';
import { api, useLoad, Spinner, ErrorNote, Empty, Badge, Modal, Field, inputCls, btnPrimary, btnGhost, btnDanger, cardCls, fmtDate } from '@/src/components/seller/ui';
import type { SellerProfile } from '@/src/components/seller/types';

type AdminSeller = SellerProfile & { ownerUsername: string; ownerEmail: string; ownerPhone: string; productCount: number; lifetimeSales: number };
interface ListResult { sellers: AdminSeller[]; counts: Record<string, number> }
interface Detail {
  seller: AdminSeller;
  earnings: { totalSales: number; totalCommission: number; available: number; availableNet: number; onHold: number; inFulfilment: number; inPayout: number; paidOut: number; pendingAdjustments: number };
  rateCard: { platformDefaultPercent: number; categories: Array<{ categoryId: number; name: string; percent: number; source: string }> };
}

const STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED', 'ALL'];

type Action =
  | { kind: 'reject' | 'suspend'; seller: AdminSeller }
  | { kind: 'commission'; seller: AdminSeller }
  | { kind: 'detail'; seller: AdminSeller };

export default function AdminSellersPanel({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [q, setQ] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const { data, error, loading, reload } = useLoad(() => api<ListResult>(`/api/admin/sellers?status=${status}&q=${encodeURIComponent(q)}`), [status, q]);

  async function act(id: number, body: Record<string, unknown>, okMsg: string) {
    setBusy(id);
    try {
      await api(`/api/admin/sellers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(okMsg);
      setAction(null);
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${status === s ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-brand-300 dark:text-neutral-950' : 'border-neutral-300 text-neutral-700 dark:border-white/15 dark:text-neutral-300'}`}>
            {s === 'PENDING' ? 'Applications' : s[0] + s.slice(1).toLowerCase()}{s !== 'ALL' && data?.counts[s] ? ` (${data.counts[s]})` : ''}
          </button>
        ))}
        <input className={`${inputCls} max-w-[240px] ml-auto`} placeholder="Search store or owner…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : !data || data.sellers.length === 0 ? (
        <div className={cardCls}><Empty>{status === 'PENDING' ? 'No applications waiting for review.' : 'No sellers in this view.'}</Empty></div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10">
                <tr><th className="py-3 px-4">Store</th><th className="py-3 px-3">Owner</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Products</th><th className="py-3 px-3 text-right">Sales</th><th className="py-3 px-3">Commission</th><th className="py-3 px-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {data.sellers.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4"><button className="font-bold text-neutral-950 hover:underline text-left dark:text-white" onClick={() => setAction({ kind: 'detail', seller: s })}>{s.storeName}</button><p className="text-[11px] text-neutral-500">Applied {fmtDate(s.createdAt)}</p></td>
                    <td className="py-3 px-3"><p className="font-semibold">{s.ownerUsername}</p><p className="text-[11px] text-neutral-500">{s.ownerEmail}</p></td>
                    <td className="py-3 px-3"><Badge status={s.status} /></td>
                    <td className="py-3 px-3 text-right">{s.productCount}</td>
                    <td className="py-3 px-3 text-right">{formatINR(s.lifetimeSales)}</td>
                    <td className="py-3 px-3">{s.commissionOverridePercent !== null ? <b>{s.commissionOverridePercent}% (custom)</b> : <span className="text-neutral-500">Default</span>}</td>
                    <td className="py-3 px-3">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {(s.status === 'PENDING' || s.status === 'REJECTED') && <button className={btnPrimary} disabled={busy === s.id} onClick={() => act(s.id, { action: 'approve' }, `${s.storeName} approved`)}>Approve</button>}
                        {s.status === 'PENDING' && <button className={btnDanger} onClick={() => setAction({ kind: 'reject', seller: s })}>Reject</button>}
                        {s.status === 'APPROVED' && <button className={btnDanger} onClick={() => setAction({ kind: 'suspend', seller: s })}>Suspend</button>}
                        {s.status === 'SUSPENDED' && <button className={btnPrimary} disabled={busy === s.id} onClick={() => act(s.id, { action: 'reinstate' }, `${s.storeName} reinstated`)}>Reinstate</button>}
                        <a className={btnGhost} href={`/seller-center?seller=${s.id}`}>Open Seller Center</a>
                        <button className={btnGhost} onClick={() => setAction({ kind: 'commission', seller: s })}>Commission</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {action && (action.kind === 'reject' || action.kind === 'suspend') && (
        <ReasonModal kind={action.kind} seller={action.seller} busy={busy === action.seller.id} onClose={() => setAction(null)} onSubmit={(reason) => act(action.seller.id, { action: action.kind, reason }, action.kind === 'reject' ? 'Application rejected' : 'Seller suspended')} />
      )}
      {action?.kind === 'commission' && (
        <CommissionModal seller={action.seller} busy={busy === action.seller.id} onClose={() => setAction(null)} onSubmit={(pct) => act(action.seller.id, { action: 'set_commission', commissionPercent: pct }, pct === null ? 'Custom rate removed' : `Commission set to ${pct}%`)} />
      )}
      {action?.kind === 'detail' && <DetailModal id={action.seller.id} onClose={() => setAction(null)} />}
    </div>
  );
}

function ReasonModal({ kind, seller, busy, onClose, onSubmit }: { kind: 'reject' | 'suspend'; seller: AdminSeller; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`${kind === 'reject' ? 'Reject application' : 'Suspend seller'}: ${seller.storeName}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Reason (shown to the seller)" hint={kind === 'suspend' ? 'Their products are hidden immediately; open orders can still be fulfilled.' : 'They can edit their details and re-apply.'}>
          <textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnDanger} disabled={busy || reason.trim().length < 5} onClick={() => onSubmit(reason.trim())}>{kind === 'reject' ? 'Reject' : 'Suspend'}</button></div>
      </div>
    </Modal>
  );
}

function CommissionModal({ seller, busy, onClose, onSubmit }: { seller: AdminSeller; busy: boolean; onClose: () => void; onSubmit: (pct: number | null) => void }) {
  const [pct, setPct] = useState(seller.commissionOverridePercent === null ? '' : String(seller.commissionOverridePercent));
  const n = Number(pct);
  const valid = pct.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100;
  return (
    <Modal title={`Commission: ${seller.storeName}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-neutral-500">A custom rate overrides the category and platform rates for this seller. It applies to <b>new orders only</b>; existing orders keep the rate they were placed with.</p>
        <Field label="Custom commission (%)"><input type="number" min={0} max={100} step={0.01} className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Leave empty to use defaults" /></Field>
        <div className="flex justify-between gap-2">
          <button className={btnGhost} disabled={busy || seller.commissionOverridePercent === null} onClick={() => onSubmit(null)}>Remove custom rate</button>
          <div className="flex gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={busy || !valid} onClick={() => onSubmit(n)}>Save</button></div>
        </div>
      </div>
    </Modal>
  );
}

function DetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, error, loading } = useLoad(() => api<Detail>(`/api/admin/sellers/${id}`), [id]);
  const s = data?.seller;
  const e = data?.earnings;
  return (
    <Modal title="Seller details" onClose={onClose} wide>
      {loading ? <Spinner /> : error ? <ErrorNote message={error} /> : s && e && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2"><h4 className="text-lg font-bold">{s.storeName}</h4><Badge status={s.status} /></div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <p><b>Owner:</b> {s.ownerUsername} ({s.ownerEmail}, {s.ownerPhone})</p>
            <p><b>Tax ID:</b> {s.taxId || '—'}</p>
            <p><b>Support:</b> {s.supportEmail || '—'} · {s.supportPhone || '—'}</p>
            <p><b>Payout account:</b> {s.payout.isConfigured ? `${s.payout.accountHolder || ''} ${s.payout.accountMasked || ''} ${s.payout.upiId || ''}` : 'not set up'}</p>
            <p className="sm:col-span-2"><b>Address:</b> {s.businessAddress || '—'}</p>
            {s.description && <p className="sm:col-span-2"><b>About:</b> {s.description}</p>}
            {s.rejectionReason && <p className="sm:col-span-2 text-red-600"><b>Rejected:</b> {s.rejectionReason}</p>}
            {s.suspensionReason && <p className="sm:col-span-2 text-red-600"><b>Suspended:</b> {s.suspensionReason}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {([['Sales', e.totalSales], ['Commission', e.totalCommission], ['Payable now', e.availableNet], ['Paid out', e.paidOut], ['On hold', e.onHold], ['In fulfilment', e.inFulfilment], ['In payout', e.inPayout], ['Adjustments', e.pendingAdjustments]] as Array<[string, number]>).map(([l, v]) => (
              <div key={l} className="rounded-xl border border-neutral-200 p-2 dark:border-white/10"><p className="text-[10px] uppercase font-bold text-neutral-500">{l}</p><p className="font-bold">{formatINR(v)}</p></div>
            ))}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Effective commission by category</p>
            <ul className="grid sm:grid-cols-2 gap-x-6 text-xs">{data.rateCard.categories.map((c) => <li key={c.categoryId} className="flex justify-between border-b border-neutral-100 py-1 dark:border-white/10"><span>{c.name}</span><span><b>{c.percent}%</b> <span className="text-neutral-400">{c.source.toLowerCase()}</span></span></li>)}</ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
