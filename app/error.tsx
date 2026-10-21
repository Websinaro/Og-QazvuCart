'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from '@/src/components/ui/icons';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application runtime error:', error);
  }, [error]);

  return (
    <div id="error-boundary-view" className="min-h-[80vh] flex items-center justify-center p-4">
      <div id="error-card" className="surface max-w-md w-full rounded-[2rem] p-10 text-center shadow-lift">
        <div className="grid place-items-center w-16 h-16 rounded-[1.25rem] bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
          {error?.message || 'An unexpected error occurred while loading this page. Please try refreshing.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            id="retry-btn"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 text-sm font-semibold hover:bg-brand-700 dark:hover:bg-brand-400 transition-colors cursor-pointer shadow-glow hover:text-white dark:hover:text-neutral-950"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            id="error-home-link"
            href="/"
            className="w-full flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-neutral-900/5 dark:bg-white/10 hover:bg-neutral-900/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-100 text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
