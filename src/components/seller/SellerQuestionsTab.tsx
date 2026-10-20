'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/src/context/ToastContext';
import { api, useLoad, Spinner, ErrorNote, Empty, inputCls, btnPrimary, cardCls, fmtDate } from './ui';

interface Q { id: number; questionText: string; createdAt: string; productName: string; productSlug: string; askedBy: string; answerText: string | null }

export default function SellerQuestionsTab({ canAnswer }: { canAnswer: boolean }) {
  const toast = useToast();
  const [unanswered, setUnanswered] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const { data, error, loading, reload } = useLoad(() => api<{ questions: Q[] }>(`/api/seller/questions?unanswered=${unanswered}`), [unanswered]);

  async function answer(q: Q) {
    setBusy(q.id);
    try {
      await api(`/api/seller/questions/${q.id}/answer`, { method: 'POST', body: JSON.stringify({ answerText: drafts[q.id] || '' }) });
      toast.success('Answer posted');
      setDrafts((d) => ({ ...d, [q.id]: '' }));
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to post answer'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" checked={unanswered} onChange={(e) => setUnanswered(e.target.checked)} /> Only questions I haven&apos;t answered
      </label>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : !data || data.questions.length === 0 ? (
        <div className={cardCls}><Empty>{unanswered ? 'You are all caught up. 🎉' : 'No customer questions yet.'}</Empty></div>
      ) : data.questions.map((q) => (
        <div key={q.id} className={`${cardCls} p-4 space-y-2`}>
          <div className="flex justify-between gap-3 text-xs text-neutral-500"><Link href={`/products/${q.productSlug}`} className="font-bold underline">{q.productName}</Link><span>{q.askedBy} · {fmtDate(q.createdAt)}</span></div>
          <p className="font-semibold text-neutral-950 dark:text-white">Q: {q.questionText}</p>
          {q.answerText ? <p className="text-sm text-neutral-700 dark:text-neutral-300"><b>Your answer:</b> {q.answerText}</p> : canAnswer && (
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Write a helpful answer…" value={drafts[q.id] || ''} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} />
              <button className={btnPrimary} disabled={busy === q.id || (drafts[q.id] || '').trim().length < 3} onClick={() => answer(q)}>Answer</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
