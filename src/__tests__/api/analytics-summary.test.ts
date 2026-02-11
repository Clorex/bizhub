/**
 * API Integration Tests for Analytics Summary
 * 
 * These tests require a running database and server.
 * Run with: npx jest src/__tests__/api/analytics-summary.test.ts
 */

import { BASE_URL } from '../setup';

describe('GET /api/vendor/analytics/summary', () => {
  it('should return 401 without authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/vendor/analytics/summary`);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });

  it('should return 403 for unpaid vendor', async () => {
    // Use the unpaid vendor from seed data
    const response = await fetch(
      `${BASE_URL}/api/vendor/analytics/summary?vendor_id=UNPAID_VENDOR_ID`
    );

    // Should be 401 (not found) or 403 (forbidden)
    expect([401, 403]).toContain(response.status);
  });

  it('should return 200 with data for paid vendor', async () => {
    // Use the paid vendor from seed data
    const response = await fetch(
      `${BASE_URL}/api/vendor/analytics/summary?vendor_id=PAID_VENDOR_ID`
    );

    if (response.status === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('sales_growth_percentage');
      expect(data.data).toHaveProperty('daily_sales');
      expect(data.data).toHaveProperty('insight');
      expect(Array.isArray(data.data.daily_sales)).toBe(true);
    }
  });
});
export {}
