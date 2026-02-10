
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    // ✅ packages-controlled security
    if (!access?.features?.proofOfPayment) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Proof-of-payment is locked on your plan. Upgrade to use it." },
        { status: 403 }
      );
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "");
    if (!orderIdClean) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || "").toLowerCase(); // "accept" | "reject"
    const rejectReason = String(body?.rejectReason || "").trim().slice(0, 300);

    if (action !== "accept" && action !== "reject") {
      return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;
    if (String(o?.businessId || "") !== String(me.businessId || "")) {
      return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    if (String(o?.paymentType || "") !== "direct_transfer") {
      return Response.json({ ok: false, error: "This is not a bank transfer order." }, { status: 400 });
    }

    const tp = o?.transferProof || null;
    if (!tp?.cloudinary?.secureUrl) {
      return Response.json({ ok: false, error: "No proof uploaded yet." }, { status: 400 });
    }

    const now = Date.now();

    if (action === "accept") {
      await ref.set(
        {
          updatedAt: new Date(),
          transferProof: {
            ...(tp || {}),
            status: "accepted",
            reviewedAtMs: now,
            reviewedByUid: me.uid || null,
            rejectReason: null,
          },

          paymentStatus: "confirmed",
          orderStatus: "paid",

          opsStatus: "paid",
          opsUpdatedAtMs: now,
        },
        { merge: true }
      );
    } else {
      await ref.set(
        {
          updatedAt: new Date(),
          transferProof: {
            ...(tp || {}),
            status: "rejected",
            reviewedAtMs: now,
            reviewedByUid: me.uid || null,
            rejectReason: rejectReason || "Rejected",
          },

          paymentStatus: "pending",
          orderStatus: "awaiting_vendor_confirmation",
        },
        { merge: true }
      );
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}