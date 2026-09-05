'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ProductRail } from '@/src/components/product/ProductRail';
import { useProductList } from '@/src/lib/useProductList';
import { getRecentCategoryIds, getRecentlyViewed } from '@/src/lib/recentlyViewed';

/**
 * "Picked for you" — a lightweight personalization signal derived from
 * categories the person has actually browsed (tracked client-side via
 * recentlyViewed.ts), rather than a hardcoded "featured" list relabeled
 * as personal. Renders nothing for first-time visitors with no browsing
 * history yet, rather than showing a misleading generic list.
 */
export function PersonalizedRail() {
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      const categoryIds = getRecentCategoryIds(4);
      if (categoryIds.length === 0) {
        setUrl(null);
      } else {
        const viewedIds = getRecentlyViewed({ limit: 20 }).map((e) => e.id);
        const params = new URLSearchParams({
          categories: categoryIds.join(','),
          sort: 'rating_desc',
          limit: '8',
        });
        if (viewedIds.length > 0) params.set('excludeIds', viewedIds.join(','));
        setUrl(`/api/products?${params.toString()}`);
      }
      setReady(true);
    };
    syncFromStorage();
  }, []);

  const { products, isLoading } = useProductList(url);

  if (!ready) return null;

  return (
    <ProductRail
      title="✨ Picked For You"
      subtitle="Based on your activity"
      icon={Sparkles}
      products={products}
      isLoading={isLoading}
    />
  );
}
