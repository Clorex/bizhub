/**
 * E2E Test: Edge Cases
 * 
 * Tests for no crashes on edge cases.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('E2E: Edge Cases', () => {
  it('should return 401 with no vendor ID', async () => {
    const res = await fetch(`${BASE_URL}/api/vendor/analytics/summary`);
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid vendor ID', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/summary?vendor_id=nonexistent-id-12345`
    );
    expect(res.status).toBe(401);
  });

  it('should not crash with empty vendor ID', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/analytics/summary?vendor_id=`
    );
    expect([400, 401]).toContain(res.status);
  });

  it('should handle cron endpoint without auth', async () => {
    const res = await fetch(
      `${BASE_URL}/api/cron/aggregate-daily-stats`,
      { method: 'POST' }
    );
    // Should either work (no CRON_SECRET set) or return 401
    expect([200, 401]).toContain(res.status);
  });

  it('should handle cron GET for health check', async () => {
    const res = await fetch(`${BASE_URL}/api/cron/aggregate-daily-stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.endpoint).toBe('/api/cron/aggregate-daily-stats');
  });

  it('should handle subscription upgrade with invalid tier', async () => {
    const res = await fetch(
      `${BASE_URL}/api/vendor/subscription/upgrade`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'invalid_tier' }),
      }
    );
    // Should be 400 or 401
    expect([400, 401]).toContain(res.status);
  });
});