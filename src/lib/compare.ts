'use client';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'compare_ids';
export const MAX_COMPARE = 4;

function read(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)).slice(0, MAX_COMPARE) : [];
  } catch { return []; }
}

export function useCompare() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener('compare-change', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('compare-change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const write = useCallback((next: number[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event('compare-change'));
  }, []);
  const toggle = useCallback((id: number) => {
    const cur = read();
    if (cur.includes(id)) write(cur.filter((x) => x !== id));
    else if (cur.length < MAX_COMPARE) write([...cur, id]);
    return cur.length >= MAX_COMPARE && !cur.includes(id) ? 'full' : 'ok';
  }, [write]);
  return { ids, toggle, remove: (id: number) => write(read().filter((x) => x !== id)), clear: () => write([]) };
}
