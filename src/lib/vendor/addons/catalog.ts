export type AddonCycle = "monthly" | "yearly";
export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type AddonItem = {
  sku: string;
  plan: BizhubPlanKey; // which plan can buy it
  kind: "item" | "bundle";
  title: string;
  description: string;
  includesSkus?: string[]; // for bundles
  priceNgn: { monthly: number; yearly: number };
};

export const ADDONS: AddonItem[] = [
  // ---------------- LAUNCH ----------------
  {
    sku: "addon_installments_basic",
    plan: "LAUNCH",
    kind: "item",
    title: "Installment plans (basic)",
    description: "Basic rules, capped usage.",
    priceNgn: { monthly: 1000, yearly: 10000 },
  },
  {
    sku: "addon_deadstock_40_15",
    plan: "LAUNCH",
    kind: "item",
    title: "Dead stock (40 rows, 15 days)",
    description: "Momentum-lite dead stock view.",
    priceNgn: { monthly: 800, yearly: 7500 },
  },
  {
    sku: "addon_reengage_remix_lite",
    plan: "LAUNCH",
    kind: "item",
    title: "Re‑engagement AI remix (lite)",
    description: "Lite remix engine with capped usage.",
    priceNgn: { monthly: 1200, yearly: 12000 },
  },
  {
    sku: "addon_followups_boost_20",
    plan: "LAUNCH",
    kind: "item",
    title: "Follow‑ups boost (10 → 20 / 72h)",
    description: "Increase follow-up capacity.",
    priceNgn: { monthly: 500, yearly: 5000 },
  },
  {
    sku: "addon_staff_plus1",
    plan: "LAUNCH",
    kind: "item",
    title: "Staff account add‑on (+1 seat)",
    description: "Adds 1 staff seat (hard cap still enforced).",
    priceNgn: { monthly: 500, yearly: 5000 },
  },
  {
    sku: "addon_bestsellers_10_14",
    plan: "LAUNCH",
    kind: "item",
    title: "Best sellers expansion (10 rows, 14 days)",
    description: "More rows and longer window.",
    priceNgn: { monthly: 500, yearly: 5000 },
  },
  {
    sku: "bundle_launch_starter_growth_pack",
    plan: "LAUNCH",
    kind: "bundle",
    title: "Starter Growth Pack (Bundle)",
    description: "Installments (basic) + Follow‑ups boost + Best sellers expansion",
    includesSkus: ["addon_installments_basic", "addon_followups_boost_20", "addon_bestsellers_10_14"],
    priceNgn: { monthly: 2000, yearly: 20000 },
  },

  // ---------------- MOMENTUM ----------------
  {
    sku: "addon_reengage_remix_apex_capped",
    plan: "MOMENTUM",
    kind: "item",
    title: "Re‑engagement AI remix (Apex engine, capped)",
    description: "Apex-grade remix with capped usage.",
    priceNgn: { monthly: 2000, yearly: 20000 },
  },
  {
    sku: "addon_installments_advanced",
    plan: "MOMENTUM",
    kind: "item",
    title: "Installment plans (advanced rules)",
    description: "Advanced rules + higher caps.",
    priceNgn: { monthly: 1500, yearly: 15000 },
  },
  {
    sku: "addon_risk_shield_quiet",
    plan: "MOMENTUM",
    kind: "item",
    title: "Smart Risk Shield (quiet monitoring)",
    description: "Monitoring only; no action tools.",
    priceNgn: { monthly: 1500, yearly: 15000 },
  },
  {
    sku: "addon_priority_dispute_review",
    plan: "MOMENTUM",
    kind: "item",
    title: "Priority dispute review (queue boost only)",
    description: "Queue boost only; no override tools.",
    priceNgn: { monthly: 1000, yearly: 10000 },
  },
  {
    sku: "addon_probation_apex_badge",
    plan: "MOMENTUM",
    kind: "item",
    title: "Verified Apex badge (temporary / probation)",
    description: "Temporary probation badge (not the full earned Apex badge).",
    priceNgn: { monthly: 1500, yearly: 15000 },
  },
  {
    sku: "addon_followups_boost_50",
    plan: "MOMENTUM",
    kind: "item",
    title: "Follow‑ups boost (25 → 50 / 72h)",
    description: "Increase follow-up capacity.",
    priceNgn: { monthly: 800, yearly: 7500 },
  },
  {
    sku: "addon_deadstock_150_60",
    plan: "MOMENTUM",
    kind: "item",
    title: "Dead stock expansion (150 rows, 60 days)",
    description: "Bigger dead stock view.",
    priceNgn: { monthly: 1000, yearly: 10000 },
  },
  {
    sku: "addon_bestsellers_50_90",
    plan: "MOMENTUM",
    kind: "item",
    title: "Best sellers expansion (50 rows, 90 days)",
    description: "Apex-grade best sellers view.",
    priceNgn: { monthly: 1000, yearly: 10000 },
  },
  {
    sku: "bundle_momentum_growth_automation_pack",
    plan: "MOMENTUM",
    kind: "bundle",
    title: "Growth Automation Pack (Bundle)",
    description: "AI remix + Follow‑ups boost + Best sellers expansion",
    includesSkus: ["addon_reengage_remix_apex_capped", "addon_followups_boost_50", "addon_bestsellers_50_90"],
    priceNgn: { monthly: 3500, yearly: 35000 },
  },
  {
    sku: "bundle_momentum_risk_trust_pack",
    plan: "MOMENTUM",
    kind: "bundle",
    title: "Risk & Trust Pack (Bundle)",
    description: "Risk Shield + Priority dispute review + Temporary Apex badge",
    includesSkus: ["addon_risk_shield_quiet", "addon_priority_dispute_review", "addon_probation_apex_badge"],
    priceNgn: { monthly: 3000, yearly: 30000 },
  },

  // ---------------- APEX ----------------
  {
    sku: "addon_risk_action_controls",
    plan: "APEX",
    kind: "item",
    title: "Risk Action Controls",
    description: "Manual approve / pause payouts / freeze orders per case.",
    priceNgn: { monthly: 3000, yearly: 30000 },
  },
  {
    sku: "addon_dispute_final_override",
    plan: "APEX",
    kind: "item",
    title: "Dispute Final Override",
    description: "Resolve, reverse, or compensate disputes.",
    priceNgn: { monthly: 2500, yearly: 25000 },
  },
  {
    sku: "addon_auto_recovery_engine",
    plan: "APEX",
    kind: "item",
    title: "Auto Recovery Engine",
    description: "AI recovers failed payments, abandoned checkouts, unpaid installments.",
    priceNgn: { monthly: 3000, yearly: 30000 },
  },
  {
    sku: "addon_early_cash_release",
    plan: "APEX",
    kind: "item",
    title: "Early Cash Release",
    description: "Risk-scored early payout before standard settlement.",
    priceNgn: { monthly: 4000, yearly: 40000 },
  },
  {
    sku: "addon_multi_store_branch_control",
    plan: "APEX",
    kind: "item",
    title: "Multi-store / Branch Control",
    description: "Run multiple businesses under one Apex account.",
    priceNgn: { monthly: 2500, yearly: 25000 },
  },
  {
    sku: "addon_advanced_analytics_export",
    plan: "APEX",
    kind: "item",
    title: "Advanced analytics export (CSV / API)",
    description: "CSV / PDF / API access to all reports.",
    priceNgn: { monthly: 2000, yearly: 20000 },
  },
  {
    sku: "addon_custom_automation_rules",
    plan: "APEX",
    kind: "item",
    title: "Custom automation rules",
    description: "Triggers for follow-ups, re-engagement, risk events.",
    priceNgn: { monthly: 2500, yearly: 25000 },
  },
  {
    sku: "addon_account_health_monitor",
    plan: "APEX",
    kind: "item",
    title: "Dedicated account health monitor",
    description: "System flags growth risks + human review priority.",
    priceNgn: { monthly: 2000, yearly: 20000 },
  },
  {
    sku: "bundle_apex_revenue_recovery_pack",
    plan: "APEX",
    kind: "bundle",
    title: "Revenue Recovery Pack (Bundle)",
    description: "Auto recovery engine + Early cash release + Advanced analytics export",
    includesSkus: ["addon_auto_recovery_engine", "addon_early_cash_release", "addon_advanced_analytics_export"],
    priceNgn: { monthly: 7000, yearly: 70000 },
  },
  {
    sku: "bundle_apex_control_power_pack",
    plan: "APEX",
    kind: "bundle",
    title: "Control & Power Pack (Bundle)",
    description: "Risk action controls + Dispute final override + Custom automation rules",
    includesSkus: ["addon_risk_action_controls", "addon_dispute_final_override", "addon_custom_automation_rules"],
    priceNgn: { monthly: 6000, yearly: 60000 },
  },
];

export function addonsForPlan(planKey: BizhubPlanKey) {
  return ADDONS.filter((a) => a.plan === planKey);
}

export function findAddonBySku(sku: string) {
  return ADDONS.find((a) => a.sku === sku) || null;
}