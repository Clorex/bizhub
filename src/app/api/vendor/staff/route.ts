// FILE: src/app/api/vendor/staff/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getStaffSeatState } from "@/lib/vendor/staffSeatsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return u.origin;
}

function cleanEmail(v: any) {
  const e = String(v || "").trim().toLowerCase();
  if (!e.includes("@") || e.length < 5) return "";
  return e;
}

function cleanJobTitle(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.slice(0, 60);
}

function cleanPerms(p: any) {
  const obj = p && typeof p === "object" ? p : {};
  return {
    productsView: !!obj.productsView,
    productsManage: !!obj.productsManage,
    ordersView: !!obj.ordersView,
    ordersManage: !!obj.ordersManage,
    analyticsView: !!obj.analyticsView,
    storeManage: false,
    walletAccess: false,
    payoutAccess: false,
  };
}

function suggestionForStaffLimit(planKey: string) {
  const pk = String(planKey || "").toUpperCase();
  if (pk === "LAUNCH") {
    return {
      action: "buy_addon",
      sku: "addon_staff_plus1",
      title: "Buy Staff +1 seat",
      url: "/vendor/purchases",
    };
  }
  return {
    action: "upgrade",
    title: "Upgrade plan",
    url: "/vendor/subscription",
  };
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const staffSnap = await adminDb.collection("businesses").doc(me.businessId).collection("staff").limit(200).get();
    const staff = staffSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const invSnap = await adminDb.collection("staffInvites").where("businessId", "==", me.businessId).limit(200).get();
    const invites = invSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      .slice(0, 100);

    const seats = await getStaffSeatState(me.businessId);

    return NextResponse.json({ ok: true, staff, invites, seats });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const seats = await getStaffSeatState(me.businessId);
    if (seats.seatLimit <= 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "FEATURE_LOCKED",
          error: "Upgrade your plan to add staff members.",
          suggestion: { action: "upgrade", url: "/vendor/subscription" },
          seats,
        },
        { status: 403 }
      );
    }
    if (seats.used >= seats.seatLimit) {
      const sug = suggestionForStaffLimit(String(seats.planKey || ""));
      return NextResponse.json(
        {
          ok: false,
          code: "STAFF_LIMIT_REACHED",
          error:
            sug.action === "buy_addon"
              ? `You have reached your staff limit (${seats.seatLimit}). Buy +1 seat to add one more staff member.`
              : `You have reached your staff limit (${seats.seatLimit}). Upgrade to add more.`,
          suggestion: sug,
          seats,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = cleanEmail(body.email);
    const name = String(body.name || "").trim().slice(0, 80);
    const jobTitle = cleanJobTitle(body.jobTitle);
    const perms = cleanPerms(body.permissions);

    if (!email) return NextResponse.json({ ok: false, error: "Valid staff email is required" }, { status: 400 });

    const inviteRef = adminDb.collection("staffInvites").doc();
    const inviteId = inviteRef.id;

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
    const slug = String(biz?.slug || me.businessSlug || "");

    await inviteRef.set({
      businessId: me.businessId,
      businessSlug: slug || null,

      email,
      emailLower: email,
      name: name || null,
      jobTitle: jobTitle || null,

      permissions: perms,

      status: "pending", // pending | accepted | revoked
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: me.uid,
    });

    // ✅ NEW: invite points to staff register page
    const inviteLink = `${appUrlFrom(req)}/staff/register?code=${encodeURIComponent(inviteId)}`;

    return NextResponse.json({ ok: true, inviteId, inviteLink });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const url = new URL(req.url);
    const inviteId = String(url.searchParams.get("inviteId") || "");
    const staffUid = String(url.searchParams.get("staffUid") || "");

    if (!inviteId && !staffUid) {
      return NextResponse.json({ ok: false, error: "inviteId or staffUid required" }, { status: 400 });
    }

    if (inviteId) {
      const ref = adminDb.collection("staffInvites").doc(inviteId);
      await ref.set(
        { status: "revoked", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return NextResponse.json({ ok: true });
    }

    if (staffUid) {
      const staffRef = adminDb.collection("businesses").doc(me.businessId).collection("staff").doc(staffUid);
      await staffRef.delete().catch(() => {});

      await adminDb
        .collection("users")
        .doc(staffUid)
        .set(
          {
            role: "customer",
            businessId: FieldValue.delete(),
            businessSlug: FieldValue.delete(),
            staffPermissions: FieldValue.delete(),
            staffJobTitle: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "No action" }, { status: 400 });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}