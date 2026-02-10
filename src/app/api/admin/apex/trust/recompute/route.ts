
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPaidOrDelivered(o: any) {
  const pt = String(o?.paymentType || "");
  const ps = String(o?.paymentStatus || "");
  const ops = String(o?.opsStatus || o?.opsStatusEffective || "").trim();
  const orderStatus = String(o?.orderStatus || "");

  const paid =
    pt === "paystack_escrow" ||
    ps === "paid" ||
    orderStatus === "paid_held" ||
    orderStatus === "released_to_vendor_wallet" ||
    orderStatus === "awaiting_vendor_confirmation";

  const delivered = ops === "delivered";
  return paid || delivered;
}

async function updateProductsForBusiness(args: { businessId: string; apexBadgeActive: boolean; apexRiskScore: number }) {
  const { businessId, apexBadgeActive, apexRiskScore } = args;

  // Update up to 2500 products (in chunks)
  const snap = await adminDb.collection("products").where("businessId", "==", businessId).limit(2500).get();
  const docs = snap.docs;
  if (docs.length === 0) return { updated: 0 };

  let updated = 0;

  for (let i = 0; i < docs.length; i += 400) {
    const batch = adminDb.batch();
    const slice = docs.slice(i, i + 400);

    for (const d of slice) {
      batch.set(
        d.ref,
        {
          apexBadgeActive,
          apexRiskScore,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updated += 1;
    }

    await batch.commit();
  }

  return { updated };
}

export async function POST(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const businessId = String(url.searchParams.get("businessId") || "").trim();

    const nowMs = Date.now();
    const start30Ms = nowMs - 30 * 86400000;
    const start7Ms = nowMs - 7 * 86400000;

    const start30Ts = Timestamp.fromMillis(start30Ms);
    const start7Ts = Timestamp.fromMillis(start7Ms);

    const bizIds: string[] = [];

    if (businessId) {
      bizIds.push(businessId);
    } else {
      const snap = await adminDb.collection("businesses").where("subscription.planKey", "==", "APEX").limit(800).get();
      for (const d of snap.docs) bizIds.push(d.id);
    }

    const results: any[] = [];

    for (const bid of bizIds) {
      const plan = await getBusinessPlanResolved(bid);
      const planKey = String(plan.planKey || "FREE").toUpperCase();
      const hasSub = !!plan.hasActiveSubscription;

      const badgeFeatureEnabled = planKey === "APEX" && hasSub && !!plan.features?.apexVerifiedBadge;
      const riskShieldEnabled = planKey === "APEX" && hasSub && !!plan.features?.apexSmartRiskShield;

      // If not eligible, clear apexTrust + product denorm
      if (!badgeFeatureEnabled && !riskShieldEnabled) {
        await adminDb.collection("businesses").doc(bid).set(
          {
            apexTrust: {
              badgeActive: false,
              reason: "NOT_ELIGIBLE",
              riskScore: 0,
              flags: [],
              updatedAtMs: nowMs,
              updatedAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

        await updateProductsForBusiness({ businessId: bid, apexBadgeActive: false, apexRiskScore: 0 });

        results.push({ businessId: bid, ok: true, badgeActive: false, reason: "NOT_ELIGIBLE", riskScore: 0 });
        continue;
      }

      const verificationTier = Number(plan?.business?.verificationTier || 0);

      const o30 = await adminDb
        .collection("orders")
        .where("businessId", "==", bid)
        .where("createdAt", ">=", start30Ts)
        .limit(8000)
        .get();

      const o7 = await adminDb
        .collection("orders")
        .where("businessId", "==", bid)
        .where("createdAt", ">=", start7Ts)
        .limit(3000)
        .get();

      const orders30 = o30.docs.map((d) => d.data() as any);
      const orders7 = o7.docs.map((d) => d.data() as any);

      const completed30 = orders30.filter(isPaidOrDelivered).length;
      const completed7 = orders7.filter(isPaidOrDelivered).length;
      const unpaid7 = orders7.filter((o) => !isPaidOrDelivered(o)).length;

      const d30 = await adminDb
        .collection("disputes")
        .where("businessId", "==", bid)
        .where("createdAt", ">=", start30Ts)
        .limit(3000)
        .get();

      const disputes30 = d30.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const openDisputes = disputes30.filter((x) => String(x.status || "open") === "open").length;
      const disputeRate = completed30 > 0 ? disputes30.length / completed30 : disputes30.length > 0 ? 1 : 0;

      const v30 = await adminDb
        .collection("vendorPolicyViolations")
        .where("businessId", "==", bid)
        .where("createdAt", ">=", start30Ts)
        .limit(2000)
        .get();

      const violations30 = v30.docs.length;

      // Risk Shield score (0..100)
      const flags: string[] = [];
      let riskScore = 0;

      if (riskShieldEnabled) {
        if (disputeRate >= 0.08) {
          flags.push("HIGH_DISPUTE_RATE");
          riskScore += 40;
        } else if (disputeRate >= 0.04) {
          flags.push("ELEVATED_DISPUTE_RATE");
          riskScore += 20;
        }

        if (openDisputes >= 3) {
          flags.push("MANY_OPEN_DISPUTES");
          riskScore += 25;
        }

        if (unpaid7 >= 8) {
          flags.push("ABANDONED_SPIKE_7D");
          riskScore += 15;
        }

        if (violations30 > 0) {
          flags.push("POLICY_HITS_30D");
          riskScore += 20;
        }
      }

      riskScore = Math.max(0, Math.min(100, Math.floor(riskScore)));

      // Badge rule (earned + maintained)
      let badgeActive = true;
      let reason = "OK";

      if (!badgeFeatureEnabled) {
        badgeActive = false;
        reason = "FEATURE_OFF";
      } else if (verificationTier < 1) {
        badgeActive = false;
        reason = "NEEDS_VERIFICATION";
      } else if (completed30 < 10) {
        badgeActive = false;
        reason = "NOT_ENOUGH_COMPLETED_ORDERS_30D";
      } else if (violations30 > 0) {
        badgeActive = false;
        reason = "POLICY_HIT";
      } else if (openDisputes > 1) {
        badgeActive = false;
        reason = "TOO_MANY_OPEN_DISPUTES";
      } else if (disputeRate > 0.05) {
        badgeActive = false;
        reason = "DISPUTE_RATE_HIGH";
      }

      await adminDb.collection("businesses").doc(bid).set(
        {
          apexTrust: {
            badgeActive,
            reason,
            verificationTier,
            completed30,
            completed7,
            disputes30: disputes30.length,
            openDisputes,
            disputeRate: Number(disputeRate.toFixed(4)),
            violations30,

            riskScore,
            flags,

            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      const denorm = await updateProductsForBusiness({
        businessId: bid,
        apexBadgeActive: badgeActive,
        apexRiskScore: riskScore,
      });

      results.push({ businessId: bid, ok: true, badgeActive, reason, riskScore, flags, productsUpdated: denorm.updated });
    }

    return Response.json({ ok: true, count: results.length, results });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}