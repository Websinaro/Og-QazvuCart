'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from '@/src/components/ui/SafeImage';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { Heart, Star, ShoppingBag, Truck, Eye, Check, Zap } from '@/src/components/ui/icons';
import { formatINR } from '@/src/lib/date';
import { flyToCart } from '@/src/lib/flyToCart';
import { CompareToggle } from '@/src/components/product/CompareToggle';
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

  // Clear the "Added" confirmation timer if the card unmounts mid-flight.
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  // Feeds the pointer-follow yellow spotlight (see .card-spotlight in globals.css).
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

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
      if (imageRef.current && validImage) flyToCart(imageRef.current, validImage);
      success(`Added ${name} to cart`);
      setJustAdded(true);
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setJustAdded(false), 1600);
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Please sign in to add to cart');
    }
  };

  // Empty/missing images fall through to SafeImage's neutral placeholder.
  const validImage = typeof primaryImage === 'string' ? primaryImage.trim() : '';

  return (
    <div
      onPointerMove={handlePointerMove}
      className="group card-spotlight relative flex flex-col h-full rounded-[1.375rem] bg-white dark:bg-[#17140b] border border-brand-700/10 dark:border-white/[0.08] shadow-soft hover:shadow-lift hover:border-brand-400/70 dark:hover:border-brand-400/40 hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-300 ease-out overflow-hidden"
    >
      {/* Media */}
      <div ref={imageRef} className="shine-sweep relative aspect-[4/4.2] w-full bg-brand-50 dark:bg-neutral-900 overflow-hidden shrink-0 m-0">
        <Link href={`/products/${slug}`} className="block w-full h-full" aria-label={name}>
          <Image
            src={validImage}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-[1.08] group-hover:rotate-[0.4deg] transition-transform duration-700 ease-out"
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
              <Zap className="w-3 h-3 text-brand-700 dark:text-brand-300" weight="fill" /> Deal
            </span>
          )}
        </div>

        {/* Wishlist */}
        <motion.button
          onClick={handleWishlistToggle}
          whileTap={{ scale: 0.82 }}
          className={`absolute top-2.5 right-2.5 z-10 grid place-items-center w-11 h-11 sm:w-10 sm:h-10 rounded-full glass shadow-sm transition-colors ${
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
            <Heart className="w-5 h-5" aria-hidden="true" weight={isFav ? 'fill' : 'regular'} />
          </motion.span>
        </motion.button>
        <CompareToggle id={id} />

        {/* Quick view */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickViewOpen(true);
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 h-8 px-3.5 rounded-full glass text-neutral-900 dark:text-white text-[11px] font-semibold shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 transition-all duration-300 max-sm:hidden cursor-pointer hover:bg-white dark:hover:bg-neutral-800"
          aria-label={`Quick view ${name}`}
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
          {categoryName && <span className="text-neutral-500 dark:text-neutral-400 truncate shrink-0 max-w-[45%]">{categoryName}</span>}
        </div>

        <Link
          href={`/products/${slug}`}
          className="block text-[13px] sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-700 dark:hover:text-brand-300 line-clamp-2 leading-snug transition-colors min-h-[2.25rem] sm:min-h-[2.5rem]"
        >
          {name}
        </Link>

        {reviewCount > 0 && rating > 0 ? (
          <div className="flex items-center gap-1.5 mt-2" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
            <Star className="w-3.5 h-3.5 text-amber-400" weight="fill" aria-hidden="true" />
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{rating.toFixed(1)}</span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">({reviewCount.toLocaleString('en-IN')})</span>
          </div>
        ) : (
          <p className="mt-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">No reviews yet</p>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[17px] sm:text-lg font-semibold tracking-tight text-neutral-950 dark:text-white tabular-nums">
              {formatINR(discountPrice)}
            </span>
            {basePrice > discountPrice && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 line-through tabular-nums">{formatINR(basePrice)}</span>
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
                : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-brand-600 dark:hover:bg-brand-200 hover:shadow-glow hover:text-neutral-950'
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

      {isQuickViewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <QuickViewModal key={slug} slug={slug} onClose={() => setIsQuickViewOpen(false)} />,
          document.body
        )}
    </div>
  );
}
