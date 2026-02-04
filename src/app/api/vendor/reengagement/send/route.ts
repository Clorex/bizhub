import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { moderateOutboundText } from "@/lib/moderation/simpleTextGuard";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import {
  composeSmartMessage,
  type ReengagementPerson,
  type ReengagementSegment,
  type PlanKey,
} from "@/lib/vendor/reengagement/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhone(raw: any) {
  const d = String(raw || "").replace(/[^\d]/g, "");
  return d.length >= 7 ? d : "";
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

  if (s === "buyers") return "buyers_all";
  if (s === "abandoned") return "abandoned";

  return (allowed.includes(s as any) ? (s as ReengagementSegment) : "buyers_all") as ReengagementSegment;
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function clampText(s: string, max = 1200) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

function safeRotationKey(v: any) {
  const s = String(v || "").trim();
  return s.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 48) || dayKey();
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    const businessId = me.businessId;

    if (!businessId) {
      return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(businessId);

    const plan = await getBusinessPlanResolved(businessId);
    const planKey = String(plan.planKey || "FREE").toUpperCase() as PlanKey;

    const reengagementEnabled = !!plan?.features?.reengagement;
    if (!reengagementEnabled) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Upgrade to message customers." },
        { status: 403 }
      );
    }

    const dailyLimit = Number(plan?.limits?.reengagementDaily || 0);
    if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Upgrade to message customers." },
        { status: 403 }
      );
    }

    const allowSmartGroups = !!plan?.features?.reengagementSmartGroups;
    const allowSmartMessages = !!plan?.features?.reengagementSmartMessages;

    // ✅ AI Remix is:
    // - Apex core (enabled)
    // - Launch/Momentum ONLY if purchased add-on (planConfigServer applies this)
    const allowAiRemix = !!plan?.features?.reengagementAiRemix;

    // VIP is Apex-only, and requires AI Remix ON
    const allowVip = String(planKey || "").toUpperCase() === "APEX" && allowAiRemix;

    const body = await req.json().catch(() => ({}));

    let segment = cleanSegment(body.segment ?? body.audience);
    const baseText = clampText(String(body.baseText ?? body.text ?? ""), 1200);
    const rotationKey = safeRotationKey(body.rotationKey);

    // Enforce toggles:
    if (!allowSmartGroups && segment !== "abandoned") segment = "buyers_all";
    if (segment === "vip" && !allowVip) segment = "buyers_all";

    const peopleRaw = Array.isArray(body.people) ? body.people : [];

    const people: ReengagementPerson[] = peopleRaw
      .map((x: any) => ({
        key: String(x?.key || "").trim(),
        phone: cleanPhone(x?.phone),
        email: x?.email ? String(x.email) : null,
        fullName: x?.fullName ? String(x.fullName) : null,
        ordersCount: Number(x?.ordersCount || 0) || 0,
        totalSpent: Number(x?.totalSpent || 0) || 0,
        lastOrderMs: Number(x?.lastOrderMs || 0) || 0,
        lastOrderId: x?.lastOrderId ? String(x.lastOrderId) : null,
      }))
      // ✅ build fix: explicitly type callback param so noImplicitAny doesn't fail
      .filter((x: any) => !!x.key && !!x.phone)
      .slice(0, 500);

    if (!baseText) return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    if (people.length < 1) return NextResponse.json({ ok: false, error: "No recipients" }, { status: 400 });

    const mod = moderateOutboundText(baseText);
    if (!mod.ok) {
      await adminDb.collection("vendorPolicyViolations").doc().set({
        businessId,
        businessSlug: me.businessSlug ?? null,
        type: "message_blocked",
        reason: mod.reason,
        hit: mod.hit ?? null,
        segment,
        createdAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        { ok: false, code: "BLOCKED_BY_POLICY", error: "Message blocked by safety policy." },
        { status: 400 }
      );
    }

    const dk = dayKey();
    const counterRef = adminDb.collection("businesses").doc(businessId).collection("reengagementCounters").doc(dk);

    const countRequested = people.length;

    const allowed = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(counterRef);
      const cur = snap.exists ? Number((snap.data() as any)?.sentCount || 0) : 0;

      const remaining = Math.max(0, dailyLimit - cur);
      const take = Math.max(0, Math.min(remaining, countRequested));

      t.set(
        counterRef,
        {
          dayKey: dk,
          planKey,
          dailyLimit,
          sentCount: cur + take,
          updatedAtMs: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
          createdAtMs: snap.exists ? (snap.data() as any)?.createdAtMs || Date.now() : Date.now(),
          createdAt: snap.exists
            ? (snap.data() as any)?.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { take, remainingAfter: Math.max(0, remaining - take), cur, dailyLimit };
    });

    const recipients = people.slice(0, allowed.take);

    const businessName = String(plan?.business?.name || me.businessSlug || "").trim() || null;
    const businessSlug = String(me.businessSlug || "").trim() || null;

    const out = recipients.map((p) => {
      const text = allowSmartMessages
        ? composeSmartMessage({
            planKey,
            features: {
              reengagementSmartMessages: true,
              reengagementAiRemix: allowAiRemix,
            },
            businessSlug,
            businessName,
            segment,
            baseText,
            person: p,
            rotationKey,
          })
        : baseText;

      return {
        key: String((p as any)?.key || ""),
        phone: cleanPhone((p as any)?.phone || ""),
        fullName: (p as any)?.fullName || null,
        text,
      };
    });

    const campaignRef = adminDb.collection("reengagementCampaigns").doc();
    await campaignRef.set({
      businessId,
      businessSlug: me.businessSlug ?? null,
      segment,
      baseText,
      rotationKey,
      recipientCount: out.length,
      createdByUid: me.uid,
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      planKey,
      flags: {
        smartGroups: allowSmartGroups,
        smartMessages: allowSmartMessages,
        aiRemix: allowAiRemix,
        vip: allowVip && segment === "vip",
      },
    });

    return NextResponse.json({
      ok: true,
      campaignId: campaignRef.id,
      segment,
      baseText,
      rotationKey,
      recipients: out,
      limit: { planKey, ...allowed },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}