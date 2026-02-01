// FILE: src/app/api/disputes/create/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { buyerKeyFrom } from "@/lib/buyers/key";

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

function planPriority(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 4;
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

    let planKey = "FREE";
    if (businessId) {
      const bSnap = await adminDb.collection("businesses").doc(businessId).get();
      const b = bSnap.exists ? (bSnap.data() as any) : {};
      const exp = Number(b?.subscription?.expiresAtMs || 0);
      const hasSub = !!(b?.subscription?.planKey && exp && exp > Date.now());
      planKey = hasSub ? String(b?.subscription?.planKey || "LAUNCH") : "FREE";
    }

    const nowMs = Date.now();

    const buyerKeyObj = buyerKeyFrom({
      phone: customer?.phone || null,
      email: customer?.email || null,
    });

    const disputeRef = adminDb.collection("disputes").doc();
    const evidenceUrls = cleanUrls(body.evidenceUrls);

    await disputeRef.set({
      orderId,
      businessId: businessId || null,

      reason: cleanReason(body.reason),
      details: cleanDetails(body.details),
      evidenceUrls,

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

      vendorPlanKey: String(planKey || "FREE").toUpperCase(),
      priority: planPriority(planKey),
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

    // Freeze buyer + increment open disputes
    if (buyerKeyObj.key) {
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
            frozenReason: "Open dispute",
            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),

            disputesCount: FieldValue.increment(1),
            openDisputes: nextOpen,
            lastDisputeAtMs: nowMs,
          },
          { merge: true }
        );
      });
    }

    // Vendor trust counters (used for marketplace visibility reduction)
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