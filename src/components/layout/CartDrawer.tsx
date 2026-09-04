'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
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

  // Celebrate the moment the person crosses the free-delivery threshold —
  // all hooks below must run on every render (rules of hooks), so the
  // "closed" early-return happens only in the JSX further down, not here.
  const prevRemainingRef = useRef<number | null>(null);
  const [justUnlockedFreeDelivery, setJustUnlockedFreeDelivery] = useState(false);

  useEffect(() => {
    if (
      prevRemainingRef.current !== null &&
      prevRemainingRef.current > 0 &&
      cart.freeDeliveryRemaining <= 0 &&
      cart.items.length > 0
    ) {
      setJustUnlockedFreeDelivery(true);
      const t = setTimeout(() => setJustUnlockedFreeDelivery(false), 2200);
      return () => clearTimeout(t);
    }
    prevRemainingRef.current = cart.freeDeliveryRemaining;
  }, [cart.freeDeliveryRemaining, cart.items.length]);

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
    <AnimatePresence>
      {isCartDrawerOpen && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={closeCartDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-neutral-200"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* Top Header */}
              <div className="p-5 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-[#FFD21F]" />
                  <h2 className="text-lg font-bold">Shopping Cart ({cart.totalItems})</h2>
                </div>
                <button
                  onClick={closeCartDrawer}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free Shipping Milestone Bar */}
              {cart.items.length > 0 && (
                <div
                  className={`border-b px-5 py-3 text-xs transition-colors duration-500 ${
                    justUnlockedFreeDelivery ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50/70 border-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-neutral-800 font-semibold mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Truck className={`w-4 h-4 ${justUnlockedFreeDelivery ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <AnimatePresence mode="wait" initial={false}>
                        {cart.freeDeliveryRemaining > 0 ? (
                          <motion.span
                            key="remaining"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                          >
                            Add <strong>{formatINR(cart.freeDeliveryRemaining)}</strong> more for <strong>FREE Delivery</strong>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="unlocked"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            className="text-emerald-700 font-bold"
                          >
                            🎉 You unlocked FREE Delivery!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="text-[11px] text-neutral-500">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${justUnlockedFreeDelivery ? 'bg-emerald-500' : 'bg-[#FFD21F]'}`}
                      initial={false}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
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
                  <AnimatePresence initial={false}>
                    {cart.items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="flex gap-3.5 p-3.5 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors overflow-hidden"
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
                                className="text-neutral-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
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
                                className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="relative px-2.5 text-xs font-bold text-neutral-900 min-w-6 text-center overflow-hidden inline-block">
                                <AnimatePresence mode="wait" initial={false}>
                                  <motion.span
                                    key={item.quantity}
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -10, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="block"
                                  >
                                    {item.quantity}
                                  </motion.span>
                                </AnimatePresence>
                              </span>
                              <button
                                onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                disabled={isLoading || item.quantity >= item.stockAvailable}
                                className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
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
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
