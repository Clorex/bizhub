import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { requirePaidVendor } from '@/lib/auth/subscription-guard';
import { RevenueBreakdownService } from '@/services/analytics/revenue-breakdown.service';
import { AnalyticsApiResponse, RevenueBreakdownData } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/revenue-breakdown
 * 
 * Returns top 5 products by revenue with percentages.
 * 
 * Requires paid subscription.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<RevenueBreakdownData>>> {
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

    // Check subscription + feature access
    const { allowed, response } = await requirePaidVendor(vendor, 'revenue_breakdown');

    if (!allowed && response) {
      return response as NextResponse<AnalyticsApiResponse<RevenueBreakdownData>>;
    }

    // Get revenue breakdown
    const data = await RevenueBreakdownService.getRevenueBreakdown(vendor.id);

    return NextResponse.json(
      {
        success: true,
        data,
        error: null,
        cached: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Revenue breakdown API error:', error);
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