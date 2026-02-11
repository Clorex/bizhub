'use client';

import React from 'react';
import ErrorState from '@/components/ui/error-state';

/**
 * Error boundary for the analytics page.
 */
export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="analytics-container">
      <div className="mt-20">
        <ErrorState
          title="Analytics Unavailable"
          description="We couldn't load your analytics data. This might be a temporary issue."
          onRetry={reset}
        />
      </div>
    </div>
  );
}