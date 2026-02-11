import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { checkSubscriptionAccess } from '@/lib/auth/subscription-guard';
import { SalesGrowthService } from '@/services/analytics/sales-growth.service';
import { generateSummaryInsight } from '@/services/analytics/insight-generator';
import { AnalyticsApiResponse, AnalyticsSummary } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/summary
 * 
 * Returns the dashboard summary card data.
 * Sales growth %, mini 30-day chart, insight text.
 * 
 * Requires paid subscription.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<AnalyticsSummary>>> {
  try {
    // Authenticate vendor
    const { vendor, error: authError } = await getVendorFromRequest(request);

    if (!vendor || authError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: authError || 'Authentication required',
          cached: false,
        },
        { status: 401 }
      );
    }

    // Check subscription (MANDATORY backend enforcement)
    const { allowed, reason } = checkSubscriptionAccess(vendor);

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: reason || 'Subscription required',
          cached: false,
        },
        { status: 403 }
      );
    }

    // Get sales growth data
    const salesGrowth = await SalesGrowthService.getSalesGrowth(vendor.id);

    // Build summary
    const summary: AnalyticsSummary = {
      sales_growth_percentage: salesGrowth.growth_percentage,
      daily_sales: salesGrowth.daily_sales,
      insight: generateSummaryInsight(salesGrowth.growth_percentage),
    };

    return NextResponse.json(
      {
        success: true,
        data: summary,
        error: null,
        cached: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Analytics summary API error:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Internal server error',
        cached: false,
      },
      { status: 500 }
    );
  }
}