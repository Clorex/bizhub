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

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({} as any));
    const token = cleanToken(body?.token);
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const id = shaId(token);

    await adminDb.collection("businesses").doc(me.businessId).collection("pushTokens").doc(id).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}