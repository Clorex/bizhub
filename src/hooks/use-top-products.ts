'use client';

import { useState, useEffect } from 'react';
import { TopProductsData } from '@/types/analytics';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

interface UseTopProductsReturn {
  data: TopProductsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch top performing products.
 */
export function useTopProducts(vendorId: string): UseTopProductsReturn {
  const [data, setData] = useState<TopProductsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!vendorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${ANALYTICS_CONFIG.ENDPOINTS.TOP_PRODUCTS}?vendor_id=${vendorId}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch top products');
        setData(null);
        return;
      }

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  return { data, isLoading, error, refetch: fetchData };
}