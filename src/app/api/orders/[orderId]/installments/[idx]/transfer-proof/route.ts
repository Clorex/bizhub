import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";
import { cloudinary } from "@/lib/cloudinary/server";
import { Readable } from "node:stream";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function safeName(v: string) {
  return String(v || "proof").replace(/[^\w.\-]+/g, "_").slice(0, 80);
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

function recomputePlan(plan: any) {
  const installments = Array.isArray(plan?.installments) ? plan.installments : [];
  const totalKobo = Number(plan?.totalKobo || 0);

  const paidKobo = installments.reduce((sum: number, it: any) => {
    const st = String(it?.status || "pending");
    const amt = Number(it?.amountKobo || 0);
    if (st === "paid" || st === "accepted") return sum + Math.max(0, amt);
    return sum;
  }, 0);

  const completed = installments.length > 0 && installments.every((it: any) => {
    const st = String(it?.status || "pending");
    return st === "paid" || st === "accepted";
  });

  return {
    ...plan,
    paidKobo,
    completed: completed && paidKobo >= totalKobo,
    completedAtMs: completed && paidKobo >= totalKobo ? Date.now() : null,
    updatedAtMs: Date.now(),
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string; idx: string }> }) {
  try {
    const me = await requireMe(req);

    const { orderId, idx } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    const i = Math.floor(Number(idx));

    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    if (!Number.isFinite(i) || i < 0) return NextResponse.json({ ok: false, error: "Invalid installment index" }, { status: 400 });

    const form = await req.formData();
    const f = form.get("file") as File | null;
    if (!f) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

    const maxBytes = 5 * 1024 * 1024;
    if (typeof (f as any)?.size === "number" && (f as any).size > maxBytes) {
      return NextResponse.json({ ok: false, error: "File too large. Max 5MB." }, { status: 400 });
    }

    const buf = Buffer.from(await f.arrayBuffer());
    const originalName = safeName(String((f as any)?.name || "proof"));
    const contentType = String((f as any)?.type || "application/octet-stream");

    const ref = adminDb.collection("orders").doc(orderIdClean);

    const res = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Order not found");

      const o = snap.data() as any;

      // ownership
      if (me.role === "customer") {
        const myEmail = lowerEmail(me.email);
        const orderEmail = lowerEmail(o?.customer?.email);
        if (!myEmail || !orderEmail || myEmail !== orderEmail) {
          const err: any = new Error("Not allowed");
          err.status = 403;
          throw err;
        }
      }

      if (String(o?.paymentType || "") !== "direct_transfer") {
        const err: any = new Error("This is not a bank transfer order.");
        err.status = 400;
        throw err;
      }

      const plan = o?.paymentPlan;
      const list = Array.isArray(plan?.installments) ? plan.installments : [];
      if (!plan?.enabled || list.length === 0) {
        const err: any = new Error("No installment plan found on this order.");
        err.status = 400;
        throw err;
      }
      if (!list[i]) {
        const err: any = new Error("Installment not found.");
        err.status = 404;
        throw err;
      }

      const inst = list[i];
      const st = String(inst?.status || "pending");
      if (st === "accepted" || st === "paid") {
        return { ok: true, already: true };
      }

      const now = Date.now();
      const folder = `bizhub/installment-proofs/${String(o?.businessId || "unknown")}/${orderIdClean}`;
      const publicId = `${now}_inst_${i}_${originalName}`;

      const up = await uploadToCloudinary({ buffer: buf, folder, publicId });
      const secureUrl = String(up?.secure_url || "");
      const cloudPublicId = String(up?.public_id || "");
      if (!secureUrl || !cloudPublicId) throw new Error("Upload failed");

      const nextList = list.map((x: any, idx2: number) => {
        if (idx2 !== i) return x;
        return {
          ...x,
          status: "submitted",
          submittedAtMs: now,
          rejectReason: null,
          proof: {
            originalName,
            contentType,
            size: buf.length,
            cloudinary: { publicId: cloudPublicId, secureUrl },
          },
        };
      });

      const nextPlan = recomputePlan({ ...plan, installments: nextList });

      tx.set(
        ref,
        {
          updatedAt: FieldValue.serverTimestamp(),
          paymentPlan: nextPlan,
        },
        { merge: true }
      );

      return { ok: true, proofUrl: secureUrl };
    });

    return NextResponse.json(res);
  } catch (e: any) {
    const status = Number(e?.status || 500);
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status });
  }
}