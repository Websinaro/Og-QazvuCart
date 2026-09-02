import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div id="not-found-view" className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div id="not-found-card" className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black text-neutral-900 mb-1">404</h1>
        <h2 className="text-lg font-bold text-neutral-800 mb-2">Page Not Found</h2>
        <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
          The product or page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <Link
          id="not-found-home-link"
          href="/"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-6 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
