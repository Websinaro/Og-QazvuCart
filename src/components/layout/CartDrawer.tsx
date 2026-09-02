'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/src/context/CartContext';
import { useToast } from '@/src/context/ToastContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck, ShieldCheck } from 'lucide-react';
import { formatINR } from '@/src/lib/date';

export function CartDrawer() {
  const { cart, isCartDrawerOpen, closeCartDrawer, updateQuantity, removeItem, isLoading } = useCart();
  const { success, error } = useToast();

  // Lock background scroll while the drawer is open, same rationale as the
  // mobile nav drawer - avoids the page shifting behind the fixed overlay.
  useEffect(() => {
    if (isCartDrawerOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isCartDrawerOpen]);

  if (!isCartDrawerOpen) return null;

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

  const handleRemove = async (itemId: number) => {
    try {
      await removeItem(itemId);
      success('Item removed from cart');
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Could not remove item');
    }
  };

  const progressPercent = Math.min(100, Math.round((cart.subtotal / cart.freeDeliveryThreshold) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={closeCartDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-neutral-200">
          {/* Top Header */}
          <div className="p-5 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#FFD21F]" />
              <h2 className="text-lg font-bold">Shopping Cart ({cart.totalItems})</h2>
            </div>
            <button
              onClick={closeCartDrawer}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Milestone Bar */}
          {cart.items.length > 0 && (
            <div className="bg-amber-50/70 border-b border-amber-100 px-5 py-3 text-xs">
              <div className="flex items-center justify-between text-neutral-800 font-semibold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  {cart.freeDeliveryRemaining > 0 ? (
                    <span>
                      Add <strong>{formatINR(cart.freeDeliveryRemaining)}</strong> more for <strong>FREE Delivery</strong>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">🎉 You qualify for FREE Delivery!</span>
                  )}
                </span>
                <span className="text-[11px] text-neutral-500">{progressPercent}%</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#FFD21F] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-1">Your cart is empty</h3>
                <p className="text-xs text-neutral-500 max-w-xs mb-6">
                  Explore millions of high-quality electronics, apparel, and home essentials with verified seller guarantees.
                </p>
                <Link
                  href="/products"
                  onClick={closeCartDrawer}
                  className="px-6 py-2.5 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-xs rounded-xl shadow transition-colors"
                >
                  Start Shopping Deals
                </Link>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3.5 p-3.5 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-20 bg-white rounded-lg border border-neutral-200 shrink-0 overflow-hidden">
                    <Image
                      src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                      alt={item.productName}
                      fill
                      sizes="80px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeCartDrawer}
                          className="text-xs font-semibold text-neutral-900 line-clamp-2 hover:text-amber-700 transition-colors"
                        >
                          {item.productName}
                        </Link>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-neutral-400 hover:text-red-600 p-1 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {item.variantName && (
                        <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">
                          Option: <span className="text-neutral-700">{item.variantName}</span>
                        </p>
                      )}
                    </div>

                    {/* Price & Quantity stepper */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-neutral-100">
                      <div>
                        <span className="text-sm font-bold text-neutral-900">{formatINR(item.unitPrice)}</span>
                        {item.basePrice > item.unitPrice && (
                          <span className="text-[11px] text-neutral-400 line-through ml-1.5">
                            {formatINR(item.basePrice)}
                          </span>
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border border-neutral-300 rounded-lg bg-white overflow-hidden shadow-xs">
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                          disabled={isLoading}
                          className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-neutral-900 min-w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                          disabled={isLoading || item.quantity >= item.stockAvailable}
                          className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary & Checkout CTA */}
          {cart.items.length > 0 && (
            <div className="p-5 border-t border-neutral-200 bg-neutral-50/80 space-y-3.5">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal ({cart.totalItems} items)</span>
                  <span className="font-semibold text-neutral-900">{formatINR(cart.subtotal)}</span>
                </div>
                {cart.totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount Savings</span>
                    <span>- {formatINR(cart.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Estimated Delivery</span>
                  <span>{cart.deliveryFee === 0 ? <strong className="text-emerald-700">FREE</strong> : formatINR(cart.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Total Payable</span>
                  <span className="text-base font-extrabold text-neutral-950">{formatINR(cart.grandTotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  href="/checkout"
                  onClick={closeCartDrawer}
                  className="w-full py-3.5 px-4 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group text-center"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secure 256-Bit SSL Encrypted Checkout</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
