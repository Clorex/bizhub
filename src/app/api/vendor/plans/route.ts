// FILE: src/app/api/vendor/plans/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { getPlanConfig, fallbackPlanConfig, type BizhubPlanKey } from "@/lib/vendor/planConfigServer";
import { addonsForPlan } from "@/lib/vendor/addons/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";

// Plan prices (unchanged)
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

  const core: string[] = [];
  addIf(core, !!features.marketplace, "Marketplace visibility (Market)");
  addIf(core, !!features.storeCustomize, "Store customization");
  addIf(core, !!features.continueInChat, "Continue in Chat (WhatsApp checkout assist)");
  addIf(core, !!features.coupons, "Coupons");
  addIf(core, !!features.promotions, "Promotions");
  benefits["Core selling"] = core;

  const payments: string[] = [];
  // ✅ USD checkout benefit (only Momentum/Apex, controlled by admin toggle)
  addIf(
    payments,
    (planKey === "MOMENTUM" || planKey === "APEX") && !!features.usdCheckout,
    "USD card payments at checkout (eligible customers can pay in USD)"
  );
  // Keep group only if has items
  if (payments.length) benefits["Payments"] = payments;

  const ops: string[] = [];
  addIf(ops, !!features.assistant, "Assistant tools");
  addIf(ops, !!features.reengagement, `Re‑engagement outreach (limit: ${Number(limits.reengagementDaily || 0)}/day)`);
  addIf(ops, !!features.reengagementSmartGroups, "Re‑engagement smart groups (first-time / repeat / inactive)");
  addIf(ops, !!features.reengagementSmartMessages, "Re‑engagement smart messages (personalized per customer)");
  addIf(ops, !!features.reengagementAiRemix, "Re‑engagement AI remix");
  addIf(ops, !!features.followUps, `Follow‑ups (cap: ${Number(limits.followUpsCap72h || 0)} / 72h)`);
  addIf(ops, !!features.proofOfPayment, "Proof of payment review tools");
  addIf(ops, !!features.installmentPlans, "Installment plans");
  addIf(ops, !!features.staff, `Staff accounts (max: ${Number(limits.staffMax || 0)})`);
  benefits["Operations"] = ops;

  const insights: string[] = [];
  addIf(insights, !!features.monthAnalytics, "Month analytics");
  addIf(
    insights,
    !!features.bestSellers,
    `Best sellers (rows: ${Number(limits.bestSellersMaxRows || 0)}, days: ${Number(limits.bestSellersMaxDays || 0)})`
  );
  addIf(
    insights,
    !!features.deadStock,
    `Dead stock (rows: ${Number(limits.deadStockMaxRows || 0)}, days: ${Number(limits.deadStockMaxDays || 0)})`
  );
  addIf(insights, !!features.customerNotes, "Customer notes");
  benefits["Insights"] = insights;

  const apex: string[] = [];
  addIf(apex, !!features.apexVerifiedBadge, "Verified Apex badge (earned + maintained)");
  addIf(apex, !!features.apexSmartRiskShield, "Smart Risk Shield (quiet risk monitoring)");
  addIf(apex, !!features.apexPriorityDisputeOverride, "Priority dispute override (queue jump + extra evidence)");
  benefits["Apex trust & protection"] = apex;

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

  if (items.length) out["Add-ons (Monthly / Yearly)"] = items.map((a) => fmt(a.title, a.priceNgn.monthly, a.priceNgn.yearly));
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