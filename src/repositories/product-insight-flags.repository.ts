// FILE: src/repositories/product-insight-flags.repository.ts
// Firestore-based product insight flags storage
// Collection: productInsightFlags

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { RestockFlagType, RestockSeverity } from "@/types/restock";

const COLLECTION = "productInsightFlags";

function generateId(): string {
  return adminDb.collection(COLLECTION).doc().id;
}

export class ProductInsightFlagsRepository {
  /**
   * Create a new insight flag.
   */
  static async create(data: {
    product_id: string;
    business_id: string;
    flag_type: RestockFlagType;
    severity: RestockSeverity;
    message: string;
    metadata?: any;
    expires_at?: Date;
  }) {
    try {
      const id = generateId();
      const now = new Date();
      const doc = {
        id,
        product_id: data.product_id,
        business_id: data.business_id,
        flag_type: data.flag_type,
        severity: data.severity,
        message: data.message,
        metadata: data.metadata ?? null,
        created_at: now,
        created_at_ms: now.getTime(),
        resolved_at: null,
        expires_at: data.expires_at ?? null,
        expires_at_ms: data.expires_at ? data.expires_at.getTime() : null,
      };

      await adminDb.collection(COLLECTION).doc(id).set(doc);
      return doc;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.create error:", error);
      return null;
    }
  }

  /**
   * Get all active (unresolved, non-expired) flags for a business.
   */
  static async getActiveByBusiness(businessId: string) {
    try {
      const now = Date.now();
      const snap = await adminDb
        .collection(COLLECTION)
        .where("business_id", "==", businessId)
        .where("resolved_at", "==", null)
        .orderBy("created_at_ms", "desc")
        .limit(200)
        .get();

      return snap.docs
        .map((d) => {
          const data = d.data() as any;
          // Filter out expired in memory
          if (data.expires_at_ms && data.expires_at_ms <= now) return null;
          return {
            id: d.id,
            product_id: String(data.product_id || ""),
            business_id: String(data.business_id || ""),
            flag_type: String(data.flag_type || ""),
            severity: String(data.severity || "info"),
            message: String(data.message || ""),
            metadata: data.metadata || null,
            created_at: data.created_at?.toDate?.() || new Date(data.created_at_ms || 0),
            resolved_at: null,
            expires_at: data.expires_at?.toDate?.() || (data.expires_at_ms ? new Date(data.expires_at_ms) : null),
          };
        })
        .filter(Boolean) as any[];
    } catch (error) {
      console.error("ProductInsightFlagsRepository.getActiveByBusiness error:", error);
      return [];
    }
  }

  /**
   * Get active flags for a specific product.
   */
  static async getActiveByProduct(productId: string) {
    try {
      const now = Date.now();
      const snap = await adminDb
        .collection(COLLECTION)
        .where("product_id", "==", productId)
        .where("resolved_at", "==", null)
        .orderBy("created_at_ms", "desc")
        .limit(50)
        .get();

      return snap.docs
        .map((d) => {
          const data = d.data() as any;
          if (data.expires_at_ms && data.expires_at_ms <= now) return null;
          return {
            id: d.id,
            product_id: String(data.product_id || ""),
            business_id: String(data.business_id || ""),
            flag_type: String(data.flag_type || ""),
            severity: String(data.severity || "info"),
            message: String(data.message || ""),
            metadata: data.metadata || null,
            created_at: data.created_at?.toDate?.() || new Date(data.created_at_ms || 0),
            resolved_at: null,
            expires_at: data.expires_at?.toDate?.() || (data.expires_at_ms ? new Date(data.expires_at_ms) : null),
          };
        })
        .filter(Boolean) as any[];
    } catch (error) {
      console.error("ProductInsightFlagsRepository.getActiveByProduct error:", error);
      return [];
    }
  }

  /**
   * Check if a flag of the same type was created recently (cooldown check).
   */
  static async hasRecentFlag(
    productId: string,
    flagType: RestockFlagType,
    cooldownHours: number
  ): Promise<boolean> {
    try {
      const cutoffMs = Date.now() - cooldownHours * 60 * 60 * 1000;
      const snap = await adminDb
        .collection(COLLECTION)
        .where("product_id", "==", productId)
        .where("flag_type", "==", flagType)
        .where("created_at_ms", ">=", cutoffMs)
        .limit(1)
        .get();

      return !snap.empty;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.hasRecentFlag error:", error);
      return true; // Assume recent to avoid spam on error
    }
  }

  /**
   * Resolve (dismiss) a flag.
   */
  static async resolve(flagId: string) {
    try {
      const now = new Date();
      await adminDb.collection(COLLECTION).doc(flagId).update({
        resolved_at: now,
        resolved_at_ms: now.getTime(),
      });
      return true;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.resolve error:", error);
      return null;
    }
  }

  /**
   * Resolve all flags of a type for a product.
   */
  static async resolveByProductAndType(
    productId: string,
    flagType: RestockFlagType
  ) {
    try {
      const snap = await adminDb
        .collection(COLLECTION)
        .where("product_id", "==", productId)
        .where("flag_type", "==", flagType)
        .where("resolved_at", "==", null)
        .limit(50)
        .get();

      if (snap.empty) return null;

      const now = new Date();
      const batch = adminDb.batch();
      snap.docs.forEach((d) =>
        batch.update(d.ref, {
          resolved_at: now,
          resolved_at_ms: now.getTime(),
        })
      );
      await batch.commit();
      return { count: snap.size };
    } catch (error) {
      console.error("ProductInsightFlagsRepository.resolveByProductAndType error:", error);
      return null;
    }
  }

  /**
   * Bulk resolve all expired flags.
   */
  static async resolveExpired(): Promise<number> {
    try {
      const nowMs = Date.now();
      const now = new Date();
      const snap = await adminDb
        .collection(COLLECTION)
        .where("resolved_at", "==", null)
        .where("expires_at_ms", "<=", nowMs)
        .limit(500)
        .get();

      if (snap.empty) return 0;

      const batch = adminDb.batch();
      snap.docs.forEach((d) =>
        batch.update(d.ref, {
          resolved_at: now,
          resolved_at_ms: nowMs,
        })
      );
      await batch.commit();
      return snap.size;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.resolveExpired error:", error);
      return 0;
    }
  }

  /**
   * Count active flags by business.
   */
  static async countActiveByBusiness(businessId: string): Promise<number> {
    try {
      const flags = await this.getActiveByBusiness(businessId);
      return flags.length;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.countActiveByBusiness error:", error);
      return 0;
    }
  }

  /**
   * Delete old resolved flags (cleanup, e.g. > 30 days).
   */
  static async deleteOldResolved(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const snap = await adminDb
        .collection(COLLECTION)
        .where("resolved_at_ms", "<=", cutoffMs)
        .limit(500)
        .get();

      if (snap.empty) return 0;

      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
    } catch (error) {
      console.error("ProductInsightFlagsRepository.deleteOldResolved error:", error);
      return 0;
    }
  }
}
