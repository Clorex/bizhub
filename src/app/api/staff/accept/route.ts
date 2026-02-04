// FILE: src/app/api/staff/accept/route.ts
import { NextResponse } from "next/server";
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getEntitlement } from "@/lib/bizhubPlans";
import { staffSeatLimitFor } from "@/lib/vendor/staffSeatsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function addonSeatPlus1ActiveEffective(biz: any, nowMs: number) {
  const ent = biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};
  const a = ent["addon_staff_plus1"];
  if (!a || typeof a !== "object") return false;

  const status = String(a.status || "");
  const expiresAtMs = Number(a.expiresAtMs || 0) || 0;
  const remainingMs = Number(a.remainingMs || 0) || 0;

  if (status === "active") return !!(expiresAtMs && expiresAtMs > nowMs);
  if (status === "paused") return remainingMs > 0; // effective resume when subscription is active
  return false;
}

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

      const bizRef = adminDb.collection("businesses").doc(businessId);
      const bizSnap = await t.get(bizRef);
      if (!bizSnap.exists) return { ok: false, status: 404, error: "Business not found" as const };
      const biz = bizSnap.data() as any;

      const entitlement = getEntitlement({
        trial: biz?.trial ?? null,
        subscription: biz?.subscription ?? null,
      }) as any;

      const planKey = String(entitlement?.planKey || "FREE").toUpperCase();
      let seatLimit = staffSeatLimitFor(planKey);

      const nowMs = Date.now();
      const subActive = hasActiveSubscription(biz);

      // ✅ Launch add-on: +1 staff seat
      if (subActive && planKey === "LAUNCH" && addonSeatPlus1ActiveEffective(biz, nowMs)) {
        seatLimit += 1;
      }

      if (seatLimit <= 0) {
        return {
          ok: false,
          status: 403,
          code: "FEATURE_LOCKED" as const,
          error: "This business must upgrade to add staff members.",
        };
      }

      // Enforce ACTIVE staff count (atomic inside transaction)
      const staffQ = adminDb.collection("businesses").doc(businessId).collection("staff").limit(seatLimit + 1);
      const staffSnap = await t.get(staffQ);
      if (staffSnap.size >= seatLimit) {
        return {
          ok: false,
          status: 403,
          code: "STAFF_LIMIT_REACHED" as const,
          error: `This business has reached its staff limit (${seatLimit}). Ask the owner to upgrade or buy +1 seat.`,
        };
      }

      const userRef = adminDb.collection("users").doc(me.uid);
      const userSnap = await t.get(userRef);
      const userData = userSnap.exists ? (userSnap.data() as any) : {};
      const curRole = String(userData.role || "customer");
      if (curRole === "admin" || curRole === "owner") {
        return { ok: false, status: 403, error: "This account cannot be added as staff" as const };
      }

      const permissions = inv.permissions || {};
      const jobTitle = String(inv.jobTitle || "").trim().slice(0, 60);

      t.set(
        userRef,
        {
          uid: me.uid,
          email: me.email,
          role: "staff",
          businessId,
          businessSlug: String(biz.slug || inv.businessSlug || ""),
          staffPermissions: permissions,
          staffJobTitle: jobTitle || null,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const staffRef = adminDb.collection("businesses").doc(businessId).collection("staff").doc(me.uid);
      t.set(
        staffRef,
        {
          uid: me.uid,
          email: me.email,
          name: inv.name || null,
          jobTitle: jobTitle || null,
          permissions,
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(
        inviteRef,
        {
          status: "accepted",
          acceptedByUid: me.uid,
          acceptedAtMs: nowMs,
          updatedAtMs: nowMs,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true, businessId, planKey, seatLimit };
    });

    if ((result as any).ok === false) {
      const r: any = result;
      return NextResponse.json({ ok: false, code: r.code, error: r.error }, { status: r.status || 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}