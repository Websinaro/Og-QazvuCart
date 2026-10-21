import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@/src/components/ui/icons';

export default function NotFoundPage() {
  return (
    <div id="not-found-view" className="relative min-h-[80vh] flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none select-none absolute inset-0 grid place-items-center">
        <span className="text-[34vw] sm:text-[22rem] font-semibold tracking-tighter leading-none text-neutral-900/[0.04] dark:text-white/[0.04]">
          404
        </span>
      </div>
      <div id="not-found-card" className="relative max-w-md w-full text-center">
        <span className="inline-block rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 text-[11px] font-semibold uppercase tracking-[0.16em] px-3.5 py-1.5 mb-6">
          Error 404
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.035em] text-neutral-950 dark:text-white mb-3">
          Page <span className="text-gradient">not found</span>
        </h1>
        <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mb-9 leading-relaxed">
          The product or page you&apos;re looking for may have been removed, renamed or is temporarily unavailable.
        </p>

        <Link
          id="not-found-home-link"
          href="/"
          className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold hover:bg-brand-600 dark:hover:bg-brand-200 transition-colors shadow-soft hover:text-neutral-950"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" weight="bold" />
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
