// FILE: src/services/intent-radar/intent-engine.service.ts
// Core computation engine for Buyer Intent Radar
// Runs via cron every few hours. Never on each request.

import { adminDb } from "@/lib/firebase/admin";
import { BuyerIntentRepository } from "@/repositories/buyer-intent.repository";
import { sendBusinessPush } from "@/lib/push/sendBusinessPush";
import {
  INTENT_WEIGHTS,
  INTENT_THRESHOLDS,
  HOT_DEAL_RULES,
  type IntentLevel,
  type ProductIntentScore,
} from "@/types/buyer-intent";

interface UserScore {
  anonymous_id: string;
  score: number;
  level: IntentLevel | null;
  signals: Record<string, number>;
}

export class IntentEngineService {
  /**
   * Process all Apex businesses.
   */
  static async processAllApexBusinesses(): Promise<{
    businessesProcessed: number;
    flagsCreated: number;
    errors: string[];
  }> {
    let businessesProcessed = 0;
    let flagsCreated = 0;
    const errors: string[] = [];

    try {
      const now = Date.now();
      const bizSnap = await adminDb
        .collection("businesses")
        .where("subscription.planKey", "==", "APEX")
        .limit(500)
        .get();

      const apexBusinesses = bizSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((b) => Number(b?.subscription?.expiresAtMs || 0) > now);

      console.log(`[IntentEngine] Found ${apexBusinesses.length} active Apex businesses`);

      for (const biz of apexBusinesses) {
        try {
          const result = await this.processOneBusiness(biz.id);
          businessesProcessed++;
          flagsCreated += result.flagsCreated;
        } catch (err: any) {
          const msg = `Business ${biz.id}: ${err?.message || err}`;
          console.error(`[IntentEngine] ${msg}`);
          errors.push(msg);
        }
      }

      // Cleanup old data
      await BuyerIntentRepository.cleanup(7);
    } catch (err: any) {
      errors.push(`Global: ${err?.message || err}`);
    }

    return { businessesProcessed, flagsCreated, errors };
  }

  /**
   * Process one business.
   */
  static async processOneBusiness(businessId: string): Promise<{
    productsProcessed: number;
    flagsCreated: number;
  }> {
    const window48h = Date.now() - 48 * 60 * 60 * 1000;

    // Get all events for this business in last 48h
    const events = await BuyerIntentRepository.getEventsByBusiness(
      businessId,
      window48h
    );

    if (events.length === 0) {
      return { productsProcessed: 0, flagsCreated: 0 };
    }

    // Group events by product
    const productEvents = new Map<string, typeof events>();
    for (const ev of events) {
      const pid = String(ev.product_id || "");
      if (!pid) continue;
      const existing = productEvents.get(pid) || [];
      existing.push(ev);
      productEvents.set(pid, existing);
    }

    let productsProcessed = 0;
    let flagsCreated = 0;

    for (const [productId, pevents] of productEvents) {
      try {
        const result = await this.processOneProduct(
          productId,
          businessId,
          pevents
        );
        productsProcessed++;
        if (result.flagCreated) flagsCreated++;
      } catch (err: any) {
        console.error(`[IntentEngine] Product ${productId}: ${err?.message}`);
      }
    }

    // Send push if new flags
    if (flagsCreated > 0) {
      try {
        await sendBusinessPush({
          businessId,
          title: "Hot Buyer Interest Detected!",
          body: `${flagsCreated} product${flagsCreated !== 1 ? "s have" : " has"} strong buyer interest right now.`,
          url: "/vendor/intent-radar",
        });
      } catch {
        // Push failure is non-fatal
      }
    }

    return { productsProcessed, flagsCreated };
  }

