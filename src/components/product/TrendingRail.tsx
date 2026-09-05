'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import { ProductRail } from '@/src/components/product/ProductRail';
import { useProductList } from '@/src/lib/useProductList';

/**
 * Ranked by actual units sold in the trailing 30 days (see
 * ProductService.getTrending) — not a static "isFeatured" flag dressed up
 * as trending.
 */
export function TrendingRail({ limit = 8 }: { limit?: number }) {
  const { products, isLoading } = useProductList(`/api/products/trending?limit=${limit}`);

  return (
    <ProductRail
      title="⭐ Trending Now"
      subtitle="Popular with QazvuCart shoppers this month"
      icon={Flame}
      products={products}
      isLoading={isLoading}
      accent="amber"
    />
  );
}
