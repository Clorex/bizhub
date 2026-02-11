import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { requirePaidVendor } from '@/lib/auth/subscription-guard';
import { TopProductsService } from '@/services/analytics/top-products.service';
import { AnalyticsApiResponse, TopProductsData } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/top-products
 * 
 * Returns ranked list of top performing products.
 * Units sold, revenue, growth vs previous period.
 * 
 * Requires paid subscription (premium+).
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<TopProductsData>>> {
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
    const { allowed, response } = await requirePaidVendor(vendor, 'top_products');

    if (!allowed && response) {
      return response as NextResponse<AnalyticsApiResponse<TopProductsData>>;
    }

    // Get top products
    const data = await TopProductsService.getTopProducts(vendor.id);

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
    console.error('Top products API error:', error);
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