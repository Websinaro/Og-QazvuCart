'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useToast } from '@/src/context/ToastContext';
import {
  Trash2,
  Heart,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
} from '@/src/components/ui/icons';
import { formatINR } from '@/src/lib/date';

export default function CartPage() {
  const router = useRouter();
  const { cart, updateQuantity, removeItem, clearCart, isLoading } = useCart();
  const { toggleWishlist } = useWishlist();
  const { success, error } = useToast();

  const handleQtyChange = async (itemId: number, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      await removeItem(itemId);
      success('Item removed from cart');
    } else {
      try {
        await updateQuantity(itemId, newQty);
      } catch (err: unknown) {
        const errObj = err as Error;
        error(errObj.message || 'Could not update quantity');
      }
    }
  };

  const handleMoveToWishlist = async (productId: number, itemId: number) => {
    try {
      await toggleWishlist(productId);
      await removeItem(itemId);
      success('Item saved to your Wishlist');
    } catch {
      error('Failed to move to wishlist');
    }
  };

  const handleClear = async () => {
    try {
      await clearCart();
      success('Cart cleared');
    } catch {
      error('Could not clear cart');
    }
  };

  const progressPercent = Math.min(100, Math.round((cart.subtotal / cart.freeDeliveryThreshold) * 100));

  if (cart.items.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 pb-24">
        <div className="surface rounded-[2rem] p-10 sm:p-14 text-center max-w-md w-full">
          <div className="grid place-items-center w-24 h-24 rounded-[2rem] bg-brand-500/10 text-brand-700 dark:text-brand-300 mx-auto mb-6">
            <ShoppingBag className="w-11 h-11" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Your cart is empty</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed mt-2">
            Looks like you haven&apos;t added anything yet. Explore the latest deals and top-rated picks.
          </p>
          <Link
            href="/products"
            className="group mt-8 inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-brand-800 dark:bg-brand-500 text-white dark:text-neutral-950 text-sm font-semibold hover:bg-brand-700 dark:hover:bg-brand-400 transition-colors hover:text-white dark:hover:text-neutral-950 shadow-glow"
          >
            Explore marketplace
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-[-0.03em] text-neutral-950 dark:text-white">Shopping cart</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5">
              {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} in your basket
            </p>
          </div>
          <button
            onClick={handleClear}
            className="h-9 px-4 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            Clear cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Items */}
          <div className="lg:col-span-8 space-y-4">
            <div className="surface p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 shrink-0">
                    <Truck className="w-4 h-4" />
                  </span>
                  {cart.freeDeliveryRemaining > 0 ? (
                    <span>
                      Add <strong className="font-semibold">{formatINR(cart.freeDeliveryRemaining)}</strong> more to unlock{' '}
                      <strong className="font-semibold">free delivery</strong>
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      🎉 You&apos;ve unlocked free express delivery
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-500 tabular-nums shrink-0">{progressPercent}%</span>
              </div>
              <div className="w-full bg-neutral-900/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    cart.freeDeliveryRemaining > 0 ? 'bg-brand-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="surface rounded-[1.25rem] shadow-soft p-3.5 sm:p-5 flex gap-3.5 sm:gap-6">
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-neutral-100 dark:bg-neutral-900 shrink-0 overflow-hidden">
                    <Image
                      src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                      alt={item.productName}
                      fill
                      sizes="128px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-[0.12em]">
                            {item.brand}
                          </span>
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="block text-sm sm:text-[15px] font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-700 dark:hover:text-brand-300 transition-colors line-clamp-2 mt-0.5"
                          >
                            {item.productName}
                          </Link>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <span className="text-base sm:text-lg font-semibold text-neutral-950 dark:text-white">{formatINR(item.itemTotal)}</span>
                          {item.basePrice > item.unitPrice && (
                            <p className="text-xs text-neutral-400 line-through">{formatINR(item.basePrice * item.quantity)}</p>
                          )}
                        </div>
                      </div>

                      {item.variantName && (
                        <p className="text-xs text-neutral-500 mt-1.5">
                          Option: <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.variantName}</span>
                        </p>
                      )}

                      <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-2">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Arrives <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.deliveryInfo.dateString}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex items-center rounded-full bg-brand-50 dark:bg-white/10 ring-1 ring-brand-700/15 dark:ring-white/10 overflow-hidden">
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                            disabled={isLoading}
                            aria-label="Decrease quantity"
                            className="grid place-items-center w-9 h-9 hover:bg-neutral-900/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" weight="bold" />
                          </button>
                          <span className="text-sm font-semibold text-neutral-950 dark:text-white min-w-8 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                            disabled={isLoading || item.quantity >= item.stockAvailable}
                            aria-label="Increase quantity"
                            className="grid place-items-center w-9 h-9 hover:bg-neutral-900/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" weight="bold" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleMoveToWishlist(item.productId, item.id)}
                          className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Heart className="w-4 h-4" /> <span className="hidden sm:inline">Save for later</span>
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer rounded-full bg-rose-500/10 px-3 h-8"
                      >
                        <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Remove</span><span className="sm:hidden sr-only">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-[170px]">
            <div className="surface rounded-[1.5rem] shadow-soft p-5 sm:p-6 space-y-5">
              <h3 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white">Order summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Price ({cart.totalItems} items)</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {formatINR(cart.totalOriginalPrice || cart.subtotal)}
                  </span>
                </div>

                {cart.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount</span>
                    <span className="tabular-nums">− {formatINR(cart.totalDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Delivery</span>
                  <span className="tabular-nums">
                    {cart.deliveryFee === 0 ? (
                      <strong className="font-semibold text-emerald-600 dark:text-emerald-400">Free</strong>
                    ) : (
                      formatINR(cart.deliveryFee)
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-4 border-t border-dashed border-neutral-900/10 dark:border-white/15">
                  <span className="font-semibold text-neutral-950 dark:text-white">Total</span>
                  <span className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white tabular-nums">
                    {formatINR(cart.grandTotal)}
                  </span>
                </div>
              </div>

              {cart.totalDiscount > 0 && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium text-center">
                  You&apos;re saving {formatINR(cart.totalDiscount)} on this order
                </div>
              )}

              <button
                onClick={() => router.push('/checkout')}
                className="group w-full h-12 px-6 rounded-full bg-brand-800 hover:bg-brand-700 text-white font-semibold text-sm shadow-glow active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Safe &amp; secure payments · 100% authentic
              </div>
            </div>

            <div className="relative isolate overflow-hidden rounded-[1.5rem] bg-brand-900 text-white p-5 space-y-4 text-xs">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-600/30 blur-3xl -z-10" />
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/10 text-brand-200 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-semibold text-white text-[13px]">QazvuCart buyer shield</h4>
                  <p className="text-[11px] text-neutral-400">Zero-fee cancellation before shipment</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/10 text-brand-200 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-semibold text-white text-[13px]">7-day replacement</h4>
                  <p className="text-[11px] text-neutral-400">Instant replacement if defective</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
