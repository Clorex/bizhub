
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCustomerKey(v: string) {
  return String(v || "").replaceAll("/", "_").trim();
}

function noteDocId(businessId: string, customerKey: string) {
  return `${businessId}__${safeCustomerKey(customerKey)}`;
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    // ✅ Packages-controlled security
    if (!access?.features?.customerNotes) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Customer notes are locked on your plan. Upgrade to use notes." },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const customerKey = safeCustomerKey(url.searchParams.get("customerKey") || "");
    if (!customerKey) return Response.json({ ok: false, error: "Missing customerKey" }, { status: 400 });

    const ref = adminDb.collection("customerNotes").doc(noteDocId(me.businessId, customerKey));
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as any) : null;

    return Response.json({
      ok: true,
      note: data
        ? {
            customerKey: data.customerKey || customerKey,
            vip: !!data.vip,
            debt: !!data.debt,
            issue: !!data.issue,
            note: String(data.note || ""),
            debtAmount: Number(data.debtAmount || 0),
            updatedAtMs: Number(data.updatedAtMs || 0),
          }
        : null,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    // ✅ Packages-controlled security
    if (!access?.features?.customerNotes) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Customer notes are locked on your plan. Upgrade to use notes." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const customerKey = safeCustomerKey(body.customerKey || "");
    if (!customerKey) return Response.json({ ok: false, error: "Missing customerKey" }, { status: 400 });

    const vip = !!body.vip;
    const debt = !!body.debt;
    const issue = !!body.issue;

    const noteText = String(body.note || "").slice(0, 1000);
    const debtAmountRaw = Number(body.debtAmount || 0);
    const debtAmount = debt ? Math.max(0, debtAmountRaw) : 0;

    const now = Date.now();

    const ref = adminDb.collection("customerNotes").doc(noteDocId(me.businessId, customerKey));
    const existing = await ref.get();
    const createdAtMs = existing.exists ? Number((existing.data() as any)?.createdAtMs || now) : now;

    await ref.set(
      {
        businessId: me.businessId,
        customerKey,
        vip,
        debt,
        issue,
        note: noteText,
        debtAmount,
        createdAtMs,
        updatedAtMs: now,
      },
      { merge: true }
    );

    return Response.json({
      ok: true,
      note: { customerKey, vip, debt, issue, note: noteText, debtAmount, updatedAtMs: now },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}