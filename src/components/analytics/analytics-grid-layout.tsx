'use client';

import React from 'react';

interface AnalyticsGridLayoutProps {
  children: React.ReactNode;
}

/**
 * Analytics Grid Layout
 * Mobile: stacked vertically, full width, 24px gap.
 * Desktop: 2-column grid where appropriate, max 1200px, centered.
 */
export default function AnalyticsGridLayout({ children }: AnalyticsGridLayoutProps) {
  return (
    <div className="analytics-container">
      <div className="analytics-grid">
        {children}
      </div>
    </div>
  );
}

/**
 * Two Column Row
 * Wraps two sections side-by-side on desktop.
 */
export function TwoColumnRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  );
}

/**
 * Full Width Row
 * Forces a section to span full width on all screens.
 */
export function FullWidthRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full">
      {children}
    </div>
  );
}