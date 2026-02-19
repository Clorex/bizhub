// FILE: src/app/api/admin/smartmatch/config/route.ts


import { requireRole } from "@/lib/auth/server";
import {
  getSmartMatchConfig,
  saveSmartMatchConfig,
} from "@/lib/smartmatch/configServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/smartmatch/config
 * Returns the current SmartMatch config (weights, thresholds, etc.)
 */
export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const config = await getSmartMatchConfig();

    return Response.json({ ok: true, config });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/smartmatch/config
 * Update SmartMatch config (admin only).
 *
 * Body: Partial<SmartMatchConfig>
 * Only provided fields are merged.
 */
export async function POST(req: Request) {
  try {
    await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));

    // Validate weights if provided
    if (body.weights) {
      const w = body.weights;
      const total =
        Number(w.location || 0) +
        Number(w.delivery || 0) +
        Number(w.reliability || 0) +
        Number(w.paymentFit || 0) +
        Number(w.vendorQuality || 0) +
        Number(w.buyerHistory || 0);

      if (total > 150) {
        return Response.json(
          {
            ok: false,
            error: `Total weight (${total}) is too high. Keep it around 100 for balanced scoring.`,
          },
          { status: 400 }
        );
      }
    }

    // Build clean update
    const update: Record<string, any> = {};

    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    if (body.weights && typeof body.weights === "object") update.weights = body.weights;
    if (typeof body.hideThreshold === "number") update.hideThreshold = body.hideThreshold;
    if (typeof body.premiumBonus === "number") update.premiumBonus = body.premiumBonus;
    if (typeof body.premiumMinScore === "number") update.premiumMinScore = body.premiumMinScore;
    if (typeof body.profileCacheTtlMs === "number") update.profileCacheTtlMs = body.profileCacheTtlMs;
    if (typeof body.scoreCacheTtlMs === "number") update.scoreCacheTtlMs = body.scoreCacheTtlMs;

    if (Object.keys(update).length === 0) {
      return Response.json(
        { ok: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await saveSmartMatchConfig(update);

    const updated = await getSmartMatchConfig();

    return Response.json({ ok: true, config: updated });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}