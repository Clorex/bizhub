// FILE: src/app/api/vendor/plans/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { getPlanConfig, fallbackPlanConfig, type BizhubPlanKey } from "@/lib/vendor/planConfigServer";
import { addonsForPlan } from "@/lib/vendor/addons/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";

const PRICE_NGN: Record<BizhubPlanKey, Record<BillingCycle, number>> = {
  FREE: { monthly: 0, quarterly: 0, biannually: 0, yearly: 0 },
  LAUNCH: { monthly: 5_000, quarterly: 14_000, biannually: 27_000, yearly: 50_000 },
  MOMENTUM: { monthly: 10_000, quarterly: 28_000, biannually: 55_000, yearly: 100_000 },
  APEX: { monthly: 25_000, quarterly: 70_000, biannually: 130_000, yearly: 200_000 },
};

function planName(k: BizhubPlanKey) {
  if (k === "FREE") return "Free access";
  if (k === "LAUNCH") return "Launch";
  if (k === "MOMENTUM") return "Momentum";
  return "Apex";
}

function planTagline(k: BizhubPlanKey) {
  if (k === "LAUNCH") return "For new and growing businesses that want to start properly.";
  if (k === "MOMENTUM") return "For businesses that want steady growth and more control.";
  if (k === "APEX") return "For high-volume and serious businesses.";
  return "Free access";
}

function recommendedFor(k: BizhubPlanKey) {
  if (k === "LAUNCH") return "New stores & small sellers";
  if (k === "MOMENTUM") return "Growing businesses";
  if (k === "APEX") return "Serious sellers & high volume";
  return "";
}

function addIf(out: string[], ok: boolean, text: string) {
  if (ok) out.push(text);
}

function buildBenefitsForPlan(planKey: BizhubPlanKey, features: any, limits: any) {
  const benefits: Record<string, string[]> = {};

  // ✅ CORE SELLING (user-focused, not feature-list)
  const core: string[] = [];
  addIf(core, !!features.marketplace, "Reach thousands of buyers on the myBizHub Marketplace");
  addIf(core, !!features.storeCustomize, "Customize your store with your brand, logo, and banner");
  addIf(core, !!features.continueInChat, "Let buyers complete orders via WhatsApp (Continue in Chat)");
  addIf(core, !!features.coupons, "Create discount codes to reward loyal customers");
  addIf(core, !!features.promotions, "Boost products to the top of the Marketplace (paid ads)");
  if (core.length) benefits["Sell more"] = core;

  // ✅ PAYMENTS (user-friendly, no USD jargon)
  const payments: string[] = [];
  if ((planKey === "MOMENTUM" || planKey === "APEX") && !!features.usdCheckout) {
    payments.push("Accept card payments in USD from international buyers");
  }
  if (payments.length) benefits["Payments"] = payments;

  // ✅ OPERATIONS (expanded + user-focused)
  const ops: string[] = [];
  
  addIf(ops, !!features.assistant, "Daily sales summary + tips to improve your business");
  
  if (!!features.reengagement) {
    const daily = Number(limits.reengagementDaily || 0);
    if (daily > 0) {
      ops.push(`Re-engage past buyers (send up to ${daily} messages/day)`);
    } else {
      ops.push("Re-engage past buyers with follow-up messages");
    }
  }
  
  addIf(ops, !!features.reengagementSmartGroups, "Target first-time, repeat, or inactive buyers separately");
  addIf(ops, !!features.reengagementSmartMessages, "Personalized messages for each customer automatically");
  addIf(ops, !!features.reengagementAiRemix, "AI-powered message suggestions (remix your copy)");
  
  if (!!features.followUps) {
    const cap = Number(limits.followUpsCap72h || 0);
    if (cap > 0) {
      ops.push(`Automated follow-ups (up to ${cap} every 72 hours)`);
    } else {
      ops.push("Automated follow-ups for abandoned carts and unpaid orders");
    }
  }
  
  addIf(ops, !!features.proofOfPayment, "Review bank transfer proof uploads faster");
  addIf(ops, !!features.installmentPlans, "Accept installment payments (split billing)");
  
  if (!!features.staff) {
    const max = Number(limits.staffMax || 0);
    if (max > 0) {
      ops.push(`Add team members (up to ${max} staff account${max !== 1 ? "s" : ""})`);
    } else {
      ops.push("Add staff accounts with custom permissions");
    }
  }
  
  if (ops.length) benefits["Operations & automation"] = ops;

  // ✅ INSIGHTS (expanded + user-friendly)
  const insights: string[] = [];
  
  addIf(insights, !!features.monthAnalytics, "See monthly sales trends (not just weekly)");
  
  if (!!features.bestSellers) {
    const rows = Number(limits.bestSellersMaxRows || 0);
    const days = Number(limits.bestSellersMaxDays || 0);
    if (rows > 0 && days > 0) {
      insights.push(`View your top ${rows} best-selling products (last ${days} days)`);
    } else {
      insights.push("Identify your best-selling products");
    }
  }
  
  if (!!features.deadStock) {
    const rows = Number(limits.deadStockMaxRows || 0);
    const days = Number(limits.deadStockMaxDays || 0);
    if (rows > 0 && days > 0) {
      insights.push(`Spot slow-moving stock early (${rows} products, ${days} days)`);
    } else {
      insights.push("Detect slow-moving products to reduce waste");
    }
  }
  
  addIf(insights, !!features.customerNotes, "Add private notes to customer profiles");
  
  if (insights.length) benefits["Business insights"] = insights;

  // ✅ APEX TRUST & PROTECTION (expanded + compelling)
  const apex: string[] = [];
  
  addIf(apex, !!features.apexVerifiedBadge, "Display a Verified Apex badge to build buyer trust");
  addIf(apex, !!features.apexSmartRiskShield, "Smart Risk Shield monitors suspicious orders quietly");
  addIf(apex, !!features.apexPriorityDisputeOverride, "Priority dispute resolution (skip the queue + extra evidence slots)");
  
  // ✅ Add more Apex-only benefits to make it compelling
  if (planKey === "APEX") {
    apex.push("Higher marketplace ranking (your products show up first)");
    apex.push("Early access to new features before other plans");
    apex.push("Dedicated support channel for urgent issues");
  }
  
  if (apex.length) benefits["Apex trust & protection"] = apex;

  // ✅ Remove empty groups
  for (const k of Object.keys(benefits)) {
    if (!benefits[k]?.length) delete benefits[k];
  }

  return benefits;
}

