// FILE: src/app/api/admin/security/send-code/route.ts

import { requireAdminStrict, sendAdminOtp } from "@/lib/admin/securityServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireAdminStrict(req);

    const res = await sendAdminOtp({
      uid: me.uid,
      email: String(me.email || ""),
      scope: "session",
    });

    return Response.json({ ok: true, sent: res.sent, devCode: res.devCode });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}