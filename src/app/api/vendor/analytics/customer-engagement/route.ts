import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { requirePaidVendor } from '@/lib/auth/subscription-guard';
import { CustomerEngagementService } from '@/services/analytics/customer-engagement.service';
import { AnalyticsApiResponse, EngagementData } from '@/types/analytics';

/**
 * GET /api/vendor/analytics/customer-engagement
 * 
 * Returns customer engagement metrics.
 * Saves, cart adds, shares with insight.
 * 
 * Requires paid subscription (premium+).
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsApiResponse<EngagementData>>> {
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
    const { allowed, response } = await requirePaidVendor(vendor, 'engagement');

    if (!allowed && response) {
      return response as NextResponse<AnalyticsApiResponse<EngagementData>>;
    }

    // Get engagement data
    const data = await CustomerEngagementService.getEngagementData(vendor.id);

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
    console.error('Customer engagement API error:', error);
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