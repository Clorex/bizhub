import { NextResponse } from "next/server";
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    if (!me.email) return NextResponse.json({ ok: false, error: "Missing email on account" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    if (!code) return NextResponse.json({ ok: false, error: "Invite code required" }, { status: 400 });

    const inviteRef = adminDb.collection("staffInvites").doc(code);

    const result = await adminDb.runTransaction(async (t) => {
      const invSnap = await t.get(inviteRef);
      if (!invSnap.exists) return { ok: false, status: 404, error: "Invite not found" as const };

      const inv = invSnap.data() as any;

      if (String(inv.status || "") !== "pending") {
        return { ok: false, status: 400, error: "Invite is not pending" as const };
      }

      const invitedEmail = String(inv.emailLower || inv.email || "").trim().toLowerCase();
      const myEmail = String(me.email || "").trim().toLowerCase();

      if (!invitedEmail || invitedEmail !== myEmail) {
        return { ok: false, status: 403, error: "This invite is for a different email address" as const };
      }

      const businessId = String(inv.businessId || "");
      if (!businessId) return { ok: false, status: 400, error: "Invite missing businessId" as const };

      const bizSnap = await t.get(adminDb.collection("businesses").doc(businessId));
      if (!bizSnap.exists) return { ok: false, status: 404, error: "Business not found" as const };
      const biz = bizSnap.data() as any;

      // Prevent accepting if user is already owner/admin
      const userRef = adminDb.collection("users").doc(me.uid);
      const userSnap = await t.get(userRef);
      const userData = userSnap.exists ? (userSnap.data() as any) : {};
      const curRole = String(userData.role || "customer");

      if (curRole === "admin" || curRole === "owner") {
        return { ok: false, status: 403, error: "This account cannot be added as staff" as const };
      }

      const permissions = inv.permissions || {};

      // Set user role to staff and attach business
      t.set(
        userRef,
        {
          uid: me.uid,
          email: me.email,
          role: "staff",
          businessId,
          businessSlug: String(biz.slug || inv.businessSlug || ""),
          staffPermissions: permissions,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Create staff membership doc under business
      const staffRef = adminDb.collection("businesses").doc(businessId).collection("staff").doc(me.uid);
      t.set(
        staffRef,
        {
          uid: me.uid,
          email: me.email,
          name: inv.name || null,
          permissions,
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Mark invite accepted
      t.set(
        inviteRef,
        {
          status: "accepted",
          acceptedByUid: me.uid,
          acceptedAtMs: Date.now(),
          updatedAtMs: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true, businessId };
    });

    if ((result as any).ok === false) {
      const r: any = result;
      return NextResponse.json({ ok: false, error: r.error }, { status: r.status || 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}