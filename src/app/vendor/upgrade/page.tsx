'use client';

import React, { useEffect, useState } from 'react';
import UpgradePrompt from '@/components/analytics/upgrade-prompt';
import { Button } from "@/components/ui/Button";
import '@/styles/analytics.css';

/**
 * Upgrade Page
 * Route: /vendor/upgrade
 * 
 * Shows subscription tier options.
 */
export default function UpgradePage() {
  const [currentTier, setCurrentTier] = useState('basic');

  useEffect(() => {
    // Get current tier from subscription status
    const fetchTier = async () => {
      try {
        const cookieMatch = document.cookie.match(/vendor_id=([^;]+)/);
        const urlParams = new URLSearchParams(window.location.search);
        const vendorId = urlParams.get('vendor_id') || cookieMatch?.[1] || '';

        if (!vendorId) return;

        const response = await fetch(
          `/api/vendor/subscription/status?vendor_id=${vendorId}`
        );
        const result = await response.json();

        if (result.success) {
          setCurrentTier(result.data.status.tier);
        }
      } catch (err) {
        console.error('Failed to fetch tier:', err);
      }
    };

    fetchTier();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-12">
        {/* Back button */}
        <div className="mb-6">
          <Button href="/vendor/dashboard" variant="ghost" size="sm">
            ← Back to Dashboard
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
            Choose Your Plan
          </h1>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Unlock powerful analytics to grow your business.
            All plans include a 14-day free trial.
          </p>
        </div>

        {/* Tier cards */}
        <UpgradePrompt currentTier={currentTier} />

        {/* FAQ or trust signals */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400">
            Cancel anytime. No hidden fees. Secure payment.
          </p>
        </div>
      </div>
    </div>
  );
}
