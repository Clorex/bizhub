'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, BarChart3, TrendingUp, Users, ShoppingBag, Sparkles, Zap } from 'lucide-react';

interface LockedAnalyticsOverlayProps {
  reason?: string;
}

const FEATURES = [
  { label: 'Sales Growth Tracking', icon: TrendingUp },
  { label: 'Revenue Breakdown', icon: BarChart3 },
  { label: 'Conversion Analytics', icon: Zap },
  { label: 'Top Products Ranking', icon: ShoppingBag },
  { label: 'Customer Engagement', icon: Users },
  { label: 'AI-Powered Insights', icon: Sparkles },
];

export default function LockedAnalyticsOverlay({
  reason = 'Subscribe to access analytics.',
}: LockedAnalyticsOverlayProps) {
  const router = useRouter();

  return (
    <div className="px-4 pt-6">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        {/* Lock icon */}
        <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-orange-500" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Unlock Premium Analytics
        </h2>

        {/* Description */}
        <p className="text-gray-500 max-w-md mb-2">
          Get detailed insights into your sales performance, revenue breakdown,
          conversion rates, and customer engagement.
        </p>

        {/* Reason */}
        <p className="text-sm text-orange-500 font-medium mb-6">{reason}</p>

        {/* Features list — NO charts, just text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mb-8">
          {FEATURES.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-gray-600">
              <Icon className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push('/vendor/subscription')}
            className="inline-flex items-center justify-center px-7 py-3 bg-orange-500 text-white text-base font-semibold rounded-xl hover:bg-orange-600 transition-all duration-200"
          >
            Upgrade Now
          </button>
          <button
            onClick={() => router.push('/vendor')}
            className="inline-flex items-center justify-center px-7 py-3 bg-transparent text-orange-500 border-2 border-orange-500 text-base font-semibold rounded-xl hover:bg-orange-500 hover:text-white transition-all duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}