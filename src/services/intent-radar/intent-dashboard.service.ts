// FILE: src/services/intent-radar/intent-dashboard.service.ts
// Reads cached intent scores and hot flags for dashboard UI.

import { adminDb } from "@/lib/firebase/admin";
import { BuyerIntentRepository } from "@/repositories/buyer-intent.repository";
import type {
  IntentRadarDashboardData,
  ProductIntentSummary,
  ProductIntentDetail,
  SignalBreakdown,
  IntentLevel,
  INTENT_WEIGHTS,
} from "@/types/buyer-intent";
import { INTENT_THRESHOLDS } from "@/types/buyer-intent";

export class IntentDashboardService {
  /**
   * Get dashboard overview.
   */
  static async getDashboard(businessId: string): Promise<IntentRadarDashboardData> {
    const flags = await BuyerIntentRepository.getActiveHotFlags(businessId);

    if (flags.length === 0) {
      // Check if there are any scores at all
      const scores = await BuyerIntentRepository.getScoresByBusiness(businessId);
      const lastComputed = scores.length > 0
        ? Math.max(...scores.map((s) => s.last_computed_at || 0))
        : null;

      return {
        hot_products: [],
        strong_products: [],
        total_hot_flags: 0,
        total_strong_flags: 0,
        last_computed_at: lastComputed ? new Date(lastComputed).toISOString() : null,
      };
    }

    // Get product info for flagged products
    const productIds = [...new Set(flags.map((f) => f.product_id))];
    const productInfo = new Map<string, { name: string; image: string }>();

    for (const pid of productIds) {
      try {
        const snap = await adminDb.collection("products").doc(pid).get();
        if (snap.exists) {
          const data = snap.data() as any;
          productInfo.set(pid, {
            name: String(data.name || "Unnamed"),
            image: Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : "",
          });
        }
      } catch {}
    }

    // Build summaries
    const hot: ProductIntentSummary[] = [];
    const strong: ProductIntentSummary[] = [];

    // Group flags by product, take the highest level
    const productFlags = new Map<string, typeof flags>();
    for (const flag of flags) {
      const existing = productFlags.get(flag.product_id) || [];
      existing.push(flag);
      productFlags.set(flag.product_id, existing);
    }

    for (const [productId, pflags] of productFlags) {
      const info = productInfo.get(productId) || { name: "Unknown", image: "" };
      const topFlag = pflags.sort((a, b) => {
        const order: Record<IntentLevel, number> = { hot: 3, strong: 2, warm: 1 };
        return (order[b.flag_level] || 0) - (order[a.flag_level] || 0);
      })[0];

      const meta = topFlag.metadata || {};

      const summary: ProductIntentSummary = {
        product_id: productId,
        product_name: meta.product_name || info.name,
        product_image: info.image,
        flag_level: topFlag.flag_level,
        message: topFlag.message,
        suggested_action: topFlag.suggested_action,
        intent_score: meta.intent_score || 0,
        strong_count: meta.strong_count || 0,
        hot_count: meta.hot_count || 0,
        unique_interested: meta.unique_interested || 0,
        created_at: new Date(topFlag.created_at).toISOString(),
      };

      if (topFlag.flag_level === "hot") hot.push(summary);
      else strong.push(summary);
    }

    // Sort by score descending
    hot.sort((a, b) => b.intent_score - a.intent_score);
    strong.sort((a, b) => b.intent_score - a.intent_score);

    const lastComputed = flags.length > 0
      ? Math.max(...flags.map((f) => f.created_at || 0))
      : null;

    return {
      hot_products: hot,
      strong_products: strong,
      total_hot_flags: hot.length,
      total_strong_flags: strong.length,
      last_computed_at: lastComputed ? new Date(lastComputed).toISOString() : null,
    };
  }

  /**
   * Get detailed intent info for a product.
   */
  static async getProductDetail(
    productId: string,
    businessId: string
  ): Promise<ProductIntentDetail | null> {
    // Verify product belongs to business
    const prodSnap = await adminDb.collection("products").doc(productId).get();
    if (!prodSnap.exists) return null;
    const prodData = prodSnap.data() as any;
    if (prodData.businessId !== businessId) return null;

    // Get cached score
    const score = await BuyerIntentRepository.getScore(productId);

    // Get active flags
    const flags = await BuyerIntentRepository.getActiveHotFlagsByProduct(productId);
    const topFlag = flags.length > 0
      ? flags.sort((a, b) => {
          const order: Record<IntentLevel, number> = { hot: 3, strong: 2, warm: 1 };
          return (order[b.flag_level] || 0) - (order[a.flag_level] || 0);
        })[0]
      : null;

    // Get raw events for signal breakdown (last 48h)
    const window48h = Date.now() - 48 * 60 * 60 * 1000;
    const events = await BuyerIntentRepository.getEventsByProduct(productId, window48h);

    // Build signal breakdown
    const breakdown: SignalBreakdown = {
      views: 0,
      repeat_views: 0,
      time_minutes: 0,
      add_to_carts: 0,
      saves: 0,
      contact_clicks: 0,
      checkout_starts: 0,
    };

    // Count views per user for repeat detection
    const userViewCounts = new Map<string, number>();
    let totalDuration = 0;

    for (const ev of events) {
      const t = String(ev.event_type || "");
      const anonId = String(ev.anonymous_id || "");

      switch (t) {
        case "product_view":
          breakdown.views++;
          userViewCounts.set(anonId, (userViewCounts.get(anonId) || 0) + 1);
          break;
        case "time_spent":
          totalDuration += Number(ev.duration_seconds || 0);
          break;
        case "add_to_cart":
          breakdown.add_to_carts++;
          break;
        case "save":
          breakdown.saves++;
          break;
        case "contact_click":
          breakdown.contact_clicks++;
          break;
        case "checkout_start":
          breakdown.checkout_starts++;
          break;
      }
    }

    breakdown.repeat_views = Array.from(userViewCounts.values()).filter((c) => c > 1).length;
    breakdown.time_minutes = Math.round((totalDuration / 60) * 10) / 10;

    return {
      product_id: productId,
      product_name: String(prodData.name || "Unnamed"),
      product_image: Array.isArray(prodData.images) ? prodData.images[0] : undefined,
      intent_score_total: score?.intent_score_total || 0,
      warm_count: score?.warm_count || 0,
      strong_count: score?.strong_count || 0,
      hot_count: score?.hot_count || 0,
      unique_users: score?.unique_users || 0,
      flag_level: topFlag?.flag_level || null,
      suggested_action: topFlag?.suggested_action || null,
      signal_breakdown: breakdown,
      flags,
    };
  }
}
