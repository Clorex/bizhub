import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    return 0;
  } catch {
    return 0;
  }
}

function csvEscape(value: any) {
  const s = value == null ? "" : String(value);
  // escape quotes by doubling
  const q = s.replace(/"/g, '""');
  // wrap if it contains comma/newline/quote
  if (/[",\n\r]/.test(q)) return `"${q}"`;
  return q;
}

function opsEffective(o: any) {
  const OPS_KEYS = new Set(["new", "contacted", "paid", "in_transit", "delivered", "cancelled"]);
  const ops = String(o?.opsStatus || "").trim();
  if (OPS_KEYS.has(ops)) return ops;

  const orderStatus = String(o?.orderStatus || "").trim();
  if (OPS_KEYS.has(orderStatus)) return orderStatus;

  const pt = String(o?.paymentType || "");
  if (pt === "paystack_escrow") return "paid";
  if (pt === "direct_transfer") return "new";
  if (pt === "chat_whatsapp") return "new";
  return "";
}

function planExportCap(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 5000;
  if (k === "MOMENTUM") return 2000;
  if (k === "LAUNCH") return 200;
  return 0;
}

export async function GET(req: Request) {
  try {
    // ✅ owner-only export (PII may be included)
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();

    const cap = planExportCap(planKey);
    if (cap <= 0) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "CSV export is locked on your plan. Upgrade to export orders." },
        { status: 403 }
      );
    }

    // We order by createdAt ASC (works with businessId+createdAt ASC index if you created it earlier),
    // then reverse in-memory to get "newest first".
    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .orderBy("createdAt", "asc")
      .limit(cap)
      .get();

    const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    raw.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)); // newest first

    const rows = raw.slice(0, cap);

    const isLaunch = planKey === "LAUNCH";
    const isMomentum = planKey === "MOMENTUM";
    const isApex = planKey === "APEX";

    // Columns by plan (FREE blocked)
    const headersBase = [
      "orderId",
      "createdAt",
      "amount",
      "currency",
      "paymentType",
      "orderStatus",
      "escrowStatus",
      "opsStatus",
      "opsStatusEffective",
      "itemsCount",
      "itemsQtyTotal",
      "customerName",
      "customerPhone",
      "customerEmail",
    ];

    const headersMore = [
      "orderSource",
      "businessSlug",
      "shippingType",
      "shippingName",
      "shippingFee",
      "couponCode",
    ];

    const headersApex = [
      "customerAddress",
      "itemsJson", // full item details (JSON string)
    ];

    const headers =
      isApex ? [...headersBase, ...headersMore, ...headersApex]
      : isMomentum ? [...headersBase, ...headersMore]
      : isLaunch ? headersBase
      : headersBase;

    const lines: string[] = [];

    // UTF-8 BOM helps Excel show ₦ and other characters correctly
    lines.push("\ufeff" + headers.join(","));

    for (const o of rows) {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemsCount = items.length;

      let qtyTotal = 0;
      for (const it of items) qtyTotal += Number(it?.qty || 1);

      const amount = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      const createdMs = toMs(o.createdAt);
      const createdAt = createdMs ? new Date(createdMs).toISOString() : "";

      const record: Record<string, any> = {
        orderId: o.id,
        createdAt,
        amount,
        currency: o.currency || "NGN",
        paymentType: o.paymentType || "",
        orderStatus: o.orderStatus || "",
        escrowStatus: o.escrowStatus || "",
        opsStatus: o.opsStatus || "",
        opsStatusEffective: opsEffective(o),
        itemsCount,
        itemsQtyTotal: qtyTotal,
        customerName: o?.customer?.fullName || "",
        customerPhone: o?.customer?.phone || "",
        customerEmail: o?.customer?.email || "",
      };

      if (isMomentum || isApex) {
        record.orderSource = o.orderSource || "";
        record.businessSlug = o.businessSlug || "";
        record.shippingType = o?.shipping?.type || "";
        record.shippingName = o?.shipping?.name || "";
        record.shippingFee = o?.shipping?.feeKobo != null ? Number(o.shipping.feeKobo) / 100 : "";
        record.couponCode = o?.coupon?.code || o?.coupon?.couponCode || o?.coupon || "";
      }

      if (isApex) {
        record.customerAddress = o?.customer?.address || "";
        try {
          record.itemsJson = JSON.stringify(items);
        } catch {
          record.itemsJson = "";
        }
      }

      const line = headers.map((h) => csvEscape(record[h])).join(",");
      lines.push(line);
    }

    const csv = lines.join("\r\n");

    const filename = `bizhub_orders_${me.businessId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}