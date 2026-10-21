'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
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

  // Subtle image parallax: the photo drifts a few pixels toward the pointer.
  // Written to CSS variables (no React state), so it costs nothing per move.
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    imageRef.current.style.setProperty('--px', `${(x * -8).toFixed(2)}px`);
    imageRef.current.style.setProperty('--py', `${(y * -8).toFixed(2)}px`);
  };
  const handlePointerLeave = () => {
    imageRef.current?.style.setProperty('--px', '0px');
    imageRef.current?.style.setProperty('--py', '0px');
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
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="group relative flex flex-col h-full rounded-[1.375rem] bg-white dark:bg-[#0e1a14] border border-neutral-900/[0.05] dark:border-white/[0.08] shadow-soft hover:border-brand-600/30 dark:hover:border-brand-400/40 hover:shadow-lift hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-300 ease-out overflow-hidden"
    >
      {/* Media */}
      <div ref={imageRef} className="relative aspect-[4/4.1] w-[calc(100%-1rem)] mx-2 mt-2 rounded-[1rem] bg-neutral-100 dark:bg-neutral-900 overflow-hidden shrink-0">
        <Link href={`/products/${slug}`} className="block w-full h-full" aria-label={name}>
          <Image
            src={validImage}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover scale-[1.02] group-hover:scale-[1.07] transition-transform duration-700 ease-out will-change-transform [translate:var(--px,0px)_var(--py,0px)]"
            referrerPolicy="no-referrer"
          />
                  </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 z-10 pointer-events-none">
          {discountPercent > 0 && (
            <span className="rounded-full bg-brand-700 text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-1">
              −{discountPercent}%
            </span>
          )}
          {isDeal && (
            <span className="inline-flex items-center gap-1 rounded-full glass text-neutral-900 dark:text-white text-[10px] font-semibold px-2 py-1">
              <Zap className="w-3 h-3 text-brand-700 dark:text-brand-300" weight="fill" /> Deal
            </span>
          )}
        </div>

        {/* Wishlist */}
        <motion.button
          onClick={handleWishlistToggle}
          whileTap={{ scale: 0.82 }}
          className={`absolute top-2.5 right-2.5 z-10 grid place-items-center w-8 h-8 rounded-full bg-white/90 dark:bg-neutral-900/80 shadow-sm transition-colors ${
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
            <Heart className="w-[17px] h-[17px]" weight={isFav ? 'fill' : 'regular'} />
          </motion.span>
        </motion.button>

        {/* Quick view */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickViewOpen(true);
          }}
          className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-1.5 h-9 rounded-full glass text-neutral-900 dark:text-white text-xs font-semibold opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 transition-[opacity,transform] duration-300 ease-out max-sm:hidden cursor-pointer hover:bg-white dark:hover:bg-neutral-800"
        >
          <Eye className="w-3.5 h-3.5" /> Quick view
        </button>

        {!inStock && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-[2px] grid place-items-center z-10">
            <span className="rounded-full bg-neutral-950 text-white text-xs font-semibold px-3.5 py-1.5">
              Sold out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 pt-3 pb-3.5 sm:px-4 sm:pb-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
          <span className="font-medium text-brand-700 dark:text-brand-300 truncate">{brand}</span>
          {categoryName && <span className="text-neutral-400 truncate shrink-0 max-w-[45%] hidden sm:block">{categoryName}</span>}
        </div>

        <Link
          href={`/products/${slug}`}
          className="block text-[13px] sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-700 dark:hover:text-brand-300 line-clamp-2 leading-snug transition-colors min-h-[2.25rem] sm:min-h-[2.5rem]"
        >
          {name}
        </Link>

        <div className="mt-auto pt-2.5">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-x-2 flex-wrap">
                <span className="text-base sm:text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white tabular-nums">
                  {formatINR(discountPrice)}
                </span>
                {basePrice > discountPrice && (
                  <span className="text-[11px] text-neutral-400 line-through tabular-nums">{formatINR(basePrice)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 tabular-nums">
                  {rating > 0 ? rating.toFixed(1) : '4.5'}
                </span>
                <span className="text-[11px] text-neutral-400">({reviewCount > 0 ? reviewCount : '128'})</span>
              </div>
            </div>

            <button
              onClick={handleQuickAdd}
              disabled={!inStock || isLoading}
              aria-label={inStock ? `Add ${name} to cart` : 'Out of stock'}
              title={inStock ? 'Add to cart' : 'Out of stock'}
              className={`shrink-0 grid place-items-center size-10 rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 cursor-pointer shadow-glow ${
                justAdded
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-800 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-neutral-950 dark:hover:bg-brand-400'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {justAdded ? (
                  <motion.span key="added" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="grid place-items-center">
                    <Check className="w-[18px] h-[18px]" weight="bold" />
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="grid place-items-center">
                    <ShoppingBag className="w-[18px] h-[18px]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {deliveryInfo && (
            <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
              <Truck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
              <span className="truncate">
                Arrives <span className="font-medium text-neutral-700 dark:text-neutral-300">{deliveryInfo.dateString}</span>
              </span>
            </p>
          )}
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
