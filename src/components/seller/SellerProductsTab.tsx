'use client';

import React, { useMemo, useState } from 'react';
import { formatINR } from '@/src/lib/date';
import { useToast } from '@/src/context/ToastContext';
import { uploadImageToCloudinary } from '@/src/lib/cloudinary';
import { ImagePlus, Loader2 } from '@/src/components/ui/icons';
import { api, useLoad, Spinner, ErrorNote, Empty, Badge, Pager, Modal, Field, inputCls, btnPrimary, btnGhost, btnDanger, cardCls } from './ui';

interface ProductRow {
  id: number; name: string; brand: string; categoryName: string | null; basePrice: number; discountPrice: number;
  stock: number; status: string; lowStock: boolean; primaryImage: string; variantCount: number;
}
interface ListResult { products: ProductRow[]; pagination: { page: number; totalPages: number; total: number } }
interface RateCard { platformDefaultPercent: number; sellerOverridePercent: number | null; categories: Array<{ categoryId: number; name: string; percent: number; source: string }> }
interface Variant { id?: number; variantName: string; sku?: string; priceAdjustment: number; stockCount: number }
interface FullProduct {
  id: number; name: string; brand: string; categoryId: number; description: string; basePrice: number; discountPrice: number; stock: number;
  model: string | null; warranty: string | null; weight: string | null; deliveryFee: number; estimatedDays: number; status: string;
  imageUrls: string[]; variants: Variant[]; specifications: Array<{ key: string; value: string }>;
}

const blank = {
  name: '', brand: '', categoryId: 0, description: '', basePrice: 0, discountPrice: 0, stock: 0,
  model: '', warranty: '', weight: '', deliveryFee: 40, estimatedDays: 3, imageUrls: [''] as string[],
  variants: [] as Variant[], specifications: [] as Array<{ key: string; value: string }>,
};

