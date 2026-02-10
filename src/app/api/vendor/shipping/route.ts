// FILE: src/app/api/vendor/shipping/route.ts

import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShipType = "pickup" | "delivery";

function cleanType(v: any): ShipType {
  return String(v || "delivery") === "pickup" ? "pickup" : "delivery";
}

function clampInt(v: any, min: number, max: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampKobo(v: any) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function cleanText(v: any, max = 80) {
  return String(v || "").trim().slice(0, max);
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb.collection("businesses").doc(me.businessId).collection("shippingOptions").limit(200).get();

    const options = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

    return Response.json({ ok: true, options });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));

    const id = body.id ? String(body.id) : "";
    const type = cleanType(body.type);

    const name = cleanText(body.name, 60);
    if (!name) return Response.json({ ok: false, error: "Name is required" }, { status: 400 });

    // ✅ plan-config driven shipping options max (no hardcoded limits)
    if (!id) {
      const plan = await getBusinessPlanResolved(me.businessId);
      const max = Number(plan?.limits?.shippingOptionsMax || 0);

      if (!Number.isFinite(max) || max <= 0) {
        return Response.json(
          { ok: false, code: "PLAN_LIMIT_SHIPPING_OPTIONS", error: "Your plan does not allow shipping options." },
          { status: 403 }
        );
      }

      const agg = await adminDb.collection("businesses").doc(me.businessId).collection("shippingOptions").count().get();
      const cur = Number((agg.data() as any)?.count || 0);

      if (cur >= max) {
        return Response.json(
          {
            ok: false,
            code: "PLAN_LIMIT_SHIPPING_OPTIONS",
            error: `You have reached your shipping option limit (${max}). Upgrade to add more.`,
            limit: max,
            current: cur,
          },
          { status: 403 }
        );
      }
    }

    const feeKobo = clampKobo(body.feeKobo);
    const etaDays = clampInt(body.etaDays, 0, 30);
    const areasText = cleanText(body.areasText, 160);
    const active = body.active === false ? false : true;
    const sortOrder = clampInt(body.sortOrder, 0, 999);

    const ref = id
      ? adminDb.collection("businesses").doc(me.businessId).collection("shippingOptions").doc(id)
      : adminDb.collection("businesses").doc(me.businessId).collection("shippingOptions").doc();

    await ref.set(
      {
        businessId: me.businessId,
        businessSlug: me.businessSlug ?? null,

        type, // pickup | delivery
        name,
        feeKobo: type === "pickup" ? 0 : feeKobo,
        fee: (type === "pickup" ? 0 : feeKobo) / 100,

        etaDays,
        areasText: areasText || null,

        active,
        sortOrder,

        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAtMs: FieldValue.increment(0), // keep for backward compatibility
      },
      { merge: true }
    );

    // If doc is newly created, set createdAtMs only once
    const snap = await ref.get();
    const data = snap.data() as any;
    if (!data?.createdAtMs || Number(data.createdAtMs) === 0) {
      await ref.set({ createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return Response.json({ ok: true, id: ref.id });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return Response.json({ ok: false, error: "id required" }, { status: 400 });

    await adminDb.collection("businesses").doc(me.businessId).collection("shippingOptions").doc(id).delete();

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}