'use client';
import React from 'react';
import Link from 'next/link';
import { useCompare, MAX_COMPARE } from '@/src/lib/compare';

/** Small "Compare" checkbox shown on product cards. */
export function CompareToggle({ id }: { id: number }) {
  const { ids, toggle } = useCompare();
  const on = ids.includes(id);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      aria-pressed={on}
      title={on || ids.length < MAX_COMPARE ? 'Compare' : `You can compare up to ${MAX_COMPARE} products`}
      className={`absolute top-14 right-3 z-10 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm glass ${on ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-700 dark:text-neutral-200'}`}
    >
      {on ? '✓ Compare' : '+ Compare'}
    </button>
  );
}

/** Floating tray that appears once something is picked. */
export function CompareBar() {
  const { ids, clear } = useCompare();
  if (ids.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-neutral-950 text-white px-4 py-2 shadow-xl text-xs font-bold dark:bg-white dark:text-neutral-950">
      <span>{ids.length} selected</span>
      {ids.length >= 2
        ? <Link href="/compare" className="rounded-full bg-yellow-400 text-neutral-950 px-3 py-1">Compare now</Link>
        : <span className="opacity-70 font-normal">pick one more</span>}
      <button onClick={clear} className="opacity-70 hover:opacity-100">Clear</button>
    </div>
  );
}