function purchasesForPlan(planKey: BizhubPlanKey) {
  const addOns = addonsForPlan(planKey);

  const bundles = addOns.filter((x) => x.kind === "bundle");
  const items = addOns.filter((x) => x.kind === "item");

  const fmt = (title: string, m: number, y: number) =>
    `${title} • ₦${m.toLocaleString("en-NG")}/month • ₦${y.toLocaleString("en-NG")}/year`;

  const out: Record<string, string[]> = {};

  if (items.length) out["Add-ons (pay monthly or yearly)"] = items.map((a) => fmt(a.title, a.priceNgn.monthly, a.priceNgn.yearly));
  if (bundles.length) out["Bundles (cheaper than buying separately)"] = bundles.map((b) => fmt(b.title, b.priceNgn.monthly, b.priceNgn.yearly));

  return out;
}

export async function GET(req: Request) {
  try {
    await requireAnyRole(req, ["owner", "staff"]);

    const cfg = await getPlanConfig().catch(() => fallbackPlanConfig());

    const plansOut: any = {};

    (["FREE", "LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).forEach((k) => {
      const p = cfg.plans[k];

      const benefits = buildBenefitsForPlan(k, p.features, p.limits);
      const purchases = k === "FREE" ? {} : purchasesForPlan(k);

      plansOut[k] = {
        key: k,
        name: planName(k),
        tagline: planTagline(k),
        recommendedFor: recommendedFor(k),
        features: p.features,
        limits: p.limits,
        priceNgn: {
          monthly: PRICE_NGN[k].monthly,
          quarterly: PRICE_NGN[k].quarterly,
          biannually: PRICE_NGN[k].biannually,
          yearly: PRICE_NGN[k].yearly,
        },
        benefits,
        purchases,
      };
    });

    return NextResponse.json({ ok: true, plans: plansOut });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}