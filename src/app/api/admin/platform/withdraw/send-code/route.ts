// FILE: src/app/api/admin/platform/withdraw/send-code/route.ts

import { requireAdminSessionVerified, sendAdminOtp } from "@/lib/admin/securityServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireAdminSessionVerified(req);

    const res = await sendAdminOtp({
      uid: me.uid,
      email: String(me.email || ""),
      scope: "withdrawal",
    });

    return Response.json({ ok: true, sent: res.sent, devCode: res.devCode });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 401 });
  }
}