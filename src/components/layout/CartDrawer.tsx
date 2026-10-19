'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/src/context/CartContext';
import { useToast } from '@/src/context/ToastContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck, ShieldCheck } from '@/src/components/ui/icons';
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
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          <motion.div
            className="absolute inset-0 bg-neutral-950/50 backdrop-blur-sm"
            onClick={closeCartDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
            <motion.div
              className="w-screen max-w-md bg-white dark:bg-[#14110a] shadow-2xl flex flex-col sm:rounded-l-[2rem] overflow-hidden border-l border-neutral-900/5 dark:border-white/10"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* Header */}
              <div className="px-6 h-[72px] shrink-0 flex items-center justify-between border-b border-neutral-900/5 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                    <ShoppingBag className="w-5 h-5" />
                  </span>
                  <div className="leading-tight">
                    <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">Your cart</h2>
                    <p className="text-xs text-neutral-500">
                      {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCartDrawer}
                  aria-label="Close cart"
                  className="grid place-items-center w-10 h-10 rounded-full text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free delivery progress */}
              {cart.items.length > 0 && (
                <div
                  className={`mx-5 mt-4 rounded-2xl px-4 py-3.5 text-xs transition-colors duration-500 ${
                    justUnlockedFreeDelivery
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                      : 'bg-brand-500/[0.07] ring-1 ring-brand-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-neutral-800 dark:text-neutral-200 font-medium mb-2.5">
                    <span className="flex items-center gap-2 min-w-0">
                      <Truck
                        className={`w-4 h-4 shrink-0 ${
                          justUnlockedFreeDelivery ? 'text-emerald-600' : 'text-brand-700 dark:text-brand-300'
                        }`}
                      />
                      <AnimatePresence mode="wait" initial={false}>
                        {cart.freeDeliveryRemaining > 0 ? (
                          <motion.span
                            key="remaining"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                          >
                            Add <strong className="font-semibold">{formatINR(cart.freeDeliveryRemaining)}</strong> more for <strong className="font-semibold">free delivery</strong>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="unlocked"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            className="text-emerald-700 dark:text-emerald-400 font-semibold"
                          >
                            🎉 You unlocked free delivery!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="text-[11px] text-neutral-500 tabular-nums shrink-0">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-neutral-900/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        justUnlockedFreeDelivery ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-400 to-brand-600'
                      }`}
                      initial={false}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                    />
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cart.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="grid place-items-center w-20 h-20 rounded-[1.75rem] bg-brand-500/10 text-brand-700 dark:text-brand-300 mb-5">
                      <ShoppingBag className="w-9 h-9" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white mb-1.5">Your cart is empty</h3>
                    <p className="text-[13px] text-neutral-500 max-w-xs mb-7 leading-relaxed">
                      Discover electronics, apparel and home essentials from verified sellers.
                    </p>
                    <Link
                      href="/products"
                      onClick={closeCartDrawer}
                      className="h-11 px-7 grid place-items-center rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-[13px] font-semibold hover:bg-brand-600 dark:hover:bg-brand-200 transition-colors hover:text-neutral-950"
                    >
                      Start shopping
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
                        className="flex gap-4 p-3 rounded-2xl border border-neutral-900/[0.06] dark:border-white/10 bg-neutral-900/[0.02] dark:bg-white/[0.03] overflow-hidden"
                      >
                        <div className="relative w-[88px] h-[88px] rounded-xl bg-neutral-100 dark:bg-neutral-900 shrink-0 overflow-hidden">
                          <Image
                            src={item.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80'}
                            alt={item.productName}
                            fill
                            sizes="88px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/products/${item.productSlug}`}
                                onClick={closeCartDrawer}
                                className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                              >
                                {item.productName}
                              </Link>
                              <button
                                onClick={() => handleRemove(item.id)}
                                className="shrink-0 grid place-items-center w-7 h-7 -mr-1 -mt-1 rounded-full text-neutral-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove item"
                                aria-label="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {item.variantName && (
                              <p className="text-[11px] text-neutral-500 mt-0.5">
                                Option: <span className="text-neutral-700 dark:text-neutral-300">{item.variantName}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="tabular-nums">
                              <span className="text-sm font-semibold text-neutral-950 dark:text-white">{formatINR(item.unitPrice)}</span>
                              {item.basePrice > item.unitPrice && (
                                <span className="text-[11px] text-neutral-400 line-through ml-1.5">{formatINR(item.basePrice)}</span>
                              )}
                            </div>

                            <div className="flex items-center rounded-full bg-white dark:bg-white/10 ring-1 ring-neutral-900/10 dark:ring-white/10 overflow-hidden">
                              <button
                                onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                disabled={isLoading}
                                aria-label="Decrease quantity"
                                className="grid place-items-center w-7 h-7 hover:bg-neutral-900/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors disabled:opacity-40 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" weight="bold" />
                              </button>
                              <span className="relative text-xs font-semibold text-neutral-900 dark:text-white min-w-6 text-center overflow-hidden inline-block tabular-nums">
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
                                aria-label="Increase quantity"
                                className="grid place-items-center w-7 h-7 hover:bg-neutral-900/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" weight="bold" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Summary */}
              {cart.items.length > 0 && (
                <div className="px-6 pt-5 pb-6 border-t border-neutral-900/5 dark:border-white/10 bg-neutral-900/[0.02] dark:bg-white/[0.02] space-y-4">
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Subtotal ({cart.totalItems} items)</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(cart.subtotal)}</span>
                    </div>
                    {cart.totalDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount savings</span>
                        <span className="tabular-nums">− {formatINR(cart.totalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>Estimated delivery</span>
                      <span className="tabular-nums">
                        {cart.deliveryFee === 0 ? (
                          <strong className="font-semibold text-emerald-600 dark:text-emerald-400">Free</strong>
                        ) : (
                          formatINR(cart.deliveryFee)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline pt-3 border-t border-dashed border-neutral-900/10 dark:border-white/15">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">Total</span>
                      <span className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white tabular-nums">{formatINR(cart.grandTotal)}</span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    onClick={closeCartDrawer}
                    className="group w-full h-12 px-5 rounded-full bg-brand-600 hover:bg-brand-500 text-neutral-950 font-semibold text-sm shadow-glow active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    Checkout
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" weight="bold" />
                  </Link>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Secure 256-bit encrypted checkout
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
