'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
} from 'lucide-react';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  icon: string;
  imageUrl: string;
  description: string;
  productCount: number;
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
        return <Headphones className="w-6 h-6 text-neutral-900" />;
      case 'fashion':
        return <Shirt className="w-6 h-6 text-neutral-900" />;
      case 'home-living':
        return <Home className="w-6 h-6 text-neutral-900" />;
      case 'sports-fitness':
        return <Dumbbell className="w-6 h-6 text-neutral-900" />;
      case 'accessories':
        return <Watch className="w-6 h-6 text-neutral-900" />;
      default:
        return <Laptop className="w-6 h-6 text-neutral-900" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100/60 pb-16">
      {/* 1. Hero Showcase Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Hero Card */}
          <div className="lg:col-span-2 relative rounded-3xl bg-neutral-950 text-white overflow-hidden p-8 sm:p-12 flex flex-col justify-between min-h-[380px] sm:min-h-[440px] shadow-xl border border-neutral-800">
            {/* Background image overlay */}
            <div className="absolute inset-0 opacity-40 mix-blend-luminosity">
              <Image
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80"
                alt="SonicBlast Headphones"
                fill
                priority
                className="object-cover object-right"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />

            <div className="relative z-10 max-w-lg space-y-4">
              <div className="inline-flex items-center gap-2 bg-[#FFD21F] text-neutral-950 font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                <Flame className="w-3.5 h-3.5 fill-neutral-950" /> Limited Edition Launch
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white">
                Next-Gen Hybrid <span className="text-[#FFD21F]">ANC Audio</span>
              </h1>
              <p className="text-sm sm:text-base text-neutral-300 font-medium leading-relaxed">
                Experience studio-grade 40mm graphene acoustic drivers, 42dB active hybrid noise cancellation, and 60-hour battery life.
              </p>
            </div>

            <div className="relative z-10 pt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/products/sonicblast-pro-wireless-headphones"
                className="px-7 py-3.5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 group"
              >
                <span>Shop SonicBlast Pro (₹1,499)</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/products?isDeal=true"
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl backdrop-blur-md border border-white/20 transition-colors"
              >
                Explore Mega Deals
              </Link>
            </div>
          </div>

          {/* Right Side Double Cards */}
          <div className="flex flex-col gap-5">
            {/* Top Promo */}
            <div className="flex-1 relative rounded-3xl bg-amber-500 text-neutral-950 p-6 sm:p-7 flex flex-col justify-between overflow-hidden shadow-md">
              <div className="relative z-10 space-y-2">
                <span className="bg-neutral-950 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  Top Seller
                </span>
                <h3 className="text-xl sm:text-2xl font-black leading-tight text-neutral-950">
                  AuraBook Max 15.6&quot; Ultra Laptop
                </h3>
                <p className="text-xs font-semibold text-neutral-900">
                  Intel Core i7 13th Gen • 16GB RAM • 512GB NVMe SSD
                </p>
              </div>
              <div className="relative z-10 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-neutral-800 line-through">₹79,999</span>
                  <p className="text-lg font-black text-neutral-950">₹54,999</p>
                </div>
                <Link
                  href="/products/aurabook-max-ultra-thin-laptop"
                  className="p-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl shadow transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Bottom Promo */}
            <div className="flex-1 relative rounded-3xl bg-neutral-900 text-white p-6 sm:p-7 flex flex-col justify-between overflow-hidden shadow-md border border-neutral-800">
              <div className="relative z-10 space-y-2">
                <span className="bg-[#E50914] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  50% OFF
                </span>
                <h3 className="text-xl sm:text-2xl font-black leading-tight text-white">
                  NovaPulse Series 7 AMOLED Smartwatch
                </h3>
                <p className="text-xs font-medium text-neutral-400">
                  Always-On Display • Bluetooth Calling • IP68 Swim-Proof
                </p>
              </div>
              <div className="relative z-10 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-neutral-500 line-through">₹5,999</span>
                  <p className="text-lg font-black text-[#FFD21F]">₹2,999</p>
                </div>
                <Link
                  href="/products/novapulse-smartwatch-series-7"
                  className="p-3 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 rounded-xl shadow transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Shop by Category Circles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
              Shop by Category
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              Explore thousands of genuine multi-vendor products
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold text-neutral-900 hover:text-amber-600 flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group bg-white p-4 rounded-2xl border border-neutral-200/80 hover:border-neutral-900 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 group-hover:bg-[#FFD21F]/20 flex items-center justify-center mb-3 transition-colors">
                {getCategoryIcon(cat.slug)}
              </div>
              <h3 className="text-xs font-bold text-neutral-900 group-hover:text-neutral-950">
                {cat.name}
              </h3>
              <span className="text-[10px] text-neutral-500 mt-0.5">
                {cat.productCount} Products
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Deal of the Day (Countdown + Hot Deals) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                <Flame className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
                    Deals of the Day
                  </h2>
                  <span className="bg-[#E50914] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Up to 50% OFF
                  </span>
                </div>
                <p className="text-xs text-neutral-500 font-medium">
                  Verified discounts refreshed every 24 hours
                </p>
              </div>
            </div>

            {/* Countdown timer */}
            <div className="flex items-center gap-2 bg-neutral-950 text-white px-4 py-2 rounded-2xl shadow-xs self-start md:self-auto">
              <Clock className="w-4 h-4 text-[#FFD21F]" />
              <span className="text-xs font-medium text-neutral-400">Ends in:</span>
              <div className="flex items-center gap-1 font-mono font-bold text-xs text-[#FFD21F]">
                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">
                  {String(timeLeft.hours).padStart(2, '0')}h
                </span>
                :
                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">
                  {String(timeLeft.minutes).padStart(2, '0')}m
                </span>
                :
                <span className="bg-neutral-800 px-1.5 py-0.5 rounded">
                  {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>

          {/* Deals Grid */}
          {isLoading ? (
            <div className="pt-6">
              <ProductGridSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 pt-6">
              {deals.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Picked For You — based on recently-viewed categories, hides itself for first-time visitors */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <PersonalizedRail />
      </div>

      {/* 4. Featured Marketplace Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
                Featured Products
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                Customer favorites with 4.5+ star verified ratings
              </p>
            </div>
          </div>
          <Link
            href="/products?isFeatured=true"
            className="text-xs font-bold text-neutral-900 hover:text-amber-600 flex items-center gap-1 transition-colors"
          >
            <span>Explore All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <ProductGridSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {featured.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}
      </section>

      {/* Trending Now — real order-volume based ranking */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <TrendingRail />
      </div>

      {/* Recently Viewed — hides itself if there's no browsing history yet */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <RecentlyViewedRail />
      </div>

      {/* 5. Trust Guarantee Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-14">
        <div className="bg-neutral-950 text-white rounded-3xl p-8 sm:p-10 relative overflow-hidden border border-neutral-800 shadow-xl">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFD21F] text-neutral-950 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">Authentic Guarantee</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Every merchant undergoes strict compliance verification. Guaranteed 100% original manufacturer inventory.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFD21F] text-neutral-950 flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">Dynamic Express Delivery</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Real-time warehouse tracking with dynamic delivery date calculation and free shipping on orders over ₹999.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFD21F] text-neutral-950 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">7-Day Zero Hassle Return</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  No questions asked return or replacement if damaged or mismatched. Instant wallet or bank refunds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
