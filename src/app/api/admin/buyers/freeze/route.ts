// FILE: src/app/api/admin/buyers/freeze/route.ts

import { requireRole } from "@/lib/auth/server";
import { setBuyerFrozen } from "@/lib/buyers/freezeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));
    const key = String(body.key || "").trim();
    const frozen = body.frozen === true;
    const reason = String(body.reason || "Restricted").slice(0, 200);

    if (!key) return Response.json({ ok: false, error: "key required" }, { status: 400 });

    await setBuyerFrozen({ key, frozen, reason: frozen ? reason : null, actorUid: me.uid });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}