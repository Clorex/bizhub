
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getEntitlement } from "@/lib/bizhubPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!bizSnap.exists) return Response.json({ ok: false, error: "Business not found" }, { status: 404 });

    const biz = { id: bizSnap.id, ...(bizSnap.data() as any) };

    const entitlement = getEntitlement({
      trial: biz?.trial ?? null,
      subscription: biz?.subscription ?? null,
    });

    // Avoid composite index requirements: no orderBy here
    const sSnap = await adminDb
      .collection("subscriptions")
      .where("businessId", "==", me.businessId)
      .limit(50)
      .get();

    const purchases = sSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a: any, b: any) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0))
      .slice(0, 20);

    return Response.json({
      ok: true,
      business: {
        id: biz.id,
        name: biz.name ?? null,
        slug: biz.slug ?? null,
        subscription: biz.subscription ?? null,
        trial: biz.trial ?? null,
      },
      entitlement,
      purchases,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}