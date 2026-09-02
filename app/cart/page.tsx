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
} from 'lucide-react';
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 pb-24">
        <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-neutral-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-neutral-950">Your Cart is Empty</h2>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            Looks like you haven&apos;t added any items to your cart yet. Explore our latest deals and top rated electronics!
          </p>
          <div className="pt-2">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-black text-xs rounded-xl shadow-md transition-all"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-neutral-950 tracking-tight">Shopping Cart</h1>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} in your basket
              </p>
            </div>
            <button
              onClick={handleClear}
              className="text-xs font-bold text-red-600 hover:text-red-700 underline"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Items List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Free Delivery Banner */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  {cart.freeDeliveryRemaining > 0 ? (
                    <span>
                      Add <strong>{formatINR(cart.freeDeliveryRemaining)}</strong> more to unlock <strong>FREE Delivery</strong>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">🎉 Congratulations! You have unlocked FREE Express Delivery</span>
                  )}
                </span>
                <span className="text-[11px] text-neutral-500">{progressPercent}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#FFD21F] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Cart Items */}
            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm divide-y divide-neutral-100 overflow-hidden">
              {cart.items.map((item) => (
                <div key={item.id} className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
                  {/* Thumbnail */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-neutral-50 rounded-2xl border border-neutral-200 shrink-0 overflow-hidden">
                    <Image
                      src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                      alt={item.productName}
                      fill
                      sizes="112px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Item Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider">
                            {item.brand}
                          </span>
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="block text-sm font-bold text-neutral-900 hover:text-amber-600 transition-colors line-clamp-2"
                          >
                            {item.productName}
                          </Link>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-neutral-950">{formatINR(item.itemTotal)}</span>
                          {item.basePrice > item.unitPrice && (
                            <p className="text-xs text-neutral-400 line-through">
                              {formatINR(item.basePrice * item.quantity)}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.variantName && (
                        <p className="text-xs text-neutral-600 font-medium mt-1">
                          Option: <strong className="text-neutral-900">{item.variantName}</strong>
                        </p>
                      )}

                      <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        Delivery by <strong className="text-neutral-800">{item.deliveryInfo.dateString}</strong>
                      </p>
                    </div>

                    {/* Quantity Stepper & Actions */}
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-neutral-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-neutral-300 rounded-xl bg-white shadow-xs overflow-hidden">
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                            disabled={isLoading}
                            className="p-2 hover:bg-neutral-100 text-neutral-700 transition-colors disabled:opacity-40"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3.5 text-xs font-bold text-neutral-950 min-w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                            disabled={isLoading || item.quantity >= item.stockAvailable}
                            className="p-2 hover:bg-neutral-100 text-neutral-700 transition-colors disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleMoveToWishlist(item.productId, item.id)}
                          className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 flex items-center gap-1 transition-colors"
                        >
                          <Heart className="w-3.5 h-3.5" /> Save for later
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Order Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-neutral-950 uppercase tracking-wider pb-3 border-b border-neutral-100">
                Price Details
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Price ({cart.totalItems} items)</span>
                  <span className="font-semibold text-neutral-900">{formatINR(cart.totalOriginalPrice || cart.subtotal)}</span>
                </div>

                {cart.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>- {formatINR(cart.totalDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-neutral-600">
                  <span>Delivery Charges</span>
                  <span>
                    {cart.deliveryFee === 0 ? (
                      <strong className="text-emerald-700 font-bold">FREE</strong>
                    ) : (
                      formatINR(cart.deliveryFee)
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-base font-black text-neutral-950 pt-3 border-t border-neutral-200">
                  <span>Total Amount</span>
                  <span className="text-lg text-neutral-950">{formatINR(cart.grandTotal)}</span>
                </div>
              </div>

              {cart.totalDiscount > 0 && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 text-center">
                  You will save {formatINR(cart.totalDiscount)} on this order!
                </div>
              )}

              <button
                onClick={() => router.push('/checkout')}
                className="w-full py-4 px-6 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Safe and Secure Payments • 100% Authentic</span>
              </div>
            </div>

            {/* Trust highlights */}
            <div className="bg-neutral-950 text-white rounded-2xl p-5 border border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#FFD21F] shrink-0" />
                <div>
                  <h4 className="font-bold text-white">QazvuCart Buyer Shield</h4>
                  <p className="text-[11px] text-neutral-400">Zero fee cancellation before shipment</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-neutral-800">
                <RotateCcw className="w-5 h-5 text-[#FFD21F] shrink-0" />
                <div>
                  <h4 className="font-bold text-white">7-Day Replacement</h4>
                  <p className="text-[11px] text-neutral-400">Instant replacement if defective</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
