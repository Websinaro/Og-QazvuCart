'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { authFetch } from '@/src/lib/api';

export interface WishlistItem {
  productId: number;
  name: string;
  slug: string;
  brand: string;
  basePrice: number;
  discountPrice: number;
  discountPercent: number;
  stock: number;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  primaryImage: string;
  deliveryInfo: {
    dateString: string;
    dayOfWeek: string;
  };
  addedAt: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  wishlistIds: Set<number>;
  isLoading: boolean;
  isInWishlist: (productId: number) => boolean;
  toggleWishlist: (productId: number) => Promise<boolean>;
  moveToCart: (productId: number, variantId?: number | null) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { refreshCart, openCartDrawer } = useCart();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setWishlistIds(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const res = await authFetch('/api/wishlist');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
        setWishlistIds(new Set(json.data.map((i: WishlistItem) => i.productId)));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (!isAuthenticated) {
        if (!ignore) {
          setItems([]);
          setWishlistIds(new Set());
          setIsLoading(false);
        }
        return;
      }
      try {
        const res = await authFetch('/api/wishlist');
        const json = await res.json();
        if (!ignore && json.success && Array.isArray(json.data)) {
          setItems(json.data);
          setWishlistIds(new Set(json.data.map((i: WishlistItem) => i.productId)));
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };
    init();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const isInWishlist = (productId: number) => {
    return wishlistIds.has(productId);
  };

  const toggleWishlist = async (productId: number): Promise<boolean> => {
    const res = await authFetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to update wishlist');
    }
    await fetchWishlist();
    return json.data?.isWishlisted;
  };

  const moveToCart = async (productId: number, variantId?: number | null) => {
    const res = await authFetch('/api/wishlist/move-to-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantId }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to move to cart');
    }
    await fetchWishlist();
    await refreshCart();
    openCartDrawer();
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        wishlistIds,
        isLoading,
        isInWishlist,
        toggleWishlist,
        moveToCart,
        refreshWishlist: fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