export default function SellerProductsTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, error, loading, reload } = useLoad(
    () => api<ListResult>(`/api/seller/products?q=${encodeURIComponent(q)}&status=${status}&lowStock=${lowOnly}&page=${page}`),
    [q, status, lowOnly, page]
  );

  const dirty = useMemo(() => Object.entries(stockDraft).filter(([, v]) => v !== ''), [stockDraft]);

  async function saveStock() {
    const updates = dirty.map(([id, v]) => ({ productId: Number(id), stock: Math.max(0, Math.floor(Number(v))) }));
    if (updates.some((u) => !Number.isFinite(u.stock))) return toast.error('Stock must be a number');
    setSaving(true);
    try {
      await api('/api/seller/inventory', { method: 'PATCH', body: JSON.stringify({ updates }) });
      toast.success(`Updated stock for ${updates.length} product(s)`);
      setStockDraft({});
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update stock');
    } finally { setSaving(false); }
  }

  async function setProductStatus(p: ProductRow, next: 'ACTIVE' | 'INACTIVE') {
    try {
      await api(`/api/seller/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      toast.success(next === 'ACTIVE' ? 'Product is live' : 'Product hidden from the store');
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed'); }
  }

  async function archive(p: ProductRow) {
    if (!confirm(`Archive "${p.name}"? It will disappear from the store. Order history is kept.`)) return;
    try {
      await api(`/api/seller/products/${p.id}`, { method: 'DELETE' });
      toast.success('Product archived');
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to archive'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-[240px]`} placeholder="Search products…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={`${inputCls} max-w-[150px]`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All (live + hidden)</option><option value="ACTIVE">Live</option><option value="INACTIVE">Hidden</option><option value="ARCHIVED">Archived</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }} /> Low stock only
        </label>
        <div className="ml-auto flex gap-2">
          {dirty.length > 0 && canEdit && <button className={btnPrimary} disabled={saving} onClick={saveStock}>Save stock ({dirty.length})</button>}
          {canEdit && <button className={btnPrimary} onClick={() => setEditing('new')}>+ Add product</button>}
        </div>
      </div>
      {!canEdit && <ErrorNote message="Your seller account is suspended, so the catalog is read-only." />}

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : !data || data.products.length === 0 ? (
        <div className={cardCls}><Empty>No products yet. Add your first product to start selling.</Empty></div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 dark:bg-white/[0.04] dark:text-neutral-300 dark:border-white/10">
                <tr><th className="py-3 px-4">Product</th><th className="py-3 px-3">Price</th><th className="py-3 px-3">Stock</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.primaryImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100" />
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-950 truncate max-w-[220px] dark:text-white">{p.name}</p>
                          <p className="text-[11px] text-neutral-500">{p.brand} · {p.categoryName || '—'}{p.variantCount ? ` · ${p.variantCount} variants` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3"><b>{formatINR(p.discountPrice)}</b>{p.basePrice > p.discountPrice && <span className="ml-1 line-through text-neutral-400">{formatINR(p.basePrice)}</span>}</td>
                    <td className="py-3 px-3">
                      <input type="number" min={0} disabled={!canEdit} className={`${inputCls} w-20 !py-1 ${p.lowStock ? '!border-amber-400' : ''}`}
                        value={stockDraft[p.id] ?? String(p.stock)}
                        onChange={(e) => setStockDraft((d) => ({ ...d, [p.id]: e.target.value === String(p.stock) ? '' : e.target.value }))} />
                      {p.lowStock && <p className="text-[10px] font-bold text-amber-600 mt-0.5">{p.stock === 0 ? 'Out of stock' : 'Low stock'}</p>}
                    </td>
                    <td className="py-3 px-3"><Badge status={p.status} label={p.status === 'ACTIVE' ? 'Live' : p.status === 'INACTIVE' ? 'Hidden' : p.status} /></td>
                    <td className="py-3 px-3">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <button className={btnGhost} onClick={() => setEditing(p.id)}>{canEdit ? 'Edit' : 'View'}</button>
                        {canEdit && p.status !== 'ARCHIVED' && (
                          <button className={btnGhost} onClick={() => setProductStatus(p, p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{p.status === 'ACTIVE' ? 'Hide' : 'Publish'}</button>
                        )}
                        {canEdit && p.status !== 'ARCHIVED' && <button className={btnDanger} onClick={() => archive(p)}>Archive</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={setPage} />}

      {editing !== null && <ProductForm id={editing} canEdit={canEdit} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}
    </div>
  );
}

function ProductForm({ id, canEdit, onClose, onSaved }: { id: number | 'new'; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const cats = useLoad(() => api<RateCard>('/api/seller/rate-card'), []);
  const { loading, error } = useLoad(async () => {
    if (id === 'new') return null;
    const { product } = await api<{ product: FullProduct }>(`/api/seller/products/${id}`);
    setForm({
      name: product.name, brand: product.brand, categoryId: product.categoryId, description: product.description,
      basePrice: product.basePrice, discountPrice: product.discountPrice, stock: product.stock,
      model: product.model || '', warranty: product.warranty || '', weight: product.weight || '',
      deliveryFee: product.deliveryFee, estimatedDays: product.estimatedDays,
      imageUrls: product.imageUrls.length ? product.imageUrls : [''],
      variants: product.variants, specifications: product.specifications,
    });
    return product;
  }, [id]);

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  async function handleUpload(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingIdx(i); setUploadPct(0);
    try {
      const r = await uploadImageToCloudinary(file, { folder: 'qazvucart/products', onProgress: setUploadPct });
      setForm((f) => ({ ...f, imageUrls: f.imageUrls.map((x, j) => (j === i ? r.url : x)) }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed');
    } finally { setUploadingIdx(null); setUploadPct(0); }
  }
  const rate = cats.data?.categories.find((c) => c.categoryId === Number(form.categoryId));
  const earn = rate ? form.discountPrice - Math.round((form.discountPrice * rate.percent) / 100) : null;

  async function submit() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        imageUrls: form.imageUrls.map((u) => u.trim()).filter(Boolean),
        model: form.model || undefined, warranty: form.warranty || undefined, weight: form.weight || undefined,
        variants: form.variants.map((v) => ({ ...v, sku: v.sku || undefined })),
        specifications: form.specifications.filter((s) => s.key.trim() && s.value.trim()),
      };
      await api(id === 'new' ? '/api/seller/products' : `/api/seller/products/${id}`, { method: id === 'new' ? 'POST' : 'PATCH', body: JSON.stringify(payload) });
      toast.success(id === 'new' ? 'Product created' : 'Product saved');
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save product'); }
    finally { setSaving(false); }
  }

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Modal title={id === 'new' ? 'Add product' : 'Edit product'} onClose={onClose} wide>
      {loading ? <Spinner /> : error ? <ErrorNote message={error} /> : (
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Product name"><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Brand"><input className={inputCls} value={form.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
            <Field label="Category">
              <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))}>
                <option value={0}>Select…</option>
                {cats.data?.categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name} ({c.percent}% commission)</option>)}
              </select>
            </Field>
            <Field label="Model (optional)"><input className={inputCls} value={form.model} onChange={(e) => set('model', e.target.value)} /></Field>
          </div>
          <Field label="Description"><textarea rows={4} className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Original price (₹)"><input type="number" min={0} className={inputCls} value={form.basePrice || ''} onChange={(e) => set('basePrice', num(e.target.value))} /></Field>
            <Field label="Selling price (₹)"><input type="number" min={0} className={inputCls} value={form.discountPrice || ''} onChange={(e) => set('discountPrice', num(e.target.value))} /></Field>
            <Field label="Stock"><input type="number" min={0} className={inputCls} value={form.stock} onChange={(e) => set('stock', num(e.target.value))} /></Field>
            <Field label="Delivery fee (₹)"><input type="number" min={0} className={inputCls} value={form.deliveryFee} onChange={(e) => set('deliveryFee', num(e.target.value))} /></Field>
          </div>
          {rate && form.discountPrice > 0 && (
            <p className="text-xs rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25">
              Commission for this category: <b>{rate.percent}%</b> ({rate.source.toLowerCase()} rate). You keep about <b>{formatINR(earn || 0)}</b> per unit sold.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Warranty"><input className={inputCls} value={form.warranty} onChange={(e) => set('warranty', e.target.value)} placeholder="1 Year" /></Field>
            <Field label="Weight"><input className={inputCls} value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="450 g" /></Field>
            <Field label="Delivery days"><input type="number" min={1} max={30} className={inputCls} value={form.estimatedDays} onChange={(e) => set('estimatedDays', num(e.target.value))} /></Field>
          </div>

          <Field label="Product images" hint="Upload photos (JPEG, PNG, WEBP, up to 8 MB each) or paste a URL. First image is the main one.">
            <div className="space-y-2">
              {form.imageUrls.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-12 h-12 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center dark:border-white/10 dark:bg-white/[0.04]">
                    {u.trim() ? <img src={u} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5 text-neutral-400" />}
                  </div>
                  <input className={inputCls} value={u} placeholder="https://… or upload →" onChange={(e) => set('imageUrls', form.imageUrls.map((x, j) => (j === i ? e.target.value : x)))} />
                  <label className={`${btnGhost} cursor-pointer whitespace-nowrap ${uploadingIdx !== null ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingIdx === i ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploadPct}%</> : <><ImagePlus className="w-4 h-4" /> Upload</>}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" disabled={uploadingIdx !== null} onChange={(e) => handleUpload(i, e)} />
                  </label>
                  <button type="button" className={btnGhost} onClick={() => set('imageUrls', form.imageUrls.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              {form.imageUrls.length < 8 && <button type="button" className={btnGhost} onClick={() => set('imageUrls', [...form.imageUrls, ''])}>+ Add image</button>}
            </div>
          </Field>

          <Field label="Variants (colour, size…)" hint="Each variant has its own stock and price adjustment (+/− ₹).">
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className={`${inputCls} col-span-5`} placeholder="Name" value={v.variantName} onChange={(e) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, variantName: e.target.value } : x)))} />
                  <input className={`${inputCls} col-span-3`} placeholder="SKU" value={v.sku || ''} onChange={(e) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} />
                  <input type="number" className={`${inputCls} col-span-2`} placeholder="± ₹" value={v.priceAdjustment} onChange={(e) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, priceAdjustment: num(e.target.value) } : x)))} />
                  <input type="number" min={0} className={`${inputCls} col-span-2`} placeholder="Stock" value={v.stockCount} onChange={(e) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, stockCount: num(e.target.value) } : x)))} />
                </div>
              ))}
              <button type="button" className={btnGhost} onClick={() => set('variants', [...form.variants, { variantName: '', priceAdjustment: 0, stockCount: 0 }])}>+ Add variant</button>
            </div>
          </Field>

          <Field label="Specifications">
            <div className="space-y-2">
              {form.specifications.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className={`${inputCls} col-span-4`} placeholder="Key" value={s.key} onChange={(e) => set('specifications', form.specifications.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <input className={`${inputCls} col-span-7`} placeholder="Value" value={s.value} onChange={(e) => set('specifications', form.specifications.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className={`${btnGhost} col-span-1`} onClick={() => set('specifications', form.specifications.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className={btnGhost} onClick={() => set('specifications', [...form.specifications, { key: '', value: '' }])}>+ Add specification</button>
            </div>
          </Field>

          {canEdit && (
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
              <button type="button" className={btnPrimary} disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save product'}</button>
            </div>
          )}
        </fieldset>
      )}
    </Modal>
  );
}
