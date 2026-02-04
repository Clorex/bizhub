// FILE: src/lib/vendor/staffSeatsServer.ts
import { adminDb } from "@/lib/firebase/admin";
import { getEntitlement } from "@/lib/bizhubPlans";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

function cleanPlanKey(v: any): BizhubPlanKey {
  const k = String(v || "FREE").toUpperCase();
  if (k === "LAUNCH" || k === "MOMENTUM" || k === "APEX") return k;
  return "FREE";
}

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function addonSeatPlus1ActiveEffective(biz: any, nowMs: number) {
  const ent = biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};
  const a = ent["addon_staff_plus1"];
  if (!a || typeof a !== "object") return false;

  const status = String(a.status || "");
  const expiresAtMs = Number(a.expiresAtMs || 0) || 0;
  const remainingMs = Number(a.remainingMs || 0) || 0;

  if (status === "active") return !!(expiresAtMs && expiresAtMs > nowMs);
  if (status === "paused") return remainingMs > 0; // effective resume when subscription is active
  return false;
}

export function staffSeatLimitFor(planKey: BizhubPlanKey | string) {
  const k = cleanPlanKey(planKey);
  if (k === "APEX") return 10;
  if (k === "MOMENTUM") return 5;
  if (k === "LAUNCH") return 3;
  return 0;
}

export async function getStaffSeatState(businessId: string) {
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : {};

  const nowMs = Date.now();
  const subActive = hasActiveSubscription(biz);

  const entitlement = getEntitlement({
    trial: biz?.trial ?? null,
    subscription: biz?.subscription ?? null,
  }) as any;

  const planKey = cleanPlanKey(entitlement?.planKey || "FREE");

  let seatLimit = staffSeatLimitFor(planKey);

  // ✅ Add-on: Launch +1 seat
  if (subActive && planKey === "LAUNCH" && addonSeatPlus1ActiveEffective(biz, nowMs)) {
    seatLimit += 1;
  }

  // Count used seats = active staff docs + pending invites
  const staffSnap = await adminDb
    .collection("businesses")
    .doc(businessId)
    .collection("staff")
    .limit(500)
    .get();

  const invSnap = await adminDb
    .collection("staffInvites")
    .where("businessId", "==", businessId)
    .limit(500)
    .get();

  const pendingInvites = invSnap.docs
    .map((d) => d.data() as any)
    .filter((x) => String(x?.status || "pending") === "pending").length;

  const used = Number(staffSnap.size || 0) + Number(pendingInvites || 0);
  const remaining = Math.max(0, seatLimit - used);

  return {
    planKey,
    hasActiveSubscription: subActive,
    seatLimit,
    used,
    remaining,
    includesPendingInvites: true,
    addon: {
      staffPlus1Effective: subActive && planKey === "LAUNCH" && addonSeatPlus1ActiveEffective(biz, nowMs),
      sku: "addon_staff_plus1",
    },
  };
}