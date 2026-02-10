
import { requireMe } from "@/lib/auth/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireMe(req);
    const u = await adminAuth.getUser(me.uid);

    return Response.json({
      ok: true,
      me: { ...me, emailVerified: !!u.emailVerified },
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Unauthorized" },
      { status: 401 }
    );
  }
}