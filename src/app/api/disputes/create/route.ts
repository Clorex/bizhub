import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { buyerKeyFrom } from "@/lib/buyers/key";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanReason(v: any) {
  const s = String(v || "").trim().slice(0, 60);
  return s || "Other";
}

function cleanDetails(v: any) {
  return String(v || "").trim().slice(0, 4000);
}

function cleanUrls(arr: any) {
  const list: string[] = Array.isArray(arr) ? arr.map((x) => String(x || "").trim()) : [];
  return list.filter((u) => u.startsWith("https://")).slice(0, 10);
}

function cleanUrlOne(v: any) {
  const u = String(v || "").trim();
  return u.startsWith("https://") ? u : "";
}

function cleanTimeline(v: any) {
  return String(v || "").trim().slice(0, 5000);
}

function addonIsActive(ent: any, nowMs: number) {
  if (!ent || typeof ent !== "object") return false;
  if (String(ent.status || "") !== "active") return false;
  const exp = Number(ent.expiresAtMs || 0);
  return !!(exp && exp > nowMs);
}

function planPriority(args: { planKey: string; apexPriorityOverride: boolean; momentumPriorityReview: boolean }) {
  const k = String(args.planKey || "FREE").toUpperCase();

  if (k === "APEX" && args.apexPriorityOverride) return 10; // jump queue (override)
  if (k === "APEX") return 4;

  // ✅ Momentum add-on: queue boost only (no override)
  if (k === "MOMENTUM" && args.momentumPriorityReview) return 3.6;

  if (k === "MOMENTUM") return 3;
  if (k === "LAUNCH") return 2;
  return 1;
}

async function requireAuthedUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new Error("Missing Authorization token");
  const decoded = await adminAuth.verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email ?? null };
}

async function getUserRole(uid: string) {
  const snap = await adminDb.collection("users").doc(uid).get();
  const d = snap.exists ? (snap.data() as any) : {};
  return {
    role: String(d.role || "customer"),
    businessId: d.businessId ? String(d.businessId) : null,
    businessSlug: d.businessSlug ? String(d.businessSlug) : null,
  };
}

export async function POST(req: Request) {
  try {
    const me = await requireAuthedUser(req);
    const meProfile = await getUserRole(me.uid);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || "").trim();

    if (!orderId) return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const order = orderSnap.data() as any;
    const businessId = String(order.businessId || "");
    const customer = order?.customer || {};

    const isVendor = meProfile.role === "owner" || meProfile.role === "staff";
    const createdByType = isVendor ? "vendor" : "buyer";

    if (isVendor) {
      if (!meProfile.businessId || String(meProfile.businessId) !== String(businessId)) {
        return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    } else {
      const orderEmail = String(customer?.email || "").trim().toLowerCase();
      const myEmail = String(me.email || "").trim().toLowerCase();
      if (orderEmail && myEmail && orderEmail !== myEmail) {
        return NextResponse.json({ ok: false, error: "Not allowed to dispute this order" }, { status: 403 });
      }
    }

    const plan = businessId ? await getBusinessPlanResolved(businessId) : null;
    const planKey = String(plan?.planKey || "FREE").toUpperCase();

    const apexPriorityOverride =
      !!plan?.features?.apexPriorityDisputeOverride && planKey === "APEX" && !!plan?.hasActiveSubscription;

    // ✅ Momentum add-on: queue boost only (no override powers)
    const entMap =
      plan?.business?.addonEntitlements && typeof plan.business.addonEntitlements === "object"
        ? plan.business.addonEntitlements
        : {};
    const momentumPriorityReview =
      planKey === "MOMENTUM" &&
      !!plan?.hasActiveSubscription &&
      addonIsActive(entMap["addon_priority_dispute_review"], Date.now());

    const nowMs = Date.now();

    const buyerKeyObj = buyerKeyFrom({
      phone: customer?.phone || null,
      email: customer?.email || null,
    });

    const disputeRef = adminDb.collection("disputes").doc();

    const evidenceUrls = cleanUrls(body.evidenceUrls);

    // ✅ Apex extra evidence fields (only vendor + only Apex override enabled)
    const timelineText = apexPriorityOverride && createdByType === "vendor" ? cleanTimeline(body.timelineText) : "";
    const voiceNoteUrl = apexPriorityOverride && createdByType === "vendor" ? cleanUrlOne(body.voiceNoteUrl) : "";
    const screenshotUrls =
      apexPriorityOverride && createdByType === "vendor" ? cleanUrls(body.screenshotUrls).slice(0, 10) : [];

    const requestFreezeCustomer =
      apexPriorityOverride && createdByType === "vendor" ? body.requestFreezeCustomer === true : false;

    const priority = planPriority({ planKey, apexPriorityOverride, momentumPriorityReview });

    await disputeRef.set({
      orderId,
      businessId: businessId || null,

      reason: cleanReason(body.reason),
      details: cleanDetails(body.details),

      evidenceUrls,

      // Apex extra evidence
      timelineText: timelineText || null,
      voiceNoteUrl: voiceNoteUrl || null,
      screenshotUrls: screenshotUrls.length ? screenshotUrls : null,
      requestFreezeCustomer,

      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: nowMs,

      createdByUid: me.uid,
      createdByEmail: me.email ?? null,
      createdByType,
      createdByRole: meProfile.role,

      buyerKey: buyerKeyObj.key || null,
      buyerPhone: buyerKeyObj.phone,
      buyerEmail: buyerKeyObj.email,

      vendorPlanKey: planKey,
      priority,
      apexPriorityOverride: apexPriorityOverride ? true : false,

      // ✅ Momentum queue boost flag
      priorityDisputeReview: momentumPriorityReview ? true : false,
    });

    const isEscrow = order.paymentType === "paystack_escrow";

    await orderRef.set(
      {
        escrowStatus: isEscrow ? "disputed" : (order.escrowStatus ?? "none"),
        orderStatus: "disputed",
        updatedAt: FieldValue.serverTimestamp(),
        disputedAtMs: nowMs,
      },
      { merge: true }
    );

    // ✅ Buyer freeze becomes an Apex vendor request (not automatic for everyone)
    if (buyerKeyObj.key && requestFreezeCustomer) {
      const bsRef = adminDb.collection("buyerSignals").doc(buyerKeyObj.key);
      await adminDb.runTransaction(async (t) => {
        const bsSnap = await t.get(bsRef);
        const bs = bsSnap.exists ? (bsSnap.data() as any) : {};
        const curOpen = Number(bs.openDisputes || 0);
        const nextOpen = curOpen + 1;

        t.set(
          bsRef,
          {
            key: buyerKeyObj.key,
            phone: buyerKeyObj.phone,
            email: buyerKeyObj.email,

            frozen: true,
            frozenReason: "Vendor requested freeze during investigation",
            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),

            disputesCount: FieldValue.increment(1),
            openDisputes: nextOpen,
            lastDisputeAtMs: nowMs,
          },
          { merge: true }
        );
      });
    } else if (buyerKeyObj.key) {
      const bsRef = adminDb.collection("buyerSignals").doc(buyerKeyObj.key);
      await bsRef.set(
        {
          disputesCount: FieldValue.increment(1),
          lastDisputeAtMs: nowMs,
        },
        { merge: true }
      );
    }

    // Vendor trust counters
    if (businessId) {
      await adminDb.collection("businesses").doc(businessId).set(
        {
          trust: {
            openDisputes: FieldValue.increment(1),
            disputesCount: FieldValue.increment(1),
            lastDisputeAtMs: nowMs,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true, disputeId: disputeRef.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create dispute" }, { status: 500 });
  }
}