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

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const orderRef = adminDb.collection("orders").doc(orderIdClean);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = orderSnap.data() as any;

    const businessId = String(o?.businessId || "");
    if (!businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    // store must be active / unlocked
    await requireVendorUnlocked(businessId);

    // ✅ packages-controlled security
    const access = await getVendorLimitsResolved(businessId);
    if (!access?.hasActiveSubscription) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "This store does not currently accept proof uploads." },
        { status: 403 }
      );
    }

    if (!access?.features?.proofOfPayment) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Proof-of-payment upload is not available for this store." },
        { status: 403 }
      );
    }

    if (String(o?.paymentType || "") !== "direct_transfer") {
      return NextResponse.json({ ok: false, error: "This order is not a bank transfer order." }, { status: 400 });
    }

    const form = await req.formData();
    const f = form.get("file") as File | null;

    // simple “match to order” check
    const customerPhone = String(form.get("customerPhone") || "");
    const customerEmail = String(form.get("customerEmail") || "");

    const orderPhone = String(o?.customer?.phone || "");
    const orderEmail = String(o?.customer?.email || "");

    const phoneOk = !!digitsOnly(orderPhone) && last10(customerPhone) === last10(orderPhone);
    const emailOk = !!lowerEmail(orderEmail) && lowerEmail(customerEmail) === lowerEmail(orderEmail);

    if (!phoneOk && !emailOk) {
      return NextResponse.json(
        { ok: false, error: "Customer details do not match this order. Use the same phone/email used for the order." },
        { status: 403 }
      );
    }

    if (!f) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (typeof (f as any)?.size === "number" && (f as any).size > maxBytes) {
      return NextResponse.json({ ok: false, error: "File too large. Max 5MB." }, { status: 400 });
    }

    const contentType = String((f as any)?.type || "application/octet-stream");
    const originalName = safeName(String((f as any)?.name || "proof"));
    const buf = Buffer.from(await f.arrayBuffer());

    const now = Date.now();
    const folder = `bizhub/transfer-proofs/${businessId}/${orderIdClean}`;
    const publicId = `${now}_${originalName}`;

    const up = await uploadToCloudinary({ buffer: buf, folder, publicId });

    const secureUrl = String(up?.secure_url || "");
    const cloudPublicId = String(up?.public_id || "");
    const resourceType = String(up?.resource_type || "");
    const format = String(up?.format || "");

    if (!secureUrl || !cloudPublicId) {
      return NextResponse.json({ ok: false, error: "Upload failed. Try again." }, { status: 500 });
    }

    await orderRef.set(
      {
        updatedAt: new Date(),
        transferProof: {
          status: "submitted",
          originalName,
          contentType,
          size: buf.length,
          uploadedAtMs: now,
          reviewedAtMs: null,
          reviewedByUid: null,
          rejectReason: null,
          uploadedBy: {
            method: "customer",
            phone: phoneOk ? digitsOnly(customerPhone) : null,
            email: emailOk ? lowerEmail(customerEmail) : null,
          },
          cloudinary: {
            publicId: cloudPublicId,
            secureUrl,
            resourceType,
            format,
          },
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      proof: { status: "submitted", uploadedAtMs: now, originalName, secureUrl },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "This store is not currently accepting proof uploads." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}