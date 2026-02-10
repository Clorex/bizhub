// FILE: src/app/api/admin/smartmatch/compute/route.ts


import { requireRole } from "@/lib/auth/server";
import {
  computeAndStoreVendorProfile,
  computeAllVendorProfiles,
} from "@/lib/smartmatch/profileServer";
import { isSmartMatchEnabledServer } from "@/lib/smartmatch/featureFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/smartmatch/compute
 *
 * Admin-only endpoint to compute vendor reliability profiles.
 *
 * Body:
 *   { businessId?: string }
 *
 * If businessId is provided, computes for that single vendor.
 * If omitted, computes for ALL vendors (bulk).
 */
export async function POST(req: Request) {
  try {
    // Admin-only
    const me = await requireRole(req, "admin");
    if (!me) {
      return Response.json(
        { ok: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    if (!isSmartMatchEnabledServer()) {
      return Response.json(
        {
          ok: false,
          error: "SmartMatch is disabled. Set NEXT_PUBLIC_SMARTMATCH_ENABLED=true to enable.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body?.businessId === "string"
      ? body.businessId.trim()
      : null;

    // Single vendor compute
    if (businessId) {
      const profile = await computeAndStoreVendorProfile(businessId);

      return Response.json({
        ok: true,
        mode: "single",
        businessId,
        profile,
      });
    }

    // Bulk compute all vendors
    const result = await computeAllVendorProfiles();

    return Response.json({
      ok: true,
      mode: "bulk",
      computed: result.computed,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (e: any) {
    console.error("[POST /api/admin/smartmatch/compute]", e?.message);
    return Response.json(
      { ok: false, error: e?.message || "Failed to compute profiles" },
      { status: 500 }
    );
  }
}