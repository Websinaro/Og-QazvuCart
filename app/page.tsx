'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import { ProductGridSkeleton } from '@/src/components/product/ProductCardSkeleton';
import { AnimatedGrid } from '@/src/components/ui/AnimatedGrid';
import { useDealCountdown } from '@/src/lib/dealCountdown';
import { useAuth } from '@/src/context/AuthContext';
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
  Sparkles,
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
    <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-[1.75rem] font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h2>
        <p className="text-[13px] sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">{subtitle}</p>
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
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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
    <span className="grid place-items-center min-w-[2.7rem] rounded-xl bg-brand-800 dark:bg-brand-500 px-2 py-1.5 tabular-nums">
      <span className="text-base font-semibold text-white dark:text-neutral-950 leading-none">{String(v).padStart(2, '0')}</span>
      <span className="text-[10px] text-brand-200 dark:text-brand-900 mt-1">{unit}</span>
    </span>
  );

  const sectionCls = 'max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14';

  return (
    <div className="min-h-screen pb-8">
      {/* Greeting (mobile) */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
          {greeting}, <span className="font-semibold text-neutral-800 dark:text-neutral-100">{user?.username ?? 'there'}</span> <span aria-hidden="true">👋</span>
        </p>
      </div>

      {/* 1. Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 lg:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Banner */}
          <div className="lg:col-span-8 relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-600 via-brand-800 to-brand-900 text-white min-h-[215px] sm:min-h-[330px] lg:min-h-[420px]">
            <span aria-hidden="true" className="absolute -right-16 -top-20 size-72 sm:size-96 rounded-full bg-white/10 -z-10" />
            <span aria-hidden="true" className="absolute right-24 -bottom-24 size-56 sm:size-72 rounded-full bg-brand-400/20 -z-10" />

            <div className="absolute inset-y-0 right-0 w-[52%] sm:w-[55%] -z-10 animate-stage-wipe [mask-image:linear-gradient(to_right,transparent,#000_38%)]">
              <Image
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80"
                alt="SonicBlast Pro wireless headphones"
                fill
                priority
                sizes="(max-width: 1024px) 60vw, 38vw"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative flex flex-col justify-center h-full min-h-[215px] sm:min-h-[330px] lg:min-h-[420px] p-5 sm:p-10 lg:p-12 max-w-[62%] sm:max-w-[58%]">
              <p className="hero-in [--d:0.05s] inline-flex items-center gap-1.5 text-xs sm:text-sm text-white/80">
                <Sparkles className="w-3.5 h-3.5" weight="fill" /> New Arrivals
              </p>
              <h1 className="hero-in [--d:0.12s] mt-1.5 text-[1.65rem] sm:text-5xl lg:text-[3.4rem] font-semibold tracking-[-0.03em] leading-[1.06]">
                Upgrade
                <br />
                Your Lifestyle
              </h1>
              <p className="hero-in [--d:0.2s] mt-2 sm:mt-4 text-[11px] sm:text-base text-white/75">Trendy. Useful. Yours.</p>
              <div className="hero-in [--d:0.28s] mt-4 sm:mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/products"
                  className="group inline-flex items-center gap-1.5 h-9 sm:h-12 px-4 sm:px-7 rounded-full bg-white text-brand-900 text-xs sm:text-sm font-semibold hover:bg-brand-50 active:scale-[0.98] transition shadow-lift"
                >
                  Shop Now
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
                </Link>
                <Link
                  href="/products?isDeal=true"
                  className="hidden sm:inline text-sm font-semibold text-white/90 underline decoration-white/30 underline-offset-[6px] hover:decoration-white transition-colors"
                >
                  Explore mega deals
                </Link>
              </div>
            </div>

            <div className="hero-in [--d:0.9s] absolute top-3 right-3 sm:top-5 sm:right-5 rounded-2xl bg-white text-neutral-950 px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-lift">
              <p className="text-[10px] sm:text-[11px] text-neutral-500 leading-none">SonicBlast Pro</p>
              <Link
                href="/products/sonicblast-pro-wireless-headphones"
                className="mt-1 block text-sm sm:text-lg font-semibold tabular-nums leading-none hover:text-brand-700"
              >
                ₹1,499
              </Link>
            </div>
          </div>

          {/* Promo tiles */}
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5">
            <Link
              href="/products/aurabook-max-ultra-thin-laptop"
              aria-label="View AuraBook Max"
              className="hero-in [--d:0.4s] group flex items-center justify-between gap-4 rounded-[1.5rem] bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.05] dark:border-white/10 shadow-soft p-4 sm:p-6 hover:border-brand-600/30 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
            >
              <div className="min-w-0">
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Top seller</span>
                <h3 className="mt-1 text-base sm:text-lg font-semibold leading-snug tracking-tight text-neutral-950 dark:text-white">
                  AuraBook Max 15.6&quot; Ultra Laptop
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">Intel Core i7 · 16GB RAM · 512GB SSD</p>
                <p className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">₹54,999</span>
                  <span className="text-xs text-neutral-400 line-through tabular-nums">₹79,999</span>
                </p>
              </div>
              <span className="grid place-items-center size-10 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-800 dark:text-brand-300 group-hover:bg-brand-800 group-hover:text-white transition-colors shrink-0">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" weight="bold" />
              </span>
            </Link>

            <Link
              href="/products/novapulse-smartwatch-series-7"
              aria-label="View NovaPulse Series 7"
              className="hero-in [--d:0.5s] group flex items-center justify-between gap-4 rounded-[1.5rem] bg-brand-100 dark:bg-brand-900/60 border border-brand-700/10 dark:border-white/10 p-4 sm:p-6 hover:border-brand-600/40 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
            >
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 px-2.5 py-0.5 text-xs font-semibold">50% off</span>
                <h3 className="mt-2 text-base sm:text-lg font-semibold leading-snug tracking-tight text-neutral-950 dark:text-white">
                  NovaPulse Series 7 Smartwatch
                </h3>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300 line-clamp-1">Always-on AMOLED · Calling · IP68</p>
                <p className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-lg sm:text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">₹2,999</span>
                  <span className="text-xs text-neutral-500 line-through tabular-nums">₹5,999</span>
                </p>
              </div>
              <span className="grid place-items-center size-10 rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 group-hover:scale-105 transition-transform shrink-0">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" weight="bold" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Categories */}
      <section className={sectionCls}>
        <SectionHead
          title="Shop by category"
          subtitle="Genuine products from verified sellers"
          href="/products"
          cta="See all"
        />
        <AnimatedGrid
          resetKey={categories.length}
          stagger={0.05}
          className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4"
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group flex flex-col items-center gap-2.5 rounded-[1.5rem] bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.05] dark:border-white/10 shadow-soft px-2 py-4 sm:py-5 hover:border-brand-600/30 hover:shadow-lift transition-[border-color,box-shadow] duration-300"
            >
              <span className="grid place-items-center size-12 sm:size-14 rounded-2xl bg-brand-100 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 group-hover:bg-brand-800 group-hover:text-white dark:group-hover:bg-brand-500 dark:group-hover:text-neutral-950 transition-colors duration-300 [&_svg]:text-current">
                {getCategoryIcon(cat.slug)}
              </span>
              <span className="text-center min-w-0">
                <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">{cat.name}</h3>
                <span className="text-[11px] text-neutral-500 mt-0.5 block">{cat.productCount} products</span>
              </span>
            </Link>
          ))}
        </AnimatedGrid>
      </section>

      {/* 3. Deals of the day */}
      <section className={sectionCls}>
        <div className="rounded-[1.75rem] bg-white/70 dark:bg-[#0b1f16] border border-neutral-900/[0.05] dark:border-white/10 shadow-soft p-4 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 sm:pb-7">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-[1.75rem] font-semibold tracking-tight text-neutral-950 dark:text-white">Today&apos;s Deals</h2>
                <span className="rounded-full bg-brand-100 dark:bg-brand-500/25 text-brand-800 dark:text-brand-200 text-xs font-semibold px-2.5 py-1">Up to 50% off</span>
              </div>
              <p className="text-[13px] sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">Verified discounts, refreshed every 24 hours</p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <span className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-white/65">
                <Clock className="w-4 h-4 text-brand-700 dark:text-brand-300" /> Ends in
              </span>
              <div className="flex items-center gap-1">
                {clock(timeLeft.hours, 'hrs')}
                <span className="text-neutral-400">:</span>
                {clock(timeLeft.minutes, 'min')}
                <span className="text-neutral-400">:</span>
                {clock(timeLeft.seconds, 'sec')}
              </div>
            </div>
          </div>

          {isLoading ? (
            <ProductGridSkeleton count={4} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5" />
          ) : (
            <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
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
        <AnimatedGrid className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5" stagger={0.1} itemClassName="">
          {[
            { Icon: ShieldCheck, title: 'Authentic guarantee', copy: 'Every merchant is compliance-verified. 100% original manufacturer inventory.' },
            { Icon: Truck, title: 'Dynamic express delivery', copy: 'Real-time warehouse tracking, live delivery dates and free shipping over ₹999.' },
            { Icon: RotateCcw, title: '7-day zero-hassle returns', copy: 'Return or replace if damaged or mismatched, with instant refunds.' },
          ].map(({ Icon, title, copy }) => (
            <div key={title} className="flex items-start gap-4 rounded-[1.5rem] bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.05] dark:border-white/10 shadow-soft p-5">
              <span className="grid place-items-center size-11 rounded-2xl bg-brand-100 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 shrink-0">
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
