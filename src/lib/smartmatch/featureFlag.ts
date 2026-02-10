// FILE: src/lib/smartmatch/featureFlag.ts

/**
 * SmartMatch feature flag.
 *
 * Phase 1: Controlled by environment variable.
 * Phase 2: Can be moved to Firestore config/smartmatch doc for runtime toggling.
 *
 * Set NEXT_PUBLIC_SMARTMATCH_ENABLED=true in .env to enable.
 */

const ENV_KEY = "NEXT_PUBLIC_SMARTMATCH_ENABLED";

/**
 * Check if SmartMatch is enabled (client-safe).
 */
export function isSmartMatchEnabled(): boolean {
  if (typeof process !== "undefined" && process.env?.[ENV_KEY]) {
    return String(process.env[ENV_KEY]).toLowerCase() === "true";
  }

  // Fallback: disabled
  return false;
}

/**
 * Server-side check — can also read from Firestore config.
 * For Phase 1, same as client check.
 */
export function isSmartMatchEnabledServer(): boolean {
  return isSmartMatchEnabled();
}