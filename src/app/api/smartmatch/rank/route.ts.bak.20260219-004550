// FILE: src/app/api/smartmatch/rank/route.ts


import { isSmartMatchEnabledServer } from "@/lib/smartmatch/featureFlag";
import { getSmartMatchConfig } from "@/lib/smartmatch/configServer";
import { getCachedVendorProfiles } from "@/lib/smartmatch/profileServer";
import { buildBuyerIntent } from "@/lib/smartmatch/buyerIntent";
import { buildProductMatchResult } from "@/lib/smartmatch/score";
import { DEFAULT_MARKET_FILTERS } from "@/lib/market/filters/types";
import type { ProductMatchResult } from "@/lib/smartmatch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/smartmatch/rank
 *
 * Given a list of product stubs (id + businessId + categoryKeys),
 * returns match scores for each product relative to the buyer.
 *
 * This is a lightweight endpoint — vendor profiles are pre-cached
 * on business docs. It does NOT load full product data.
 *
 * Body:
 * {
 *   products: Array<{ id: string; businessId: string; categoryKeys?: string[] }>
 *   filters: MarketFilterState (optional — used to build buyer intent)
 *   orderHistory?: Array<{ businessId: string; paymentType?: string; categoryKeys?: string[] }>
 * }
 *
 * Returns:
 * {
 *   ok: boolean
 *   enabled: boolean
 *   scores: Record<productId, ProductMatchResult>
 * }
 */
export async function POST(req: Request) {
  try {
    if (!isSmartMatchEnabledServer()) {
      return Response.json({ ok: true, enabled: false, scores: {} });
    }

    const config = await getSmartMatchConfig();
    if (!config.enabled) {
      return Response.json({ ok: true, enabled: false, scores: {} });
    }

    const body = await req.json().catch(() => ({}));

    const productStubs: Array<{
      id: string;
      businessId: string;
      categoryKeys?: string[];
    }> = Array.isArray(body?.products) ? body.products.slice(0, 200) : [];

    if (productStubs.length === 0) {
      return Response.json({ ok: true, enabled: true, scores: {} });
    }

    // Build buyer intent
    const filters = body?.filters || DEFAULT_MARKET_FILTERS;
    const orderHistory = Array.isArray(body?.orderHistory)
      ? body.orderHistory.slice(0, 100)
      : [];

    const buyer = buildBuyerIntent({ filters, orderHistory });

    // Collect unique business IDs
    const businessIds = [
      ...new Set(
        productStubs
          .map((p) => String(p.businessId || ""))
          .filter(Boolean)
      ),
    ];

    // Load cached vendor profiles in batch
    const profileMap = await getCachedVendorProfiles(businessIds);

    // Compute scores
    const scores: Record<string, ProductMatchResult> = {};

    for (const stub of productStubs) {
      const productId = String(stub.id || "");
      const businessId = String(stub.businessId || "");

      if (!productId || !businessId) continue;

      const vendor = profileMap.get(businessId);
      if (!vendor) {
        // No profile cached — skip (will show without match badge)
        continue;
      }

      // Check if vendor has premium subscription
      // (We stored this info on the profile already via supportsCard etc.
      //  For premium check, we need subscription data.
      //  Since profile is computed from business doc, we can check the
      //  business doc's subscription field. For Phase 1, we'll consider
      //  any vendor with a non-FREE plan as "premium".)
      const isPremium =
        vendor.supportsCard || vendor.supportsBankTransfer || vendor.supportsChat;

      const result = buildProductMatchResult({
        productId,
        businessId,
        buyer,
        vendor,
        weights: config.weights,
        productCategories: stub.categoryKeys,
        isPremium,
        premiumBonus: config.premiumBonus,
        premiumMinScore: config.premiumMinScore,
      });

      scores[productId] = result;
    }

    return Response.json({
      ok: true,
      enabled: true,
      scores,
    });
  } catch (e: any) {
    console.error("[POST /api/smartmatch/rank]", e?.message);
    // Graceful degradation — return empty scores, don't break the market
    return Response.json({
      ok: true,
      enabled: false,
      scores: {},
      _error: e?.message,
    });
  }
}