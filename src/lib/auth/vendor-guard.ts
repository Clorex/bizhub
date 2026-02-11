import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Vendor, VendorSession } from '@/types/vendor';

/**
 * Extract vendor ID from request.
 * 
 * In production, this should come from your auth system
 * (NextAuth session, JWT token, cookie, etc.)
 * 
 * For development, we support:
 * 1. Authorization header: Bearer <vendor_id>
 * 2. Query param: ?vendor_id=xxx
 * 3. Cookie: vendor_id=xxx
 */
export async function getVendorFromRequest(
  request: NextRequest
): Promise<{ vendor: Vendor | null; error: string | null }> {
  try {
    // Method 1: Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const vendorId = authHeader.substring(7);
      const vendor = await getVendorById(vendorId);
      if (vendor) return { vendor, error: null };
    }

    // Method 2: Query parameter
    const url = new URL(request.url);
    const vendorIdParam = url.searchParams.get('vendor_id');
    if (vendorIdParam) {
      const vendor = await getVendorById(vendorIdParam);
      if (vendor) return { vendor, error: null };
    }

    // Method 3: Cookie
    const vendorIdCookie = request.cookies.get('vendor_id')?.value;
    if (vendorIdCookie) {
      const vendor = await getVendorById(vendorIdCookie);
      if (vendor) return { vendor, error: null };
    }

    return { vendor: null, error: 'No vendor authentication found' };
  } catch (error) {
    console.error('Vendor guard error:', error);
    return { vendor: null, error: 'Authentication failed' };
  }
}

/**
 * Fetch vendor from database by ID.
 */
async function getVendorById(vendorId: string): Promise<Vendor | null> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) return null;

    return {
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      store_name: vendor.store_name,
      is_paid: vendor.is_paid,
      subscription_tier: vendor.subscription_tier as Vendor['subscription_tier'],
      subscription_expiry: vendor.subscription_expiry ?? new Date(0),
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
    };
  } catch (error) {
    console.error('Get vendor error:', error);
    return null;
  }
}

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
      cached: false,
    },
    { status: 401 }
  );
}

/**
 * Create a vendor session object from a vendor.
 */
export function createVendorSession(vendor: Vendor): VendorSession {
  return {
    vendor_id: vendor.id,
    email: vendor.email,
    store_name: vendor.store_name,
    is_paid: vendor.is_paid,
    subscription_tier: vendor.subscription_tier,
    subscription_expiry: vendor.subscription_expiry.toISOString(),
  };
}