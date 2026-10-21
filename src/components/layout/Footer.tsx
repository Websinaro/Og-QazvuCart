'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/src/components/ui/BrandMark';
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

const linkCls = 'text-white/65 hover:text-white transition-colors inline-flex items-center gap-1 group';

export function Footer() {
  return (
    <footer className="relative mt-12 sm:mt-24 rounded-t-[2rem] bg-brand-950 text-white/70 overflow-hidden">
      {/* Trust pillars */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-6 sm:gap-y-8 pb-8 sm:pb-12 border-b border-white/10">
          {PILLARS.map(({ Icon, title, copy }) => (
            <div key={title} className="flex items-start gap-3.5 min-w-0">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-brand-500/15 text-brand-300 shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white">{title}</h4>
                <p className="text-xs text-white/60 mt-0.5">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 sm:gap-10 text-[13px]">
        <div className="col-span-2 space-y-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark className="w-9 h-9 ring-1 ring-white/25" />
            <span className="text-xl font-semibold text-white tracking-tight">
              Qazvu<span className="text-brand-300">Cart</span>
            </span>
          </Link>
          <p className="text-white/60 leading-relaxed max-w-sm">
            A multi-vendor marketplace built for speed: authentic brands, verified reviews and seamless delivery.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {['UPI', 'Visa', 'Mastercard', 'NetBanking', 'COD'].map((m) => (
              <span
                key={m}
                className="px-2.5 py-1 rounded-md border border-white/15 text-[11px] font-medium text-white/75"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h5 className="text-sm font-semibold text-white">Categories</h5>
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
          <h5 className="text-sm font-semibold text-white">Customer care</h5>
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
          <h5 className="text-sm font-semibold text-white">Multi-vendor hub</h5>
          <ul className="space-y-2.5 text-white/50">
            <li>Sell on QazvuCart (Phase 2)</li>
            <li>Seller protection program</li>
            <li>Fulfilment by QazvuCart</li>
            <li>Marketplace APIs</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/45">
        <p>© 2026 QazvuCart Technologies Inc. All rights reserved.</p>
        <p>Built with Next.js &amp; PostgreSQL</p>
      </div>
    </footer>
  );
}
