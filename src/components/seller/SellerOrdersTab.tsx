'use client';

import React, { useState } from 'react';
import { formatINR } from '@/src/lib/date';
import { useToast } from '@/src/context/ToastContext';
import { api, useLoad, Spinner, ErrorNote, Empty, Badge, Pager, Modal, Field, inputCls, btnPrimary, btnGhost, btnDanger, cardCls, fmtDate, fmtDateTime } from './ui';

interface Item { id: number; productName: string; productImage: string; variantName: string | null; unitPrice: number; quantity: number; totalPrice: number; commissionBps: number; commissionAmount: number; sellerEarning: number }
interface Parcel {
  id: number; orderNumber: string; orderDate: string; status: string; paymentMethod: string; paymentStatus: string;
  subtotal: number; commissionAmount: number; sellerEarning: number; carrier: string | null; trackingNumber: string | null;
  settlementStatus: string; deliveredAt: string | null; estimatedDeliveryDate: string | null;
  shippingAddress: { fullName?: string; phoneNumber?: string; houseBuilding?: string; streetArea?: string; city?: string; state?: string; postalCode?: string } | null;
  items: Item[];
}
interface ListResult { orders: Parcel[]; counts: Record<string, number>; pagination: { page: number; totalPages: number; total: number } }

const FILTERS = ['ALL', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const NEXT: Record<string, { status: string; label: string } | undefined> = {
  CONFIRMED: { status: 'PACKED', label: 'Mark packed' },
  PACKED: { status: 'SHIPPED', label: 'Mark shipped' },
  SHIPPED: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
};
const CAN_CANCEL = ['CONFIRMED', 'PACKED'];

export default function SellerOrdersTab() {
  const toast = useToast();
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Parcel | null>(null);
  const [ship, setShip] = useState<{ parcel: Parcel; mode: 'ship' | 'track' } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const { data, error, loading, reload } = useLoad(
    () => api<ListResult>(`/api/seller/orders?status=${status}&q=${encodeURIComponent(q)}&page=${page}`),
    [status, page, q]
  );

  async function update(parcel: Parcel, body: Record<string, unknown>, okMsg: string) {
    setBusy(parcel.id);
    try {
      await api(`/api/seller/orders/${parcel.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(okMsg);
      setShip(null);
      setOpen(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  function advance(p: Parcel) {
    const next = NEXT[p.status];
    if (!next) return;
    if (next.status === 'SHIPPED') return setShip({ parcel: p, mode: 'ship' }); // collect carrier + tracking first
    void update(p, { status: next.status }, `Order ${p.orderNumber} updated`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setStatus(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${status === f ? 'bg-neutral-950 text-white border-neutral-950 dark:bg-brand-300 dark:text-neutral-950' : 'border-neutral-300 text-neutral-700 dark:border-white/15 dark:text-neutral-300'}`}>
            {f.replace(/_/g, ' ')}{f !== 'ALL' && data?.counts[f] ? ` (${data.counts[f]})` : ''}
          </button>
        ))}
        <input className={`${inputCls} max-w-[220px] ml-auto`} placeholder="Search order number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : !data || data.orders.length === 0 ? (
        <div className={cardCls}><Empty>No orders in this view.</Empty></div>
      ) : (
        <div className="space-y-3">
          {data.orders.map((p) => {
            const next = NEXT[p.status];
            return (
              <div key={p.id} className={`${cardCls} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <button onClick={() => setOpen(p)} className="font-bold text-neutral-950 underline-offset-2 hover:underline dark:text-white">{p.orderNumber}</button>
                    <p className="text-[11px] text-neutral-500">{fmtDateTime(p.orderDate)} · {p.paymentMethod === 'COD' ? 'Cash on delivery' : p.paymentStatus === 'PAID' ? 'Paid online' : `Payment ${p.paymentStatus.toLowerCase()}`}</p>
                  </div>
                  <Badge status={p.status} />
                </div>

                <ul className="mt-3 space-y-2">
                  {p.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 text-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.productImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-neutral-900 dark:text-white">{i.productName}</p>
                        <p className="text-[11px] text-neutral-500">{i.variantName ? `${i.variantName} · ` : ''}Qty {i.quantity} × {formatINR(i.unitPrice)}</p>
                      </div>
                      <p className="font-bold">{formatINR(i.totalPrice)}</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 dark:border-white/10">
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Sales <b>{formatINR(p.subtotal)}</b> − commission <b>{formatINR(p.commissionAmount)}</b> = <b className="text-emerald-600">you earn {formatINR(p.sellerEarning)}</b>
                  </p>
                  <div className="flex gap-2">
                    {next && <button className={btnPrimary} disabled={busy === p.id} onClick={() => advance(p)}>{next.label}</button>}
                    {CAN_CANCEL.includes(p.status) && (
                      <button className={btnDanger} disabled={busy === p.id} onClick={() => { if (confirm(`Cancel ${p.orderNumber}? Stock will be returned and the customer notified.`)) void update(p, { status: 'CANCELLED' }, 'Order cancelled'); }}>Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />
        </div>
      )}

      {ship && (
        <ShipModal
          parcel={ship.parcel}
          mode={ship.mode}
          busy={busy === ship.parcel.id}
          onClose={() => setShip(null)}
          onSubmit={(carrier, trackingNumber) =>
            update(
              ship.parcel,
              ship.mode === 'ship' ? { status: 'SHIPPED', carrier, trackingNumber } : { carrier, trackingNumber },
              ship.mode === 'ship' ? 'Marked as shipped' : 'Tracking updated'
            )
          }
        />
      )}
      {open && <DetailModal parcel={open} onClose={() => setOpen(null)} onTrack={() => { setShip({ parcel: open, mode: 'track' }); setOpen(null); }} />}
    </div>
  );
}

function ShipModal({ parcel, mode, busy, onClose, onSubmit }: { parcel: Parcel; mode: 'ship' | 'track'; busy: boolean; onClose: () => void; onSubmit: (carrier: string, tracking: string) => void }) {
  const [carrier, setCarrier] = useState(parcel.carrier || '');
  const [tracking, setTracking] = useState(parcel.trackingNumber || '');
  return (
    <Modal title={`${mode === 'ship' ? 'Ship' : 'Tracking for'} ${parcel.orderNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Courier / carrier"><input className={inputCls} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Delhivery" /></Field>
        <Field label="Tracking number" hint="Optional, but customers love it."><input className={inputCls} value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>Back</button>
          <button className={btnPrimary} disabled={busy} onClick={() => onSubmit(carrier, tracking)}>{mode === 'ship' ? 'Mark as shipped' : 'Save tracking'}</button>
        </div>
      </div>
    </Modal>
  );
}

function DetailModal({ parcel: p, onClose, onTrack }: { parcel: Parcel; onClose: () => void; onTrack: () => void }) {
  const a = p.shippingAddress;
  return (
    <Modal title={`Order ${p.orderNumber}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2"><Badge status={p.status} /><span className="text-neutral-500 text-xs">Placed {fmtDate(p.orderDate)}</span></div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Ship to</p>
          {a ? (
            <p className="text-neutral-800 dark:text-neutral-200">{a.fullName} · {a.phoneNumber}<br />{a.houseBuilding}, {a.streetArea}<br />{a.city}, {a.state} {a.postalCode}</p>
          ) : <p className="text-neutral-500">Address is shared once the order is paid and ready to fulfil.</p>}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Tracking</p>
          <p>{p.carrier || '—'} {p.trackingNumber ? `· ${p.trackingNumber}` : ''}</p>
          {['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(p.status) && <button className={`${btnGhost} mt-2`} onClick={onTrack}>Edit courier / tracking</button>}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Commission per item</p>
          <ul className="space-y-1">
            {p.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3"><span className="truncate">{i.productName} × {i.quantity}</span><span className="shrink-0 text-neutral-500">{(i.commissionBps / 100).toFixed(2)}% = {formatINR(i.commissionAmount)} → <b className="text-emerald-600">{formatINR(i.sellerEarning)}</b></span></li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-500">Earnings status: <Badge status={p.settlementStatus} /></p>
      </div>
    </Modal>
  );
}
