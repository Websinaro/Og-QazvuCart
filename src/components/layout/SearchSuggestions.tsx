'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Sugg { products: { name: string; slug: string }[]; brands: string[]; categories: { name: string; slug: string }[] }

/** Dropdown under a search box; typo-tolerant on the server. Render inside a `relative` wrapper. */
export function SearchSuggestions({ query }: { query: string }) {
  const [data, setData] = useState<Sugg | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setData(null); setOpen(false); return; }
    const t = setTimeout(() => {
      fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`).then((r) => r.json())
        .then((j) => { if (j.success) { setData(j.data); setOpen(true); } }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e: Event) => { if (e.type === 'submit' || !ref.current?.parentElement?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('submit', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('submit', close); document.removeEventListener('keydown', esc); };
  }, []);

  const empty = !data || (!data.products.length && !data.brands.length && !data.categories.length);
  if (!open || empty) return <div ref={ref} />;
  const item = 'block px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/10';
  const done = () => setOpen(false);
  return (
    <div ref={ref} className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-neutral-200 bg-white shadow-xl py-2 dark:bg-neutral-900 dark:border-white/10">
      {data!.products.map((p) => <Link key={p.slug} href={`/products/${p.slug}`} onClick={done} className={item}>{p.name}</Link>)}
      {data!.brands.map((b) => <Link key={b} href={`/products?brands=${encodeURIComponent(b)}`} onClick={done} className={item}>Brand: <b>{b}</b></Link>)}
      {data!.categories.map((c) => <Link key={c.slug} href={`/products?category=${c.slug}`} onClick={done} className={item}>In <b>{c.name}</b></Link>)}
    </div>
  );
}
