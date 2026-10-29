'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import { ProductGridSkeleton } from '@/src/components/product/ProductCardSkeleton';
import { AnimatedGrid } from '@/src/components/ui/AnimatedGrid';
import { formatINR } from '@/src/lib/date';
import { useDealCountdown } from '@/src/lib/dealCountdown';
import { RecentlyViewedRail } from '@/src/components/product/RecentlyViewedRail';
import { TrendingRail } from '@/src/components/product/TrendingRail';
import { PersonalizedRail } from '@/src/components/product/PersonalizedRail';
import {
  Flame,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Laptop,
  Shirt,
  Home,
  Dumbbell,
  Watch,
  ChevronRight,
  Clock,
} from '@/src/components/ui/icons';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  icon: string;
  imageUrl: string;
  description: string;
  productCount: number;
}

function SectionHead({
  icon,
  title,
  subtitle,
  href,
  cta,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h2>
          <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-xs font-semibold text-neutral-800 dark:text-neutral-200 border border-neutral-900/10 dark:border-white/15 hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 hover:border-transparent transition-all group"
        >
          {cta}
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
);
}

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [deals, setDeals] = useState<ProductCardProps[]>([]);
  const [featured, setFeatured] = useState<ProductCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Deal countdown — counts down to real end-of-day, see useDealCountdown().
  const timeLeft = useDealCountdown();

  useEffect(() => {
    let cancelled = false;
    async function loadHomeData() {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const [catRes, dealsRes, featRes] = await Promise.all([
          fetch('/api/categories').then((r) => r.json()),
          fetch('/api/products?isDeal=true&limit=4').then((r) => r.json()),
          fetch('/api/products?isFeatured=true&limit=8').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (catRes.success) setCategories(catRes.data);
        if (dealsRes.success) setDeals(dealsRes.data.products);
        if (featRes.success) setFeatured(featRes.data.products);
        if (!catRes.success && !dealsRes.success && !featRes.success) setLoadFailed(true);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Spotlight tiles come from live catalogue data so prices, stock and links
  // can never drift from what the product page shows.
  const spotlightPool = [...deals, ...featured].filter(
    (p, idx, arr) => p.inStock && arr.findIndex((q) => q.id === p.id) === idx
  );
  const spotlightA = isLoading ? undefined : spotlightPool[0];
  const spotlightB = isLoading ? undefined : spotlightPool[1];

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'electronics':
        return <Headphones className="w-6 h-6" />;
      case 'fashion':
        return <Shirt className="w-6 h-6" />;
      case 'home-living':
        return <Home className="w-6 h-6" />;
      case 'sports-fitness':
        return <Dumbbell className="w-6 h-6" />;
      case 'accessories':
        return <Watch className="w-6 h-6" />;
      default:
        return <Laptop className="w-6 h-6" />;
    }
  };

  const fadeUp = {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  };

  const clock = (v: number, unit: string) => (
    <span className="grid place-items-center min-w-[2.75rem] rounded-lg bg-white/10 px-2 py-1.5 tabular-nums">
      <span className="text-sm font-semibold text-brand-300 leading-none">{String(v).padStart(2, '0')}</span>
      <span className="text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5">{unit}</span>
    </span>
  );

  return (
    <div className="min-h-screen pb-8">
      {/* 1. Hero bento */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-2 relative isolate rounded-[2rem] bg-gradient-to-br from-brand-200 via-brand-300 to-brand-400 text-neutral-950 overflow-hidden p-7 sm:p-12 flex flex-col justify-between min-h-[420px] sm:min-h-[500px] shadow-lift"
          >
            {/* Backdrop: dotted grid + breathing white glows */}
            <div className="absolute inset-0 -z-10 pointer-events-none">
              <div className="absolute inset-0 bg-dots opacity-70 [mask-image:linear-gradient(135deg,black,transparent_65%)]" />
              <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-white/70 blur-[100px] animate-pulse-glow" />
              <div className="absolute right-1/4 -top-28 w-80 h-80 rounded-full bg-white/60 blur-[90px] animate-pulse-glow [animation-delay:2s]" />
            </div>

            {/* Floating product photo (desktop) */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotate: 6 }}
              animate={{ opacity: 1, x: 0, rotate: 2 }}
              transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="hidden sm:block absolute right-8 top-8 bottom-8 w-[40%] -z-[5]"
            >
              <div className="relative h-full w-full rounded-[1.75rem] overflow-hidden ring-4 ring-white/80 shadow-lift animate-float-slow">
                <Image
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80"
                  alt="SonicBlast Pro wireless headphones in studio light"
                  fill
                  priority
                  sizes="(max-width: 1024px) 40vw, 28vw"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-500/25 via-transparent to-white/10" />
              </div>
            </motion.div>

            <div className="max-w-lg space-y-5 sm:max-w-[52%] lg:max-w-[55%]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/75 backdrop-blur-md border border-neutral-950/10 px-3.5 py-1.5 text-[11px] font-semibold text-neutral-900">
                <Flame className="w-3.5 h-3.5 text-brand-700" weight="fill" /> Limited edition launch
              </span>
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02]">
                Hear every{' '}
                <span className="relative inline-block px-2.5 -mx-0.5 rounded-xl bg-white/85 text-neutral-950 -rotate-1 shadow-soft">
                  detail.
                </span>
                <br />
                Block the rest.
              </h1>
              <p className="text-sm sm:text-base text-neutral-800/80 leading-relaxed max-w-md">
                Studio-grade 40mm graphene drivers, 42 dB hybrid noise cancellation and a 60-hour battery, in one pair.
              </p>
            </div>

            <div className="pt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/products/sonicblast-pro-wireless-headphones"
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg"
              >
                Shop SonicBlast Pro
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
              </Link>
              <Link
                href="/products?isDeal=true"
                className="inline-flex items-center h-12 px-6 rounded-full bg-white/60 hover:bg-white backdrop-blur-md border border-neutral-950/10 text-sm font-semibold text-neutral-900 transition-colors"
              >
                Explore mega deals
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5">
            {[spotlightA, spotlightB].map((p, i) =>
              p ? (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 * (i + 1), ease: [0.16, 1, 0.3, 1] }}
                  className={
                    i === 0
                      ? 'group relative isolate rounded-[2rem] p-6 sm:p-7 min-h-[220px] flex flex-col justify-between overflow-hidden bg-white dark:bg-[#17140b] border border-brand-700/10 dark:border-white/10 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300'
                      : 'group relative isolate rounded-[2rem] p-6 sm:p-7 min-h-[220px] flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-400 to-brand-500 text-neutral-950 shadow-glow hover:-translate-y-1 transition-transform duration-300'
                  }
                >
                  <div
                    className={`absolute w-44 h-44 rounded-full blur-2xl -z-10 group-hover:scale-125 transition-transform duration-700 ${
                      i === 0 ? '-right-10 -top-10 bg-brand-300/70' : '-left-10 -bottom-12 bg-white/60'
                    }`}
                  />
                  <div className="space-y-2.5">
                    {p.discountPercent > 0 ? (
                      <span className="inline-block rounded-full bg-rose-600 text-white px-2.5 py-1 text-xs font-semibold">
                        {p.discountPercent}% off
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-neutral-950 text-brand-300 px-2.5 py-1 text-xs font-semibold">
                        Featured
                      </span>
                    )}
                    <h2 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight line-clamp-3">
                      <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
                        {p.name}
                      </Link>
                    </h2>
                    <p className={`text-xs ${i === 0 ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-900/75'}`}>
                      {[p.brand, p.categoryName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="pt-5 flex items-end justify-between">
                    <div>
                      {p.basePrice > p.discountPrice && (
                        <span className={`text-xs line-through tabular-nums ${i === 0 ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900/65'}`}>
                          {formatINR(p.basePrice)}
                        </span>
                      )}
                      <p className={`text-xl font-semibold tabular-nums ${i === 0 ? 'text-neutral-950 dark:text-white' : ''}`}>
                        {formatINR(p.discountPrice)}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`grid place-items-center w-11 h-11 rounded-full group-hover:scale-110 transition ${
                        i === 0 ? 'bg-brand-500 text-neutral-950 shadow-glow' : 'bg-neutral-950 text-brand-300'
                      }`}
                    >
                      <ArrowRight className="w-4 h-4" weight="bold" />
                    </span>
                  </div>
                </motion.div>
              ) : (
                <div key={`sk-${i}`} className="shimmer-bg rounded-[2rem] min-h-[220px]" aria-hidden="true" />
              )
            )}
          </div>
        </div>
      </section>

      {/* 2. Categories */}
      <motion.section {...fadeUp} className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <SectionHead
          title="Shop by category"
          subtitle="Explore genuine products from verified sellers"
          href="/products"
          cta="View all"
        />
        <AnimatedGrid
          resetKey={categories.length}
          stagger={0.07}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4"
        >
          {(isLoading && categories.length === 0 ? [] : categories).map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group card-spotlight relative surface p-4 sm:p-5 flex flex-col items-center text-center hover:-translate-y-1.5 hover:shadow-lift hover:border-brand-400/70 transition-[transform,box-shadow,border-color] duration-300"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
            >
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-brand-400/20 text-brand-700 dark:text-brand-300 group-hover:bg-brand-500 group-hover:text-neutral-950 group-hover:shadow-glow group-hover:animate-icon-wiggle transition-colors duration-300 mb-3 [&_svg]:text-current">
                {getCategoryIcon(cat.slug)}
              </span>
              <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{cat.name}</h3>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{cat.productCount} {cat.productCount === 1 ? 'product' : 'products'}</span>
            </Link>
          ))}
        </AnimatedGrid>
        {isLoading && categories.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-[1.25rem] h-[132px]" />
            ))}
          </div>
        )}
      </motion.section>

      {loadFailed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
          <div role="alert" className="surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">We couldn&apos;t load the latest products</p>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 mt-0.5">Check your connection and try again.</p>
            </div>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="h-11 px-6 rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-[13px] font-semibold hover:bg-brand-600 dark:hover:bg-brand-200 hover:text-neutral-950 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* 3. Deals of the day */}
      <motion.section {...fadeUp} className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="rounded-[2rem] surface p-5 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6">
            <div className="flex items-center gap-3.5">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600 text-neutral-950 shadow-glow">
                <Flame className="w-6 h-6" weight="fill" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Deals of the day</h2>
                  <span className="rounded-full bg-brand-400/25 text-brand-800 dark:text-brand-300 text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
                    Up to 50% off
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Verified discounts, refreshed every 24 hours
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-neutral-950 text-white pl-4 pr-2 py-2 self-start md:self-auto">
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="w-4 h-4 text-brand-300" /> Ends in
              </span>
              <div className="flex items-center gap-1">
                {clock(timeLeft.hours, 'hrs')}
                <span className="text-neutral-600">:</span>
                {clock(timeLeft.minutes, 'min')}
                <span className="text-neutral-600">:</span>
                {clock(timeLeft.seconds, 'sec')}
              </div>
            </div>
          </div>

          {isLoading ? (
            <ProductGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5" />
          ) : (
            <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {deals.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </AnimatedGrid>
          )}
        </div>
      </motion.section>

      {/* Picked for you (hides itself for first-time visitors) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <PersonalizedRail />
      </div>

      {/* 4. Featured */}
      <motion.section {...fadeUp} className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <SectionHead
          icon={
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 shrink-0">
              <Sparkles className="w-5 h-5" weight="fill" />
            </span>
          }
          title="Featured products"
          subtitle="Customer favourites with 4.5+ verified ratings"
          href="/products?isFeatured=true"
          cta="Explore all"
        />
        {isLoading ? (
          <ProductGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5" />
        ) : (
          <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {featured.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </AnimatedGrid>
        )}
      </motion.section>

      {/* Trending now */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <TrendingRail />
      </div>

      {/* Recently viewed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <RecentlyViewedRail />
      </div>

      {/* 5. Guarantees */}
      <motion.section {...fadeUp} className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-200 via-brand-100 to-white dark:from-[#241d09] dark:via-[#1a1508] dark:to-[#120f08] border border-brand-400/40 dark:border-white/10 text-neutral-900 dark:text-white p-7 sm:p-12">
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-brand-400/40 blur-[110px] -z-10 animate-pulse-glow" />
          <div className="absolute inset-0 bg-dots opacity-40 -z-10 [mask-image:linear-gradient(200deg,black,transparent_60%)]" />
          <AnimatedGrid className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10" stagger={0.12} itemClassName="">
            {[
              { Icon: ShieldCheck, title: 'Authentic guarantee', copy: 'Every merchant is compliance-verified. 100% original manufacturer inventory.' },
              { Icon: Truck, title: 'Dynamic express delivery', copy: 'Real-time warehouse tracking, live delivery dates and free shipping over ₹999.' },
              { Icon: RotateCcw, title: '7-day zero-hassle returns', copy: 'Return or replace if damaged or mismatched, with instant refunds.' },
            ].map(({ Icon, title, copy }) => (
              <div key={title} className="group flex items-start gap-4">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-brand-500 text-neutral-950 shadow-glow shrink-0 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base font-semibold mb-1.5">{title}</h3>
                  <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{copy}</p>
                </div>
              </div>
            ))}
          </AnimatedGrid>
        </div>
      </motion.section>
    </div>
  );
}
