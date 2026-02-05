import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shaId(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 40);
}

function cleanToken(v: any) {
  const t = String(v || "").trim();
  if (!t) return "";
  if (t.length < 20) return "";
  if (t.length > 4096) return "";
  return t;
}

function roleFromMe(me: any): "owner" | "staff" {
  const r = String(me?.role || me?.accountRole || "").toLowerCase();
  return r === "staff" ? "staff" : "owner";
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({} as any));
    const token = cleanToken(body?.token);

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const id = shaId(token);
    const role = roleFromMe(me);
    const nowMs = Date.now();

    const ref = adminDb.collection("businesses").doc(me.businessId).collection("pushTokens").doc(id);

    await ref.set(
      {
        id,
        token,
        businessId: me.businessId,
        uid: me.uid,
        role,
        createdAtMs: nowMs,
        lastSeenAtMs: nowMs,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, id, role });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}