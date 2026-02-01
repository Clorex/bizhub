// FILE: src/lib/vendor/syncBusinessSignals.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getTrustRules } from "@/lib/vendor/trustRulesServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export type VerificationTier = 0 | 1 | 2 | 3;

function computeTierFromVerification(v: any): VerificationTier {
  const tier1 = String(v?.tier1?.status || "").toLowerCase() === "verified";
  const tier2 = String(v?.tier2?.status || "").toLowerCase() === "verified";
  const tier3 = String(v?.tier3?.status || "").toLowerCase() === "verified";

  if (tier3) return 3;
  if (tier2) return 2;
  if (tier1) return 1;
  return 0;
}

export async function syncBusinessSignalsToProducts(params: { businessId: string }) {
  const businessId = String(params.businessId || "").trim();
  if (!businessId) throw new Error("Missing businessId");

  const bizRef = adminDb.collection("businesses").doc(businessId);
  const bizSnap = await bizRef.get();
  if (!bizSnap.exists) throw new Error("Business not found");

  const biz = bizSnap.data() as any;

  const trustRules = await getTrustRules();

  const tier = computeTierFromVerification(biz?.verification || {});
  const openDisputes = Number(biz?.trust?.openDisputes || 0);

  // penalty is used only to reduce marketplace visibility
  const reduceThreshold = Number(trustRules.dispute.reduceOpenDisputes || 4);
  const warnThreshold = Number(trustRules.dispute.warnOpenDisputes || 2);

  const marketPenalty = openDisputes >= reduceThreshold ? 2 : openDisputes >= warnThreshold ? 1 : 0;

  // marketScore is a simple ordering helper for /market client-side sort
  const marketScore = tier * 100 - marketPenalty * 80;

  // Plan-resolved marketplace flag (FREE should not appear on market)
  const plan = await getBusinessPlanResolved(businessId);
  const subscribed = !!plan.hasActiveSubscription;
  const marketAllowed = !!plan.features?.marketplace;

  const patchBusiness: any = {
    verificationTier: tier,
    trust: {
      ...(biz?.trust || {}),
      openDisputes: openDisputes || 0,
      warnOpenDisputesThreshold: warnThreshold,
      reduceOpenDisputesThreshold: reduceThreshold,
      marketPenalty,
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  await bizRef.set(patchBusiness, { merge: true });

  // Update products in batches
  const pSnap = await adminDb.collection("products").where("businessId", "==", businessId).limit(1000).get();
  const docs = pSnap.docs;

  const state = String(biz?.state || "").trim() || null;
  const city = String(biz?.city || "").trim() || null;

  const basePatch: any = {
    businessState: state,
    businessCity: city,

    marketTier: tier,
    marketPenalty,
    marketScore,

    marketAllowed, // ✅ now tied to plan.features.marketplace
    businessHasActiveSubscription: subscribed,

    updatedAt: FieldValue.serverTimestamp(),
  };

  // batch limit 500 writes
  for (let i = 0; i < docs.length; i += 450) {
    const chunk = docs.slice(i, i + 450);
    const batch = adminDb.batch();

    for (const d of chunk) {
      batch.set(d.ref, basePatch, { merge: true });
    }

    await batch.commit();
  }

  return { ok: true, productsUpdated: docs.length, tier, marketPenalty, marketScore, marketAllowed, subscribed };
}