'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { Heart, Star, ShoppingBag, Truck, Eye, Check } from 'lucide-react';
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
    <div className="group relative bg-white rounded-2xl border border-neutral-200/80 hover:border-neutral-900 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden h-full">
      {/* Top Media & Badges */}
      <div ref={imageRef} className="relative aspect-square w-full bg-neutral-50 overflow-hidden shrink-0">
        <Link href={`/products/${slug}`} className="block w-full h-full">
          <Image
            src={validImage}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10 pointer-events-none">
          {discountPercent > 0 && (
            <span className="bg-[#E50914] text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wide">
              {discountPercent}% OFF
            </span>
          )}
          {isDeal && (
            <span className="bg-neutral-950 text-[#FFD21F] text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm uppercase">
              ⚡ Deal
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <motion.button
          onClick={handleWishlistToggle}
          whileTap={{ scale: 0.8 }}
          className={`absolute top-2.5 right-2.5 z-10 p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-colors shadow-sm ${
            isFav
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-white/80 hover:bg-white text-neutral-600 hover:text-red-600 border border-neutral-200/60'
          }`}
          aria-label="Add to Wishlist"
        >
          <motion.span
            key={isFav ? 'fav' : 'not-fav'}
            initial={{ scale: 0.5, rotate: isFav ? -20 : 0 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
            className="block"
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFav ? 'fill-red-600' : ''}`} />
          </motion.span>
        </motion.button>

        {/* Quick View — appears on hover (desktop) / always tappable (touch) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickViewOpen(true);
          }}
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950/90 text-white text-[10px] sm:text-[11px] font-bold rounded-full shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 sm:transition-all sm:duration-300 max-sm:opacity-100 max-sm:translate-y-0 cursor-pointer"
        >
          <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Quick View
        </button>

        {/* Out of Stock Overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="bg-neutral-900 text-white font-bold text-[10px] sm:text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Category */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-neutral-500 mb-1">
            <span className="uppercase tracking-wider font-bold text-neutral-700 truncate mr-1">{brand}</span>
            {categoryName && <span className="truncate shrink-0">{categoryName}</span>}
          </div>

          {/* Title */}
          <Link
            href={`/products/${slug}`}
            className="block text-xs sm:text-sm font-bold text-neutral-900 hover:text-neutral-700 line-clamp-2 leading-snug transition-colors mb-2 min-h-[2rem] sm:min-h-[2.5rem]"
          >
            {name}
          </Link>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-2.5 sm:mb-3">
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold">
              <span>{rating > 0 ? rating.toFixed(1) : '4.5'}</span>
              <Star className="w-3 h-3 fill-emerald-700 text-emerald-700" />
            </div>
            <span className="text-[10px] sm:text-[11px] text-neutral-400 font-medium">
              ({reviewCount > 0 ? reviewCount : '128'})
            </span>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-2 border-t border-neutral-100/80">
          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <span className="text-base sm:text-lg font-black text-neutral-950">{formatINR(discountPrice)}</span>
            {basePrice > discountPrice && (
              <span className="text-[11px] sm:text-xs text-neutral-400 line-through font-medium">
                {formatINR(basePrice)}
              </span>
            )}
          </div>

          {/* Delivery Note */}
          {deliveryInfo && (
            <p className="text-[10px] sm:text-[11px] text-neutral-500 flex items-center gap-1 mb-2.5 sm:mb-3 truncate">
              <Truck className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="truncate">
                Delivery by <strong>{deliveryInfo.dateString}</strong>
              </span>
            </p>
          )}

          {/* Action Button */}
          <button
            onClick={handleQuickAdd}
            disabled={!inStock || isLoading}
            className={`w-full py-2 sm:py-2.5 px-3 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed group/btn cursor-pointer ${
              justAdded ? 'bg-emerald-500 text-white' : 'bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950'
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
                  <Check className="w-3.5 h-3.5" />
                  Added ✓
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {inStock ? 'Add to Cart' : 'Out of Stock'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {isQuickViewOpen && (
        <QuickViewModal slug={slug} onClose={() => setIsQuickViewOpen(false)} />
      )}
    </div>
  );
}
