'use client';

import { useEffect, useState } from 'react';
import { ProductCardProps } from '@/src/components/product/ProductCard';

interface UseProductListResult {
  products: ProductCardProps[];
  isLoading: boolean;
  error: boolean;
}

/**
 * Fetches a product list from a given /api/products* URL. Returns an
 * empty, non-error state if `url` is null — lets callers defer fetching
 * until they have enough info to build the query (e.g. recently-viewed
 * ids read from localStorage after mount).
 */
export function useProductList(url: string | null): UseProductListResult {
  const [products, setProducts] = useState<ProductCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(!!url);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setProducts([]);
      setIsLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(false);
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setProducts(json.data.products || []);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { products, isLoading, error };
}
