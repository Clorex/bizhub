import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { requirePaidVendor } from '@/lib/auth/subscription-guard';
import { SalesGrowthService } from '@/services/analytics/sales-growth.service';
import { AnalyticsApiResponse, SalesGrowthData } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/sales-growth
 * 
 * Returns full sales growth data.
 * Daily sales for last 30 days, growth %, peak day, insight.
 * 
 * Requires paid subscription.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<SalesGrowthData>>> {
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
    const { allowed, response } = await requirePaidVendor(vendor, 'sales_growth');

    if (!allowed && response) {
      return response as NextResponse<AnalyticsApiResponse<SalesGrowthData>>;
    }

    // Get sales growth data
    const data = await SalesGrowthService.getSalesGrowth(vendor.id);

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
    console.error('Sales growth API error:', error);
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