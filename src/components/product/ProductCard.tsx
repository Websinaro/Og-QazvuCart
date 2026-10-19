'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { Heart, Star, ShoppingBag, Truck, Eye, Check, Zap } from '@/src/components/ui/icons';
import { formatINR } from '@/src/lib/date';
import { flyToCart } from '@/src/lib/flyToCart';
import { QuickViewModal } from '@/src/components/product/QuickViewModal';

export interface ProductCardProps {
  id: number;
  name: string;
  slug: string;
  brand: string;
  categoryName?: string;
  basePrice: number;
  discountPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  primaryImage: string;
  inStock: boolean;
  stock?: number;
  deliveryInfo?: {
    dateString: string;
    formattedDate: string;
  };
  isDeal?: boolean;
}

export function ProductCard({
  id,
  name,
  slug,
  brand,
  categoryName,
  basePrice,
  discountPrice,
  discountPercent,
  rating,
  reviewCount,
  primaryImage,
  inStock,
  deliveryInfo,
  isDeal,
}: ProductCardProps) {
  const { addToCart, isLoading } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { success, error } = useToast();
  const imageRef = useRef<HTMLDivElement>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const isFav = isInWishlist(id);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const added = await toggleWishlist(id);
      success(added ? 'Saved to Wishlist' : 'Removed from Wishlist');
    } catch {
      error('Please sign in to save wishlist items');
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    try {
      await addToCart(id, null, 1);
      if (imageRef.current) flyToCart(imageRef.current, validImage);
      success(`Added ${name} to cart`);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Please sign in to add to cart');
    }
  };

  const validImage =
    typeof primaryImage === 'string' && primaryImage.trim()
      ? primaryImage.trim()
      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80';

  return (
    <div className="group relative flex flex-col h-full rounded-[1.375rem] bg-white dark:bg-[#13131a] border border-neutral-900/[0.06] dark:border-white/[0.08] shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      {/* Media */}
      <div ref={imageRef} className="relative aspect-[4/4.2] w-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden shrink-0 m-0">
        <Link href={`/products/${slug}`} className="block w-full h-full" aria-label={name}>
          <Image
            src={validImage}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10 pointer-events-none">
          {discountPercent > 0 && (
            <span className="rounded-full bg-rose-600 text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 shadow-sm">
              −{discountPercent}%
            </span>
          )}
          {isDeal && (
            <span className="inline-flex items-center gap-1 rounded-full glass text-neutral-900 dark:text-white text-[10px] font-semibold px-2.5 py-1 shadow-sm">
              <Zap className="w-3 h-3 text-brand-600 dark:text-brand-300" weight="fill" /> Deal
            </span>
          )}
        </div>

        {/* Wishlist */}
        <motion.button
          onClick={handleWishlistToggle}
          whileTap={{ scale: 0.82 }}
          className={`absolute top-3 right-3 z-10 grid place-items-center w-9 h-9 rounded-full glass shadow-sm transition-colors ${
            isFav ? 'text-rose-600' : 'text-neutral-700 dark:text-neutral-200 hover:text-rose-600'
          }`}
          aria-label={isFav ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={isFav}
        >
          <motion.span
            key={isFav ? 'fav' : 'not-fav'}
            initial={{ scale: 0.5, rotate: isFav ? -20 : 0 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
            className="block"
          >
            <Heart className="w-[18px] h-[18px]" weight={isFav ? 'fill' : 'regular'} />
          </motion.span>
        </motion.button>

        {/* Quick view */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickViewOpen(true);
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 h-8 px-3.5 rounded-full glass text-neutral-900 dark:text-white text-[11px] font-semibold shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 max-sm:hidden cursor-pointer hover:bg-white dark:hover:bg-neutral-800"
        >
          <Eye className="w-3.5 h-3.5" /> Quick view
        </button>

        {!inStock && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-[2px] grid place-items-center z-10">
            <span className="rounded-full bg-neutral-950 text-white text-[11px] font-semibold px-3 py-1.5 tracking-wide">
              Sold out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] mb-1.5">
          <span className="font-semibold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300 truncate">{brand}</span>
          {categoryName && <span className="text-neutral-400 truncate shrink-0 max-w-[45%]">{categoryName}</span>}
        </div>

        <Link
          href={`/products/${slug}`}
          className="block text-[13px] sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-700 dark:hover:text-brand-300 line-clamp-2 leading-snug transition-colors min-h-[2.25rem] sm:min-h-[2.5rem]"
        >
          {name}
        </Link>

        <div className="flex items-center gap-1.5 mt-2">
          <Star className="w-3.5 h-3.5 text-amber-400" weight="fill" />
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
            {rating > 0 ? rating.toFixed(1) : '4.5'}
          </span>
          <span className="text-[11px] text-neutral-400">({reviewCount > 0 ? reviewCount : '128'})</span>
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[17px] sm:text-lg font-semibold tracking-tight text-neutral-950 dark:text-white tabular-nums">
              {formatINR(discountPrice)}
            </span>
            {basePrice > discountPrice && (
              <span className="text-xs text-neutral-400 line-through tabular-nums">{formatINR(basePrice)}</span>
            )}
          </div>

          {deliveryInfo && (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                Arrives <span className="font-medium text-neutral-700 dark:text-neutral-300">{deliveryInfo.dateString}</span>
              </span>
            </p>
          )}

          <button
            onClick={handleQuickAdd}
            disabled={!inStock || isLoading}
            className={`mt-3 w-full h-10 px-3 text-[13px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer ${
              justAdded
                ? 'bg-emerald-500 text-white'
                : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-brand-600 dark:hover:bg-brand-200 hover:shadow-glow'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {justAdded ? (
                <motion.span
                  key="added"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" weight="bold" /> Added
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {inStock ? 'Add to cart' : 'Out of stock'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {isQuickViewOpen && (
        <QuickViewModal key={slug} slug={slug} onClose={() => setIsQuickViewOpen(false)} />
      )}
    </div>
  );
}
