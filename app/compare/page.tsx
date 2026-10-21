'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompare } from '@/src/lib/compare';
import { useCart } from '@/src/context/CartContext';
import { formatINR } from '@/src/lib/date';

interface Item {
  id: number; name: string; slug: string; brand: string; categoryName?: string; discountPrice: number; basePrice: number;
  rating: number; reviewCount: number; primaryImage: string; inStock: boolean; warranty?: string | null;
  specs: Record<string, string>;
}

export default function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const { addToCart } = useCart();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/products/compare?ids=${ids.join(',')}`).then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data.products); }).finally(() => setLoading(false));
  }, [ids]);

  const specKeys = Array.from(new Set(items.flatMap((i) => Object.keys(i.specs || {}))));
  const lowest = items.length ? Math.min(...items.map((i) => i.discountPrice)) : 0;
  const bestRating = items.length ? Math.max(...items.map((i) => Number(i.rating))) : 0;
  const cell = 'p-3 align-top text-xs text-neutral-800 dark:text-neutral-200 border-t border-neutral-100 dark:border-white/10';
  const label = `${cell} font-bold text-neutral-500 dark:text-neutral-400 w-32 sticky left-0 bg-white dark:bg-[#0f0d06]`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-950 dark:text-white">Compare products</h1>
        {items.length > 0 && <button onClick={clear} className="text-xs font-bold underline text-neutral-600 dark:text-neutral-300">Clear all</button>}
      </div>
      {loading ? <p className="text-sm text-neutral-500">Loading…</p> : items.length < 2 ? (
        <div className="rounded-2xl border border-neutral-200 p-10 text-center text-sm dark:border-white/10 dark:text-neutral-300">
          Pick at least two products with “+ Compare” on any product card. <Link href="/products" className="font-bold underline">Browse products</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-white/10">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr>
              <th className={label} />
              {items.map((i) => (
                <th key={i.id} className={`${cell} min-w-[180px]`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.primaryImage} alt={i.name} className="w-24 h-24 object-cover rounded-xl mb-2" />
                  <Link href={`/products/${i.slug}`} className="font-bold hover:underline">{i.name}</Link>
                  <button onClick={() => remove(i.id)} className="block text-[11px] font-normal text-red-600 mt-1">Remove</button>
                </th>
              ))}
            </tr></thead>
            <tbody>
              <tr><td className={label}>Price</td>{items.map((i) => (
                <td key={i.id} className={cell}><b className={i.discountPrice === lowest ? 'text-emerald-600' : ''}>{formatINR(i.discountPrice)}</b>
                  {i.basePrice > i.discountPrice && <span className="line-through text-neutral-400 ml-1">{formatINR(i.basePrice)}</span>}
                  {i.discountPrice === lowest && <span className="block text-[10px] text-emerald-600 font-bold">Lowest price</span>}</td>))}</tr>
              <tr><td className={label}>Rating</td>{items.map((i) => (
                <td key={i.id} className={cell}><b className={Number(i.rating) === bestRating && bestRating > 0 ? 'text-emerald-600' : ''}>{Number(i.rating).toFixed(1)} ★</b> ({i.reviewCount})</td>))}</tr>
              <tr><td className={label}>Brand</td>{items.map((i) => <td key={i.id} className={cell}>{i.brand}</td>)}</tr>
              <tr><td className={label}>Availability</td>{items.map((i) => (
                <td key={i.id} className={`${cell} font-bold ${i.inStock ? 'text-emerald-600' : 'text-red-600'}`}>{i.inStock ? 'In stock' : 'Out of stock'}</td>))}</tr>
              {specKeys.map((k) => (
                <tr key={k}><td className={label}>{k}</td>{items.map((i) => <td key={i.id} className={cell}>{i.specs?.[k] || '—'}</td>)}</tr>
              ))}
              <tr><td className={label} />{items.map((i) => (
                <td key={i.id} className={cell}>
                  <button disabled={!i.inStock} onClick={() => addToCart(i.id, null, 1)} className="px-3 py-1.5 rounded-lg bg-neutral-950 text-white font-bold disabled:opacity-40 dark:bg-white dark:text-neutral-950">Add to cart</button>
                </td>))}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
