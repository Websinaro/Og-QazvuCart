'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useWishlist } from '@/src/context/WishlistContext';
import { AuthModal } from '@/src/components/auth/AuthModal';
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
} from 'lucide-react';
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

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);

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

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white shadow-xs border-b border-neutral-200">
        {/* 1. Announcement Bar */}
        <div className="bg-neutral-950 text-white text-[12px] py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-[#FFD21F] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Sale Live
              </span>
              <span className="font-medium text-neutral-300 hidden sm:inline">
                ⚡ Mega Deals: Up to <strong>50% OFF</strong> + <strong>FREE Delivery</strong> on orders above ₹999!
              </span>
              <span className="font-medium text-neutral-300 sm:hidden">
                ⚡ Up to 50% OFF + Free Delivery on ₹999+
              </span>
            </div>
            <div className="flex items-center gap-4 text-neutral-400 text-xs">
              <Link href="/products?isDeal=true" className="hover:text-[#FFD21F] transition-colors flex items-center gap-1 font-semibold text-white">
                <Flame className="w-3.5 h-3.5 text-[#FFD21F]" /> Today&apos;s Deals
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Main Header Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* Mobile Menu Toggle & Brand Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden p-2 text-neutral-700 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <Link href="/" className="flex items-center gap-1.5 group">
                <div className="w-9 h-9 rounded-xl bg-neutral-950 flex items-center justify-center font-black text-xl text-[#FFD21F] shadow-sm group-hover:scale-105 transition-transform">
                  Q
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-neutral-950">Qazvu</span>
                    <span className="text-xl sm:text-2xl font-black text-[#FFD21F] bg-neutral-950 px-1.5 rounded-sm ml-0.5">Cart</span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest -mt-1 hidden sm:block">
                    Multi-Vendor Marketplace
                  </span>
                </div>
              </Link>
            </div>

            {/* Location Selector (Desktop) */}
            <div className="hidden xl:flex items-center gap-2 pl-2 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 text-xs cursor-pointer transition-colors">
              <MapPin className="w-4 h-4 text-[#FFD21F] shrink-0 fill-[#FFD21F]" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-neutral-500 font-medium">Deliver to</span>
                <span className="font-bold text-neutral-900 leading-tight">Bengaluru 560038</span>
              </div>
            </div>

            {/* Search Bar with Category Select (Desktop/Tablet) */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex-1 max-w-2xl hidden md:flex items-center border-2 border-neutral-900 rounded-xl overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-[#FFD21F]"
            >
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-neutral-100 text-neutral-800 text-xs font-semibold px-3 py-2.5 border-r border-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for headphones, laptops, running shoes, espresso machines..."
                className="flex-1 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none bg-white"
              />

              <button
                type="submit"
                className="bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 px-5 py-2.5 font-bold transition-colors flex items-center gap-1"
                aria-label="Search"
              >
                <Search className="w-4 h-4 text-neutral-950" />
                <span className="text-xs uppercase font-extrabold tracking-wide hidden lg:inline">Search</span>
              </button>
            </form>

            {/* Right Action Icons (Auth, Wishlist, Cart) */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* User Account Menu */}
              <div className="relative">
                {isAuthenticated && user ? (
                  <button
                    ref={userMenuTriggerRef}
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                    aria-label="Open account menu"
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-neutral-100 text-neutral-900 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-[#FFD21F] font-bold text-xs flex items-center justify-center shrink-0">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-[10px] text-neutral-500 font-medium">Hello,</span>
                      <span className="text-xs font-bold text-neutral-900 max-w-[100px] truncate">
                        {user.username}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 hidden sm:block" />
                  </button>
                ) : (
                  <button
                    onClick={openLogin}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-100 text-neutral-900 transition-colors text-xs font-bold"
                  >
                    <UserIcon className="w-4 h-4 text-neutral-700" />
                    <span className="hidden sm:inline">Sign In</span>
                  </button>
                )}

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      aria-label="Account menu"
                      className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-neutral-200 py-2 z-50 animate-fade-in text-xs font-medium"
                    >
                      {isAuthenticated && user && (
                        <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
                          <p className="font-bold text-neutral-950 text-sm truncate">{user.username}</p>
                          <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                          <span className="inline-block mt-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                            {user.role}
                          </span>
                        </div>
                      )}

                      <div className="py-1">
                        {user?.role === 'ADMIN' && (
                          <Link
                            href="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 text-amber-950 hover:bg-amber-100 font-bold border-b border-amber-200/60"
                          >
                            <Shield className="w-4 h-4 text-amber-700" />
                            <span>Admin Panel</span>
                            <span className="ml-auto text-[10px] bg-amber-300 text-amber-950 font-black px-1.5 py-0.5 rounded uppercase">
                              Admin
                            </span>
                          </Link>
                        )}
                        <Link
                          href="/account"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 font-semibold"
                        >
                          <UserIcon className="w-4 h-4 text-neutral-500" /> Profile Overview
                        </Link>
                        <Link
                          href="/account?tab=orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 font-semibold"
                        >
                          <Package className="w-4 h-4 text-neutral-500" /> My Orders & Tracking
                        </Link>
                        <Link
                          href="/account?tab=addresses"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 font-semibold"
                        >
                          <MapPin className="w-4 h-4 text-neutral-500" /> Saved Addresses
                        </Link>
                        <Link
                          href="/account?tab=reviews"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 font-semibold"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" /> Pending Reviews
                        </Link>
                        <Link
                          href="/account?tab=settings"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 font-semibold"
                        >
                          <Settings className="w-4 h-4 text-neutral-500" /> Account Settings
                        </Link>
                      </div>

                      <div className="border-t border-neutral-100 pt-1">
                        <button
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 font-bold"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Wishlist Link */}
              <Link
                href="/account?tab=wishlist"
                className="relative p-2 rounded-xl hover:bg-neutral-100 text-neutral-700 hover:text-neutral-950 transition-colors"
                title="My Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {wishlistItems.length}
                  </span>
                )}
              </Link>

              {/* Cart Drawer Trigger */}
              <button
                onClick={toggleCartDrawer}
                className="flex items-center gap-2.5 p-2 sm:px-3.5 sm:py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl shadow-sm transition-all"
                aria-label="Open Shopping Cart"
              >
                <div className="relative" id="header-cart-icon">
                  <ShoppingBag className="w-5 h-5 text-[#FFD21F]" />
                  {cart.totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-neutral-950 shadow-xs">
                      {cart.totalItems}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[10px] text-neutral-400 font-medium">Cart</span>
                  <span className="text-xs font-black text-white">{formatINR(cart.subtotal)}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar Row */}
          <div className="mt-2.5 md:hidden">
            <form onSubmit={handleSearchSubmit} className="flex items-center border border-neutral-300 rounded-xl overflow-hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands..."
                className="flex-1 px-3 py-2 text-xs bg-neutral-50 text-neutral-900 focus:outline-none"
              />
              <button type="submit" className="bg-[#FFD21F] p-2 text-neutral-950 font-bold">
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 3. Category Navigation Strip */}
        <div className="bg-neutral-50 border-t border-neutral-200 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs font-semibold text-neutral-700">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
              <Link
                href="/products"
                className="px-3 py-1 rounded-lg hover:bg-neutral-200/70 text-neutral-900 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Menu className="w-3.5 h-3.5" /> All Products
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="px-3 py-1 rounded-lg hover:bg-neutral-200/70 text-neutral-700 hover:text-neutral-950 transition-colors whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3 py-1.5 pl-4 shrink-0">
              <Link
                href="/products?isDeal=true"
                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-extrabold bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 fill-red-600" /> Hot Deals
              </Link>
              <Link
                href="/products?isFeatured=true"
                className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Featured
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl z-50 flex flex-col justify-between p-5 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-950 flex items-center justify-center font-bold text-lg text-[#FFD21F]">
                    Q
                  </div>
                  <span className="font-black text-lg text-neutral-900">QazvuCart</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Bar in Drawer */}
              <div className="py-4 border-b border-neutral-100">
                {isAuthenticated && user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-900 text-[#FFD21F] font-bold flex items-center justify-center text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-neutral-900">{user.username}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                    {user.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-100 border border-amber-300 text-amber-950 font-black text-xs rounded-xl shadow-xs"
                      >
                        <Shield className="w-4 h-4 text-amber-800" />
                        <span>Go to Admin Panel</span>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openLogin();
                      }}
                      className="w-full py-2.5 px-4 bg-[#FFD21F] text-neutral-950 font-bold text-xs rounded-xl shadow-xs"
                    >
                      Sign In to QazvuCart
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openRegister();
                      }}
                      className="w-full py-2.5 px-4 border border-neutral-300 text-neutral-800 font-bold text-xs rounded-xl"
                    >
                      Create Account
                    </button>
                  </div>
                )}
              </div>

              {/* Categories Navigation */}
              <div className="py-4">
                <p className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider mb-2">Shop Categories</p>
                <div className="space-y-1">
                  <Link
                    href="/products"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-semibold text-neutral-900 rounded-lg hover:bg-neutral-100"
                  >
                    All Products
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/products?category=${c.slug}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-100"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions in Drawer */}
            {isAuthenticated && (
              <div className="pt-4 border-t border-neutral-200">
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-red-600 font-bold text-xs hover:bg-red-50 rounded-xl"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
}
