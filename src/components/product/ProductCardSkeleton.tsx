import React from 'react';

/**
 * Mirrors the real ProductCard layout so the page doesn't jump when data
 * replaces the skeleton.
 */
export function ProductCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 11) * 60}ms` }}
      className="animate-skeleton-in rounded-2xl bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.08] dark:border-white/[0.08] overflow-hidden h-full flex flex-col"
    >
      <div className="relative aspect-[4/4.2] w-full shimmer-bg" />
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col gap-2.5">
        <div className="h-2.5 w-1/3 rounded-full shimmer-bg" />
        <div className="h-3.5 w-full rounded-full shimmer-bg" />
        <div className="h-3.5 w-2/3 rounded-full shimmer-bg" />
        <div className="h-3 w-20 rounded-full shimmer-bg mt-1" />
        <div className="mt-auto pt-3 space-y-2.5">
          <div className="h-5 w-24 rounded-full shimmer-bg" />
          <div className="h-10 w-full rounded-lg shimmer-bg" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 8,
  className = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
