'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/src/lib/api';

interface Q { id: number; questionText: string; productName: string; askedBy: string }

export default function AdminQuestionsPanel() {
  const [rows, setRows] = useState<Q[]>([]);
  const load = useCallback(async () => {
    const j = await authFetch('/api/admin/questions').then((r) => r.json()).catch(() => null);
    if (j?.success) setRows(j.data);
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    await authFetch(`/api/admin/questions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  };
  if (!rows.length) return null;
  return (
    <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-soft dark:bg-[#17140b] dark:border-white/10 space-y-3">
      <h3 className="text-base font-semibold text-neutral-950 dark:text-white">Questions awaiting approval ({rows.length})</h3>
      {rows.map((q) => (
        <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-neutral-100 pt-3 dark:border-white/10 text-neutral-800 dark:text-neutral-200">
          <div><p className="font-bold">{q.questionText}</p><p className="text-neutral-500 dark:text-neutral-400">{q.productName} · asked by {q.askedBy}</p></div>
          <div className="flex gap-2">
            <button onClick={() => act(q.id, 'APPROVED')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold">Approve</button>
            <button onClick={() => act(q.id, 'REJECTED')} className="px-3 py-1.5 rounded-lg border border-neutral-300 font-bold dark:border-white/15">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
