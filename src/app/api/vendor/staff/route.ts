import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

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

function cleanPerms(p: any) {
  const obj = p && typeof p === "object" ? p : {};
  return {
    productsView: !!obj.productsView,
    productsManage: !!obj.productsManage,
    ordersView: !!obj.ordersView,
    ordersManage: !!obj.ordersManage,
    analyticsView: !!obj.analyticsView,
    storeManage: false, // owner-only for now
    walletAccess: false, // owner-only
    payoutAccess: false, // owner-only
  };
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    // Staff members
    const staffSnap = await adminDb
      .collection("businesses")
      .doc(me.businessId)
      .collection("staff")
      .limit(200)
      .get();

    const staff = staffSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Invites
    const invSnap = await adminDb
      .collection("staffInvites")
      .where("businessId", "==", me.businessId)
      .limit(200)
      .get();

    const invites = invSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      .slice(0, 100);

    return NextResponse.json({ ok: true, staff, invites });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));
    const email = cleanEmail(body.email);
    const name = String(body.name || "").trim().slice(0, 80);
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

      permissions: perms,

      status: "pending", // pending | accepted | revoked
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: me.uid,
    });

    const inviteLink = `${appUrlFrom(req)}/account/invite?code=${encodeURIComponent(inviteId)}`;

    return NextResponse.json({ ok: true, inviteId, inviteLink });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
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
      await ref.set({ status: "revoked", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (staffUid) {
      // Remove staff membership doc + downgrade user role back to customer (safe)
      const staffRef = adminDb.collection("businesses").doc(me.businessId).collection("staff").doc(staffUid);
      await staffRef.delete().catch(() => {});

      await adminDb.collection("users").doc(staffUid).set(
        {
          role: "customer",
          businessId: FieldValue.delete(),
          businessSlug: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "No action" }, { status: 400 });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}