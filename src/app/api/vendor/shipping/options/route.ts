import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const storeSlug = String(url.searchParams.get("storeSlug") || "").trim();

    if (!storeSlug) {
      return NextResponse.json({ ok: false, error: "storeSlug required" }, { status: 400 });
    }

    const bizSnap = await adminDb
      .collection("businesses")
      .where("slug", "==", storeSlug)
      .limit(1)
      .get();

    if (bizSnap.empty) return NextResponse.json({ ok: false, error: "Store not found" }, { status: 404 });

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;

    const sSnap = await adminDb
      .collection("businesses")
      .doc(businessId)
      .collection("shippingOptions")
      .limit(200)
      .get();

    const options = sSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((o) => o.active !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((o) => ({
        id: o.id,
        type: o.type || "delivery",
        name: o.name || "Delivery",
        feeKobo: Number(o.feeKobo || 0),
        etaDays: Number(o.etaDays || 0),
        areasText: o.areasText || null,
      }));

    return NextResponse.json({ ok: true, businessId, storeSlug, options });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}