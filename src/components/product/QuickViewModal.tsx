'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Heart, ShoppingBag, Truck, Minus, Plus, ExternalLink } from 'lucide-react';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import { formatINR } from '@/src/lib/date';
import { flyToCart } from '@/src/lib/flyToCart';

interface QuickViewProduct {
  id: number;
  name: string;
  slug: string;
  brand: string;
  description: string;
  basePrice: number;
  discountPrice: number;
  stock: number;
  rating: string | number;
  reviewCount: number;
  categoryName?: string;
  images: { id: number; imageUrl: string; isPrimary: boolean }[];
}

export function QuickViewModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const { addToCart, isLoading: isCartLoading } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { success, error } = useToast();
  const imgRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setProduct(json.data);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const isFav = product ? isInWishlist(product.id) : false;

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await addToCart(product.id, null, qty);
      if (imgRef.current) {
        flyToCart(imgRef.current, product.images[activeImage]?.imageUrl || product.images[0]?.imageUrl);
      }
      success(`Added ${qty > 1 ? `${qty}x ` : ''}${product.name} to cart`);
      onClose();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Please sign in to add to cart');
    }
  };

  const handleWishlist = async () => {
    if (!product) return;
    try {
      const added = await toggleWishlist(product.id);
      success(added ? 'Saved to Wishlist' : 'Removed from Wishlist');
    } catch {
      error('Please sign in to save wishlist items');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Quick product preview"
          className="relative bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        >
          <button
            onClick={onClose}
            aria-label="Close quick view"
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-md text-neutral-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {status === 'loading' && (
            <div className="p-10 flex items-center justify-center min-h-[320px]">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <div className="p-10 text-center min-h-[320px] flex flex-col items-center justify-center">
              <p className="text-sm font-bold text-neutral-700">Couldn&apos;t load this product.</p>
              <Link href={`/products/${slug}`} className="mt-3 text-xs font-bold text-neutral-900 underline">
                Open full product page
              </Link>
            </div>
          )}

          {status === 'ready' && product && (
            <div className="grid grid-cols-1 sm:grid-cols-2 overflow-y-auto">
              {/* Image */}
              <div className="relative bg-neutral-50">
                <div ref={imgRef} className="relative aspect-square w-full">
                  {product.images.length > 0 ? (
                    <Image
                      src={product.images[activeImage]?.imageUrl || product.images[0].imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
                      No image
                    </div>
                  )}
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {product.images.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImage(i)}
                        className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer ${
                          i === activeImage ? 'border-neutral-900' : 'border-transparent'
                        }`}
                      >
                        <Image src={img.imageUrl} alt="" fill className="object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-5 sm:p-6 flex flex-col">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{product.brand}</span>
                <h2 className="text-lg font-black text-neutral-950 leading-snug mt-0.5 mb-2">{product.name}</h2>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[11px] font-extrabold">
                    <span>{Number(product.rating) > 0 ? Number(product.rating).toFixed(1) : 'New'}</span>
                    <Star className="w-3 h-3 fill-emerald-700 text-emerald-700" />
                  </div>
                  <span className="text-[11px] text-neutral-400 font-medium">({product.reviewCount} reviews)</span>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-black text-neutral-950">{formatINR(product.discountPrice)}</span>
                  {product.basePrice > product.discountPrice && (
                    <span className="text-sm text-neutral-400 line-through font-medium">
                      {formatINR(product.basePrice)}
                    </span>
                  )}
                </div>
                {product.basePrice > product.discountPrice && (
                  <p className="text-xs font-bold text-emerald-700 mb-3">
                    You save {formatINR(product.basePrice - product.discountPrice)}
                  </p>
                )}

                <p className="text-xs text-neutral-600 line-clamp-3 mb-4">{product.description}</p>

                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mb-4">
                  <Truck className="w-3.5 h-3.5" />
                  {product.stock > 0 ? (
                    <span>
                      In stock — <strong className="text-neutral-700">{product.stock} left</strong>
                    </span>
                  ) : (
                    <span className="text-red-600 font-bold">Out of stock</span>
                  )}
                </div>

                {/* Qty */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-neutral-700">Qty</span>
                  <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="p-2 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-sm font-bold min-w-[2rem] text-center">{qty}</span>
                    <button
                      onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))}
                      className="p-2 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={product.stock <= 0 || isCartLoading}
                    className="flex-1 py-3 px-4 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                  <motion.button
                    onClick={handleWishlist}
                    whileTap={{ scale: 0.85 }}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      isFav
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:border-red-300 hover:text-red-600'
                    }`}
                    aria-label="Toggle wishlist"
                  >
                    <motion.span
                      key={isFav ? 'fav' : 'not-fav'}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className="block"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-600' : ''}`} />
                    </motion.span>
                  </motion.button>
                </div>

                <Link
                  href={`/products/${product.slug}`}
                  onClick={onClose}
                  className="mt-3 text-center text-xs font-bold text-neutral-500 hover:text-neutral-900 flex items-center justify-center gap-1"
                >
                  View full details <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
