import {
  generateEngagementInsight,
  generateSummaryInsight,
  generatePeakDayInsight,
} from '@/services/analytics/insight-generator';

describe('Engagement Insights', () => {
  it('should warn about low conversion from saves', () => {
    const insight = generateEngagementInsight(100, 10, 50);
    expect(insight).toContain('not converting');
  });

  it('should show positive message for good conversion', () => {
    const insight = generateEngagementInsight(100, 80, 50);
    expect(insight).toContain('Strong engagement');
  });

  it('should handle saves with no purchases', () => {
    const insight = generateEngagementInsight(50, 0, 20);
    expect(insight).toContain('not converting');
  });

  it('should handle all zeros', () => {
    const insight = generateEngagementInsight(0, 0, 0);
    expect(insight).toContain('No engagement data');
  });

  it('should handle cart adds with no purchases', () => {
    const insight = generateEngagementInsight(0, 0, 30);
    expect(insight).toContain('checkout flow');
  });
});

describe('Summary Insights', () => {
  it('should return strong message for >20%', () => {
    const insight = generateSummaryInsight(30);
    expect(insight).toContain('Strong growth');
  });

  it('should return steady message for 0-20%', () => {
    const insight = generateSummaryInsight(10);
    expect(insight).toContain('Steady');
  });

  it('should return slight dip for -10 to 0', () => {
    const insight = generateSummaryInsight(-5);
    expect(insight).toContain('Slight dip');
  });

  it('should return decline for < -10', () => {
    const insight = generateSummaryInsight(-20);
    expect(insight).toContain('declined');
  });
});

describe('Peak Day Insights', () => {
  it('should format peak day correctly', () => {
    const insight = generatePeakDayInsight('2025-01-15', 450.50);
    expect(insight).toContain('$450.50');
    expect(insight).toContain('Best day');
  });

  it('should return empty for no date', () => {
    const insight = generatePeakDayInsight('', 0);
    expect(insight).toBe('');
  });
});