import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { SubscriptionService } from '@/services/subscription/subscription.service';

/**
 * GET /api/vendor/subscription/status
 * 
 * Returns vendor subscription status.
 * No subscription required to check status.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate vendor
    const { vendor, error: authError } = await getVendorFromRequest(request);

    if (!vendor || authError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: authError || 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Get subscription status
    const status = await SubscriptionService.getSubscriptionStatus(vendor.id);

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: 'Could not retrieve subscription status',
        },
        { status: 500 }
      );
    }

    // Check for expiry warning
    const expiryWarning = await SubscriptionService.getExpiryWarning(vendor.id);

    // Get upgrade options
    const upgradeOptions = SubscriptionService.getUpgradeOptions(
      vendor.subscription_tier
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          status,
          expiry_warning: expiryWarning,
          upgrade_options: upgradeOptions,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Subscription status API error:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}