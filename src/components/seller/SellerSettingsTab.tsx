'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/src/context/ToastContext';
import { api, useLoad, Spinner, ErrorNote, Field, inputCls, btnPrimary, cardCls, Badge } from './ui';
import type { SellerProfile } from './types';

interface RateCard { platformDefaultPercent: number; sellerOverridePercent: number | null; payoutHoldDays: number; minPayoutAmount: number; categories: Array<{ categoryId: number; name: string; percent: number; source: string }> }

export default function SellerSettingsTab({ seller, canEdit, onChanged }: { seller: SellerProfile; canEdit: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [profile, setProfile] = useState({
    storeName: seller.storeName, description: seller.description || '', supportEmail: seller.supportEmail || '',
    supportPhone: seller.supportPhone || '', businessAddress: seller.businessAddress || '', taxId: seller.taxId || '',
  });
  const [bank, setBank] = useState({ accountHolder: seller.payout.accountHolder || '', bankName: seller.payout.bankName || '', ifsc: seller.payout.ifsc || '', accountNumber: '', upiId: seller.payout.upiId || '', currentPassword: '' });
  const [busy, setBusy] = useState<'profile' | 'bank' | null>(null);
  const rates = useLoad(() => api<RateCard>('/api/seller/rate-card'), []);

  async function saveProfile() {
    setBusy('profile');
    try {
      await api('/api/seller/me', { method: 'PATCH', body: JSON.stringify(profile) });
      toast.success('Store profile saved');
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setBusy(null); }
  }

  async function saveBank() {
    setBusy('bank');
    try {
      const body: Record<string, string> = { currentPassword: bank.currentPassword };
      (['accountHolder', 'bankName', 'ifsc', 'accountNumber', 'upiId'] as const).forEach((k) => { if (bank[k].trim()) body[k] = bank[k].trim(); });
      await api('/api/seller/payout-details', { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Payout details saved');
      setBank((b) => ({ ...b, accountNumber: '', currentPassword: '' }));
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setBusy(null); }
  }

  const set = (k: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <section className={`${cardCls} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-950 dark:text-white">Store profile</h3>
          <Link className="text-xs font-bold underline" href={`/seller/${seller.slug}`}>View public store</Link>
        </div>
        <fieldset disabled={!canEdit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Store name"><input className={inputCls} value={profile.storeName} onChange={set('storeName')} /></Field>
            <Field label="GSTIN / Tax ID"><input className={inputCls} value={profile.taxId} onChange={set('taxId')} /></Field>
            <Field label="Support email"><input className={inputCls} value={profile.supportEmail} onChange={set('supportEmail')} /></Field>
            <Field label="Support phone"><input className={inputCls} value={profile.supportPhone} onChange={set('supportPhone')} /></Field>
          </div>
          <Field label="Business address"><textarea rows={2} className={inputCls} value={profile.businessAddress} onChange={set('businessAddress')} /></Field>
          <Field label="About your store"><textarea rows={3} className={inputCls} value={profile.description} onChange={set('description')} /></Field>
          {canEdit && <button className={btnPrimary} disabled={busy === 'profile'} onClick={saveProfile}>Save profile</button>}
        </fieldset>
      </section>

      <section className={`${cardCls} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-950 dark:text-white">Payout account</h3>
          <Badge status={seller.payout.isConfigured ? 'APPROVED' : 'PENDING'} label={seller.payout.isConfigured ? 'Configured' : 'Not set up'} />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Where we send your earnings. Your account number is encrypted and only the last 4 digits are ever shown{seller.payout.accountMasked ? ` (currently ${seller.payout.accountMasked})` : ''}. Leave the account number blank to keep the saved one.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Account holder"><input className={inputCls} value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} /></Field>
          <Field label="Bank name"><input className={inputCls} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} /></Field>
          <Field label="IFSC"><input className={inputCls} value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0001234" /></Field>
          <Field label="Account number"><input className={inputCls} inputMode="numeric" autoComplete="off" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} placeholder={seller.payout.accountMasked || ''} /></Field>
          <Field label="UPI ID (optional)"><input className={inputCls} value={bank.upiId} onChange={(e) => setBank({ ...bank, upiId: e.target.value })} placeholder="name@bank" /></Field>
          <Field label="Confirm with your password" hint="Required whenever payout details change."><input type="password" autoComplete="current-password" className={inputCls} value={bank.currentPassword} onChange={(e) => setBank({ ...bank, currentPassword: e.target.value })} /></Field>
        </div>
        <button className={btnPrimary} disabled={busy === 'bank' || !bank.currentPassword} onClick={saveBank}>Save payout details</button>
      </section>

      <section className={`${cardCls} p-5`}>
        <h3 className="font-bold text-neutral-950 mb-2 dark:text-white">Your commission rates</h3>
        {rates.loading ? <Spinner /> : rates.error ? <ErrorNote message={rates.error} /> : rates.data && (
          <>
            <p className="text-xs text-neutral-500 mb-3 dark:text-neutral-400">
              {rates.data.sellerOverridePercent !== null ? `You have a special rate of ${rates.data.sellerOverridePercent}% on every category.` : `Standard platform rate is ${rates.data.platformDefaultPercent}%; some categories have their own rate.`} The rate is locked in when an order is placed. Earnings are paid {rates.data.payoutHoldDays} days after delivery.
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {rates.data.categories.map((c) => (
                <li key={c.categoryId} className="flex justify-between border-b border-neutral-100 py-1 dark:border-white/10"><span>{c.name}</span><b>{c.percent}%</b></li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
