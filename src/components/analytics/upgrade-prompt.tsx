'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  currentTier?: number;
  compact?: boolean;
}

const PLANS = [
  {
    key: 'LAUNCH',
    name: 'Launch',
    tier: 1,
    features: [
      'Weekly analytics',
      'Basic revenue charts',
      'Up to 800 orders tracked',
      'Email support',
    ],
    isPopular: false,
  },
  {
    key: 'MOMENTUM',
    name: 'Momentum',
    tier: 2,
    features: [
      'Everything in Launch',
      'Monthly analytics',
      'Revenue breakdown',
      'Conversion tracking',
      'Top products ranking',
      'AI-powered insights',
    ],
    isPopular: true,
  },
  {
    key: 'APEX',
    name: 'Apex',
    tier: 3,
    features: [
      'Everything in Momentum',
      'Period comparisons',
      'Advanced insights',
      'Up to 2,500 orders tracked',
      'Priority support',
    ],
    isPopular: false,
  },
];

export default function UpgradePrompt({
  currentTier = 0,
  compact = false,
}: UpgradePromptProps) {
  const router = useRouter();

  if (compact) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-orange-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-800">Unlock More Analytics</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Revenue breakdown, conversion tracking, top products, and AI insights.
            </p>
          </div>
          <button
            onClick={() => router.push('/vendor/subscription')}
            className="inline-flex items-center justify-center px-4 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition"
          >
            View Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((plan) => {
        const isCurrent = plan.tier === currentTier;
        const isUpgrade = plan.tier > currentTier;
        const isPopular = plan.isPopular;

        return (
          <div
            key={plan.key}
            className={`
              relative bg-white rounded-2xl shadow-sm p-5
              ${isPopular ? 'border-2 border-orange-500 shadow-md' : 'border border-gray-200'}
              ${isCurrent ? 'opacity-60' : ''}
            `}
          >
            {/* Popular badge */}
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-600">
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan name */}
            <h3 className="text-lg font-bold text-gray-800 mt-2">{plan.name}</h3>

            {/* Features */}
            <ul className="space-y-2.5 mb-6 mt-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg
                    className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Button */}
            {isCurrent ? (
              <button
                disabled
                className="w-full py-2.5 text-sm font-semibold text-gray-400 bg-gray-100 rounded-xl cursor-not-allowed"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => router.push('/vendor/subscription')}
                className={`
                  w-full py-2.5 text-sm font-semibold rounded-xl transition
                  ${isPopular
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-transparent text-orange-500 border-2 border-orange-500 hover:bg-orange-500 hover:text-white'
                  }
                `}
              >
                {isUpgrade ? 'Upgrade' : 'Select Plan'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}