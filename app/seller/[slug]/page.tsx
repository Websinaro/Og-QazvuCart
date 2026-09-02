'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import {
  Store,
  Star,
  ShieldCheck,
  Package,
  LayoutGrid,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface SellerProfile {
  id: number;
  name: string;
  slug: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  memberSince: string;
  avatarUrl?: string;
  totalProducts: number;
  totalCategories: number;
}

interface SellerPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export default function SellerStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [productList, setProductList] = useState<ProductCardProps[]>([]);
  const [pagination, setPagination] = useState<SellerPagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadStore = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/sellers/${slug}?page=${targetPage}&limit=12`);
        const json = await res.json();
        if (!json.success) {
          setNotFound(true);
          return;
        }
        setSeller(json.data.seller);
        setProductList(json.data.products);
        setPagination(json.data.pagination);
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    loadStore(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, page]);

  const memberSinceLabel = seller
    ? new Date(seller.memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  if (isLoading && !seller) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-neutral-950 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !seller) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-neutral-400" />
        </div>
        <h1 className="text-xl font-black text-neutral-950">Store not found</h1>
        <p className="text-sm text-neutral-500 max-w-sm">
          This seller storefront doesn&apos;t exist or is no longer active. Double-check the link, or browse our full catalog instead.
        </p>
        <Link
          href="/products"
          className="mt-2 bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
        >
          Browse All Products
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-screen">
      {/* Store Banner */}
      <div className="bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#FFD21F] flex items-center justify-center shrink-0 font-black text-2xl text-neutral-950">
            {seller.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.avatarUrl} alt={seller.name} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
            ) : (
              seller.name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black truncate">{seller.name}</h1>
              {seller.isVerified && (
                <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                  <ShieldCheck className="w-3 h-3" /> Verified Merchant
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] sm:text-xs text-neutral-300 font-semibold">
              <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                <Star className="w-3.5 h-3.5 fill-[#FFD21F] text-[#FFD21F]" />
                {seller.rating > 0 ? seller.rating.toFixed(1) : 'New'} ({seller.reviewCount} reviews)
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {seller.totalProducts} products
              </span>
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" /> {seller.totalCategories} categories
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Selling since {memberSinceLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm sm:text-base font-black text-neutral-950 flex items-center gap-2">
            <Store className="w-4 h-4 text-neutral-500" /> Products from this store
          </h2>
          {pagination && <span className="text-xs text-neutral-500 font-semibold">{pagination.total} items</span>}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-neutral-200 border-t-neutral-950 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && productList.length === 0 && (
          <div className="text-center py-16 text-sm text-neutral-500 bg-white border border-neutral-200 rounded-2xl">
            This store hasn&apos;t listed any products yet. Check back soon.
          </div>
        )}

        {!isLoading && productList.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {productList.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-xl border border-neutral-300 disabled:opacity-40 hover:bg-white transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-neutral-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="p-2 rounded-xl border border-neutral-300 disabled:opacity-40 hover:bg-white transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
