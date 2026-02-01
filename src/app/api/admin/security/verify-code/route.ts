// FILE: src/app/api/admin/security/verify-code/route.ts
import { NextResponse } from "next/server";
import {
  requireAdminStrict,
  verifyAdminOtp,
  markAdminSessionVerified,
} from "@/lib/admin/securityServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireAdminStrict(req);

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();

    if (!code) {
      return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    }

    await verifyAdminOtp({ uid: me.uid, code, scope: "session" });

    const s = await markAdminSessionVerified({
      uid: me.uid,
      email: String(me.email || ""),
    });

    return NextResponse.json({ ok: true, verifiedUntilMs: s.verifiedUntilMs });
  } catch (e: any) {
    const msg = e?.message || "Failed";
    const code = e?.code || null;
    return NextResponse.json({ ok: false, code, error: msg }, { status: 400 });
  }
}