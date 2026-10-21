import React from 'react';

/** QazvuCart logo mark: a leaf-shaped check in brand green. */
export function BrandMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[12px] bg-brand-800 dark:bg-brand-500 text-white dark:text-brand-950 shrink-0 ${className}`}>
      <svg viewBox="0 0 64 64" className="w-[64%] h-[64%]" fill="none" aria-hidden="true">
        {/* leaf */}
        <path
          d="M10 34c0-13 10-22 26-24 0 15-8 26-22 28-2 .3-4-1-4-4Z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* check tail */}
        <path
          d="M22 38 L32 48 L54 18"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-brand-200 dark:stroke-brand-900"
        />
      </svg>
    </span>
  );
}
