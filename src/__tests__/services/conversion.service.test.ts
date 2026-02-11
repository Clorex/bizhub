import { BASE_URL } from '../setup';
import { generateConversionInsight } from '@/services/analytics/insight-generator';

describe('Conversion Insights', () => {
  it('should return good conversion message for >50%', () => {
    const insight = generateConversionInsight(55);
    expect(insight).toBe('Your product pages convert very well.');
  });

  it('should return average message for 20-50%', () => {
    const insight = generateConversionInsight(35);
    expect(insight).toBe('Your conversion rate is average.');
  });

  it('should return improvement message for <20%', () => {
    const insight = generateConversionInsight(10);
    expect(insight).toBe('Improve product photos or descriptions.');
  });

  it('should handle exactly 50%', () => {
    const insight = generateConversionInsight(50);
    expect(insight).toBe('Your conversion rate is average.');
  });

  it('should handle exactly 20%', () => {
    const insight = generateConversionInsight(20);
    expect(insight).toBe('Your conversion rate is average.');
  });

  it('should handle 0%', () => {
    const insight = generateConversionInsight(0);
    expect(insight).toBe('Improve product photos or descriptions.');
  });
});