'use client';

import React, { useState } from 'react';
import { formatINR } from '@/src/lib/date';
import { api, useLoad, StatCard, Spinner, ErrorNote, Empty, Badge, Pager, Modal, btnGhost, cardCls, fmtDate, fmtDateTime } from './ui';

interface Summary {
  totalSales: number; totalCommission: number; netEarnings: number; inFulfilment: number; onHold: number; available: number;
  inPayout: number; paidOut: number; pendingAdjustments: number; availableNet: number; payoutHoldDays: number; minPayoutAmount: number;
}
interface LedgerRow {
  id: number; orderNumber: string; orderDate: string; status: string; subtotal: number; commissionAmount: number; sellerEarning: number;
  settlementStatus: string; deliveredAt: string | null; payableAt: string | null; payoutNumber: string | null; isPayable: boolean;
}
interface EarningsResult { summary: Summary; earnings: LedgerRow[]; pagination: { page: number; totalPages: number } }
interface PayoutRow { id: number; payoutNumber: string; status: string; orderCount: number; grossAmount: number; commissionAmount: number; adjustmentsAmount: number; netAmount: number; method: string | null; reference: string | null; createdAt: string; paidAt: string | null }
interface Report {
  payout: PayoutRow & { destination: { accountHolder?: string; bankName?: string; accountMasked?: string; upiId?: string } | null; failureReason: string | null };
  lines: Array<{ orderNumber: string; deliveredAt: string | null; productName: string; variantName: string | null; quantity: number; totalPrice: number; commissionPercent: number; commissionAmount: number; sellerEarning: number }>;
  adjustments: Array<{ id: number; type: string; reason: string; amount: number }>;
}

const SETTLEMENT_LABEL: Record<string, string> = { UNSETTLED: 'Pending', IN_PAYOUT: 'In payout', PAID: 'Paid', VOID: 'Void', LEGACY: 'Before marketplace' };

