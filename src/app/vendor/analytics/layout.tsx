import React from 'react';
import '@/styles/analytics.css';
import '@/styles/charts.css';

export const metadata = {
  title: 'Analytics | myBizHub',
  description: 'Premium vendor analytics dashboard',
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}