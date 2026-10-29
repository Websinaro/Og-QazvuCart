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

const SELLER_LINKS = [
  { href: '/sell', label: 'Become a seller' },
  { href: '/seller-center', label: 'Seller centre' },
];

const linkCls = 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors inline-flex items-center gap-1 group py-1';

export function Footer() {
  return (
    <footer aria-label="Site footer" className="relative mt-20 bg-gradient-to-b from-brand-50 to-brand-100 dark:from-[#14110a] dark:to-[#0f0d08] text-neutral-700 dark:text-neutral-300 border-t border-brand-400/40 dark:border-white/10 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-80 rounded-full bg-brand-400/30 blur-[120px]" />

      {/* Trust pillars */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {PILLARS.map(({ Icon, title, copy }) => (
            <div
              key={title}
              className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white dark:bg-white/[0.04] border border-brand-700/10 dark:border-white/10 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-400/30 text-brand-800 dark:text-brand-300 shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 text-[13px]">
        <div className="col-span-2 space-y-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-300 to-brand-600 text-neutral-950 font-bold text-lg shadow-glow">
              Q
            </span>
            <span className="text-xl font-semibold text-neutral-950 dark:text-white tracking-tight">
              Qazvu<span className="text-brand-700 dark:text-brand-300">Cart</span>
            </span>
          </Link>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-sm">
            A multi-vendor marketplace built for speed: authentic brands, verified reviews and seamless delivery.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {['UPI', 'Visa', 'Mastercard', 'NetBanking', 'COD'].map((m) => (
              <span
                key={m}
                className="px-2.5 py-1 rounded-full border border-brand-700/15 dark:border-white/10 bg-white dark:bg-white/[0.04] text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[11px] font-semibold text-neutral-950 dark:text-white uppercase tracking-[0.16em]">Categories</h2>
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
          <h2 className="text-[11px] font-semibold text-neutral-950 dark:text-white uppercase tracking-[0.16em]">Customer care</h2>
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
          <h2 className="text-[11px] font-semibold text-neutral-950 dark:text-white uppercase tracking-[0.16em]">Sell with us</h2>
          <ul className="space-y-2.5">
            {SELLER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-brand-700/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-neutral-600 dark:text-neutral-400">
        <p>© {new Date().getFullYear()} QazvuCart. All rights reserved.</p>
        <p>Prices in INR, inclusive of applicable taxes.</p>
      </div>
    </footer>
  );
}
