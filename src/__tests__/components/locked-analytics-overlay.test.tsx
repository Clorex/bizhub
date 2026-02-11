import { BASE_URL } from '../setup';
import React from 'react';
import { render, screen } from '@testing-library/react';
import LockedAnalyticsOverlay from '@/components/analytics/locked-analytics-overlay';

describe('LockedAnalyticsOverlay', () => {
  it('should render lock title', () => {
    render(<LockedAnalyticsOverlay />);
    expect(screen.getByText('Unlock Premium Analytics')).toBeTruthy();
  });

  it('should render upgrade button', () => {
    render(<LockedAnalyticsOverlay />);
    expect(screen.getByText('Upgrade Now')).toBeTruthy();
  });

  it('should render back to dashboard button', () => {
    render(<LockedAnalyticsOverlay />);
    expect(screen.getByText('Back to Dashboard')).toBeTruthy();
  });

  it('should display custom reason', () => {
    render(<LockedAnalyticsOverlay reason="Your subscription has expired." />);
    expect(screen.getByText('Your subscription has expired.')).toBeTruthy();
  });

  it('should list all features', () => {
    render(<LockedAnalyticsOverlay />);
    expect(screen.getByText('Sales Growth Tracking')).toBeTruthy();
    expect(screen.getByText('Revenue Breakdown')).toBeTruthy();
    expect(screen.getByText('Conversion Analytics')).toBeTruthy();
    expect(screen.getByText('Top Products Ranking')).toBeTruthy();
    expect(screen.getByText('Customer Engagement')).toBeTruthy();
    expect(screen.getByText('Actionable Insights')).toBeTruthy();
  });
});