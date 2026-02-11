import { NextRequest, NextResponse } from 'next/server';
import { getVendorFromRequest } from '@/lib/auth/vendor-guard';
import { SubscriptionService } from '@/services/subscription/subscription.service';
import cache from '@/lib/redis';

/**
 * POST /api/vendor/subscription/upgrade
 * 
 * Upgrade vendor subscription tier.
 * 
 * Body: { tier: "basic" | "premium" | "pro" }
 * 
 * In production, this would integrate with Stripe/payment processor.
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    let body: { tier?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: 'Invalid request body. Expected JSON with { tier: string }',
        },
        { status: 400 }
      );
    }

    const { tier } = body;

    if (!tier) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: 'Missing required field: tier',
        },
        { status: 400 }
      );
    }

    // Validate tier value
    const validTiers = ['basic', 'premium', 'pro'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: `Invalid tier. Must be one of: ${validTiers.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Process upgrade
    const result = await SubscriptionService.upgradeSubscription(
      vendor.id,
      tier
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: result.message,
        },
        { status: 400 }
      );
    }

    // Invalidate analytics cache for this vendor
    await cache.invalidatePattern(`analytics:${vendor.id}:*`);

    // Get updated status
    const updatedStatus = await SubscriptionService.getSubscriptionStatus(
      vendor.id
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          message: result.message,
          status: updatedStatus,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Subscription upgrade API error:', error);
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