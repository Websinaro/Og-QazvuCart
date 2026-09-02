'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

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
    <div id="error-boundary-view" className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div id="error-card" className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-neutral-900 mb-2">Something went wrong</h2>
        <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
          {error?.message || 'An unexpected error occurred while loading this page. Please try refreshing.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            id="retry-btn"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            id="error-home-link"
            href="/"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
