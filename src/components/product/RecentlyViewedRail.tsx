'use client';

import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { ProductRail } from '@/src/components/product/ProductRail';
import { useProductList } from '@/src/lib/useProductList';
import { getRecentlyViewed } from '@/src/lib/recentlyViewed';

/**
 * "Continue exploring" — renders nothing until we know (client-side, after
 * mount) whether there's any viewing history, and renders nothing at all
 * if there isn't, so it never shows an empty section to a first-time
 * visitor.
 */
export function RecentlyViewedRail({ excludeId, title = 'Recently Viewed' }: { excludeId?: number; title?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      const entries = getRecentlyViewed({ excludeId, limit: 10 });
      setUrl(
        entries.length === 0 ? null : `/api/products?ids=${entries.map((e) => e.id).join(',')}&limit=${entries.length}`
      );
      setReady(true);
    };
    syncFromStorage();
    // Re-check when the tab regains focus, in case the person viewed more
    // products in another tab and came back.
    window.addEventListener('focus', syncFromStorage);
    return () => window.removeEventListener('focus', syncFromStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeId]);

  const { products, isLoading } = useProductList(url);

  if (!ready) return null;

  return (
    <ProductRail
      title={`👀 ${title}`}
      subtitle="Continue exploring"
      icon={History}
      products={products}
      isLoading={isLoading}
    />
  );
}
