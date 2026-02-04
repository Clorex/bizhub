import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";
import { cloudinary } from "@/lib/cloudinary/server";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digitsOnly(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function last10(v: string) {
  const d = digitsOnly(v);
  return d.length >= 10 ? d.slice(-10) : d;
}

function lowerEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

function safeName(v: string) {
  return String(v || "proof")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
}

function isSettled(status: string) {
  const s = String(status || "");
  return s === "accepted" || s === "paid";
}

async function uploadToCloudinary(opts: { buffer: Buffer; folder: string; publicId: string }) {
  return await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: opts.folder, public_id: opts.publicId, resource_type: "auto", overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    Readable.from(opts.buffer).pipe(stream);
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string; idx: string }> }) {
  try {
    const { orderId, idx } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    const i = Math.floor(Number(idx));

    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    if (!Number.isFinite(i) || i < 0) return NextResponse.json({ ok: false, error: "Invalid installment index" }, { status: 400 });

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;
    const businessId = String(o?.businessId || "");
    if (!businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(businessId);

    const access = await getVendorLimitsResolved(businessId);

    // ✅ Packages-controlled security
    if (!access?.features?.installmentPlans) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Installment payments are not available for this store." },
        { status: 403 }
      );
    }

    // proof upload must also be enabled
    if (!access?.features?.proofOfPayment) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Proof upload is not available for this store." },
        { status: 403 }
      );
    }

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
    if (isSettled(inst?.status)) {
      return NextResponse.json({ ok: false, error: "This installment is already completed." }, { status: 400 });
    }

    // Customer match (phone/email from form must match order)
    const form = await req.formData();
    const f = form.get("file") as File | null;
    const customerPhone = String(form.get("customerPhone") || "");
    const customerEmail = String(form.get("customerEmail") || "");

    const orderPhone = String(o?.customer?.phone || "");
    const orderEmail = String(o?.customer?.email || "");

    const phoneOk = !!digitsOnly(orderPhone) && last10(customerPhone) === last10(orderPhone);
    const emailOk = !!lowerEmail(orderEmail) && lowerEmail(customerEmail) === lowerEmail(orderEmail);

    if (!phoneOk && !emailOk) {
      return NextResponse.json({ ok: false, error: "Customer details do not match this order." }, { status: 403 });
    }

    if (!f) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

    const maxBytes = 5 * 1024 * 1024;
    if (typeof (f as any)?.size === "number" && (f as any).size > maxBytes) {
      return NextResponse.json({ ok: false, error: "File too large. Max 5MB." }, { status: 400 });
    }

    const contentType = String((f as any)?.type || "application/octet-stream");
    const originalName = safeName(String((f as any)?.name || "proof"));
    const buf = Buffer.from(await f.arrayBuffer());

    const now = Date.now();
    const folder = `bizhub/installment-proofs/${businessId}/${orderIdClean}/i${i}`;
    const publicId = `${now}_${originalName}`;

    const up = await uploadToCloudinary({ buffer: buf, folder, publicId });

    const secureUrl = String(up?.secure_url || "");
    const cloudPublicId = String(up?.public_id || "");
    if (!secureUrl || !cloudPublicId) return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });

    const next = [...list];
    next[i] = {
      ...inst,
      status: "submitted",
      submittedAtMs: now,
      reviewedAtMs: null,
      rejectReason: null,
      proof: {
        originalName,
        contentType,
        size: buf.length,
        uploadedAtMs: now,
        uploadedBy: {
          method: "customer",
          phone: phoneOk ? digitsOnly(customerPhone) : null,
          email: emailOk ? lowerEmail(customerEmail) : null,
        },
        cloudinary: {
          publicId: cloudPublicId,
          secureUrl,
          resourceType: String(up?.resource_type || ""),
          format: String(up?.format || ""),
        },
      },
    };

    await ref.set(
      {
        updatedAt: new Date(),
        paymentPlan: { ...plan, updatedAtMs: now, installments: next },
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, proof: { idx: i, status: "submitted", uploadedAtMs: now, secureUrl } });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Store locked." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}