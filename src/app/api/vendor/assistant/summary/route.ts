// FILE: src/app/api/vendor/assistant/summary/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getAssistantLimitsResolved } from "@/lib/vendor/assistantLimitsServer";
import { getTrustRules } from "@/lib/vendor/trustRulesServer";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function startOfTodayMs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getAssistantLimitsResolved(me.businessId);
    if (!access.limits.canUseAssistant) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Upgrade to unlock the sales assistant." },
        { status: 403 }
      );
    }

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
    const slug = String(biz?.slug || me.businessSlug || "");
    const storeName = String(biz?.name || slug || "Store");
    const openDisputes = Number(biz?.trust?.openDisputes || 0);

    const trustRules = await getTrustRules();
    const warnAt = Number(trustRules.dispute.warnOpenDisputes || 2);
    const reduceAt = Number(trustRules.dispute.reduceOpenDisputes || 4);

    const disputeLevel =
      openDisputes >= reduceAt ? "reduce" : openDisputes >= warnAt ? "warn" : "none";

    // Fetch last 7 days orders (MVP: query by createdAt range if available)
    const nowMs = Date.now();
    const startToday = startOfTodayMs();
    const startWeek = nowMs - 7 * 24 * 60 * 60 * 1000;

    const startTs = Timestamp.fromMillis(startWeek);
    const endTs = Timestamp.fromMillis(nowMs);

    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<=", endTs)
      .limit(2000)
      .get();

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    function within(ms: number, a: number, b: number) {
      return ms >= a && ms <= b;
    }

    let todayOrders = 0;
    let todayRevenue = 0;
    let todayPaid = 0;
    let todayChat = 0;

    let weekOrders = 0;
    let weekRevenue = 0;
    let weekPaid = 0;
    let weekChat = 0;

    for (const o of orders) {
      const ms = toMs(o.createdAt);
      if (!ms) continue;

      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      const payType = String(o.paymentType || "");
      const isPaid = payType === "paystack_escrow";
      const isChat = payType === "chat_whatsapp";

      if (within(ms, startWeek, nowMs)) {
        weekOrders += 1;
        weekRevenue += amt;
        if (isPaid) weekPaid += 1;
        if (isChat) weekChat += 1;
      }

      if (within(ms, startToday, nowMs)) {
        todayOrders += 1;
        todayRevenue += amt;
        if (isPaid) todayPaid += 1;
        if (isChat) todayChat += 1;
      }
    }

    const summaryLines: string[] = [];
    summaryLines.push(`BizHub summary — ${storeName}`);
    summaryLines.push(`Today: ${todayOrders} order(s) • ${fmtNaira(todayRevenue)}`);
    summaryLines.push(`This week: ${weekOrders} order(s) • ${fmtNaira(weekRevenue)}`);
    if (openDisputes > 0) summaryLines.push(`Open disputes: ${openDisputes}`);
    summaryLines.push(`Store link: ${slug ? `${process.env.NEXT_PUBLIC_APP_URL}/b/${slug}` : "—"}`);

    const whatsappText = summaryLines.join("\n");

    return NextResponse.json({
      ok: true,
      meta: {
        planKey: access.planKey,
        limits: access.limits,
      },
      business: {
        id: me.businessId,
        slug: slug || null,
        name: storeName || null,
      },
      dispute: {
        openDisputes,
        warnAt,
        reduceAt,
        level: disputeLevel, // none | warn | reduce
      },
      today: { orders: todayOrders, revenue: todayRevenue, paidOrders: todayPaid, chatOrders: todayChat },
      week: { orders: weekOrders, revenue: weekRevenue, paidOrders: weekPaid, chatOrders: weekChat },
      whatsappText,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}