'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCardProps } from '@/src/components/product/ProductCard';
import { useCart } from '@/src/context/CartContext';
import { formatINR } from '@/src/lib/date';

export function FrequentlyBoughtTogether({ slug, currentId, currentName, currentPrice }: { slug: string; currentId: number; currentName: string; currentPrice: number }) {
  const { addToCart } = useCart();
  const [items, setItems] = useState<ProductCardProps[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${slug}/together`).then((r) => r.json()).then((j) => {
      if (j.success) { setItems(j.data.products); setPicked(new Set(j.data.products.map((p: ProductCardProps) => p.id))); }
    }).catch(() => {});
  }, [slug]);

  if (items.length === 0) return null;
  const chosen = items.filter((p) => picked.has(p.id));
  const total = currentPrice + chosen.reduce((n, p) => n + p.discountPrice, 0);
  const addAll = async () => {
    setBusy(true);
    try { for (const id of [currentId, ...chosen.map((p) => p.id)]) await addToCart(id, null, 1); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-white/10 space-y-3">
      <h3 className="text-base font-semibold text-neutral-950 dark:text-white">Frequently bought together</h3>
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-800 dark:text-neutral-200">
        <span className="font-bold">This item: {currentName} · {formatINR(currentPrice)}</span>
        {items.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2 dark:border-white/10 cursor-pointer">
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.primaryImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
            <Link href={`/products/${p.slug}`} className="max-w-[160px] truncate hover:underline">{p.name}</Link>
            <b>{formatINR(p.discountPrice)}</b>
          </label>
        ))}
      </div>
      <button onClick={addAll} disabled={busy} className="px-4 py-2 rounded-xl bg-neutral-950 text-white text-xs font-bold disabled:opacity-60 dark:bg-white dark:text-neutral-950">
        {busy ? 'Adding…' : `Add ${chosen.length + 1} items to cart · ${formatINR(total)}`}
      </button>
    </section>
  );
}
