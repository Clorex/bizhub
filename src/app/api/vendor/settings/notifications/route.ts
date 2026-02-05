import { NextResponse } from "next/server";
import { requireAnyRole, requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickBool(v: any, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
    const notif = biz?.settings?.notifications || {};

    return NextResponse.json({
      ok: true,
      staffNudgesEnabled: pickBool(notif.staffNudgesEnabled, false),
      staffPushEnabled: pickBool(notif.staffPushEnabled, false),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({} as any));

    const patch: any = {};
    if (typeof body?.staffNudgesEnabled === "boolean") patch["settings.notifications.staffNudgesEnabled"] = body.staffNudgesEnabled;
    if (typeof body?.staffPushEnabled === "boolean") patch["settings.notifications.staffPushEnabled"] = body.staffPushEnabled;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    await adminDb.collection("businesses").doc(me.businessId).set(patch, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}