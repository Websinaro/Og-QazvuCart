'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, RotateCcw, Lock, ArrowRight } from '@/src/components/ui/icons';

const PILLARS = [
  { Icon: ShieldCheck, title: '100% authentic', copy: 'Verified multi-vendor stores' },
  { Icon: Truck, title: 'Fast delivery', copy: 'Free delivery over ₹999' },
  { Icon: RotateCcw, title: 'Easy returns', copy: '7-day replacement guarantee' },
  { Icon: Lock, title: 'Secure payments', copy: '256-bit encrypted checkout' },
];

const CATEGORY_LINKS = [
  { href: '/products?category=electronics', label: 'Electronics & Audio' },
  { href: '/products?category=fashion', label: 'Fashion & Apparel' },
  { href: '/products?category=home-living', label: 'Home & Living' },
  { href: '/products?category=beauty-care', label: 'Beauty & Skincare' },
  { href: '/products?category=sports-fitness', label: 'Sports & Fitness' },
];

const CARE_LINKS = [
  { href: '/account?tab=orders', label: 'Track orders' },
  { href: '/account?tab=addresses', label: 'Shipping & delivery' },
  { href: '/account?tab=reviews', label: 'Verified reviews' },
  { href: '/account?tab=settings', label: 'Account settings' },
];

const linkCls = 'text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1 group';

export function Footer() {
  return (
    <footer className="relative mt-20 bg-neutral-950 text-neutral-300 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-80 rounded-full bg-brand-600/20 blur-[120px]" />

      {/* Trust pillars */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {PILLARS.map(({ Icon, title, copy }) => (
            <div
              key={title}
              className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-500/15 text-brand-300 shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white">{title}</h4>
                <p className="text-xs text-neutral-400 mt-0.5">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 text-[13px]">
        <div className="col-span-2 space-y-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-lg shadow-glow">
              Q
            </span>
            <span className="text-xl font-semibold text-white tracking-tight">
              Qazvu<span className="text-brand-300">Cart</span>
            </span>
          </Link>
          <p className="text-neutral-400 leading-relaxed max-w-sm">
            A multi-vendor marketplace built for speed: authentic brands, verified reviews and seamless delivery.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {['UPI', 'Visa', 'Mastercard', 'NetBanking', 'COD'].map((m) => (
              <span
                key={m}
                className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-medium text-neutral-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h5 className="text-[11px] font-semibold text-white uppercase tracking-[0.16em]">Categories</h5>
          <ul className="space-y-2.5">
            {CATEGORY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h5 className="text-[11px] font-semibold text-white uppercase tracking-[0.16em]">Customer care</h5>
          <ul className="space-y-2.5">
            {CARE_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <h5 className="text-[11px] font-semibold text-white uppercase tracking-[0.16em]">Multi-vendor hub</h5>
          <ul className="space-y-2.5 text-neutral-500">
            <li>Sell on QazvuCart (Phase 2)</li>
            <li>Seller protection program</li>
            <li>Fulfilment by QazvuCart</li>
            <li>Marketplace APIs</li>
          </ul>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-neutral-500">
        <p>© 2026 QazvuCart Technologies Inc. All rights reserved.</p>
        <p>Built with Next.js &amp; PostgreSQL</p>
      </div>
    </footer>
  );
}
