// FILE: src/lib/smartmatch/profileServer.ts

import { adminDb } from "@/lib/firebase/admin";
import { computeVendorProfile } from "./vendorProfile";
import type { VendorReliabilityProfile } from "./types";
import { getSmartMatchConfig } from "./configServer";

/**
 * Load a cached vendor profile from the business doc.
 * Returns null if not yet computed or expired.
 */
export async function getCachedVendorProfile(
  businessId: string
): Promise<VendorReliabilityProfile | null> {
  try {
    const snap = await adminDb.collection("businesses").doc(businessId).get();
    if (!snap.exists) return null;

    const data = snap.data() as any;
    const profile = data?.smartMatch?.profile as VendorReliabilityProfile | undefined;

    if (!profile || !profile.computedAtMs) return null;

    const config = await getSmartMatchConfig();
    const age = Date.now() - profile.computedAtMs;

    if (age > config.profileCacheTtlMs) return null;

    return profile;
  } catch {
    return null;
  }
}

/**
 * Load cached vendor profiles for multiple businesses in batch.
 * Returns a map of businessId → profile (only includes valid cached ones).
 */
export async function getCachedVendorProfiles(
  businessIds: string[]
): Promise<Map<string, VendorReliabilityProfile>> {
  const map = new Map<string, VendorReliabilityProfile>();
  if (!businessIds.length) return map;

  const config = await getSmartMatchConfig();
  const now = Date.now();

  // Firestore getAll supports up to ~500 refs at a time
  const chunks = chunkArray(
    businessIds.filter(Boolean),
    400
  );

  for (const chunk of chunks) {
    try {
      const refs = chunk.map((id) => adminDb.collection("businesses").doc(id));
      const snaps: any[] = await (adminDb as any).getAll(...refs);

      for (const snap of snaps) {
        if (!snap || !snap.exists) continue;

        const data = snap.data() as any;
        const profile = data?.smartMatch?.profile as
          | VendorReliabilityProfile
          | undefined;

        if (!profile || !profile.computedAtMs) continue;

        const age = now - profile.computedAtMs;
        if (age > config.profileCacheTtlMs) continue;

        map.set(snap.id, profile);
      }
    } catch (e: any) {
      console.error("[smartmatch/profileServer] Batch load error:", e?.message);
    }
  }

  return map;
}

/**
 * Compute and store a vendor's reliability profile.
 * This is the "heavy" operation that should be run periodically or on-demand.
 */
export async function computeAndStoreVendorProfile(
  businessId: string
): Promise<VendorReliabilityProfile> {
  // Load business
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  if (!bizSnap.exists) {
    throw new Error(`Business ${businessId} not found`);
  }
  const business = { id: bizSnap.id, ...(bizSnap.data() as any) };

  // Load orders for this business (last 6 months for relevance)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600_000);
  const ordersSnap = await adminDb
    .collection("orders")
    .where("businessId", "==", businessId)
    .where("createdAt", ">=", sixMonthsAgo)
    .limit(500)
    .get();

  const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  // Load disputes for this business
  const disputesSnap = await adminDb
    .collection("disputes")
    .where("businessId", "==", businessId)
    .limit(200)
    .get();

  // Fallback: also check disputes by orderId if businessId not indexed on disputes
  let disputes = disputesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // If no disputes found by businessId, try matching by order IDs
  if (disputes.length === 0 && orders.length > 0) {
    const orderIds = orders.map((o) => o.id).slice(0, 30);

    if (orderIds.length > 0) {
      const chunks = chunkArray(orderIds, 10);
      for (const chunk of chunks) {
        try {
          const dSnap = await adminDb
            .collection("disputes")
            .where("orderId", "in", chunk)
            .get();

          for (const d of dSnap.docs) {
            disputes.push({ id: d.id, ...(d.data() as any) });
          }
        } catch {
          // "in" queries have limits; best-effort
        }
      }
    }
  }

  // Load products for stock accuracy
  const productsSnap = await adminDb
    .collection("products")
    .where("businessId", "==", businessId)
    .limit(200)
    .get();

  const products = productsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // Compute profile
  const profile = computeVendorProfile({
    business,
    orders,
    disputes,
    products,
  });

  // Store on business doc
  await adminDb
    .collection("businesses")
    .doc(businessId)
    .set(
      {
        smartMatch: {
          profile,
          lastComputedAtMs: Date.now(),
        },
      },
      { merge: true }
    );

  return profile;
}

/**
 * Compute profiles for ALL active vendors.
 * Used by admin cron/trigger.
 */
export async function computeAllVendorProfiles(): Promise<{
  computed: number;
  failed: number;
  errors: string[];
}> {
  let computed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Get all businesses with active subscriptions (or all, depending on strategy)
  // For Phase 1: compute for ALL businesses (even free) since free vendors
  // are included in smart ranking per the spec.
  const bizSnap = await adminDb.collection("businesses").limit(1000).get();

  for (const doc of bizSnap.docs) {
    try {
      await computeAndStoreVendorProfile(doc.id);
      computed++;
    } catch (e: any) {
      failed++;
      const msg = `${doc.id}: ${e?.message || "Unknown error"}`;
      errors.push(msg);
      if (errors.length <= 10) {
        console.error("[smartmatch/computeAll]", msg);
      }
    }
  }

  return { computed, failed, errors: errors.slice(0, 20) };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}