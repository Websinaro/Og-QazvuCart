'use client';

import React from 'react';
import { formatINR } from '@/src/lib/date';
import { api, useLoad, StatCard, Spinner, ErrorNote, cardCls, Badge, fmtDate, Empty } from './ui';
import type { SellerTab } from './types';

interface Dashboard {
  products: { active: number; lowStock: number; outOfStock: number };
  sales: { today: number; last7: number; last30: number };
  salesSeries: Array<{ day: string; sales: number; orders: number }>;
  fulfilment: { toPack: number; toShip: number; inTransit: number; delivered: number; cancelled: number; returned: number };
  earnings: { availableNet: number; inFulfilment: number; onHold: number; inPayout: number; paidOut: number; totalCommission: number; netEarnings: number };
  unansweredQuestions: number;
  recentOrders: Array<{ id: number; orderNumber: string; orderDate: string; status: string; subtotal: number; sellerEarning: number }>;
}

export default function SellerOverviewTab({ onNavigate }: { onNavigate: (t: SellerTab) => void }) {
  const { data, error, loading, reload } = useLoad(() => api<Dashboard>('/api/seller/dashboard'), []);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return null;

  const max = Math.max(1, ...data.salesSeries.map((d) => d.sales));
  const f = data.fulfilment;

  const todo: Array<{ label: string; n: number; tab: SellerTab }> = [
    { label: 'To pack', n: f.toPack, tab: 'orders' },
    { label: 'To ship', n: f.toShip, tab: 'orders' },
    { label: 'In transit', n: f.inTransit, tab: 'orders' },
    { label: 'Unanswered questions', n: data.unansweredQuestions, tab: 'questions' },
    { label: 'Low / out of stock', n: data.products.lowStock + data.products.outOfStock, tab: 'products' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sales today" value={formatINR(data.sales.today)} />
        <StatCard label="Last 7 days" value={formatINR(data.sales.last7)} />
        <StatCard label="Last 30 days" value={formatINR(data.sales.last30)} />
        <StatCard label="Available to withdraw" value={formatINR(data.earnings.availableNet)} tone="green" sub={`${formatINR(data.earnings.onHold + data.earnings.inFulfilment)} still pending`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {todo.map((t) => (
          <button key={t.label} onClick={() => onNavigate(t.tab)} className={`${cardCls} p-3 text-left hover:border-neutral-400 transition-colors`}>
            <p className={`text-2xl font-bold ${t.n > 0 ? 'text-amber-600' : 'text-neutral-400'}`}>{t.n}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t.label}</p>
          </button>
        ))}
      </div>

      <div className={`${cardCls} p-4`}>
        <p className="text-sm font-bold text-neutral-950 mb-3 dark:text-white">Sales, last 14 days</p>
        <div className="flex items-end gap-1.5 h-32" role="img" aria-label="Daily sales for the last 14 days">
          {data.salesSeries.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.day}: ${formatINR(d.sales)} · ${d.orders} order(s)`}>
              <div className="w-full rounded-t-md bg-neutral-900 group-hover:bg-brand-400 dark:bg-brand-300" style={{ height: `${Math.max(3, (d.sales / max) * 100)}%`, opacity: d.sales ? 1 : 0.2 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-neutral-400 mt-1.5">
          <span>{fmtDate(data.salesSeries[0]?.day)}</span>
          <span>{fmtDate(data.salesSeries[data.salesSeries.length - 1]?.day)}</span>
        </div>
      </div>

      <div className={`${cardCls} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-neutral-950 dark:text-white">Recent orders</p>
          <button onClick={() => onNavigate('orders')} className="text-xs font-bold underline">View all</button>
        </div>
        {data.recentOrders.length === 0 ? (
          <Empty>No orders yet. Once customers buy your products they will show up here.</Empty>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-bold text-neutral-900 dark:text-white">{o.orderNumber}</p>
                  <p className="text-[11px] text-neutral-500">{fmtDate(o.orderDate)}</p>
                </div>
                <Badge status={o.status} />
                <div className="text-right">
                  <p className="font-bold">{formatINR(o.subtotal)}</p>
                  <p className="text-[11px] text-emerald-600">you earn {formatINR(o.sellerEarning)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
