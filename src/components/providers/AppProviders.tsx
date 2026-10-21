'use client';

import React from 'react';
import { AuthProvider } from '@/src/context/AuthContext';
import { CartProvider } from '@/src/context/CartContext';
import { WishlistProvider } from '@/src/context/WishlistContext';
import { ToastProvider } from '@/src/context/ToastContext';
import { NotificationProvider } from '@/src/context/NotificationContext';
import { Header } from '@/src/components/layout/Header';
import { Footer } from '@/src/components/layout/Footer';
import { CartDrawer } from '@/src/components/layout/CartDrawer';
import { BottomNav } from '@/src/components/layout/BottomNav';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ToastProvider>
            <NotificationProvider>
              <div className="flex flex-col min-h-screen pb-safe-nav">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
                <CartDrawer />
                <BottomNav />
              </div>
            </NotificationProvider>
          </ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
