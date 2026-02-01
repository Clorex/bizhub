import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

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

    if (bizSnap.empty) {
      return NextResponse.json({ ok: false, error: "Store not found" }, { status: 404 });
    }

    const bizDoc = bizSnap.docs[0];
    const biz = { id: bizDoc.id, ...(bizDoc.data() as any) };

    const enabledToggle = biz?.continueInChatEnabled === true;
    const whatsapp = String(biz?.whatsapp || "").trim();
    const subscribed = hasActiveSubscription(biz);

    // Strict rule: NOT available for free users => subscription required.
    const enabled = !!(enabledToggle && subscribed && whatsapp);

    return NextResponse.json({
      ok: true,
      storeSlug,
      storeName: biz?.name ?? null,
      enabled,
      reasons: {
        toggleOn: enabledToggle,
        subscribed,
        whatsappSet: !!whatsapp,
      },
      whatsapp: enabled ? whatsapp : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}