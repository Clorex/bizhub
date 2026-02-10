// FILE: src/lib/smartmatch/configServer.ts

import { adminDb } from "@/lib/firebase/admin";
import type { SmartMatchConfig } from "./types";
import { DEFAULT_CONFIG } from "./config";

const CONFIG_DOC_PATH = "config/smartmatch";

let cachedConfig: SmartMatchConfig | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load SmartMatch config from Firestore (with in-memory cache).
 * Falls back to DEFAULT_CONFIG if doc doesn't exist.
 *
 * Admin can update `config/smartmatch` doc to change weights at runtime.
 */
export async function getSmartMatchConfig(): Promise<SmartMatchConfig> {
  const now = Date.now();

  if (cachedConfig && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedConfig;
  }

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
      weights: {
        location: clampInt(data?.weights?.location, 0, 50, DEFAULT_CONFIG.weights.location),
        delivery: clampInt(data?.weights?.delivery, 0, 50, DEFAULT_CONFIG.weights.delivery),
        reliability: clampInt(data?.weights?.reliability, 0, 50, DEFAULT_CONFIG.weights.reliability),
        paymentFit: clampInt(data?.weights?.paymentFit, 0, 50, DEFAULT_CONFIG.weights.paymentFit),
        vendorQuality: clampInt(data?.weights?.vendorQuality, 0, 50, DEFAULT_CONFIG.weights.vendorQuality),
        buyerHistory: clampInt(data?.weights?.buyerHistory, 0, 50, DEFAULT_CONFIG.weights.buyerHistory),
      },
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

/**
 * Save SmartMatch config to Firestore (admin use).
 */
export async function saveSmartMatchConfig(
  config: Partial<SmartMatchConfig>
): Promise<void> {
  await adminDb.doc(CONFIG_DOC_PATH).set(
    {
      ...config,
      updatedAtMs: Date.now(),
    },
    { merge: true }
  );

  // Bust cache
  cachedConfig = null;
  cachedAtMs = 0;
}

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}