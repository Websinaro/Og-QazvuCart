'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { authFetch } from '@/src/lib/api';

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  productName: string;
  productSlug: string;
  productImage: string;
  brand: string;
  variantName: string | null;
  basePrice: number;
  unitPrice: number;
  discountPercent: number;
  quantity: number;
  itemTotal: number;
  stockAvailable: number;
  inStock: boolean;
  deliveryFee: number;
  estimatedDays: number;
  deliveryInfo: {
    dateString: string;
    dayOfWeek: string;
    formattedDate: string;
    fullDate: string;
  };
}

export interface CartSummary {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  totalOriginalPrice: number;
  totalDiscount: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  freeDeliveryRemaining: number;
  grandTotal: number;
}

interface CartContextType {
  cart: CartSummary;
  isLoading: boolean;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
  addToCart: (productId: number, variantId?: number | null, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const emptyCart: CartSummary = {
  items: [],
  totalItems: 0,
  subtotal: 0,
  totalOriginalPrice: 0,
  totalDiscount: 0,
  deliveryFee: 0,
  freeDeliveryThreshold: 999,
  freeDeliveryRemaining: 999,
  grandTotal: 0,
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartSummary>(emptyCart);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(emptyCart);
      return;
    }
    setIsLoading(true);
    try {
      const res = await authFetch('/api/cart');
      const json = await res.json();
      if (json.success && json.data) {
        setCart(json.data);
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
      try {
        const res = await authFetch('/api/cart');
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setCart(json.data);
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

  const addToCart = async (productId: number, variantId: number | null = null, quantity = 1) => {
    const res = await authFetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantId, quantity }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to add item to cart');
    }
    setCart(json.data);
    setIsCartDrawerOpen(true);
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    const res = await authFetch(`/api/cart/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to update quantity');
    }
    setCart(json.data);
  };

  const removeItem = async (itemId: number) => {
    const res = await authFetch(`/api/cart/${itemId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to remove item');
    }
    setCart(json.data);
  };

  const clearCart = async () => {
    const res = await authFetch('/api/cart', {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to clear cart');
    }
    setCart(json.data);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isCartDrawerOpen,
        openCartDrawer: () => setIsCartDrawerOpen(true),
        closeCartDrawer: () => setIsCartDrawerOpen(false),
        toggleCartDrawer: () => setIsCartDrawerOpen((prev) => !prev),
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