  /**
   * Process a single product: compute per-user scores, aggregate, flag.
   */
  static async processOneProduct(
    productId: string,
    businessId: string,
    events: any[]
  ): Promise<{ flagCreated: boolean }> {
    // Group events by anonymous user
    const userEvents = new Map<string, typeof events>();
    for (const ev of events) {
      const anonId = String(ev.anonymous_id || "unknown");
      const existing = userEvents.get(anonId) || [];
      existing.push(ev);
      userEvents.set(anonId, existing);
    }

    // Track view counts per user for repeat_view detection
    const userScores: UserScore[] = [];

    for (const [anonId, uevents] of userEvents) {
      const signals: Record<string, number> = {};
      let score = 0;

      // Count event types
      const typeCounts = new Map<string, number>();
      let totalDuration = 0;

      for (const ev of uevents) {
        const t = String(ev.event_type || "");
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
        if (t === "time_spent") {
          totalDuration += Number(ev.duration_seconds || 0);
        }
      }

      // Compute score
      const views = typeCounts.get("product_view") || 0;
      const repeatViews = Math.max(0, views - 1);
      const timeMinutes = totalDuration / 60;
      const addToCarts = typeCounts.get("add_to_cart") || 0;
      const saves = typeCounts.get("save") || 0;
      const contactClicks = typeCounts.get("contact_click") || 0;
      const checkoutStarts = typeCounts.get("checkout_start") || 0;
      const compares = typeCounts.get("compare") || 0;
      const storeRevisits = typeCounts.get("store_revisit") || 0;

      score += views * INTENT_WEIGHTS.product_view;
      score += repeatViews * INTENT_WEIGHTS.repeat_view;
      score += timeMinutes * INTENT_WEIGHTS.time_spent;
      score += addToCarts * INTENT_WEIGHTS.add_to_cart;
      score += saves * INTENT_WEIGHTS.save;
      score += contactClicks * INTENT_WEIGHTS.contact_click;
      score += checkoutStarts * INTENT_WEIGHTS.checkout_start;
      score += compares * INTENT_WEIGHTS.compare;
      score += storeRevisits * INTENT_WEIGHTS.store_revisit;

      score = Math.round(score);

      signals.views = views;
      signals.repeat_views = repeatViews;
      signals.time_minutes = Math.round(timeMinutes * 10) / 10;
      signals.add_to_carts = addToCarts;
      signals.saves = saves;
      signals.contact_clicks = contactClicks;
      signals.checkout_starts = checkoutStarts;

      let level: IntentLevel | null = null;
      if (score >= INTENT_THRESHOLDS.HOT) level = "hot";
      else if (score >= INTENT_THRESHOLDS.STRONG) level = "strong";
      else if (score >= INTENT_THRESHOLDS.WARM) level = "warm";

      userScores.push({ anonymous_id: anonId, score, level, signals });
    }

    // Aggregate
    const warmCount = userScores.filter((u) => u.level === "warm").length;
    const strongCount = userScores.filter((u) => u.level === "strong").length;
    const hotCount = userScores.filter((u) => u.level === "hot").length;
    const totalScore = userScores.reduce((s, u) => s + u.score, 0);

    // Save cached score
    const scoreData: ProductIntentScore = {
      product_id: productId,
      business_id: businessId,
      intent_score_total: totalScore,
      warm_count: warmCount,
      strong_count: strongCount,
      hot_count: hotCount,
      unique_users: userScores.length,
      last_computed_at: Date.now(),
    };

    await BuyerIntentRepository.upsertScore(scoreData);

    // Determine if we should create a hot flag
    let flagCreated = false;
    const isHotDeal =
      hotCount >= HOT_DEAL_RULES.HOT_USERS_FOR_FLAG ||
      strongCount >= HOT_DEAL_RULES.STRONG_USERS_IN_48H;

    const isStrongDeal =
      !isHotDeal && strongCount >= 1;

    if (isHotDeal || isStrongDeal) {
      // Check cooldown
      const hasRecent = await BuyerIntentRepository.hasRecentHotFlag(
        productId,
        HOT_DEAL_RULES.ALERT_COOLDOWN_HOURS
      );

      if (!hasRecent) {
        const flagLevel: IntentLevel = isHotDeal ? "hot" : "strong";
        const topSignals = this.getTopSignals(userScores);

        // Get product name
        let productName = "Product";
        try {
          const pSnap = await adminDb.collection("products").doc(productId).get();
          if (pSnap.exists) productName = String((pSnap.data() as any)?.name || "Product");
        } catch {}

        await BuyerIntentRepository.createHotFlag({
          product_id: productId,
          business_id: businessId,
          flag_level: flagLevel,
          message: isHotDeal
            ? "High buyer attention detected — multiple buyers showing strong purchase intent."
            : "Repeat views and engagement rising — buyers are seriously interested.",
          suggested_action: isHotDeal
            ? "Consider running a promo, ensure stock is ready, and respond quickly to messages."
            : "Update stock levels and check product details are complete.",
          metadata: {
            product_name: productName,
            intent_score: totalScore,
            strong_count: strongCount,
            hot_count: hotCount,
            unique_interested: userScores.filter((u) => u.level).length,
            top_signals: topSignals,
          },
          created_at: Date.now(),
          expires_at: Date.now() + HOT_DEAL_RULES.FLAG_EXPIRY_HOURS * 60 * 60 * 1000,
        });

        flagCreated = true;
      }
    }

    return { flagCreated };
  }

  /**
   * Summarize top signals across all interested users.
   */
  private static getTopSignals(userScores: UserScore[]): string[] {
    const signals: string[] = [];
    const interested = userScores.filter((u) => u.level);

    const totalCarts = interested.reduce((s, u) => s + (u.signals.add_to_carts || 0), 0);
    const totalSaves = interested.reduce((s, u) => s + (u.signals.saves || 0), 0);
    const totalContacts = interested.reduce((s, u) => s + (u.signals.contact_clicks || 0), 0);
    const totalCheckouts = interested.reduce((s, u) => s + (u.signals.checkout_starts || 0), 0);
    const totalRepeats = interested.reduce((s, u) => s + (u.signals.repeat_views || 0), 0);

    if (totalCheckouts > 0) signals.push(`${totalCheckouts} checkout start${totalCheckouts !== 1 ? "s" : ""}`);
    if (totalContacts > 0) signals.push(`${totalContacts} contact click${totalContacts !== 1 ? "s" : ""}`);
    if (totalCarts > 0) signals.push(`${totalCarts} cart add${totalCarts !== 1 ? "s" : ""}`);
    if (totalSaves > 0) signals.push(`${totalSaves} save${totalSaves !== 1 ? "s" : ""}`);
    if (totalRepeats > 0) signals.push(`${totalRepeats} repeat view${totalRepeats !== 1 ? "s" : ""}`);

    return signals.slice(0, 4);
  }
}
