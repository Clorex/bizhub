import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { requirePaidVendor } from '@/lib/auth/subscription-guard';
import { ConversionService } from '@/services/analytics/conversion.service';
import { AnalyticsApiResponse, ConversionData } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/conversion
 * 
 * Returns conversion funnel data.
 * Views → Clicks → Purchases with conversion rate.
 * 
 * Requires paid subscription (premium+).
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<ConversionData>>> {
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
    const { allowed, response } = await requirePaidVendor(vendor, 'conversion');

    if (!allowed && response) {
      return response as NextResponse<AnalyticsApiResponse<ConversionData>>;
    }

    // Get conversion data
    const data = await ConversionService.getConversionData(vendor.id);

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
    console.error('Conversion API error:', error);
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