// FILE: src/app/api/vendor/reengagement/audience/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanAudience(v: any) {
  const s = String(v || "buyers").trim();
  if (s === "buyers" || s === "abandoned") return s;
  return "buyers";
}

function cleanPhone(raw: string) {
  const d = String(raw || "").replace(/[^\d]/g, "");
  return d.length >= 7 ? d : "";
}

function cleanEmail(raw: string) {
  const e = String(raw || "").trim().toLowerCase();
  return e.includes("@") ? e : "";
}

function buyerKey(o: any) {
  const phone = cleanPhone(o?.customer?.phone || "");
  const email = cleanEmail(o?.customer?.email || "");
  return phone ? `phone:${phone}` : email ? `email:${email}` : "";
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    await requireVendorUnlocked(me.businessId);

    const url = new URL(req.url);
    const audience = cleanAudience(url.searchParams.get("audience"));
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || 30)));

    const endMs = Date.now();
    const startMs = endMs - days * 24 * 60 * 60 * 1000;

    const startTs = Timestamp.fromMillis(startMs);
    const endTs = Timestamp.fromMillis(endMs);

    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<=", endTs)
      .limit(5000)
      .get();

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const out: any[] = [];
    const seen = new Set<string>();

    for (const o of orders) {
      const key = buyerKey(o);
      if (!key || seen.has(key)) continue;

      const ops = String(o?.opsStatus || o?.opsStatusEffective || "").trim();
      const pt = String(o?.paymentType || "");
      const paid = pt === "paystack_escrow" || String(o?.paymentStatus || "") === "paid";

      const isDelivered = ops === "delivered";
      const isPaidOrDelivered = paid || isDelivered;

      const isAbandoned = audience === "abandoned" ? !paid : false;
      const include = audience === "buyers" ? isPaidOrDelivered : isAbandoned;

      if (!include) continue;

      seen.add(key);

      const phone = cleanPhone(o?.customer?.phone || "");
      const email = cleanEmail(o?.customer?.email || "");
      const fullName = String(o?.customer?.fullName || "").trim();

      out.push({
        key,
        phone: phone || null,
        email: email || null,
        fullName: fullName || null,
        lastOrderId: o.id,
        storeSlug: String(o?.businessSlug || me.businessSlug || ""),
      });
    }

    const withPhone = out.filter((x) => !!x.phone);

    return NextResponse.json({ ok: true, audience, days, total: withPhone.length, people: withPhone.slice(0, 500) });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}