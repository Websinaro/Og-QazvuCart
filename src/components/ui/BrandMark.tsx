import React from 'react';

/** QazvuCart logo mark: a "Q" whose tail doubles as a cart handle. */
export function BrandMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[10px] bg-brand-800 dark:bg-brand-500 text-white dark:text-brand-950 shrink-0 ${className}`}>
      <svg viewBox="0 0 64 64" className="w-[62%] h-[62%]" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="30" cy="30" r="16" />
        <path d="M41 41 L53 53" className="stroke-brand-300 dark:stroke-brand-900" />
      </svg>
    </span>
  );
}
