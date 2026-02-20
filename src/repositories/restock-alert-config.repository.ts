// FILE: src/repositories/restock-alert-config.repository.ts
// Firestore-based restock alert config
// Stored as: businesses/{businessId} -> field: restockConfig

import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_RESTOCK_CONFIG, type RestockAlertConfig } from "@/types/restock";

export class RestockAlertConfigRepository {
  /**
   * Get config for a business, returning defaults if none exists.
   */
  static async getByBusiness(businessId: string): Promise<RestockAlertConfig> {
    try {
      const snap = await adminDb.collection("businesses").doc(businessId).get();
      if (!snap.exists) return { ...DEFAULT_RESTOCK_CONFIG };

      const biz = snap.data() as any;
      const cfg = biz?.restockConfig;
      if (!cfg || typeof cfg !== "object") return { ...DEFAULT_RESTOCK_CONFIG };

      return {
        enabled: typeof cfg.enabled === "boolean" ? cfg.enabled : DEFAULT_RESTOCK_CONFIG.enabled,
        growth_threshold_pct: Number(cfg.growth_threshold_pct) || DEFAULT_RESTOCK_CONFIG.growth_threshold_pct,
        spike_threshold_pct: Number(cfg.spike_threshold_pct) || DEFAULT_RESTOCK_CONFIG.spike_threshold_pct,
        stockout_warn_days: Number(cfg.stockout_warn_days) || DEFAULT_RESTOCK_CONFIG.stockout_warn_days,
        stockout_urgent_days: Number(cfg.stockout_urgent_days) || DEFAULT_RESTOCK_CONFIG.stockout_urgent_days,
        alert_cooldown_hours: Number(cfg.alert_cooldown_hours) || DEFAULT_RESTOCK_CONFIG.alert_cooldown_hours,
        email_alerts_enabled: typeof cfg.email_alerts_enabled === "boolean" ? cfg.email_alerts_enabled : DEFAULT_RESTOCK_CONFIG.email_alerts_enabled,
      };
    } catch (error) {
      console.error("RestockAlertConfigRepository.getByBusiness error:", error);
      return { ...DEFAULT_RESTOCK_CONFIG };
    }
  }

  /**
   * Upsert config for a business.
   */
  static async upsert(
    businessId: string,
    data: Partial<RestockAlertConfig>
  ) {
    try {
      const current = await this.getByBusiness(businessId);
      const merged: RestockAlertConfig = {
        ...current,
        ...data,
      };

      await adminDb.collection("businesses").doc(businessId).set(
        { restockConfig: merged, restockConfigUpdatedAt: Date.now() },
        { merge: true }
      );

      return merged;
    } catch (error) {
      console.error("RestockAlertConfigRepository.upsert error:", error);
      return null;
    }
  }
}
