
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { Timestamp } from "firebase-admin/firestore";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import type { ReengagementSegment } from "@/lib/vendor/reengagement/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhone(raw: string) {
  const d = String(raw || "").replace(/[^\d]/g, "");
  return d.length >= 7 ? d : "";
}

function cleanEmail(raw: string) {
  const e = String(raw || "").trim().toLowerCase();
  return e.includes("@") ? e : "";
}

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

function buyerKeyFromOrder(o: any) {
  const phone = cleanPhone(o?.customer?.phone || "");
  const email = cleanEmail(o?.customer?.email || "");
  return phone ? `phone:${phone}` : email ? `email:${email}` : "";
}

function planOrderScanCap(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 10000;
  if (k === "MOMENTUM") return 6000;
  if (k === "LAUNCH") return 2000;
  return 800;
}

function cleanSegment(v: any): ReengagementSegment {
  const s = String(v || "").trim();
  const allowed: ReengagementSegment[] = [
    "buyers_all",
    "buyers_first",
    "buyers_repeat",
    "inactive_30",
    "inactive_60",
    "inactive_90",
    "abandoned",
    "vip",
  ];

  // backward compatibility
  if (s === "buyers") return "buyers_all";
  if (s === "abandoned") return "abandoned";

  return (allowed.includes(s as any) ? (s as ReengagementSegment) : "buyers_all") as ReengagementSegment;
}

function isPaid(o: any) {
  const pt = String(o?.paymentType || "");
  const ps = String(o?.paymentStatus || "");
  const orderStatus = String(o?.orderStatus || "");

  if (pt === "paystack_escrow") return true;
  if (ps === "paid") return true;

  if (
    orderStatus === "paid_held" ||
    orderStatus === "released_to_vendor_wallet" ||
    orderStatus === "awaiting_vendor_confirmation"
  ) {
    return true;
  }

  return false;
}

function isDelivered(o: any) {
  const ops = String(o?.opsStatus || o?.opsStatusEffective || "").trim();
  return ops === "delivered";
}

function amountNgn(o: any) {
  const a = Number(o?.amount || 0);
  if (Number.isFinite(a) && a > 0) return a;

  const k = Number(o?.amountKobo || 0);
  if (Number.isFinite(k) && k > 0) return k / 100;

  return 0;
}

type Agg = {
  key: string;

  phone: string;
  email: string;
  fullName: string;

  completedOrdersCount: number;
  completedTotalSpent: number;
  lastCompletedOrderMs: number;
  lastCompletedOrderId: string;

  lastAbandonedOrderMs: number;
  lastAbandonedOrderId: string;

  lastAnyOrderMs: number;
  lastAnyOrderId: string;
};

