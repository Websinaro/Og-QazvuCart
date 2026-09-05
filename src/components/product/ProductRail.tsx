'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import { ProductCardSkeleton } from '@/src/components/product/ProductCardSkeleton';

export function ProductRail({
  title,
  subtitle,
  icon: Icon,
  products,
  isLoading,
  skeletonCount = 4,
  accent = 'default',
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  products: ProductCardProps[];
  isLoading: boolean;
  skeletonCount?: number;
  accent?: 'default' | 'amber';
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  };

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="py-6 sm:py-8">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          {Icon && (
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                accent === 'amber' ? 'bg-[#FFD21F] text-neutral-950' : 'bg-neutral-900 text-[#FFD21F]'
              }`}
            >
              <Icon className="w-4 h-4" />
            </span>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-black text-neutral-950 leading-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-neutral-500 font-medium">{subtitle}</p>}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scrollBy(-320)}
            aria-label="Scroll left"
            className="p-1.5 rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollBy(320)}
            aria-label="Scroll right"
            className="p-1.5 rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className="w-[46vw] sm:w-[240px] shrink-0 snap-start">
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((p) => (
              <div key={p.id} className="w-[46vw] sm:w-[240px] shrink-0 snap-start">
                <ProductCard {...p} />
              </div>
            ))}
      </div>
    </section>
  );
}
