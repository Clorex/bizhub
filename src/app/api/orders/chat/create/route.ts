// FILE: src/app/api/orders/chat/create/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendBusinessPush } from "@/lib/push/sendBusinessPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanStr(v: any, max = 120) {
  return String(v || "").trim().slice(0, max);
}

function cleanSelectedOptions(v: any) {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    const kk = cleanStr(k, 30);
    const vv = cleanStr(val, 60);
    if (kk && vv) out[kk] = vv;
  }
  return Object.keys(out).length ? out : null;
}

function cleanItems(items: any[]) {
  const out: any[] = [];

  for (const it of items.slice(0, 50)) {
    const productId = cleanStr(it?.productId, 80);
    const name = cleanStr(it?.name, 120) || "Item";
    const qty = clampInt(it?.qty ?? 1, 1, 999);
    const price = Number(it?.price || 0);

    const imageUrl = it?.imageUrl ? cleanStr(it.imageUrl, 500) : null;
    const selectedOptions = cleanSelectedOptions(it?.selectedOptions);

    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;

    if (!productId) continue;

    out.push({
      productId,
      name,
      qty,
      price: safePrice,
      imageUrl: imageUrl || null,
      selectedOptions: selectedOptions || null,
    });
  }

  return out;
}

function computeSubtotalKoboFromItems(items: any[]) {
  let kobo = 0;
  for (const it of items) {
    const qty = clampInt(it?.qty ?? 1, 1, 999);
    const priceNgn = Number(it?.price || 0);
    const priceKobo = Math.floor((Number.isFinite(priceNgn) ? Math.max(0, priceNgn) : 0) * 100);
    kobo += qty * priceKobo;
  }
  return Math.max(0, Math.floor(kobo));
}

function safeInt(n: any, fallback = 0) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? v : fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const storeSlug = cleanStr(body.storeSlug, 80);
    const clientOrderId = cleanStr(body.clientOrderId, 120);
    const itemsRaw = Array.isArray(body.items) ? body.items : [];

    if (!storeSlug) return Response.json({ ok: false, error: "storeSlug is required" }, { status: 400 });
    if (!clientOrderId) return Response.json({ ok: false, error: "clientOrderId is required" }, { status: 400 });
    if (!itemsRaw.length) return Response.json({ ok: false, error: "items are required" }, { status: 400 });

    const bizSnap = await adminDb.collection("businesses").where("slug", "==", storeSlug).limit(1).get();
    if (bizSnap.empty) return Response.json({ ok: false, error: "Store not found" }, { status: 404 });

    const bizDoc = bizSnap.docs[0];
    const biz = { id: bizDoc.id, ...(bizDoc.data() as any) };
    const businessId = biz.id;

    const enabledToggle = biz?.continueInChatEnabled === true;
    const subscribed = hasActiveSubscription(biz);
    const whatsapp = cleanStr(biz?.whatsapp, 40);

    if (!enabledToggle) {
      return Response.json(
        { ok: false, code: "CHAT_DISABLED", error: "Continue in Chat is disabled for this store." },
        { status: 403 }
      );
    }
    if (!subscribed) {
      return Response.json(
        { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "Continue in Chat requires an active subscription." },
        { status: 403 }
      );
    }
    if (!whatsapp) {
      return Response.json({ ok: false, code: "WHATSAPP_NOT_SET", error: "Vendor WhatsApp is not set." }, { status: 400 });
    }

    const items = cleanItems(itemsRaw);
    if (!items.length) return Response.json({ ok: false, error: "No valid items" }, { status: 400 });

    const subtotalKobo = computeSubtotalKoboFromItems(items);
    const orderRef = adminDb.collection("orders").doc(clientOrderId);

    // Counter doc per business (atomic)
    const counterRef = adminDb.collection("businessCounters").doc(businessId);

    const result = await adminDb.runTransaction(async (t) => {
      const existing = await t.get(orderRef);
      if (existing.exists) {
        const d: any = existing.data() || {};
        return { ok: true, orderId: existing.id, orderNumber: d.orderNumber ?? null, alreadyExisted: true };
      }

      // Allocate next orderNumber
      const counterSnap = await t.get(counterRef);
      const cur = counterSnap.exists ? safeInt((counterSnap.data() as any)?.orderSeq, 0) : 0;
      const next = cur + 1;

      t.set(counterRef, { orderSeq: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const nowMs = Date.now();

      t.set(orderRef, {
        businessId,
        businessSlug: storeSlug,

        // NEW: simple sequential order number
        orderNumber: next,

        orderSource: "chat_whatsapp",
        paymentType: "chat_whatsapp",
        escrowStatus: "none",
        orderStatus: "new",

        opsStatus: "new",
        opsUpdatedAtMs: nowMs,

        items,
        customer: {},

        coupon: null,
        shipping: null,

        amountKobo: 0,
        amount: 0,
        currency: "NGN",

        quote: {
          subtotalKobo,
          currency: "NGN",
        },

        channel: {
          type: "whatsapp",
          vendorWhatsapp: whatsapp,
        },

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, orderId: orderRef.id, orderNumber: next, alreadyExisted: false };
    });

    if (result?.ok && !result?.alreadyExisted) {
      sendBusinessPush({
        businessId,
        title: "New order",
        body: "A customer started an order via WhatsApp.",
        url: `/vendor/orders/${result.orderId}`,
      }).catch(() => {});
    }

    return Response.json(result);
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed to create chat order" }, { status: 500 });
  }
}