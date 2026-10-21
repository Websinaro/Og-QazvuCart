'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import { ProductGridSkeleton } from '@/src/components/product/ProductCardSkeleton';
import { AnimatedGrid } from '@/src/components/ui/AnimatedGrid';
import { useDealCountdown } from '@/src/lib/dealCountdown';
import { RecentlyViewedRail } from '@/src/components/product/RecentlyViewedRail';
import { TrendingRail } from '@/src/components/product/TrendingRail';
import { PersonalizedRail } from '@/src/components/product/PersonalizedRail';
import {
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

const SPECS = [
  { label: 'Drivers', value: '40 mm graphene' },
  { label: 'Noise cancelling', value: '42 dB hybrid' },
  { label: 'Battery', value: '60 hours' },
];

function SectionHead({
  title,
  subtitle,
  href,
  cta,
}: {
  title: string;
  subtitle: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 sm:mb-7">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-white transition-colors group"
        >
          {cta}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" weight="bold" />
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

  // Deal countdown — counts down to real end-of-day, see useDealCountdown().
  const timeLeft = useDealCountdown();

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [catRes, dealsRes, featRes] = await Promise.all([
          fetch('/api/categories').then((r) => r.json()),
          fetch('/api/products?isDeal=true&limit=4').then((r) => r.json()),
          fetch('/api/products?isFeatured=true&limit=8').then((r) => r.json()),
        ]);

        if (catRes.success) setCategories(catRes.data);
        if (dealsRes.success) setDeals(dealsRes.data.products);
        if (featRes.success) setFeatured(featRes.data.products);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadHomeData();
  }, []);

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

  const clock = (v: number, unit: string) => (
    <span className="grid place-items-center min-w-[2.9rem] rounded-lg bg-white/10 px-2 py-1.5 tabular-nums">
      <span className="text-base font-semibold text-white leading-none">{String(v).padStart(2, '0')}</span>
      <span className="text-[10px] text-brand-200/70 mt-1">{unit}</span>
    </span>
  );

  // Pointer parallax for the hero stage. CSS variables only, no re-render.
  const handleStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--sx', `${(x * -18).toFixed(1)}px`);
    e.currentTarget.style.setProperty('--sy', `${(y * -14).toFixed(1)}px`);
  };
  const handleStageLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--sx', '0px');
    e.currentTarget.style.setProperty('--sy', '0px');
  };

  const sectionCls = 'max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20';

  return (
    <div className="min-h-screen pb-8">
      {/* 1. Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <h1 className="hero-in [--d:0.05s] text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-semibold tracking-[-0.04em] leading-[1.02] text-neutral-950 dark:text-white">
              Hear every detail. Block the rest.
            </h1>
            <p className="hero-in [--d:0.15s] mt-5 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md">
              Studio-grade 40mm graphene drivers, 42 dB hybrid noise cancellation and a 60-hour battery, in one pair.
            </p>
            <div className="hero-in [--d:0.25s] mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/products/sonicblast-pro-wireless-headphones"
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 text-sm font-semibold hover:bg-brand-700 dark:hover:bg-brand-400 active:scale-[0.98] transition-colors shadow-glow"
              >
                Shop SonicBlast Pro · ₹1,499
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
              </Link>
              <Link
                href="/products?isDeal=true"
                className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 underline decoration-neutral-300 dark:decoration-white/25 underline-offset-[6px] hover:decoration-brand-600 transition-colors"
              >
                Explore mega deals
              </Link>
            </div>
          </div>

          {/* Stage */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div
              onPointerMove={handleStageMove}
              onPointerLeave={handleStageLeave}
              className="relative isolate overflow-hidden rounded-[1.75rem] bg-brand-900 min-h-[340px] sm:min-h-[460px] lg:min-h-[520px]"
            >
              <div className="absolute inset-0 -z-10 animate-stage-wipe">
                <div className="absolute -inset-[5%] transition-transform duration-500 ease-out [transform:translate3d(var(--sx,0px),var(--sy,0px),0)_scale(1.03)]">
                  <Image
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80"
                    alt="SonicBlast Pro wireless headphones"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-950/10 to-transparent" />
              </div>

              <div className="hero-in [--d:1s] absolute top-4 right-4 sm:top-6 sm:right-6 rounded-xl bg-white text-neutral-950 px-3.5 py-2 shadow-lift">
                <p className="text-[11px] text-neutral-500 leading-none">SonicBlast Pro</p>
                <p className="mt-1 text-lg font-semibold tabular-nums leading-none">₹1,499</p>
              </div>

              <dl className="absolute left-4 right-4 bottom-4 sm:left-6 sm:right-auto sm:bottom-6 sm:w-[22rem] rounded-2xl bg-brand-950/55 backdrop-blur-md border border-white/15 px-4 py-3.5 space-y-2.5">
                {SPECS.map((spec, i) => (
                  <div
                    key={spec.label}
                    style={{ '--i': i } as React.CSSProperties}
                    className="callout-anim flex items-center gap-3 text-sm"
                  >
                    <span className="callout-dot size-1.5 rounded-full bg-brand-300 shrink-0" />
                    <dt className="callout-label text-white/70 shrink-0">{spec.label}</dt>
                    <span className="callout-line h-px flex-1 bg-white/25" />
                    <dd className="callout-label font-semibold text-white tabular-nums shrink-0">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Promo tiles */}
        <div className="mt-6 lg:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <Link
            href="/products/aurabook-max-ultra-thin-laptop"
            aria-label="View AuraBook Max"
            className="hero-in [--d:0.4s] group flex items-center justify-between gap-5 rounded-2xl bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.08] dark:border-white/10 p-5 sm:p-6 hover:border-brand-600/40 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
          >
            <div className="min-w-0">
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Top seller</span>
              <h3 className="mt-1 text-lg sm:text-xl font-semibold leading-snug tracking-tight text-neutral-950 dark:text-white">
                AuraBook Max 15.6&quot; Ultra Laptop
              </h3>
              <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">Intel Core i7 13th Gen · 16GB RAM · 512GB NVMe SSD</p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">₹54,999</span>
                <span className="text-xs text-neutral-400 line-through tabular-nums">₹79,999</span>
              </p>
            </div>
            <span className="grid place-items-center size-11 rounded-full border border-neutral-900/15 dark:border-white/20 text-neutral-900 dark:text-white group-hover:bg-brand-800 group-hover:border-brand-800 group-hover:text-white transition-colors shrink-0">
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" weight="bold" />
            </span>
          </Link>

          <Link
            href="/products/novapulse-smartwatch-series-7"
            aria-label="View NovaPulse Series 7"
            className="hero-in [--d:0.5s] group flex items-center justify-between gap-5 rounded-2xl bg-brand-100 dark:bg-brand-900/60 border border-brand-700/10 dark:border-white/10 p-5 sm:p-6 hover:border-brand-600/40 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
          >
            <div className="min-w-0">
              <span className="inline-block rounded-md bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 px-2 py-0.5 text-xs font-semibold">50% off</span>
              <h3 className="mt-2 text-lg sm:text-xl font-semibold leading-snug tracking-tight text-neutral-950 dark:text-white">
                NovaPulse Series 7 AMOLED Smartwatch
              </h3>
              <p className="mt-1 text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-300">Always-on display · Bluetooth calling · IP68</p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">₹2,999</span>
                <span className="text-xs text-neutral-500 line-through tabular-nums">₹5,999</span>
              </p>
            </div>
            <span className="grid place-items-center size-11 rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 group-hover:scale-105 transition-transform shrink-0">
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" weight="bold" />
            </span>
          </Link>
        </div>
      </section>

      {/* 2. Categories */}
      <section className={sectionCls}>
        <SectionHead
          title="Shop by category"
          subtitle="Genuine products from verified sellers"
          href="/products"
          cta="View all"
        />
        <AnimatedGrid
          resetKey={categories.length}
          stagger={0.05}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4"
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group relative flex flex-col justify-between min-h-[8.5rem] rounded-2xl bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.08] dark:border-white/10 p-4 hover:border-brand-600/40 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
            >
              <span className="flex items-start justify-between">
                <span className="grid place-items-center size-11 rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300 group-hover:bg-brand-800 group-hover:text-white dark:group-hover:bg-brand-500 dark:group-hover:text-neutral-950 transition-colors duration-300 [&_svg]:text-current">
                  {getCategoryIcon(cat.slug)}
                </span>
                <ArrowRight className="w-4 h-4 text-brand-700 dark:text-brand-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition duration-300" weight="bold" />
              </span>
              <span className="block mt-5">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cat.name}</h3>
                <span className="text-xs text-neutral-500 mt-0.5 block">{cat.productCount} products</span>
              </span>
            </Link>
          ))}
        </AnimatedGrid>
      </section>

      {/* 3. Deals of the day */}
      <section className={sectionCls}>
        <div className="rounded-[1.75rem] bg-brand-900 dark:bg-[#0b1f16] dark:border dark:border-white/10 p-5 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 sm:pb-7">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-white">Deals of the day</h2>
                <span className="rounded-md bg-brand-500/25 text-brand-200 text-xs font-semibold px-2 py-1">Up to 50% off</span>
              </div>
              <p className="text-sm text-white/60 mt-1">Verified discounts, refreshed every 24 hours</p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="flex items-center gap-1.5 text-sm text-white/65">
                <Clock className="w-4 h-4 text-brand-300" /> Ends in
              </span>
              <div className="flex items-center gap-1">
                {clock(timeLeft.hours, 'hrs')}
                <span className="text-white/30">:</span>
                {clock(timeLeft.minutes, 'min')}
                <span className="text-white/30">:</span>
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
      </section>

      {/* Picked for you (hides itself for first-time visitors) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <PersonalizedRail />
      </div>

      {/* 4. Featured */}
      <section className={sectionCls}>
        <SectionHead
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
      </section>

      {/* Trending now */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <TrendingRail />
      </div>

      {/* Recently viewed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <RecentlyViewedRail />
      </div>

      {/* 5. Guarantees */}
      <section className={sectionCls}>
        <AnimatedGrid className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pt-10 border-t border-neutral-900/10 dark:border-white/10" stagger={0.1} itemClassName="">
          {[
            { Icon: ShieldCheck, title: 'Authentic guarantee', copy: 'Every merchant is compliance-verified. 100% original manufacturer inventory.' },
            { Icon: Truck, title: 'Dynamic express delivery', copy: 'Real-time warehouse tracking, live delivery dates and free shipping over ₹999.' },
            { Icon: RotateCcw, title: '7-day zero-hassle returns', copy: 'Return or replace if damaged or mismatched, with instant refunds.' },
          ].map(({ Icon, title, copy }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="grid place-items-center size-11 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white mb-1">{title}</h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xs">{copy}</p>
              </div>
            </div>
          ))}
        </AnimatedGrid>
      </section>
    </div>
  );
}
