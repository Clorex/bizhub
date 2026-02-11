'use client';

import { useState, useEffect } from 'react';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

interface SubscriptionStatusData {
  status: {
    is_active: boolean;
    tier: string;
    expires_at: string;
    days_remaining: number;
  };
  expiry_warning: string | null;
  upgrade_options: any[];
}

interface UseSubscriptionStatusReturn {
  data: SubscriptionStatusData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch vendor subscription status.
 */
export function useSubscriptionStatus(vendorId: string): UseSubscriptionStatusReturn {
  const [data, setData] = useState<SubscriptionStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!vendorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${ANALYTICS_CONFIG.ENDPOINTS.SUBSCRIPTION_STATUS}?vendor_id=${vendorId}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch subscription status');
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