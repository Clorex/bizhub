import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint (no auth) used by /staff/register and /staff/login
 * to read invite details by code.
 *
 * It reveals only invite configuration (email/role/permissions), not private business data.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") || "").trim();
    if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });

    const snap = await adminDb.collection("staffInvites").doc(code).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Invite not found" }, { status: 404 });

    const inv = snap.data() as any;

    return NextResponse.json({
      ok: true,
      invite: {
        code,
        status: String(inv.status || "pending"), // pending | accepted | revoked
        email: String(inv.email || ""),
        emailLower: String(inv.emailLower || ""),
        name: inv.name || null,
        jobTitle: inv.jobTitle || null,
        permissions: inv.permissions || {},
        businessId: inv.businessId || null,
        businessSlug: inv.businessSlug || null,
        createdAtMs: Number(inv.createdAtMs || 0) || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}