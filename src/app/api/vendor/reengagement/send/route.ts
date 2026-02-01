// FILE: src/app/api/vendor/reengagement/send/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getAssistantLimitsResolved } from "@/lib/vendor/assistantLimitsServer";
import { moderateOutboundText } from "@/lib/moderation/simpleTextGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPhone(raw: any) {
  const d = String(raw || "").replace(/[^\d]/g, "");
  return d.length >= 7 ? d : "";
}

function cleanAudience(v: any) {
  const s = String(v || "buyers").trim();
  if (s === "buyers" || s === "abandoned") return s;
  return "buyers";
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function planDailyLimit(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 150;
  if (k === "MOMENTUM") return 60;
  if (k === "LAUNCH") return 20;
  return 0;
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    await requireVendorUnlocked(me.businessId);

    const access = await getAssistantLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE");
    const dailyLimit = planDailyLimit(planKey);

    if (dailyLimit <= 0) {
      return NextResponse.json({ ok: false, code: "FEATURE_LOCKED", error: "Upgrade to message past buyers." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const audience = cleanAudience(body.audience);
    const text = String(body.text || "").trim().slice(0, 1200);

    const peopleRaw = Array.isArray(body.people) ? body.people : [];
    const people = peopleRaw
      .map((x: any) => ({ phone: cleanPhone(x?.phone), key: String(x?.key || "") }))
      .filter((x: any) => !!x.phone)
      .slice(0, 500);

    if (!text) return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    if (people.length < 1) return NextResponse.json({ ok: false, error: "No recipients" }, { status: 400 });

    // Moderation (policy violation)
    const mod = moderateOutboundText(text);
    if (!mod.ok) {
      await adminDb.collection("vendorPolicyViolations").doc().set({
        businessId: me.businessId,
        businessSlug: me.businessSlug ?? null,
        type: "message_blocked",
        reason: mod.reason,
        hit: mod.hit ?? null,
        audience,
        createdAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        { ok: false, code: "BLOCKED_BY_POLICY", error: "Message blocked by safety policy." },
        { status: 400 }
      );
    }

    const dk = dayKey();
    const counterRef = adminDb.collection("businesses").doc(me.businessId).collection("reengagementCounters").doc(dk);

    // Determine how many we can send today
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
          createdAt: snap.exists ? (snap.data() as any)?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { take, remainingAfter: Math.max(0, remaining - take), cur, dailyLimit };
    });

    const recipients = people.slice(0, allowed.take);

    // Campaign log
    const campaignRef = adminDb.collection("reengagementCampaigns").doc();
    await campaignRef.set({
      businessId: me.businessId,
      businessSlug: me.businessSlug ?? null,
      audience,
      text,
      recipientCount: recipients.length,
      createdByUid: me.uid,
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      planKey,
    });

    return NextResponse.json({
      ok: true,
      campaignId: campaignRef.id,
      audience,
      text,
      recipients,
      limit: { planKey, dailyLimit, ...allowed },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}