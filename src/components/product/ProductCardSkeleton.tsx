import React from 'react';

/**
 * Mirrors the real ProductCard layout (image block, badges, title lines,
 * price, button) so the page doesn't visibly "jump" when real data
 * replaces the skeleton — the shimmer occupies the same shape.
 */
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden h-full flex flex-col">
      <div className="relative aspect-square w-full overflow-hidden shimmer-bg" />
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2.5">
        <div className="h-2.5 w-1/3 rounded shimmer-bg" />
        <div className="h-3.5 w-full rounded shimmer-bg" />
        <div className="h-3.5 w-2/3 rounded shimmer-bg" />
        <div className="h-5 w-16 rounded-md shimmer-bg mt-1" />
        <div className="mt-auto pt-2 border-t border-neutral-100/80 space-y-2">
          <div className="h-5 w-24 rounded shimmer-bg" />
          <div className="h-9 w-full rounded-xl shimmer-bg" />
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
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
