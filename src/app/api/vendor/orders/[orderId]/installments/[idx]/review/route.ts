import { NextResponse, type NextRequest } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSettled(status: string) {
  const s = String(status || "");
  return s === "accepted" || s === "paid";
}

function computePaidKobo(installments: any[]) {
  return (Array.isArray(installments) ? installments : []).reduce((sum, x) => {
    return sum + (isSettled(String(x?.status || "")) ? Number(x?.amountKobo || 0) : 0);
  }, 0);
}

function allSettled(installments: any[]) {
  const arr = Array.isArray(installments) ? installments : [];
  return arr.length > 0 && arr.every((x) => isSettled(String(x?.status || "")));
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string; idx: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    // ✅ packages-controlled security (includes add-on unlock)
    if (!access?.features?.installmentPlans) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Installment plans are locked on your plan." },
        { status: 403 }
      );
    }

    const { orderId, idx } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    const i = Math.floor(Number(idx));

    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    if (!Number.isFinite(i) || i < 0) {
      return NextResponse.json({ ok: false, error: "Invalid installment index" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || "").toLowerCase(); // accept|reject
    const rejectReason = String(body?.rejectReason || "").trim().slice(0, 300);

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;
    if (String(o?.businessId || "") !== String(me.businessId || "")) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    // Only bank transfer installments need manual review
    if (String(o?.paymentType || "") !== "direct_transfer") {
      return NextResponse.json({ ok: false, error: "This is not a bank transfer order." }, { status: 400 });
    }

    const plan = o?.paymentPlan;
    const list = Array.isArray(plan?.installments) ? plan.installments : [];
    if (!plan?.enabled || list.length === 0) {
      return NextResponse.json({ ok: false, error: "No installment plan on this order." }, { status: 400 });
    }

    if (i >= list.length) return NextResponse.json({ ok: false, error: "Installment not found." }, { status: 404 });

    const inst = list[i] || {};
    if (!inst?.proof?.cloudinary?.secureUrl) {
      return NextResponse.json({ ok: false, error: "No proof uploaded for this installment yet." }, { status: 400 });
    }

    const now = Date.now();
    const next = [...list];

    if (action === "accept") {
      next[i] = { ...inst, status: "accepted", reviewedAtMs: now, rejectReason: null, reviewedByUid: me.uid || null };
    } else {
      next[i] = {
        ...inst,
        status: "rejected",
        reviewedAtMs: now,
        rejectReason: rejectReason || "Rejected",
        reviewedByUid: me.uid || null,
      };
    }

    const paidKobo = computePaidKobo(next);
    const completed = allSettled(next) && paidKobo === Number(plan?.totalKobo || 0);

    const patch: any = {
      updatedAt: FieldValue.serverTimestamp(),
      paymentPlan: {
        ...plan,
        installments: next,
        paidKobo,
        completed,
        completedAtMs: completed ? now : null,
        updatedAtMs: now,
      },
    };

    if (completed) {
      patch.paymentStatus = "confirmed";
      patch.orderStatus = "paid";
      patch.opsStatus = "paid";
      patch.opsUpdatedAtMs = now;
    }

    await ref.set(patch, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}