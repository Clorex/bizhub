// FILE: src/app/api/admin/security/session/route.ts
import { NextResponse } from "next/server";
import { requireAdminStrict, getAdminSession } from "@/lib/admin/securityServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAdminStrict(req);
    const s = await getAdminSession(me.uid);
    return NextResponse.json({ ok: true, verified: s.verified, verifiedUntilMs: s.verifiedUntilMs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unauthorized" }, { status: 401 });
  }
}