function buildSegments(args: { nowMs: number; people: Agg[]; allowSmartGroups: boolean; allowVip: boolean }) {
  const { nowMs, people, allowSmartGroups, allowVip } = args;

  const buyersAll = people.filter((p) => p.completedOrdersCount >= 1);

  const first = allowSmartGroups ? buyersAll.filter((p) => p.completedOrdersCount === 1) : [];
  const repeat = allowSmartGroups ? buyersAll.filter((p) => p.completedOrdersCount >= 2) : [];

  const inactive = (days: number) =>
    allowSmartGroups
      ? buyersAll.filter((p) => p.lastCompletedOrderMs > 0 && nowMs - p.lastCompletedOrderMs >= days * 86400000)
      : [];

  let vip: Agg[] = [];
  if (allowVip) {
    const sorted = [...buyersAll].sort((a, b) => (b.completedTotalSpent || 0) - (a.completedTotalSpent || 0));
    const take = Math.max(10, Math.min(200, Math.ceil(sorted.length * 0.1)));
    vip = sorted.slice(0, take);
  }

  const abandoned = people.filter((p) => p.lastAbandonedOrderMs > 0);

  return {
    buyers_all: buyersAll,
    buyers_first: first,
    buyers_repeat: repeat,
    inactive_30: inactive(30),
    inactive_60: inactive(60),
    inactive_90: inactive(90),
    abandoned,
    vip,
  } as Record<ReengagementSegment, Agg[]>;
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const plan = await getBusinessPlanResolved(me.businessId);
    const planKey = String(plan.planKey || "FREE").toUpperCase();

    const reengagementEnabled = !!plan?.features?.reengagement;
    if (!reengagementEnabled) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Upgrade to use Re‑engagement." },
        { status: 403 }
      );
    }

    const allowSmartGroups = !!plan?.features?.reengagementSmartGroups;
    const allowVip = planKey === "APEX" && !!plan?.features?.reengagementAiRemix;

    const url = new URL(req.url);
    let segment = cleanSegment(url.searchParams.get("segment") || url.searchParams.get("audience"));

    const daysParam = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 90)));
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

    // If smart groups is OFF, force segment to buyers_all (except abandoned)
    if (!allowSmartGroups && segment !== "abandoned") segment = "buyers_all";
    // VIP is only allowed if reengagementAiRemix is enabled for Apex
    if (segment === "vip" && !allowVip) segment = "buyers_all";

    const orderScanCap = planOrderScanCap(planKey);

    const nowMs = Date.now();
    const lookbackDays = Math.max(120, daysParam);
    const startMs = nowMs - lookbackDays * 86400000;
    const startTs = Timestamp.fromMillis(startMs);

    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .where("createdAt", ">=", startTs)
      .limit(orderScanCap)
      .get();

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    const map = new Map<string, Agg>();

    for (const o of orders) {
      const key = buyerKeyFromOrder(o);
      if (!key) continue;

      const phone = cleanPhone(o?.customer?.phone || "");
      const email = cleanEmail(o?.customer?.email || "");
      const fullName = String(o?.customer?.fullName || "").trim();

      const ms = toMs(o.createdAt);
      const paid = isPaid(o);
      const delivered = isDelivered(o);
      const completed = paid || delivered;
      const amt = Math.max(0, amountNgn(o));

      const cur: Agg =
        map.get(key) ||
        ({
          key,
          phone,
          email,
          fullName,

          completedOrdersCount: 0,
          completedTotalSpent: 0,
          lastCompletedOrderMs: 0,
          lastCompletedOrderId: "",

          lastAbandonedOrderMs: 0,
          lastAbandonedOrderId: "",

          lastAnyOrderMs: 0,
          lastAnyOrderId: "",
        } as Agg);

      if (!cur.phone && phone) cur.phone = phone;
      if (!cur.email && email) cur.email = email;
      if (!cur.fullName && fullName) cur.fullName = fullName;

      if (ms && (!cur.lastAnyOrderMs || ms > cur.lastAnyOrderMs)) {
        cur.lastAnyOrderMs = ms;
        cur.lastAnyOrderId = String(o.id || "");
      }

      if (completed) {
        cur.completedOrdersCount += 1;
        cur.completedTotalSpent += amt;
        if (ms && (!cur.lastCompletedOrderMs || ms > cur.lastCompletedOrderMs)) {
          cur.lastCompletedOrderMs = ms;
          cur.lastCompletedOrderId = String(o.id || "");
        }
      } else {
        if (ms && (!cur.lastAbandonedOrderMs || ms > cur.lastAbandonedOrderMs)) {
          cur.lastAbandonedOrderMs = ms;
          cur.lastAbandonedOrderId = String(o.id || "");
        }
      }

      map.set(key, cur);
    }

    let people = Array.from(map.values()).filter((p) => !!p.phone);

    const segments = buildSegments({ nowMs, people, allowSmartGroups, allowVip });

    let list = segments[segment] || segments.buyers_all;

    if (segment === "abandoned") {
      const cutoffMs = nowMs - Math.max(1, Math.min(365, daysParam)) * 86400000;
      list = list.filter((p) => p.lastAbandonedOrderMs >= cutoffMs);
    }

    if (q) {
      list = list.filter((p) => {
        const n = String(p.fullName || "").toLowerCase();
        const ph = String(p.phone || "");
        const em = String(p.email || "").toLowerCase();
        return n.includes(q) || ph.includes(q) || em.includes(q);
      });
    }

    if (segment === "vip") {
      list.sort((a, b) => (b.completedTotalSpent || 0) - (a.completedTotalSpent || 0));
    } else if (segment.startsWith("inactive_")) {
      list.sort((a, b) => (a.lastCompletedOrderMs || 0) - (b.lastCompletedOrderMs || 0));
    } else {
      list.sort(
        (a, b) =>
          (b.lastCompletedOrderMs || b.lastAnyOrderMs || 0) - (a.lastCompletedOrderMs || a.lastAnyOrderMs || 0)
      );
    }

    const toPerson = (p: Agg) => ({
      key: p.key,
      phone: p.phone || null,
      email: p.email || null,
      fullName: p.fullName || null,

      ordersCount: p.completedOrdersCount,
      totalSpent: Number((p.completedTotalSpent || 0).toFixed(2)),
      lastOrderMs: p.lastCompletedOrderMs || p.lastAnyOrderMs || 0,
      lastOrderId: (p.lastCompletedOrderId || p.lastAnyOrderId || "").trim() || null,

      lastAbandonedOrderMs: p.lastAbandonedOrderMs || 0,
      lastAbandonedOrderId: p.lastAbandonedOrderId || null,
    });

    const counts = {
      buyers_all: segments.buyers_all.length,
      buyers_first: segments.buyers_first.length,
      buyers_repeat: segments.buyers_repeat.length,
      inactive_30: segments.inactive_30.length,
      inactive_60: segments.inactive_60.length,
      inactive_90: segments.inactive_90.length,
      abandoned: segments.abandoned.length,
      vip: segments.vip.length,
    };

    return Response.json({
      ok: true,
      meta: {
        planKey,
        features: plan.features,
        limits: plan.limits,
        orderScanCap,
        lookbackDays,
      },
      segment,
      days: daysParam,
      counts,
      total: list.length,
      people: list.slice(0, 500).map(toPerson),
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}