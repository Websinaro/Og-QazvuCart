'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import { ProductGridSkeleton } from '@/src/components/product/ProductCardSkeleton';
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
          <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
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

  const fadeUp = {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  };

  const clock = (v: number, unit: string) => (
    <span className="grid place-items-center min-w-[2.75rem] rounded-lg bg-white/10 px-2 py-1.5 tabular-nums">
      <span className="text-sm font-semibold text-white leading-none">{String(v).padStart(2, '0')}</span>
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
            className="lg:col-span-2 relative isolate rounded-[2rem] bg-neutral-950 text-white overflow-hidden p-7 sm:p-12 flex flex-col justify-between min-h-[420px] sm:min-h-[500px]"
          >
            <div className="absolute inset-0 -z-10">
              <Image
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1400&q=80"
                alt="SonicBlast Pro wireless headphones"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover object-right opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-transparent" />
              <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-brand-600/40 blur-[110px]" />
            </div>

            <div className="max-w-lg space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-1.5 text-[11px] font-medium text-brand-100">
                <Flame className="w-3.5 h-3.5 text-brand-300" weight="fill" /> Limited edition launch
              </span>
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02]">
                Hear every <span className="text-gradient">detail.</span>
                <br />
                Block the rest.
              </h1>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-md">
                Studio-grade 40mm graphene drivers, 42 dB hybrid noise cancellation and a 60-hour battery, in one pair.
              </p>
            </div>

            <div className="pt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/products/sonicblast-pro-wireless-headphones"
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white text-neutral-950 text-sm font-semibold hover:bg-brand-100 transition-colors shadow-lg"
              >
                Shop SonicBlast Pro · ₹1,499
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
              </Link>
              <Link
                href="/products?isDeal=true"
                className="inline-flex items-center h-12 px-6 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-sm font-medium transition-colors"
              >
                Explore mega deals
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative isolate rounded-[2rem] p-6 sm:p-7 min-h-[220px] flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white shadow-glow"
            >
              <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/15 blur-2xl -z-10" />
              <div className="space-y-2.5">
                <span className="inline-block rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Top seller
                </span>
                <h3 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight">
                  AuraBook Max 15.6&quot; Ultra Laptop
                </h3>
                <p className="text-xs text-white/75">Intel Core i7 13th Gen · 16GB RAM · 512GB NVMe SSD</p>
              </div>
              <div className="pt-5 flex items-end justify-between">
                <div>
                  <span className="text-xs text-white/60 line-through tabular-nums">₹79,999</span>
                  <p className="text-xl font-semibold tabular-nums">₹54,999</p>
                </div>
                <Link
                  href="/products/aurabook-max-ultra-thin-laptop"
                  aria-label="View AuraBook Max"
                  className="grid place-items-center w-11 h-11 rounded-full bg-white text-brand-700 hover:scale-105 active:scale-95 transition-transform"
                >
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative isolate rounded-[2rem] p-6 sm:p-7 min-h-[220px] flex flex-col justify-between overflow-hidden bg-neutral-900 text-white border border-white/10"
            >
              <div className="absolute -left-10 -bottom-12 w-48 h-48 rounded-full bg-sky-500/20 blur-3xl -z-10" />
              <div className="space-y-2.5">
                <span className="inline-block rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  50% off
                </span>
                <h3 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight">
                  NovaPulse Series 7 AMOLED Smartwatch
                </h3>
                <p className="text-xs text-neutral-400">Always-on display · Bluetooth calling · IP68</p>
              </div>
              <div className="pt-5 flex items-end justify-between">
                <div>
                  <span className="text-xs text-neutral-500 line-through tabular-nums">₹5,999</span>
                  <p className="text-xl font-semibold text-brand-200 tabular-nums">₹2,999</p>
                </div>
                <Link
                  href="/products/novapulse-smartwatch-series-7"
                  aria-label="View NovaPulse Series 7"
                  className="grid place-items-center w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 hover:scale-105 active:scale-95 text-white transition"
                >
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </Link>
              </div>
            </motion.div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group relative surface p-4 sm:p-5 flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-lift hover:border-brand-500/40 transition-all duration-300"
            >
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 group-hover:bg-brand-600 group-hover:text-white group-hover:scale-105 transition-all duration-300 mb-3 [&_svg]:text-current">
                {getCategoryIcon(cat.slug)}
              </span>
              <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{cat.name}</h3>
              <span className="text-[11px] text-neutral-500 mt-0.5">{cat.productCount} products</span>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* 3. Deals of the day */}
      <motion.section {...fadeUp} className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="rounded-[2rem] surface p-5 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6">
            <div className="flex items-center gap-3.5">
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_8px_24px_-8px_rgb(225_29_72/0.6)]">
                <Flame className="w-6 h-6" weight="fill" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Deals of the day</h2>
                  <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {deals.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {featured.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
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
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-neutral-950 text-white p-7 sm:p-12">
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-brand-600/30 blur-[110px] -z-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {[
              { Icon: ShieldCheck, title: 'Authentic guarantee', copy: 'Every merchant is compliance-verified. 100% original manufacturer inventory.' },
              { Icon: Truck, title: 'Dynamic express delivery', copy: 'Real-time warehouse tracking, live delivery dates and free shipping over ₹999.' },
              { Icon: RotateCcw, title: '7-day zero-hassle returns', copy: 'Return or replace if damaged or mismatched, with instant refunds.' },
            ].map(({ Icon, title, copy }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/10 border border-white/10 text-brand-200 shrink-0">
                  <Icon className="w-6 h-6" />
                </span>
                <div>
                  <h4 className="text-base font-semibold mb-1.5">{title}</h4>
                  <p className="text-[13px] text-neutral-400 leading-relaxed">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
