'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { Store, LayoutDashboard, Package, ShoppingBag, Banknote, MessageSquare, Settings, ArrowLeft } from '@/src/components/ui/icons';
import { api, Badge, ErrorNote, Spinner, cardCls } from '@/src/components/seller/ui';
import type { SellerProfile, SellerTab } from '@/src/components/seller/types';
import SellerOverviewTab from '@/src/components/seller/SellerOverviewTab';
import SellerProductsTab from '@/src/components/seller/SellerProductsTab';
import SellerOrdersTab from '@/src/components/seller/SellerOrdersTab';
import SellerEarningsTab from '@/src/components/seller/SellerEarningsTab';
import SellerQuestionsTab from '@/src/components/seller/SellerQuestionsTab';
import SellerSettingsTab from '@/src/components/seller/SellerSettingsTab';

const TABS: Array<{ id: SellerTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'earnings', label: 'Earnings', icon: Banknote },
  { id: 'questions', label: 'Q&A', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SellerCenter() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const viewSellerId = params.get('seller');
  const isAdminView = user?.role === 'ADMIN' && !!viewSellerId;
  const initial = (params.get('tab') as SellerTab) || 'overview';
  const [tab, setTab] = useState<SellerTab>(TABS.some((t) => t.id === initial) ? initial : 'overview');
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const loadSeller = useCallback(async () => {
    try {
      const { seller: s } = await api<{ seller: SellerProfile | null }>('/api/seller/me');
      setSeller(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your store');
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { setLoaded(true); return; }
    void loadSeller();
  }, [isLoading, user, loadSeller]);

  const go = (t: SellerTab) => { setTab(t); router.replace(`/seller-center?tab=${t}${viewSellerId ? `&seller=${viewSellerId}` : ''}`, { scroll: false }); };

  if (isLoading || !loaded) return <div className="max-w-5xl mx-auto px-4 py-10"><Spinner /></div>;
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Store className="w-10 h-10 mx-auto text-neutral-400" />
        <h1 className="text-xl font-bold text-neutral-950 dark:text-white">Seller Center</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Log in to manage your store.</p>
        <button onClick={() => setAuthOpen(true)} className="px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold dark:bg-brand-300 dark:text-neutral-950">Log in</button>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
      </div>
    );
  }
  if (error) return <div className="max-w-3xl mx-auto px-4 py-10"><ErrorNote message={error} onRetry={loadSeller} /></div>;

  // Signed in but not an active seller yet: send them to the application page.
  if (user.role === 'ADMIN' && !viewSellerId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Store className="w-10 h-10 mx-auto text-neutral-400" />
        <h1 className="text-xl font-bold text-neutral-950 dark:text-white">Seller Center</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Pick a seller from the admin Sellers tab to open their Seller Center.</p>
        <Link href="/admin" className="inline-block px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold dark:bg-brand-300 dark:text-neutral-950">Go to admin panel</Link>
      </div>
    );
  }
  const isSellerRole = user?.role === 'SELLER' || isAdminView;
  if (!seller || !isSellerRole || (!isAdminView && (seller.status === 'PENDING' || seller.status === 'REJECTED'))) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Store className="w-10 h-10 mx-auto text-neutral-400" />
        <h1 className="text-xl font-bold text-neutral-950 dark:text-white">{seller ? 'Your seller application' : 'Become a seller'}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {seller?.status === 'PENDING' ? 'Your application is under review. We will notify you as soon as it is approved.' : seller?.status === 'REJECTED' ? 'Your application was not approved. Update your details and apply again.' : 'Apply to open your store on our marketplace.'}
        </p>
        <Link href="/sell" className="inline-block px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold dark:bg-brand-300 dark:text-neutral-950">Go to application</Link>
      </div>
    );
  }

  const suspended = seller.status === 'SUSPENDED';
  const canEdit = isAdminView || !suspended;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Back to store" className="p-2 rounded-xl border border-neutral-300 dark:border-white/15"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-950 dark:text-white flex items-center gap-2">{seller.storeName} <Badge status={seller.status} /></h1>
            <p className="text-xs text-neutral-500">Seller Center</p>
          </div>
        </div>
        <Link href={`/seller/${seller.slug}`} className="text-xs font-bold underline">View public store</Link>
      </div>

      {isAdminView && (
        <div className="rounded-xl border border-sky-300 bg-sky-50 text-sky-900 text-sm p-3 flex items-center justify-between gap-3 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200">
          <span>Admin view: you are managing <b>{seller.storeName}</b> on the seller&apos;s behalf.</span>
          <Link href="/admin" className="font-bold underline whitespace-nowrap">Back to admin</Link>
        </div>
      )}
      {suspended && !isAdminView && (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 text-sm p-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          Your store is suspended{seller.suspensionReason ? `: ${seller.suspensionReason}` : ''}. Your products are hidden, but you can still fulfil open orders and see your earnings.
        </div>
      )}
      {!seller.payout.isConfigured && !suspended && (
        <button onClick={() => go('settings')} className="w-full text-left rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          Add your payout account so we can pay your earnings → <b>Settings</b>
        </button>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-white/10" aria-label="Seller sections">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? 'border-neutral-950 text-neutral-950 dark:border-brand-300 dark:text-white' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'overview' && <SellerOverviewTab onNavigate={go} />}
        {tab === 'products' && <SellerProductsTab canEdit={canEdit} />}
        {tab === 'orders' && <SellerOrdersTab />}
        {tab === 'earnings' && <SellerEarningsTab />}
        {tab === 'questions' && <SellerQuestionsTab canAnswer />}
        {tab === 'settings' && <SellerSettingsTab seller={seller} canEdit={canEdit} onChanged={loadSeller} />}
      </div>
    </div>
  );
}

export default function SellerCenterPage() {
  return (
    <Suspense fallback={<div className={`${cardCls} max-w-3xl mx-auto my-10`}><Spinner /></div>}>
      <SellerCenter />
    </Suspense>
  );
}
