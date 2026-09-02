'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, RotateCcw, Lock, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-neutral-950 text-neutral-300 pt-12 pb-8 border-t border-neutral-800">
      {/* 1. Trust Pillars */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 border-b border-neutral-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-[#FFD21F]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">100% Authentic</h4>
              <p className="text-xs text-neutral-400">Verified multi-vendor stores</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-[#FFD21F]">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Fast Delivery</h4>
              <p className="text-xs text-neutral-400">Free delivery over ₹999</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-[#FFD21F]">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Easy Returns</h4>
              <p className="text-xs text-neutral-400">7-day replacement guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-[#FFD21F]">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Secure Payments</h4>
              <p className="text-xs text-neutral-400">256-bit encrypted checkout</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 text-xs">
        {/* Brand Col */}
        <div className="col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFD21F] text-neutral-950 font-black text-lg flex items-center justify-center">
              Q
            </div>
            <span className="text-xl font-black text-white">Qazvu<span className="text-[#FFD21F]">Cart</span></span>
          </Link>
          <p className="text-neutral-400 leading-relaxed max-w-sm">
            India&apos;s fastest growing multi-vendor marketplace. Designed for speed, authentic brands, verified customer reviews, and seamless delivery.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Accepted Payment Methods:</span>
            <div className="flex gap-1.5 font-bold text-[10px] text-white">
              <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">UPI</span>
              <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">VISA</span>
              <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">Mastercard</span>
              <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">NetBanking</span>
              <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">COD</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <h5 className="font-bold text-white uppercase tracking-wider text-xs">Categories</h5>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/products?category=electronics" className="hover:text-white transition-colors">Electronics & Audio</Link></li>
            <li><Link href="/products?category=fashion" className="hover:text-white transition-colors">Fashion & Apparel</Link></li>
            <li><Link href="/products?category=home-living" className="hover:text-white transition-colors">Home & Living</Link></li>
            <li><Link href="/products?category=beauty-care" className="hover:text-white transition-colors">Beauty & Skincare</Link></li>
            <li><Link href="/products?category=sports-fitness" className="hover:text-white transition-colors">Sports & Fitness</Link></li>
          </ul>
        </div>

        {/* Customer Care */}
        <div className="space-y-3">
          <h5 className="font-bold text-white uppercase tracking-wider text-xs">Customer Care</h5>
          <ul className="space-y-2 text-neutral-400">
            <li><Link href="/account?tab=orders" className="hover:text-white transition-colors">Track Orders</Link></li>
            <li><Link href="/account?tab=addresses" className="hover:text-white transition-colors">Shipping & Delivery</Link></li>
            <li><Link href="/account?tab=reviews" className="hover:text-white transition-colors">Verified Customer Reviews</Link></li>
            <li><Link href="/account?tab=settings" className="hover:text-white transition-colors">Account Settings</Link></li>
          </ul>
        </div>

        {/* Seller Info (Phase 2 readiness) */}
        <div className="space-y-3">
          <h5 className="font-bold text-white uppercase tracking-wider text-xs">Multi-Vendor Hub</h5>
          <ul className="space-y-2 text-neutral-400">
            <li><span className="text-neutral-500">Sell on QazvuCart (Phase 2)</span></li>
            <li><span className="text-neutral-500">Seller Protection Program</span></li>
            <li><span className="text-neutral-500">Fulfilment by QazvuCart</span></li>
            <li><span className="text-neutral-500">Marketplace APIs</span></li>
          </ul>
        </div>
      </div>

      {/* 3. Copyright Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500">
        <p>© 2026 QazvuCart Technologies Inc. All rights reserved.</p>
        <p className="flex items-center gap-1">
          Built with precision for Next.js & PostgreSQL
        </p>
      </div>
    </footer>
  );
}
