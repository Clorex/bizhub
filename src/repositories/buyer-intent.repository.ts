// FILE: src/repositories/buyer-intent.repository.ts
// Firestore-based buyer intent data access
// Collections:
//   buyerIntentEvents — raw events
//   productIntentScores — cached per-product scores
//   productHotFlags — active hot deal flags

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  IntentLevel,
  ProductIntentScore,
  ProductHotFlag,
} from "@/types/buyer-intent";

export class BuyerIntentRepository {
  // ===== RAW EVENTS =====

  /**
   * Get all intent events for a product within a time window.
   */
  static async getEventsByProduct(
    productId: string,
    sinceMs: number
  ) {
    try {
      const snap = await adminDb
        .collection("buyerIntentEvents")
        .where("product_id", "==", productId)
        .where("created_at", ">=", sinceMs)
        .orderBy("created_at", "desc")
        .limit(2000)
        .get();

      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (error) {
      console.error("BuyerIntentRepository.getEventsByProduct error:", error);
      return [];
    }
  }

  /**
   * Get all intent events for a business within a time window.
   */
  static async getEventsByBusiness(
    businessId: string,
    sinceMs: number
  ) {
    try {
      const snap = await adminDb
        .collection("buyerIntentEvents")
        .where("business_id", "==", businessId)
        .where("created_at", ">=", sinceMs)
        .orderBy("created_at", "desc")
        .limit(10000)
        .get();

      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (error) {
      console.error("BuyerIntentRepository.getEventsByBusiness error:", error);
      return [];
    }
  }

  // ===== CACHED SCORES =====

  /**
   * Upsert cached intent score for a product.
   */
  static async upsertScore(data: ProductIntentScore) {
    try {
      await adminDb
        .collection("productIntentScores")
        .doc(data.product_id)
        .set(
          {
            ...data,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (error) {
      console.error("BuyerIntentRepository.upsertScore error:", error);
    }
  }

  /**
   * Get cached intent score for a product.
   */
  static async getScore(productId: string): Promise<ProductIntentScore | null> {
    try {
      const snap = await adminDb
        .collection("productIntentScores")
        .doc(productId)
        .get();

      if (!snap.exists) return null;
      return snap.data() as ProductIntentScore;
    } catch (error) {
      console.error("BuyerIntentRepository.getScore error:", error);
      return null;
    }
  }

  /**
   * Get all scores for a business.
   */
  static async getScoresByBusiness(businessId: string): Promise<ProductIntentScore[]> {
    try {
      const snap = await adminDb
        .collection("productIntentScores")
        .where("business_id", "==", businessId)
        .where("intent_score_total", ">", 0)
        .orderBy("intent_score_total", "desc")
        .limit(200)
        .get();

      return snap.docs.map((d) => d.data() as ProductIntentScore);
    } catch (error) {
      console.error("BuyerIntentRepository.getScoresByBusiness error:", error);
      return [];
    }
  }

  // ===== HOT FLAGS =====

  /**
   * Create a hot deal flag.
   */
  static async createHotFlag(data: Omit<ProductHotFlag, "id">) {
    try {
      const id = adminDb.collection("productHotFlags").doc().id;
      const flag: ProductHotFlag = { id, ...data };
      await adminDb.collection("productHotFlags").doc(id).set(flag);
      return flag;
    } catch (error) {
      console.error("BuyerIntentRepository.createHotFlag error:", error);
      return null;
    }
  }

  /**
   * Get active (non-expired) hot flags for a business.
   */
  static async getActiveHotFlags(businessId: string): Promise<ProductHotFlag[]> {
    try {
      const nowMs = Date.now();
      const snap = await adminDb
        .collection("productHotFlags")
        .where("business_id", "==", businessId)
        .where("expires_at", ">", nowMs)
        .orderBy("expires_at", "desc")
        .limit(100)
        .get();

      return snap.docs.map((d) => d.data() as ProductHotFlag);
    } catch (error) {
      console.error("BuyerIntentRepository.getActiveHotFlags error:", error);
      return [];
    }
  }

  /**
   * Get active hot flags for a specific product.
   */
  static async getActiveHotFlagsByProduct(productId: string): Promise<ProductHotFlag[]> {
    try {
      const nowMs = Date.now();
      const snap = await adminDb
        .collection("productHotFlags")
        .where("product_id", "==", productId)
        .where("expires_at", ">", nowMs)
        .orderBy("expires_at", "desc")
        .limit(10)
        .get();

      return snap.docs.map((d) => d.data() as ProductHotFlag);
    } catch (error) {
      console.error("BuyerIntentRepository.getActiveHotFlagsByProduct error:", error);
      return [];
    }
  }

  /**
   * Check if a hot flag was created recently for a product (cooldown).
   */
  static async hasRecentHotFlag(
    productId: string,
    cooldownHours: number
  ): Promise<boolean> {
    try {
      const cutoffMs = Date.now() - cooldownHours * 60 * 60 * 1000;
      const snap = await adminDb
        .collection("productHotFlags")
        .where("product_id", "==", productId)
        .where("created_at", ">=", cutoffMs)
        .limit(1)
        .get();

      return !snap.empty;
    } catch (error) {
      console.error("BuyerIntentRepository.hasRecentHotFlag error:", error);
      return true;
    }
  }

  /**
   * Clean up expired flags and old events.
   */
  static async cleanup(olderThanDays: number = 7): Promise<number> {
    let deleted = 0;
    try {
      const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

      // Delete old events
      const evSnap = await adminDb
        .collection("buyerIntentEvents")
        .where("created_at", "<", cutoffMs)
        .limit(500)
        .get();

      if (!evSnap.empty) {
        const batch = adminDb.batch();
        evSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += evSnap.size;
      }

      // Delete expired flags
      const nowMs = Date.now();
      const flagSnap = await adminDb
        .collection("productHotFlags")
        .where("expires_at", "<", nowMs - 7 * 24 * 60 * 60 * 1000)
        .limit(500)
        .get();

      if (!flagSnap.empty) {
        const batch = adminDb.batch();
        flagSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += flagSnap.size;
      }
    } catch (error) {
      console.error("BuyerIntentRepository.cleanup error:", error);
    }
    return deleted;
  }
}
