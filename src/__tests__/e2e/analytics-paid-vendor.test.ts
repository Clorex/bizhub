/**
 * E2E Test: Paid Vendor Analytics
 * 
 * Requires running app + seeded database.
 * Run with: npx jest src/__tests__/e2e/analytics-paid-vendor.test.ts
 */

import { BASE_URL } from '../setup';
describe('E2E: Paid Vendor Analytics', () => {
  const PAID_VENDOR_ID = process.env.TEST_PAID_VENDOR_ID || 'PAID_VENDOR_ID';

  it('should load summary endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/summary?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.data.sales_growth_percentage).toBe('number');
  });

  it('should load sales growth endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/sales-growth?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.daily_sales.length).toBe(30);
  });

  it('should load revenue breakdown endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/revenue-breakdown?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.top_products.length).toBeGreaterThan(0);
  });

  it('should load conversion endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/conversion?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.data.conversion_rate).toBe('number');
  });

  it('should load top products endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/top-products?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.products.length).toBeGreaterThan(0);
  });

  it('should load engagement endpoint', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/customer-engagement?vendor_id=${PAID_VENDOR_ID}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.data.saves).toBe('number');
  });
});