export default function SellerEarningsTab() {
  const [view, setView] = useState<'ledger' | 'payouts'>('ledger');
  const [settlement, setSettlement] = useState('ALL');
  const [page, setPage] = useState(1);
  const [reportId, setReportId] = useState<number | null>(null);

  const earnings = useLoad(() => api<EarningsResult>(`/api/seller/earnings?settlement=${settlement}&page=${page}`), [settlement, page]);
  const payouts = useLoad(() => api<{ payouts: PayoutRow[] }>('/api/seller/payouts'), []);

  const s = earnings.data?.summary;

  return (
    <div className="space-y-5">
      {earnings.error && <ErrorNote message={earnings.error} onRetry={earnings.reload} />}
      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard label="Available for payout" value={formatINR(s.availableNet)} tone="green" sub={s.pendingAdjustments ? `includes ${formatINR(s.pendingAdjustments)} adjustments` : 'delivered & past the return window'} />
            <StatCard label="On hold" value={formatINR(s.onHold)} sub={`released ${s.payoutHoldDays} days after delivery`} />
            <StatCard label="Awaiting delivery" value={formatINR(s.inFulfilment)} sub="orders still in progress" />
            <StatCard label="Transfer in progress" value={formatINR(s.inPayout)} />
            <StatCard label="Paid out so far" value={formatINR(s.paidOut)} />
            <StatCard label="Commission charged" value={formatINR(s.totalCommission)} sub={`on ${formatINR(s.totalSales)} of sales`} />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Earnings become payable {s.payoutHoldDays} days after delivery. Payouts are settled by the marketplace team (minimum {formatINR(s.minPayoutAmount)}). If an order is returned after payout, its earnings are deducted from your next payout.
          </p>
        </>
      )}

      <div className="flex gap-2">
        {(['ledger', 'payouts'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-full text-xs font-bold border ${view === v ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-brand-300 dark:text-neutral-950' : 'border-neutral-300 text-neutral-700 dark:border-white/15 dark:text-neutral-300'}`}>
            {v === 'ledger' ? 'Order earnings' : 'Payout history'}
          </button>
        ))}
        {view === 'ledger' && (
          <select className="ml-auto px-3 py-1.5 rounded-xl border border-neutral-300 text-xs font-bold bg-transparent dark:border-white/15" value={settlement} onChange={(e) => { setSettlement(e.target.value); setPage(1); }}>
            <option value="ALL">All</option><option value="UNSETTLED">Pending</option><option value="IN_PAYOUT">In payout</option><option value="PAID">Paid</option><option value="VOID">Void</option>
          </select>
        )}
      </div>

      {view === 'ledger' ? (
        earnings.loading && !earnings.data ? <Spinner /> : !earnings.data || earnings.data.earnings.length === 0 ? (
          <div className={cardCls}><Empty>No earnings yet.</Empty></div>
        ) : (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10">
                  <tr><th className="py-3 px-4">Order</th><th className="py-3 px-3">Order status</th><th className="py-3 px-3 text-right">Sales</th><th className="py-3 px-3 text-right">Commission</th><th className="py-3 px-3 text-right">You earn</th><th className="py-3 px-3">Settlement</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                  {earnings.data.earnings.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4"><p className="font-bold text-neutral-900 dark:text-white">{r.orderNumber}</p><p className="text-[11px] text-neutral-500">{fmtDate(r.orderDate)}</p></td>
                      <td className="py-3 px-3"><Badge status={r.status} /></td>
                      <td className="py-3 px-3 text-right">{formatINR(r.subtotal)}</td>
                      <td className="py-3 px-3 text-right text-red-600">−{formatINR(r.commissionAmount)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{formatINR(r.sellerEarning)}</td>
                      <td className="py-3 px-3">
                        <Badge status={r.settlementStatus} label={r.isPayable ? 'Ready for payout' : SETTLEMENT_LABEL[r.settlementStatus]} />
                        {r.payoutNumber && <p className="text-[10px] text-neutral-500 mt-0.5">{r.payoutNumber}</p>}
                        {r.payableAt && !r.isPayable && <p className="text-[10px] text-neutral-500 mt-0.5">payable {fmtDate(r.payableAt)}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : payouts.loading && !payouts.data ? <Spinner /> : !payouts.data || payouts.data.payouts.length === 0 ? (
        <div className={cardCls}><Empty>No payouts yet. Your first payout will appear here once your earnings are settled.</Empty></div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10">
                <tr><th className="py-3 px-4">Payout</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Orders</th><th className="py-3 px-3 text-right">Net amount</th><th className="py-3 px-3">Reference</th><th className="py-3 px-3 text-right">Report</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {payouts.data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4"><p className="font-bold text-neutral-900 dark:text-white">{p.payoutNumber}</p><p className="text-[11px] text-neutral-500">{fmtDate(p.paidAt || p.createdAt)}</p></td>
                    <td className="py-3 px-3"><Badge status={p.status} /></td>
                    <td className="py-3 px-3 text-right">{p.orderCount}</td>
                    <td className="py-3 px-3 text-right font-bold">{formatINR(p.netAmount)}</td>
                    <td className="py-3 px-3 text-neutral-500">{p.reference || '—'}</td>
                    <td className="py-3 px-3 text-right"><button className={btnGhost} onClick={() => setReportId(p.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view === 'ledger' && earnings.data && <Pager page={earnings.data.pagination.page} totalPages={earnings.data.pagination.totalPages} onPage={setPage} />}

      {reportId !== null && <ReportModal id={reportId} onClose={() => setReportId(null)} />}
    </div>
  );
}

function ReportModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, error, loading } = useLoad(() => api<Report>(`/api/seller/payouts/${id}`), [id]);
  return (
    <Modal title="Settlement report" onClose={onClose} wide>
      {loading ? <Spinner /> : error ? <ErrorNote message={error} /> : data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-bold text-neutral-950 dark:text-white">{data.payout.payoutNumber}</p><p className="text-xs text-neutral-500">Created {fmtDateTime(data.payout.createdAt)}{data.payout.paidAt ? ` · Paid ${fmtDateTime(data.payout.paidAt)}` : ''}</p></div>
            <div className="flex items-center gap-2"><Badge status={data.payout.status} /><a className={btnGhost} href={`/api/seller/payouts/${id}?format=csv`} download>Download CSV</a></div>
          </div>
          {data.payout.failureReason && <ErrorNote message={`Transfer failed: ${data.payout.failureReason}. The earnings were released and will be included in your next payout.`} />}
          {data.payout.destination && <p className="text-xs text-neutral-500">Sent to {data.payout.destination.accountHolder} · {data.payout.destination.bankName} {data.payout.destination.accountMasked}{data.payout.destination.upiId ? ` · ${data.payout.destination.upiId}` : ''}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-500 uppercase text-[10px] border-b border-neutral-200 dark:border-white/10"><tr><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Comm.</th><th className="py-2 text-right">Earning</th></tr></thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {data.lines.map((l, i) => (
                  <tr key={i}><td className="py-2 pr-3 font-bold">{l.orderNumber}</td><td className="py-2 pr-3">{l.productName}{l.variantName ? ` (${l.variantName})` : ''} × {l.quantity}</td><td className="py-2 pr-3 text-right">{formatINR(l.totalPrice)}</td><td className="py-2 pr-3 text-right text-red-600">{l.commissionPercent}% · −{formatINR(l.commissionAmount)}</td><td className="py-2 text-right font-bold text-emerald-600">{formatINR(l.sellerEarning)}</td></tr>
                ))}
                {data.adjustments.map((a) => (
                  <tr key={`a${a.id}`}><td className="py-2 pr-3 font-bold" colSpan={4}>Adjustment: {a.reason}</td><td className={`py-2 text-right font-bold ${a.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{a.amount < 0 ? '−' : '+'}{formatINR(Math.abs(a.amount))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-neutral-200 pt-3 space-y-1 dark:border-white/10">
            <div className="flex justify-between"><span>Gross sales</span><b>{formatINR(data.payout.grossAmount)}</b></div>
            <div className="flex justify-between"><span>Commission</span><b className="text-red-600">−{formatINR(data.payout.commissionAmount)}</b></div>
            {data.payout.adjustmentsAmount !== 0 && <div className="flex justify-between"><span>Adjustments</span><b>{formatINR(data.payout.adjustmentsAmount)}</b></div>}
            <div className="flex justify-between text-base"><span className="font-bold">Net payout</span><b className="text-emerald-600">{formatINR(data.payout.netAmount)}</b></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
