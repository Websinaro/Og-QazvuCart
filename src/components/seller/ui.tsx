'use client';

/**
 * Small shared building blocks for the Seller Center and the admin
 * marketplace panels (kept dependency-free so both can import them).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/src/lib/api';
import { X, Loader2 } from '@/src/components/ui/icons';

export async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  // Admin "view as seller": /seller-center?seller=<id> -> x-view-seller-id header
  // (the server only honours it for ADMIN users).
  let viewSeller: string | null = null;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/seller-center')) {
    viewSeller = new URLSearchParams(window.location.search).get('seller');
  }
  const res = await authFetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(viewSeller ? { 'x-view-seller-id': viewSeller } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

/** Loads data on mount / when `deps` change and exposes a reload(). */
export function useLoad<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, deps);
  return { data, error, loading, reload, setData };
}

export const cardCls =
  'bg-white rounded-2xl border border-neutral-200 shadow-soft dark:bg-[#0e1a14] dark:border-white/10';
export const inputCls =
  'w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-950 dark:bg-white/[0.04] dark:text-white dark:border-white/10 dark:focus:border-white/40';
export const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1 dark:text-neutral-400';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-300 dark:text-neutral-950 dark:hover:bg-brand-200';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 text-neutral-800 text-sm font-bold hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/15 dark:text-neutral-100 dark:hover:bg-white/10';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-bold hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-neutral-500 mt-1 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  amber: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25',
  red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  blue: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-white/10 dark:text-neutral-300 dark:border-white/10',
};

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'green', PAID: 'green', DELIVERED: 'green', ACTIVE: 'green',
  PENDING: 'amber', PROCESSING: 'amber', CONFIRMED: 'blue', PACKED: 'blue', SHIPPED: 'blue', OUT_FOR_DELIVERY: 'blue',
  IN_PAYOUT: 'blue', UNSETTLED: 'amber', PENDING_PAYMENT: 'amber', INACTIVE: 'neutral',
  REJECTED: 'red', SUSPENDED: 'red', FAILED: 'red', CANCELLED: 'red', RETURNED: 'red', VOID: 'neutral', LEGACY: 'neutral', ARCHIVED: 'neutral',
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[STATUS_TONE[status] || 'neutral'];
  return (
    <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border whitespace-nowrap ${tone}`}>
      {(label || status).replace(/_/g, ' ')}
    </span>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'green' | 'amber' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-neutral-950 dark:text-white';
  return (
    <div className={`${cardCls} p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold tracking-tight mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-1 dark:text-neutral-400">{sub}</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${cardCls} w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-2xl`}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-white/95 backdrop-blur dark:bg-[#0e1a14]/95 dark:border-white/10">
          <h3 className="font-bold text-neutral-950 dark:text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500 dark:text-neutral-400">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 text-sm p-3 flex items-center justify-between gap-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-bold underline shrink-0">Retry</button>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">{children}</div>;
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <button className={btnGhost} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Page {page} of {totalPages}</span>
      <button className={btnGhost} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
