// FILE: src/app/api/admin/platform/pin/route.ts

import { requireAdminSessionVerified } from "@/lib/admin/securityServer";
import { getAdminWithdrawPinState, setAdminWithdrawPin } from "@/lib/admin/withdrawPinServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAdminSessionVerified(req);
    const st = await getAdminWithdrawPinState(me.uid);
    return Response.json({ ok: true, pinSet: st.set, pinSetAtMs: st.setAtMs });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdminSessionVerified(req);

    const body = await req.json().catch(() => ({}));
    const pin = String(body.pin || "");

    await setAdminWithdrawPin({ uid: me.uid, email: String(me.email || ""), pin });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 400 });
  }
}