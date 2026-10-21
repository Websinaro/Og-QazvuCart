'use client';

import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, type AppIcon } from '@/src/components/ui/icons';
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
  icon?: AppIcon;
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
    <section className="py-8 sm:py-10">
      <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <span
              className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
                accent === 'amber'
                  ? 'bg-brand-700 text-white'
                  : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
              }`}
            >
              <Icon className="w-5 h-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-neutral-950 dark:text-white leading-tight">{title}</h2>
            {subtitle && <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            onClick={() => scrollBy(-320)}
            aria-label="Scroll left"
            className="grid place-items-center w-9 h-9 rounded-full border border-neutral-900/10 dark:border-white/15 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 hover:border-transparent active:scale-95 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollBy(320)}
            aria-label="Scroll right"
            className="grid place-items-center w-9 h-9 rounded-full border border-neutral-900/10 dark:border-white/15 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 hover:border-transparent active:scale-95 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3.5 sm:gap-5 overflow-x-auto pb-4 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth no-scrollbar"
      >
        {isLoading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className="w-[46vw] sm:w-[250px] shrink-0 snap-start">
                <ProductCardSkeleton index={i} />
              </div>
            ))
          : products.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 26, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22, delay: Math.min(i, 6) * 0.06 }}
                className="w-[46vw] sm:w-[250px] shrink-0 snap-start"
              >
                <ProductCard {...p} />
              </motion.div>
            ))}
      </div>
    </section>
  );
}
