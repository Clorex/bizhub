
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

function digitsOnly(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function lowerEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

function listCaps(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return { orderScanCap: 10000, customersVisible: 3000 };
  if (k === "MOMENTUM") return { orderScanCap: 6000, customersVisible: 1000 };
  if (k === "LAUNCH") return { orderScanCap: 2000, customersVisible: 300 };
  return { orderScanCap: 800, customersVisible: 50 }; // FREE = “taste”
}

function exportUnlocked(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  return k !== "FREE";
}

function safeCustomerKey(v: string) {
  return String(v || "").replaceAll("/", "_").trim();
}

function noteDocId(businessId: string, customerKey: string) {
  return `${businessId}__${safeCustomerKey(customerKey)}`;
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");

    // ✅ IMPORTANT: capture as a guaranteed string for TS + callbacks
    const businessId = me.businessId;
    if (!businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(businessId);

    const access = await getVendorLimitsResolved(businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();

    const caps = listCaps(planKey);

    // store slug needed for store opt-out checks
    const storeSlug = String(me.businessSlug || "").trim().toLowerCase();

    // Orders scan (one where + limit, sort in-memory)
    const oSnap = await adminDb
      .collection("orders")
      .where("businessId", "==", businessId)
      .limit(caps.orderScanCap)
      .get();

    const orders = oSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    type Agg = {
      customerKey: string;
      fullName: string;
      phone: string;
      email: string;
      ordersCount: number;
      totalSpent: number;
      lastOrderMs: number;
      lastOrderId: string;
    };

    const map = new Map<string, Agg>();

    for (const o of orders) {
      const phone = digitsOnly(String(o?.customer?.phone || ""));
      const email = lowerEmail(String(o?.customer?.email || ""));
      const customerKey = phone ? `phone:${phone}` : email ? `email:${email}` : "";
      if (!customerKey) continue;

      const fullName = String(o?.customer?.fullName || "").trim();
      const ms = toMs(o.createdAt);
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);

      const cur =
        map.get(customerKey) ||
        ({
          customerKey,
          fullName: fullName || "",
          phone,
          email,
          ordersCount: 0,
          totalSpent: 0,
          lastOrderMs: ms || 0,
          lastOrderId: String(o.id || ""),
        } as Agg);

      cur.ordersCount += 1;
      cur.totalSpent += Math.max(0, amt);

      if (!cur.fullName && fullName) cur.fullName = fullName;
      if (!cur.phone && phone) cur.phone = phone;
      if (!cur.email && email) cur.email = email;

      if (ms && (!cur.lastOrderMs || ms > cur.lastOrderMs)) {
        cur.lastOrderMs = ms;
        cur.lastOrderId = String(o.id || "");
      }

      map.set(customerKey, cur);
    }

    let customers = Array.from(map.values()).sort((a, b) => (b.lastOrderMs || 0) - (a.lastOrderMs || 0));
    customers = customers.slice(0, caps.customersVisible);

    // ✅ Customer Notes (packages-controlled)
    const notesAllowed = !!access?.features?.customerNotes;
    const notesMap = new Map<string, any>();

    if (notesAllowed && customers.length > 0) {
      const refs = customers.map((c) =>
        adminDb.collection("customerNotes").doc(noteDocId(businessId, c.customerKey))
      );

      const anyDb: any = adminDb as any;
      const snaps =
        typeof anyDb.getAll === "function"
          ? await anyDb.getAll(...refs)
          : await Promise.all(refs.map((r: any) => r.get()));

      for (const s of snaps) {
        if (!s?.exists) continue;
        const d = s.data() as any;
        const ck = String(d.customerKey || "");
        if (!ck) continue;

        notesMap.set(ck, {
          vip: !!d.vip,
          debt: !!d.debt,
          issue: !!d.issue,
          note: String(d.note || ""),
          debtAmount: Number(d.debtAmount || 0),
          updatedAtMs: Number(d.updatedAtMs || 0),
        });
      }
    }

    // Opt-out sets (server-side): users.marketingPrefs
    const globalOptOutEmails = new Set<string>();
    const storeOptOutEmails = new Set<string>();

    const globalSnap = await adminDb
      .collection("users")
      .where("marketingPrefs.globalOptOut", "==", true)
      .limit(20000)
      .get();

    for (const d of globalSnap.docs) {
      const u = d.data() as any;
      const e = lowerEmail(String(u.emailLower || u.email || ""));
      if (e) globalOptOutEmails.add(e);
    }

    if (storeSlug) {
      const storeSnap = await adminDb
        .collection("users")
        .where("marketingPrefs.storeOptOutSlugs", "array-contains", storeSlug)
        .limit(20000)
        .get();

      for (const d of storeSnap.docs) {
        const u = d.data() as any;
        const e = lowerEmail(String(u.emailLower || u.email || ""));
        if (e) storeOptOutEmails.add(e);
      }
    }

    const out = customers.map((c) => {
      const e = lowerEmail(c.email);
      const optedOutGlobal = !!e && globalOptOutEmails.has(e);
      const optedOutStore = !!e && storeOptOutEmails.has(e);
      const marketingOptedOut = optedOutGlobal || optedOutStore;
      const optOutScope = optedOutGlobal ? "global" : optedOutStore ? "store" : "";

      const notes = notesAllowed ? notesMap.get(c.customerKey) || null : null;

      return {
        customerKey: c.customerKey,
        fullName: c.fullName || null,
        phone: c.phone || null,
        email: c.email || null,
        ordersCount: c.ordersCount,
        totalSpent: Number(c.totalSpent.toFixed(2)),
        lastOrderMs: c.lastOrderMs || 0,
        lastOrderId: c.lastOrderId || null,
        marketingOptedOut,
        optOutScope,
        notes,
      };
    });

    return Response.json({
      ok: true,
      meta: {
        planKey,
        limits: {
          customersVisible: caps.customersVisible,
          customersExportUnlocked: exportUnlocked(planKey),

          // ✅ UI reads this
          customerNotesUnlocked: notesAllowed,
        },
      },
      customers: out,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." },
        { status: 403 }
      );
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}