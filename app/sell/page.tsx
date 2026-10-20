'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { Store, CheckCircle2, Clock, AlertTriangle, ArrowRight } from '@/src/components/ui/icons';
import { api, Badge, Field, Spinner, inputCls, btnPrimary, cardCls } from '@/src/components/seller/ui';
import type { SellerProfile } from '@/src/components/seller/types';

const emptyStore = { storeName: '', businessAddress: '', supportEmail: '', supportPhone: '', taxId: '', description: '' };
const emptyAccount = { username: '', email: '', phone: '', password: '', confirmPassword: '' };

export default function SellPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const toast = useToast();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState(emptyStore);
  const [account, setAccount] = useState(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { seller: s } = await api<{ seller: SellerProfile | null }>('/api/seller/me');
      setSeller(s);
      if (s) setStore({ storeName: s.storeName, businessAddress: s.businessAddress || '', supportEmail: s.supportEmail || '', supportPhone: s.supportPhone || '', taxId: s.taxId || '', description: s.description || '' });
    } catch { /* not signed in or transient: show the form */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) void load(); else { setSeller(null); setLoaded(true); }
  }, [isLoading, user, load]);

  const cleanStore = () => Object.fromEntries(Object.entries(store).filter(([, v]) => v.trim() !== ''));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (user) {
        await api('/api/seller/apply', { method: 'POST', body: JSON.stringify(cleanStore()) });
        toast.success('Application submitted!');
        await load();
      } else {
        await api('/api/auth/register-seller', { method: 'POST', body: JSON.stringify({ ...account, store: cleanStore() }) });
        toast.success('Account created and application submitted!');
        await refreshUser();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setBusy(false); }
  }

  if (isLoading || !loaded) return <div className="max-w-xl mx-auto px-4 py-12"><Spinner /></div>;

  // ---- Existing application states -------------------------------------
  if (user && seller && seller.status !== 'REJECTED') {
    const m = {
      PENDING: { icon: Clock, title: 'Application under review', text: 'Thanks for applying! Our team reviews every store. You will get a notification as soon as a decision is made.' },
      APPROVED: { icon: CheckCircle2, title: 'You are an approved seller', text: 'Your store is live. Add products, manage orders and track your earnings in the Seller Center.' },
      SUSPENDED: { icon: AlertTriangle, title: 'Your seller account is suspended', text: seller.suspensionReason ? `Reason: ${seller.suspensionReason}` : 'Please contact support.' },
    }[seller.status as 'PENDING' | 'APPROVED' | 'SUSPENDED'];
    const Icon = m.icon;
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Icon className="w-12 h-12 mx-auto text-neutral-500" />
        <h1 className="text-xl font-bold text-neutral-950 dark:text-white">{m.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{m.text}</p>
        <div className="flex items-center justify-center gap-2"><span className="font-bold">{seller.storeName}</span><Badge status={seller.status} /></div>
        {(seller.status === 'APPROVED' || seller.status === 'SUSPENDED') && <Link href="/seller-center" className={btnPrimary}>Open Seller Center <ArrowRight className="w-4 h-4" /></Link>}
      </div>
    );
  }

  const set = (k: keyof typeof emptyStore) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setStore((s) => ({ ...s, [k]: e.target.value }));
  const setA = (k: keyof typeof emptyAccount) => (e: React.ChangeEvent<HTMLInputElement>) => setAccount((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-2">
        <Store className="w-10 h-10 mx-auto text-neutral-500" />
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">Sell on our marketplace</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">List your products, fulfil orders and get paid. Applications are reviewed by our team before your store goes live.</p>
      </div>

      {seller?.status === 'REJECTED' && (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 text-sm p-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          Your previous application was not approved{seller.rejectionReason ? `: ${seller.rejectionReason}` : '.'} Update your details below and apply again.
        </div>
      )}

      <form onSubmit={submit} className={`${cardCls} p-5 space-y-5`}>
        {!user && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-neutral-950 dark:text-white">1. Your account</h2>
              <button type="button" className="text-xs font-bold underline" onClick={() => setLoginOpen(true)}>Already have an account? Log in</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Username"><input required className={inputCls} value={account.username} onChange={setA('username')} autoComplete="username" /></Field>
              <Field label="Email"><input required type="email" className={inputCls} value={account.email} onChange={setA('email')} autoComplete="email" /></Field>
              <Field label="Phone"><input required className={inputCls} value={account.phone} onChange={setA('phone')} autoComplete="tel" /></Field>
              <div />
              <Field label="Password"><input required type="password" minLength={6} className={inputCls} value={account.password} onChange={setA('password')} autoComplete="new-password" /></Field>
              <Field label="Confirm password"><input required type="password" minLength={6} className={inputCls} value={account.confirmPassword} onChange={setA('confirmPassword')} autoComplete="new-password" /></Field>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-bold text-neutral-950 dark:text-white">{user ? 'Store details' : '2. Store details'}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Store name"><input required minLength={3} maxLength={60} className={inputCls} value={store.storeName} onChange={set('storeName')} /></Field>
            <Field label="GSTIN / Tax ID (optional)"><input className={inputCls} value={store.taxId} onChange={set('taxId')} /></Field>
            <Field label="Support email (optional)"><input type="email" className={inputCls} value={store.supportEmail} onChange={set('supportEmail')} /></Field>
            <Field label="Support phone (optional)"><input className={inputCls} value={store.supportPhone} onChange={set('supportPhone')} /></Field>
          </div>
          <Field label="Business address"><textarea required minLength={10} rows={2} className={inputCls} value={store.businessAddress} onChange={set('businessAddress')} /></Field>
          <Field label="About your store (optional)"><textarea rows={3} maxLength={1000} className={inputCls} value={store.description} onChange={set('description')} /></Field>
        </section>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          After approval you will add your payout account in the Seller Center. A commission is charged on each sale; you will see the exact rate for every category before you list a product.
        </p>
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>{busy ? 'Submitting…' : seller?.status === 'REJECTED' ? 'Re-submit application' : 'Submit application'}</button>
      </form>

      <AuthModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} initialMode="login" />
    </div>
  );
}
