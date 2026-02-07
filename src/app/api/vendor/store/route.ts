// FILE: src/app/api/vendor/store/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { cleanListCsv, keywordsForBusiness } from "@/lib/search/keywords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!snap.exists) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    return NextResponse.json({ ok: true, business: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    const biz = bizSnap.exists ? (bizSnap.data() as any) : {};

    const plan = await getBusinessPlanResolved(me.businessId);
    const canCustomize = !!(plan.features as any)?.storeCustomize;

    const wantsContinueInChatEnabled = body.continueInChatEnabled === true;
    if (wantsContinueInChatEnabled && !hasActiveSubscription(biz)) {
      return NextResponse.json(
        { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "Subscribe to enable Continue in Chat." },
        { status: 403 }
      );
    }

    const searchTags = cleanListCsv(body.searchTagsCsv);

    const patch: any = {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      state: typeof body.state === "string" ? body.state.trim() : undefined,
      city: typeof body.city === "string" ? body.city.trim() : undefined,
      whatsapp: typeof body.whatsapp === "string" ? body.whatsapp.trim() : undefined,
      instagram: typeof body.instagram === "string" ? body.instagram.trim().replace(/^@/, "") : undefined,

      logoUrl: canCustomize && typeof body.logoUrl === "string" ? body.logoUrl : undefined,
      bannerUrl: canCustomize && typeof body.bannerUrl === "string" ? body.bannerUrl : undefined,

      continueInChatEnabled: body.continueInChatEnabled === true ? true : false,

      // ✅ NEW: vendor keywords + search index
      searchTags,
      searchKeywords: keywordsForBusiness({
        slug: String(biz?.slug || ""),
        name: typeof body.name === "string" ? body.name.trim() : String(biz?.name || ""),
        description: typeof body.description === "string" ? body.description : String(biz?.description || ""),
        state: typeof body.state === "string" ? body.state.trim() : String(biz?.state || ""),
        city: typeof body.city === "string" ? body.city.trim() : String(biz?.city || ""),
        instagram: typeof body.instagram === "string" ? body.instagram.trim().replace(/^@/, "") : String(biz?.instagram || ""),
        tags: searchTags,
      }),

      updatedAt: FieldValue.serverTimestamp(),
    };

    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    await adminDb.collection("businesses").doc(me.businessId).set(patch, { merge: true });

    return NextResponse.json({ ok: true, planKey: plan.planKey, canCustomize });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}