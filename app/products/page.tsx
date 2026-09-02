'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCard, ProductCardProps } from '@/src/components/product/ProductCard';
import {
  SlidersHorizontal,
  X,
  Star,
  RotateCcw,
  Sparkles,
  Grid3X3,
  LayoutGrid,
  Grid2X2,
} from 'lucide-react';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  productCount: number;
}

function ProductsCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const qParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'all';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const minRatingParam = searchParams.get('minRating') || '';
  const minDiscountParam = searchParams.get('minDiscount') || '';
  const inStockParam = searchParams.get('inStock') === 'true';
  const isDealParam = searchParams.get('isDeal') === 'true';
  const isFeaturedParam = searchParams.get('isFeatured') === 'true';
  const sortParam = searchParams.get('sort') || 'relevance';
  const pageParam = Number(searchParams.get('page')) || 1;

  // Local filter states
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductCardProps[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(3);

  // Price inputs local state
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);

  // Load categories
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setCategories(json.data);
      })
      .catch(() => {});
  }, []);

  // Fetch products based on searchParams
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const queryString = searchParams.toString();
        const res = await fetch(`/api/products?${queryString}`);
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setProducts(json.data.products);
          setTotalCount(json.data.pagination.total);
          setTotalPages(json.data.pagination.totalPages);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  // Update URL helper
  const updateFilters = (newParams: Record<string, string | number | boolean | null>) => {
    const current = new URLSearchParams(searchParams.toString());
    // reset to page 1 on filter change
    if (!('page' in newParams)) {
      current.set('page', '1');
    }

    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === '' || val === undefined || (key === 'category' && val === 'all')) {
        current.delete(key);
      } else {
        current.set(key, String(val));
      }
    });

    router.push(`/products?${current.toString()}`);
  };

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({
      minPrice: minPriceInput || null,
      maxPrice: maxPriceInput || null,
    });
  };

  const clearAllFilters = () => {
    setMinPriceInput('');
    setMaxPriceInput('');
    router.push('/products');
  };

  const activeCategory = categories.find((c) => c.slug === categoryParam);

  const hasActiveFilters =
    categoryParam !== 'all' ||
    Boolean(qParam) ||
    Boolean(minPriceParam) ||
    Boolean(maxPriceParam) ||
    Boolean(minRatingParam) ||
    Boolean(minDiscountParam) ||
    inStockParam ||
    isDealParam ||
    isFeaturedParam;

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white border-b border-neutral-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                <span>Home</span>
                <span>/</span>
                <span className="font-semibold text-neutral-900">
                  {activeCategory ? activeCategory.name : qParam ? `Search: "${qParam}"` : 'All Products'}
                </span>
              </div>
              <h1 className="text-2xl font-black text-neutral-950 tracking-tight">
                {activeCategory ? activeCategory.name : qParam ? `Results for "${qParam}"` : 'Explore All Products'}
              </h1>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                Showing {totalCount} verified items
              </p>
            </div>

            {/* Sort, Grid Density & Mobile Filter Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#FFD21F]" />
                <span>Filters</span>
              </button>

              {/* Grid Column Selector (Desktop & Tablet) */}
              <div className="hidden sm:flex items-center bg-white border border-neutral-300 rounded-xl p-1 shadow-xs gap-0.5">
                <button
                  type="button"
                  onClick={() => setGridCols(2)}
                  title="2 Column Grid"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    gridCols === 2 ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridCols(3)}
                  title="3 Column Grid (Default)"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    gridCols === 3 ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridCols(4)}
                  title="4 Column Grid (Compact)"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    gridCols === 4 ? 'bg-neutral-950 text-[#FFD21F]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-xl px-3 py-1.5 shadow-xs">
                <span className="text-xs text-neutral-500 font-semibold whitespace-nowrap hidden sm:inline">Sort by:</span>
                <select
                  value={sortParam}
                  onChange={(e) => updateFilters({ sort: e.target.value })}
                  className="bg-transparent text-xs font-bold text-neutral-900 focus:outline-none cursor-pointer"
                >
                  <option value="relevance">Featured & Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating_desc">Customer Rating (4★+)</option>
                  <option value="discount_desc">Biggest Discount (% OFF)</option>
                  <option value="newest">Newest Arrivals</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-neutral-100 text-xs">
              <span className="font-bold text-neutral-500 text-[11px] uppercase tracking-wider">Active Filters:</span>

              {qParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-900 rounded-lg font-semibold">
                  Query: {qParam}
                  <button onClick={() => updateFilters({ q: null })}><X className="w-3.5 h-3.5 text-neutral-500 hover:text-neutral-950" /></button>
                </span>
              )}

              {categoryParam !== 'all' && activeCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-950 rounded-lg font-semibold">
                  Category: {activeCategory.name}
                  <button onClick={() => updateFilters({ category: null })}><X className="w-3.5 h-3.5 text-amber-800 hover:text-black" /></button>
                </span>
              )}

              {(minPriceParam || maxPriceParam) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-900 rounded-lg font-semibold">
                  Price: ₹{minPriceParam || '0'} - ₹{maxPriceParam || 'Max'}
                  <button onClick={() => { setMinPriceInput(''); setMaxPriceInput(''); updateFilters({ minPrice: null, maxPrice: null }); }}>
                    <X className="w-3.5 h-3.5 text-neutral-500 hover:text-neutral-950" />
                  </button>
                </span>
              )}

              {minRatingParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-950 rounded-lg font-semibold">
                  Rating: {minRatingParam}★ & Above
                  <button onClick={() => updateFilters({ minRating: null })}><X className="w-3.5 h-3.5 text-emerald-800" /></button>
                </span>
              )}

              {minDiscountParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-950 rounded-lg font-semibold">
                  Discount: {minDiscountParam}%+ OFF
                  <button onClick={() => updateFilters({ minDiscount: null })}><X className="w-3.5 h-3.5 text-red-800" /></button>
                </span>
              )}

              {inStockParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-900 rounded-lg font-semibold">
                  In Stock Only
                  <button onClick={() => updateFilters({ inStock: null })}><X className="w-3.5 h-3.5 text-neutral-500" /></button>
                </span>
              )}

              {isDealParam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-950 rounded-lg font-semibold">
                  ⚡ Hot Deals
                  <button onClick={() => updateFilters({ isDeal: null })}><X className="w-3.5 h-3.5 text-red-800" /></button>
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 underline ml-2"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Catalog Grid & Left Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Left Sidebar */}
          <aside className="hidden lg:block space-y-6">
            {/* Category Filter */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider mb-3">
                Categories
              </h3>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => updateFilters({ category: null })}
                  className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors flex items-center justify-between ${
                    categoryParam === 'all'
                      ? 'bg-neutral-900 text-[#FFD21F] font-bold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>All Categories</span>
                  <span>{categories.reduce((a, b) => a + b.productCount, 0)}</span>
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateFilters({ category: c.slug })}
                    className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors flex items-center justify-between ${
                      categoryParam === c.slug
                        ? 'bg-neutral-900 text-[#FFD21F] font-bold'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[11px] opacity-70">({c.productCount})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider mb-3">
                Price (₹)
              </h3>
              <form onSubmit={handlePriceApply} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-500 font-semibold">Min</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 font-semibold">Max</label>
                    <input
                      type="number"
                      placeholder="100000"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  Apply Price
                </button>
              </form>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => { setMinPriceInput(''); setMaxPriceInput('1000'); updateFilters({ minPrice: null, maxPrice: '1000' }); }}
                  className="text-[11px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-medium text-neutral-700"
                >
                  Under ₹1K
                </button>
                <button
                  onClick={() => { setMinPriceInput('1000'); setMaxPriceInput('5000'); updateFilters({ minPrice: '1000', maxPrice: '5000' }); }}
                  className="text-[11px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-medium text-neutral-700"
                >
                  ₹1K - ₹5K
                </button>
                <button
                  onClick={() => { setMinPriceInput('5000'); setMaxPriceInput(''); updateFilters({ minPrice: '5000', maxPrice: null }); }}
                  className="text-[11px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-medium text-neutral-700"
                >
                  Above ₹5K
                </button>
              </div>
            </div>

            {/* Rating Filter */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider mb-3">
                Customer Rating
              </h3>
              <div className="space-y-1.5 text-xs">
                {[4, 3].map((star) => (
                  <button
                    key={star}
                    onClick={() => updateFilters({ minRating: minRatingParam === String(star) ? null : star })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                      minRatingParam === String(star)
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{star} Stars & Above</span>
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Filter */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider mb-3">
                Discount
              </h3>
              <div className="space-y-1.5 text-xs">
                {[50, 40, 30, 20].map((disc) => (
                  <button
                    key={disc}
                    onClick={() => updateFilters({ minDiscount: minDiscountParam === String(disc) ? null : disc })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                      minDiscountParam === String(disc)
                        ? 'bg-red-50 text-red-900 border border-red-300 font-bold'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{disc}% or more</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Availability & Deals */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-extrabold text-neutral-900 uppercase tracking-wider">
                Availability & Deals
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-800 font-medium">
                <input
                  type="checkbox"
                  checked={inStockParam}
                  onChange={(e) => updateFilters({ inStock: e.target.checked ? true : null })}
                  className="rounded text-neutral-900 focus:ring-[#FFD21F]"
                />
                <span>In Stock Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-neutral-800 font-medium">
                <input
                  type="checkbox"
                  checked={isDealParam}
                  onChange={(e) => updateFilters({ isDeal: e.target.checked ? true : null })}
                  className="rounded text-neutral-900 focus:ring-[#FFD21F]"
                />
                <span>⚡ Flash Deals Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-neutral-800 font-medium">
                <input
                  type="checkbox"
                  checked={isFeaturedParam}
                  onChange={(e) => updateFilters({ isFeatured: e.target.checked ? true : null })}
                  className="rounded text-neutral-900 focus:ring-[#FFD21F]"
                />
                <span>✨ Featured Only</span>
              </label>
            </div>
          </aside>

          {/* Right Product Grid & Pagination */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div
                className={
                  gridCols === 4
                    ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4'
                    : gridCols === 2
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                    : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5'
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={n} className="bg-white rounded-2xl p-4 border border-neutral-200 animate-pulse h-80 flex flex-col justify-between">
                    <div className="w-full h-44 bg-neutral-200 rounded-xl" />
                    <div className="space-y-2 mt-3">
                      <div className="h-3.5 bg-neutral-200 rounded w-3/4" />
                      <div className="h-3.5 bg-neutral-200 rounded w-1/2" />
                      <div className="h-8 bg-neutral-200 rounded-xl mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-sm max-w-lg mx-auto my-8">
                <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-1">No matching products found</h3>
                <p className="text-xs text-neutral-500 mb-6">
                  Try adjusting your filters, clearing your price range, or searching with broader keywords.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-[#FFD21F] font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Reset All Filters
                </button>
              </div>
            ) : (
              <>
                <div
                  className={
                    gridCols === 4
                      ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4'
                      : gridCols === 2
                      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                      : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5'
                  }
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} {...product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => updateFilters({ page: Math.max(1, pageParam - 1) })}
                      disabled={pageParam <= 1}
                      className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => updateFilters({ page: p })}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                          pageParam === p
                            ? 'bg-neutral-950 text-[#FFD21F]'
                            : 'border border-neutral-300 text-neutral-800 hover:bg-neutral-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => updateFilters({ page: Math.min(totalPages, pageParam + 1) })}
                      disabled={pageParam >= totalPages}
                      className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileFilterOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-2xl z-50 flex flex-col justify-between p-5 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-neutral-900" />
                  <h3 className="font-bold text-base text-neutral-950">Filters & Refinements</h3>
                </div>
                <button onClick={() => setIsMobileFilterOpen(false)}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Categories */}
              <div className="py-4 border-b border-neutral-100">
                <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">Category</h4>
                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => { updateFilters({ category: null }); setIsMobileFilterOpen(false); }}
                    className={`block w-full text-left py-1.5 px-2 rounded-lg ${categoryParam === 'all' ? 'bg-neutral-900 text-[#FFD21F] font-bold' : 'text-neutral-700'}`}
                  >
                    All Categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { updateFilters({ category: c.slug }); setIsMobileFilterOpen(false); }}
                      className={`block w-full text-left py-1.5 px-2 rounded-lg ${categoryParam === c.slug ? 'bg-neutral-900 text-[#FFD21F] font-bold' : 'text-neutral-700'}`}
                    >
                      {c.name} ({c.productCount})
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="py-4 border-b border-neutral-100">
                <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">Price Range</h4>
                <form
                  onSubmit={(e) => {
                    handlePriceApply(e);
                    setIsMobileFilterOpen(false);
                  }}
                  className="space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="p-1.5 text-xs border rounded border-neutral-300"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="p-1.5 text-xs border rounded border-neutral-300"
                    />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-neutral-900 text-white text-xs font-bold rounded">
                    Apply
                  </button>
                </form>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <button
                onClick={() => { clearAllFilters(); setIsMobileFilterOpen(false); }}
                className="w-full py-2 text-xs font-bold text-red-600 border border-red-200 rounded-xl"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 p-12 text-center text-sm font-bold">Loading marketplace catalog...</div>}>
      <ProductsCatalogContent />
    </Suspense>
  );
}
