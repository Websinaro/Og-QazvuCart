'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/src/lib/api';
import { formatINR } from '@/src/lib/date';

interface Row { id: number; orderNumber: string; total: number; customer: string; reason: string; details: string | null; status: string; adminNote: string | null; createdAt: string }

export default function AdminReturnsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const j = await authFetch('/api/admin/returns?status=REQUESTED').then((r) => r.json()).catch(() => null);
    if (j?.success) setRows(j.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id: number, decision: 'APPROVE' | 'REJECT') => {
    const note = decision === 'REJECT' ? prompt('Reason shown to the customer (optional):') ?? '' : '';
    if (decision === 'APPROVE' && !confirm('Approve this return? The order will be marked Returned and the refund started.')) return;
    const j = await authFetch(`/api/admin/returns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }) }).then((r) => r.json());
    if (!j.success) setErr(j.error?.message || 'Failed'); else { setErr(''); load(); }
  };

  if (!rows.length && !err) return null;
  return (
    <div className="bg-white rounded-2xl p-5 border border-amber-300 shadow-soft dark:bg-[#17140b] dark:border-amber-500/30 space-y-3">
      <h3 className="text-base font-semibold text-neutral-950 dark:text-white">Pending return requests ({rows.length})</h3>
      {err && <p className="text-xs font-bold text-red-600">{err}</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-neutral-100 pt-3 dark:border-white/10 text-neutral-800 dark:text-neutral-200">
          <div>
            <p className="font-bold">{r.orderNumber} · {formatINR(r.total)} · {r.customer}</p>
            <p className="text-neutral-500 dark:text-neutral-400">{r.reason.replace(/_/g, ' ').toLowerCase()}{r.details ? ` — ${r.details}` : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => resolve(r.id, 'APPROVE')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold">Approve</button>
            <button onClick={() => resolve(r.id, 'REJECT')} className="px-3 py-1.5 rounded-lg border border-neutral-300 font-bold dark:border-white/15">Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}
