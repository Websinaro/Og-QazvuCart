'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { Home, Search, ShoppingBag, Heart, User, type AppIcon } from '@/src/components/ui/icons';

type Tab = {
  key: string;
  label: string;
  href: string;
  Icon: AppIcon;
  isActive: (path: string, tab: string | null) => boolean;
};

const TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/', Icon: Home, isActive: (p) => p === '/' },
  { key: 'explore', label: 'Explore', href: '/products', Icon: Search, isActive: (p) => p.startsWith('/products') },
  { key: 'cart', label: 'Cart', href: '/cart', Icon: ShoppingBag, isActive: (p) => p.startsWith('/cart') || p.startsWith('/checkout') },
  {
    key: 'wishlist',
    label: 'Wishlist',
    href: '/account?tab=wishlist',
    Icon: Heart,
    isActive: (p, t) => p.startsWith('/account') && t === 'wishlist',
  },
  {
    key: 'profile',
    label: 'Profile',
    href: '/account',
    Icon: User,
    isActive: (p, t) => p.startsWith('/account') && t !== 'wishlist',
  },
];

function BottomNavInner() {
  const pathname = usePathname() || '/';
  const tab = useSearchParams().get('tab');
  const { cart } = useCart();
  const { items: wishlistItems } = useWishlist();

  // Seller / admin consoles have their own chrome.
  if (pathname.startsWith('/admin') || pathname.startsWith('/seller-center')) return null;

  const badge = (key: string) => {
    if (key === 'cart') return cart.totalItems;
    if (key === 'wishlist') return wishlistItems.length;
    return 0;
  };

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-neutral-900/5 dark:border-white/10 bg-white/95 dark:bg-[#0a150f]/95 backdrop-blur-xl pb-safe shadow-[0_-8px_30px_-12px_rgb(20_80_36/0.18)]"
    >
      <ul className="mx-auto max-w-lg grid grid-cols-5 px-2 pt-2 pb-2">
        {TABS.map(({ key, label, href, Icon, isActive }) => {
          const active = isActive(pathname, tab);
          const count = badge(key);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="group flex flex-col items-center gap-1 py-1 select-none"
              >
                <span
                  data-cart-target={key === 'cart' ? '' : undefined}
                  className={`relative grid place-items-center h-8 w-14 rounded-full transition-colors ${
                    active ? 'bg-brand-100 dark:bg-brand-500/20' : 'group-active:bg-neutral-900/5'
                  }`}
                >
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      active ? 'text-brand-800 dark:text-brand-300' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                    weight={active ? 'fill' : 'regular'}
                  />
                  {count > 0 && (
                    <span className="absolute top-0 right-2 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-[10px] font-semibold ring-2 ring-white dark:ring-[#0a150f]">
                      {count}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-none ${
                    active ? 'font-semibold text-brand-800 dark:text-brand-300' : 'font-medium text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
