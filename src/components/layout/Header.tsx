'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { NotificationBell } from '@/src/components/layout/NotificationBell';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { useTheme } from '@/src/context/ThemeContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { ThemeToggle } from '@/src/components/layout/ThemeToggle';
import {
  Search,
  ShoppingBag,
  Heart,
  User as UserIcon,
  MapPin,
  ChevronDown,
  Menu,
  X,
  Package,
  LogOut,
  Settings,
  Sparkles,
  Zap,
  Flame,
  Shield,
} from '@/src/components/ui/icons';
import { formatINR } from '@/src/lib/date';

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { cart, toggleCartDrawer } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { resolvedTheme } = useTheme();

  // Explicit color-scheme opt-out for icon wrappers: `only light`/`only
  // dark` (as opposed to the page-level `light dark`) tells the browser
  // "this subtree's colors are correct for this exact scheme, don't run
  // your auto-dark repaint heuristic on it". Page-level `color-scheme:
  // light dark` already stops most browsers' auto-dark from touching the
  // page, but some OEM WebViews (confirmed: ColorOS/Oppo) still repaint
  // inline SVG icon content specifically. Scoping the *stricter* value to
  // just the icon keeps the icon safe from that without lying to the rest
  // of the page. Matched to resolvedTheme so it flips correctly on toggle.
  const iconSafeStyle: React.CSSProperties = {
    colorScheme: resolvedTheme === 'dark' ? 'only dark' : 'only light',
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuTriggerRef = useRef<HTMLDivElement>(null);

  // Escape closes the profile dropdown and returns focus to its trigger.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isUserMenuOpen]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lock background scroll while the mobile drawer is open so the page
  // underneath can't shift/jump behind the fixed overlay on touch devices.
  useEffect(() => {
    if (isMobileMenuOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isMobileMenuOpen]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    router.push(`/products?${params.toString()}`);
  };

  const openLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
    setIsUserMenuOpen(false);
  };

  const openRegister = () => {
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
    setIsUserMenuOpen(false);
  };

  const navLink =
    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-950 dark:hover:text-white transition-colors';

  const iconBtn =
    'relative grid place-items-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-200 hover:bg-neutral-900/5 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer select-none force-dark-safe';

  const activate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        {/* 1. Announcement bar */}
        <div className="bg-neutral-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-4 text-[12px]">
            <p className="flex items-center gap-2 min-w-0 text-neutral-300">
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-200">
                <Zap className="w-3 h-3" /> Live
              </span>
              <span className="truncate hidden sm:inline">
                Up to <b className="text-white font-semibold">50% off</b> and <b className="text-white font-semibold">free delivery</b> on orders above ₹999
              </span>
              <span className="truncate sm:hidden">Up to 50% off · Free delivery ₹999+</span>
            </p>
            <Link
              href="/products?isDeal=true"
              className="shrink-0 inline-flex items-center gap-1.5 font-medium text-white/90 hover:text-white transition-colors"
            >
              <Flame className="w-3.5 h-3.5 text-brand-300" /> Today&apos;s deals
            </Link>
          </div>
        </div>

        {/* 2. Main bar */}
        <div className="glass border-b border-neutral-900/5 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-5 h-[68px]">
              {/* Mobile menu + logo */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  onKeyDown={activate(() => setIsMobileMenuOpen((prev) => !prev))}
                  className={`${iconBtn} lg:hidden -ml-2`}
                  style={iconSafeStyle}
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </div>

                <Link href="/" className="flex items-center gap-2.5 group" aria-label="QazvuCart home">
                  <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-lg shadow-glow group-hover:scale-105 transition-transform">
                    Q
                    <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
                  </span>
                  <span className="hidden sm:flex flex-col leading-none">
                    <span className="text-[19px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                      Qazvu<span className="text-brand-600 dark:text-brand-300">Cart</span>
                    </span>
                    <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-neutral-500">Marketplace</span>
                  </span>
                </Link>
              </div>

              {/* Deliver-to (xl) */}
              <div className="hidden xl:flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full border border-neutral-900/10 dark:border-white/10 hover:bg-neutral-900/5 dark:hover:bg-white/5 text-xs cursor-pointer transition-colors shrink-0">
                <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" weight="fill" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Deliver to</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Bengaluru 560038</span>
                </div>
              </div>

              {/* Search (md+) */}
              <form
                onSubmit={handleSearchSubmit}
                className="flex-1 max-w-2xl hidden md:flex items-center h-11 rounded-full bg-neutral-900/[0.045] dark:bg-white/[0.07] border border-transparent focus-within:border-brand-500/60 focus-within:bg-white dark:focus-within:bg-neutral-900 focus-within:ring-4 focus-within:ring-brand-500/15 transition-all overflow-hidden"
              >
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Search category"
                  className="h-full bg-transparent pl-4 pr-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer max-w-[9.5rem] truncate"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="h-5 w-px bg-neutral-900/10 dark:bg-white/15" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search headphones, laptops, sneakers…"
                  className="flex-1 min-w-0 h-full px-4 text-sm bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="m-1 h-9 w-9 lg:w-auto lg:px-4 grid lg:flex place-items-center gap-1.5 rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:bg-brand-600 dark:hover:bg-brand-200 transition-colors"
                >
                  <Search className="w-4 h-4" weight="bold" />
                  <span className="hidden lg:inline">Search</span>
                </button>
              </form>

              <div className="flex-1 md:hidden" />

              {/* Actions */}
              <div className="relative flex items-center gap-0.5 sm:gap-1 shrink-0">
                <ThemeToggle className="hidden sm:grid" />
                <NotificationBell />

                <Link href="/account?tab=wishlist" className={iconBtn} title="My Wishlist" aria-label="My wishlist">
                  <Heart className="w-[22px] h-[22px]" />
                  {wishlistItems.length > 0 && (
                    <span className="absolute top-1 right-0.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-rose-600 text-white text-[10px] font-semibold ring-2 ring-white dark:ring-neutral-950">
                      {wishlistItems.length}
                    </span>
                  )}
                </Link>

                {/* Account */}
                <div className="relative">
                  {isAuthenticated && user ? (
                    <div
                      ref={userMenuTriggerRef}
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      onKeyDown={activate(() => setIsUserMenuOpen((prev) => !prev))}
                      aria-haspopup="menu"
                      aria-expanded={isUserMenuOpen}
                      aria-label="Open account menu"
                      className="flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-3 rounded-full hover:bg-neutral-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none force-dark-safe"
                    >
                      <span className="grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold text-xs shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                      <span className="hidden lg:flex flex-col text-left leading-tight">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Hello,</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 max-w-[96px] truncate">
                          {user.username}
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-500 hidden sm:block" />
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openLogin}
                      onKeyDown={activate(openLogin)}
                      aria-label="Sign in"
                      className="flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none force-dark-safe"
                    >
                      <UserIcon className="w-[18px] h-[18px]" />
                      <span className="hidden sm:inline">Sign in</span>
                    </div>
                  )}

                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsUserMenuOpen(false)} />
                      <div
                        role="menu"
                        aria-label="Account menu"
                        className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] surface p-2 z-50 shadow-lift animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150 origin-top-right"
                      >
                        {user && (
                          <div className="flex items-center gap-3 px-3 py-3 mb-1 rounded-xl bg-neutral-900/[0.035] dark:bg-white/5">
                            <span className="grid place-items-center w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-neutral-950 dark:text-white truncate">{user.username}</p>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                            </div>
                            <span className="ml-auto shrink-0 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-200 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                              {user.role}
                            </span>
                          </div>
                        )}

                        {user?.role === 'ADMIN' && (
                          <Link
                            href="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-brand-500/10 text-brand-800 dark:text-brand-200 hover:bg-brand-500/15 text-[13px] font-semibold transition-colors"
                          >
                            <Shield className="w-4 h-4" /> Admin panel
                          </Link>
                        )}
                        <Link href="/account" onClick={() => setIsUserMenuOpen(false)} className={navLink}>
                          <UserIcon className="w-4 h-4 text-neutral-400" /> Profile overview
                        </Link>
                        <Link href="/account?tab=orders" onClick={() => setIsUserMenuOpen(false)} className={navLink}>
                          <Package className="w-4 h-4 text-neutral-400" /> Orders & tracking
                        </Link>
                        <Link href="/account?tab=addresses" onClick={() => setIsUserMenuOpen(false)} className={navLink}>
                          <MapPin className="w-4 h-4 text-neutral-400" /> Saved addresses
                        </Link>
                        <Link href="/account?tab=reviews" onClick={() => setIsUserMenuOpen(false)} className={navLink}>
                          <Sparkles className="w-4 h-4 text-neutral-400" /> Pending reviews
                        </Link>
                        <Link href="/account?tab=settings" onClick={() => setIsUserMenuOpen(false)} className={navLink}>
                          <Settings className="w-4 h-4 text-neutral-400" /> Account settings
                        </Link>
                        <div className="my-1.5 h-px bg-neutral-900/5 dark:bg-white/10" />
                        <button
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Cart */}
                <button
                  onClick={toggleCartDrawer}
                  className="ml-1 flex items-center gap-2.5 h-10 pl-3 pr-3 sm:pr-4 rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-brand-600 dark:hover:bg-brand-200 active:scale-95 shadow-soft transition"
                  aria-label="Open shopping cart"
                >
                  <span className="relative" id="header-cart-icon">
                    <ShoppingBag className="w-[19px] h-[19px]" />
                    {cart.totalItems > 0 && (
                      <span className="absolute -top-2 -right-2.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-brand-500 text-white text-[10px] font-semibold ring-2 ring-neutral-950 dark:ring-white">
                        {cart.totalItems}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:block text-[13px] font-semibold tabular-nums">{formatINR(cart.subtotal)}</span>
                </button>
              </div>
            </div>

            {/* Mobile search */}
            <form
              onSubmit={handleSearchSubmit}
              className="md:hidden pb-3 -mt-1 flex items-center gap-2"
            >
              <div className="flex-1 flex items-center gap-2 h-10 px-3.5 rounded-full bg-neutral-900/[0.05] dark:bg-white/[0.08] focus-within:ring-4 focus-within:ring-brand-500/15">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, brands…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>
              <button type="submit" className="h-10 px-4 rounded-full bg-brand-600 text-white text-xs font-semibold" aria-label="Search">
                Go
              </button>
            </form>
          </div>

          {/* 3. Category strip */}
          <div className="hidden md:block border-t border-neutral-900/5 dark:border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4">
              <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[13px] font-medium" aria-label="Categories">
                <Link
                  href="/products"
                  className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-semibold whitespace-nowrap hover:bg-brand-600 dark:hover:bg-brand-200 transition-colors"
                >
                  <Menu className="w-3.5 h-3.5" /> All products
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="px-3 h-8 grid place-items-center rounded-full text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/10 whitespace-nowrap transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/products?isDeal=true"
                  className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[12px] font-semibold hover:bg-rose-500/15 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" weight="fill" /> Hot deals
                </Link>
                <Link
                  href="/products?isFeatured=true"
                  className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-200 text-[12px] font-semibold hover:bg-brand-500/15 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" weight="fill" /> Featured
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[86%] max-w-sm bg-white dark:bg-[#0e0e14] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-5 h-16 border-b border-neutral-900/5 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold">Q</span>
                <span className="font-semibold text-[17px] text-neutral-950 dark:text-white tracking-tight">QazvuCart</span>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsMobileMenuOpen(false)}
                  onKeyDown={activate(() => setIsMobileMenuOpen(false))}
                  className={iconBtn}
                  style={iconSafeStyle}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {isAuthenticated && user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-900/[0.035] dark:bg-white/5">
                    <span className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-neutral-950 dark:text-white truncate">{user.username}</p>
                      <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-500/10 text-brand-800 dark:text-brand-200 font-semibold text-[13px]"
                    >
                      <Shield className="w-4 h-4" /> Go to admin panel
                    </Link>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: '/account?tab=orders', label: 'Orders', Icon: Package },
                      { href: '/account?tab=wishlist', label: 'Wishlist', Icon: Heart },
                      { href: '/account?tab=addresses', label: 'Addresses', Icon: MapPin },
                      { href: '/account?tab=settings', label: 'Settings', Icon: Settings },
                    ].map(({ href, label, Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 h-11 px-3 rounded-xl border border-neutral-900/10 dark:border-white/10 text-[13px] font-medium text-neutral-800 dark:text-neutral-200"
                      >
                        <Icon className="w-4 h-4 text-neutral-400" /> {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openLogin();
                    }}
                    className="w-full h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-[13px] shadow-glow transition-colors"
                  >
                    Sign in to QazvuCart
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openRegister();
                    }}
                    className="w-full h-11 rounded-xl border border-neutral-900/10 dark:border-white/15 text-neutral-800 dark:text-neutral-200 font-semibold text-[13px]"
                  >
                    Create account
                  </button>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.16em] mb-2 px-1">Shop</p>
                <div className="space-y-0.5">
                  <Link
                    href="/products"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2.5 text-[15px] font-semibold text-neutral-950 dark:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5"
                  >
                    All products
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/products?category=${c.slug}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2.5 text-[15px] text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {isAuthenticated && (
              <div className="px-5 py-4 border-t border-neutral-900/5 dark:border-white/10 shrink-0">
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 h-11 text-rose-600 dark:text-rose-400 font-semibold text-[13px] hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
}
