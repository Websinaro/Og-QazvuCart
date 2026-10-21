'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/src/lib/api';
import { formatINR } from '@/src/lib/date';

type Gran = 'day' | 'week' | 'month';
interface Insights {
  summary: Record<'today' | 'week' | 'month', { revenue: number; orders: number }>;
  series: { period: string; revenue: number; orders: number }[];
  topProducts: { id: number; name: string; units: number; revenue: number }[];
  categories: { name: string; revenue: number; units: number }[];
  sellers: { id: number; storeName: string; parcels: number; grossSales: number; commission: number; earnings: number; problemRate: number | null }[];
  returns: { cancelled: number; returned: number; total: number; cancelRate: number; returnRate: number; refundCount: number; refundAmount: number; refundPending: number };
  lowStock: { id: number; name: string; stock: number; sold30: number; daysLeft: number | null }[];
}

const card = 'bg-white rounded-2xl p-5 border border-neutral-200 shadow-soft dark:bg-[#17140b] dark:border-white/10';
const h2 = 'text-base font-semibold text-neutral-950 dark:text-white mb-3';
const muted = 'text-neutral-500 dark:text-neutral-400';

function download(path: string) {
  window.location.href = path; // cookie-authenticated; browser handles the CSV download
}

function BarChart({ data }: { data: Insights['series'] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  if (!data.length) return <p className={`text-xs py-10 text-center ${muted}`}>No paid orders in this range yet.</p>;
  return (
    <div className="flex items-end gap-1 h-44">
      {data.map((d) => (
        <div key={d.period} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div className="absolute -top-1 hidden group-hover:block z-10 text-[10px] font-bold bg-neutral-900 text-white rounded px-1.5 py-0.5 whitespace-nowrap">
            {d.period.slice(5)} · {formatINR(d.revenue)} · {d.orders} orders
          </div>
          <div className="w-full bg-yellow-400 rounded-t-md min-h-[2px]" style={{ height: `${(d.revenue / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminInsightsPanel() {
  const [gran, setGran] = useState<Gran>('day');
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/admin/insights?granularity=${gran}`).then((r) => r.json());
      if (res.success) { setData(res.data); setError(''); } else setError(res.error?.message || 'Failed to load insights');
    } catch { setError('Failed to load insights'); }
  }, [gran]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // near-real-time refresh
    return () => clearInterval(t);
  }, [load]);

  if (error) return <div className={`${card} text-xs text-red-600`}>{error}</div>;
  if (!data) return <div className={`${card} text-xs ${muted}`}>Loading insights…</div>;
  const { summary, returns: ret } = data;

  return (
    <div className="space-y-6">
      {/* Real-time summaries + exports */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-950 dark:text-white">Sales Insights <span className={`text-[11px] font-medium ${muted}`}>· auto-refreshes every 30s</span></h2>
        <div className="flex gap-2">
          {(['orders', 'products', 'sales'] as const).map((t) => (
            <button key={t} onClick={() => download(`/api/admin/export/${t}`)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
              ⬇ {t[0].toUpperCase() + t.slice(1)} CSV
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['today', 'week', 'month'] as const).map((k) => (
          <div key={k} className={card}>
            <p className={`text-xs font-bold uppercase tracking-wider ${muted}`}>{k === 'today' ? 'Today' : k === 'week' ? 'This week' : 'This month'}</p>
            <p className="text-2xl font-bold text-neutral-950 dark:text-white mt-1">{formatINR(summary[k].revenue)}</p>
            <p className={`text-xs ${muted}`}>{summary[k].orders} paid orders</p>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">Revenue</h3>
          <div className="flex gap-1 text-xs font-bold">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button key={g} onClick={() => setGran(g)} className={`px-2.5 py-1 rounded-lg ${gran === g ? 'bg-yellow-400 text-neutral-950' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10'}`}>
                {g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
        <BarChart data={data.series} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className={card}>
          <h3 className={h2}>Top-selling products</h3>
          <div className="divide-y divide-neutral-100 dark:divide-white/10 text-xs">
            {data.topProducts.map((p, i) => (
              <div key={p.id} className="py-2 flex justify-between gap-3">
                <span className="font-bold text-neutral-900 dark:text-white truncate">{i + 1}. {p.name}</span>
                <span className={`${muted} whitespace-nowrap`}>{p.units} sold · <b className="text-neutral-950 dark:text-white">{formatINR(p.revenue)}</b></span>
              </div>
            ))}
            {!data.topProducts.length && <p className={`py-6 text-center ${muted}`}>No sales yet.</p>}
          </div>
        </div>

        {/* Category performance */}
        <div className={card}>
          <h3 className={h2}>Category performance</h3>
          <div className="space-y-3">
            {data.categories.map((c) => {
              const max = Math.max(1, data.categories[0]?.revenue || 1);
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    <span>{c.name}</span><span>{formatINR(c.revenue)} · {c.units} units</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden dark:bg-white/10">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.max(3, (c.revenue / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {!data.categories.length && <p className={`py-6 text-center text-xs ${muted}`}>No category sales yet.</p>}
          </div>
        </div>
      </div>

      {/* Seller performance & commission */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h3 className={h2}>Seller performance & commission</h3>
          <button onClick={() => download('/api/admin/reports/commission?format=csv')} className="text-xs font-bold text-neutral-700 hover:underline dark:text-neutral-300">⬇ Commission CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] dark:bg-white/[0.04] dark:text-neutral-300">
              <tr><th className="py-2 px-3">Seller</th><th className="px-3">Orders</th><th className="px-3">Gross</th><th className="px-3">Commission</th><th className="px-3">Seller earnings</th><th className="px-3">Cancel/return %</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10 text-neutral-800 dark:text-neutral-200">
              {data.sellers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 px-3 font-bold">{s.storeName}</td><td className="px-3">{s.parcels}</td>
                  <td className="px-3">{formatINR(s.grossSales)}</td><td className="px-3 text-emerald-600 font-bold">{formatINR(s.commission)}</td>
                  <td className="px-3">{formatINR(s.earnings)}</td>
                  <td className={`px-3 font-bold ${(s.problemRate ?? 0) > 15 ? 'text-red-600' : ''}`}>{s.problemRate ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cancellations / returns / refunds */}
        <div className={card}>
          <h3 className={h2}>Cancellations, returns & refunds</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Cancelled', `${ret.cancelled} (${ret.cancelRate}%)`],
              ['Returned', `${ret.returned} (${ret.returnRate}%)`],
              ['Refunds issued', `${ret.refundCount} · ${formatINR(ret.refundAmount)}`],
              ['Refunds pending/failed', String(ret.refundPending)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-neutral-50 dark:bg-white/[0.04] p-3">
                <p className={`font-bold uppercase text-[10px] ${muted}`}>{label}</p>
                <p className="text-sm font-bold text-neutral-950 dark:text-white mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock + forecast */}
        <div className={card}>
          <h3 className={h2}>Low stock & inventory forecast</h3>
          <div className="divide-y divide-neutral-100 dark:divide-white/10 text-xs">
            {data.lowStock.map((p) => (
              <div key={p.id} className="py-2 flex justify-between gap-3">
                <span className="font-bold text-neutral-900 dark:text-white truncate">{p.name}</span>
                <span className="whitespace-nowrap">
                  <b className="text-red-600">{p.stock} left</b>
                  <span className={muted}> · {p.daysLeft === null ? 'no recent sales' : `~${p.daysLeft}d of stock (${p.sold30} sold/30d)`}</span>
                </span>
              </div>
            ))}
            {!data.lowStock.length && <p className={`py-6 text-center ${muted}`}>Stock looks healthy.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
