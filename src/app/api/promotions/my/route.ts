import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCampaign(x: any) {
  const startedAtMs = Number(x.startedAtMs || 0);
  const endsAtMs = Number(x.endsAtMs || 0);

  const productIds: string[] = Array.isArray(x.productIds)
    ? x.productIds.map(String)
    : x.productId
      ? [String(x.productId)]
      : [];

  const dailyBudgetKobo = Number(x.dailyBudgetKobo || 0);
  const totalBudgetKobo = Number(x.totalBudgetKobo || x.amountKobo || 0);
  const days = Number(x.days || 0);

  return {
    id: String(x.id || x.reference || ""),
    reference: String(x.reference || x.id || ""),
    businessId: String(x.businessId || ""),
    businessSlug: x.businessSlug ? String(x.businessSlug) : null,
    productIds,
    status: String(x.status || "active"),
    startedAtMs,
    endsAtMs,
    days,
    dailyBudgetKobo,
    totalBudgetKobo,
  };
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) {
      return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb
      .collection("promotionCampaigns")
      .where("businessId", "==", me.businessId)
      .limit(50)
      .get();

    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const campaigns = raw
      .map(normalizeCampaign)
      .sort((a, b) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0))
      .slice(0, 20);

    // product previews
    const pSnap = await adminDb
      .collection("products")
      .where("businessId", "==", me.businessId)
      .limit(300)
      .get();

    const productMap = new Map<string, any>();
    for (const d of pSnap.docs) {
      const p = d.data() as any;
      productMap.set(d.id, {
        id: d.id,
        name: p.name ?? "Product",
        imageUrl: Array.isArray(p.images) ? p.images[0] ?? "" : "",
        price: Number(p.price || 0),
        boostUntilMs: Number(p.boostUntilMs || 0),
      });
    }

    const campaignsWithProducts = campaigns.map((c) => ({
      ...c,
      products: c.productIds.map((id) => productMap.get(id)).filter(Boolean).slice(0, 5),
    }));

    return NextResponse.json({ ok: true, campaigns: campaignsWithProducts });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}