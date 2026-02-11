'use client';

import { useState, useEffect } from 'react';
import { ConversionData } from '@/types/analytics';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

interface UseConversionReturn {
  data: ConversionData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch conversion performance data.
 */
export function useConversion(vendorId: string): UseConversionReturn {
  const [data, setData] = useState<ConversionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!vendorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${ANALYTICS_CONFIG.ENDPOINTS.CONVERSION}?vendor_id=${vendorId}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch conversion data');
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