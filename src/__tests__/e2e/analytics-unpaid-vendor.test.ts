/**
 * E2E Test: Unpaid Vendor Analytics
 * 
 * Verifies all endpoints return 403 for unpaid vendors.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('E2E: Unpaid Vendor Analytics', () => {
  const UNPAID_VENDOR_ID = process.env.TEST_UNPAID_VENDOR_ID || 'UNPAID_VENDOR_ID';

  const endpoints = [
    '/api/vendor/analytics/summary',
    '/api/vendor/analytics/sales-growth',
    '/api/vendor/analytics/revenue-breakdown',
    '/api/vendor/analytics/conversion',
    '/api/vendor/analytics/top-products',
    '/api/vendor/analytics/customer-engagement',
  ];

  endpoints.forEach((endpoint) => {
    it(`should return 403 for ${endpoint}`, async () => {
      const res = await fetch(
        `${BASE_URL}${endpoint}?vendor_id=${UNPAID_VENDOR_ID}`
      );
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });

  it('should allow subscription status check', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/subscription/status?vendor_id=${UNPAID_VENDOR_ID}`
    );
    // Status check should be allowed even for unpaid
    expect([200, 401]).toContain(res.status);
  });
});