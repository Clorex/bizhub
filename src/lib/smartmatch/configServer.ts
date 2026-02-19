// FILE: src/lib/smartmatch/configServer.ts
import { adminDb } from "@/lib/firebase/admin";
import type { SmartMatchConfig, SmartMatchWeights } from "./types";
import { DEFAULT_CONFIG } from "./config";

const CONFIG_DOC_PATH = "config/smartmatch";

let cachedConfig: SmartMatchConfig | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeWeights(w: SmartMatchWeights): SmartMatchWeights {
  const sum =
    w.categoryMatch +
    w.locationProximity +
    w.reliabilityScore +
    w.activityScore +
    w.customerRatingScore;

  // enforce sum=100 by proportion if admin mis-configures
  if (!sum || sum === 100) return w;

  return {
    categoryMatch: Math.round((w.categoryMatch / sum) * 100),
    locationProximity: Math.round((w.locationProximity / sum) * 100),
    reliabilityScore: Math.round((w.reliabilityScore / sum) * 100),
    activityScore: Math.round((w.activityScore / sum) * 100),
    customerRatingScore: Math.round((w.customerRatingScore / sum) * 100),
  };
}

function readWeights(data: any): SmartMatchWeights {
  const dw = DEFAULT_CONFIG.weights;

  // New-format weights
  if (data?.weights?.categoryMatch != null) {
    return normalizeWeights({
      categoryMatch: clampInt(data?.weights?.categoryMatch, 0, 100, dw.categoryMatch),
      locationProximity: clampInt(data?.weights?.locationProximity, 0, 100, dw.locationProximity),
      reliabilityScore: clampInt(data?.weights?.reliabilityScore, 0, 100, dw.reliabilityScore),
      activityScore: clampInt(data?.weights?.activityScore, 0, 100, dw.activityScore),
      customerRatingScore: clampInt(
        data?.weights?.customerRatingScore,
        0,
        100,
        dw.customerRatingScore
      ),
    });
  }

  // Old-format detected → fallback to defaults (prevents breaking admin page)
  return dw;
}

export async function getSmartMatchConfig(): Promise<SmartMatchConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAtMs < CACHE_TTL_MS) return cachedConfig;

  try {
    const snap = await adminDb.doc(CONFIG_DOC_PATH).get();

    if (!snap.exists) {
      cachedConfig = { ...DEFAULT_CONFIG };
      cachedAtMs = now;
      return cachedConfig;
    }

    const data = snap.data() as any;

    const config: SmartMatchConfig = {
      enabled: data?.enabled !== false,

      weights: readWeights(data),

      hideThreshold: clampInt(data?.hideThreshold, 0, 100, DEFAULT_CONFIG.hideThreshold),
      premiumBonus: clampInt(data?.premiumBonus, 0, 20, DEFAULT_CONFIG.premiumBonus),
      premiumMinScore: clampInt(data?.premiumMinScore, 0, 100, DEFAULT_CONFIG.premiumMinScore),

      profileCacheTtlMs: clampInt(
        data?.profileCacheTtlMs,
        60_000,
        24 * 3600_000,
        DEFAULT_CONFIG.profileCacheTtlMs
      ),
      scoreCacheTtlMs: clampInt(
        data?.scoreCacheTtlMs,
        60_000,
        3600_000,
        DEFAULT_CONFIG.scoreCacheTtlMs
      ),
    };

    cachedConfig = config;
    cachedAtMs = now;
    return config;
  } catch (e: any) {
    console.error("[smartmatch/configServer] Failed to load config:", e?.message);
    cachedConfig = { ...DEFAULT_CONFIG };
    cachedAtMs = now;
    return cachedConfig;
  }
}

export async function saveSmartMatchConfig(config: Partial<SmartMatchConfig>): Promise<void> {
  await adminDb.doc(CONFIG_DOC_PATH).set(
    { ...config, updatedAtMs: Date.now() },
    { merge: true }
  );

  cachedConfig = null;
  cachedAtMs = 0;
}