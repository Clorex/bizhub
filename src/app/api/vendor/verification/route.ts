// FILE: src/app/api/vendor/verification/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { syncBusinessSignalsToProducts } from "@/lib/vendor/syncBusinessSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TierKey = "tier1" | "tier2" | "tier3";

function cleanTier(v: any): TierKey {
  const s = String(v || "").trim();
  if (s === "tier1" || s === "tier2" || s === "tier3") return s;
  return "tier1";
}

function cleanUrls(arr: any) {
  const list: string[] = Array.isArray(arr) ? arr.map((x) => String(x || "").trim()) : [];
  return list.filter((u) => u.startsWith("https://")).slice(0, 10);
}

function cleanIdType(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "nin") return "nin";
  if (s === "drivers_licence") return "drivers_licence";
  if (s === "voters_card") return "voters_card";
  if (s === "passport") return "passport";
  return "nin";
}

function cleanIdNumber(v: any) {
  const s = String(v || "").trim().replace(/\s+/g, "");
  return s.slice(0, 30);
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });

    const biz = snap.data() as any;

    return NextResponse.json({
      ok: true,
      business: {
        id: me.businessId,
        slug: biz?.slug ?? null,
        name: biz?.name ?? null,
        state: biz?.state ?? null,
        city: biz?.city ?? null,
      },
      verification: biz?.verification ?? null,
      verificationTier: Number(biz?.verificationTier || 0),
      trust: biz?.trust ?? null,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));
    const tier = cleanTier(body.tier);

    const bizRef = adminDb.collection("businesses").doc(me.businessId);
    const bizSnap = await bizRef.get();
    if (!bizSnap.exists) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });

    const nowMs = Date.now();

    const verification = (bizSnap.data() as any)?.verification || {};

    const submissionRef = adminDb.collection("verificationSubmissions").doc();

    if (tier === "tier1") {
      // Tier 1: face check (guided photos) - auto-pass (your instruction)
      const selfieUrls = cleanUrls(body.selfieUrls);
      if (selfieUrls.length < 1) {
        return NextResponse.json({ ok: false, error: "Upload at least 1 clear selfie photo" }, { status: 400 });
      }

      verification.tier1 = {
        status: "verified", // auto
        method: "selfie_photos",
        selfieUrls,
        verifiedAtMs: nowMs,
        updatedAtMs: nowMs,
      };

      await bizRef.set(
        {
          verification,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await submissionRef.set({
        businessId: me.businessId,
        tier: "tier1",
        status: "auto_verified",
        payload: { selfieUrls },
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        reviewedAtMs: nowMs,
      });

      await syncBusinessSignalsToProducts({ businessId: me.businessId });

      return NextResponse.json({ ok: true, tier: "tier1", status: "verified" });
    }

    if (tier === "tier2") {
      // Tier 2: ID number only (no photo) -> pending admin review
      const idType = cleanIdType(body.idType);
      const idNumber = cleanIdNumber(body.idNumber);

      if (!idNumber) {
        return NextResponse.json({ ok: false, error: "Enter a valid ID number" }, { status: 400 });
      }

      verification.tier2 = {
        status: "pending",
        idType,
        idNumber,
        submittedAtMs: nowMs,
        updatedAtMs: nowMs,
        adminNote: null,
      };

      await bizRef.set(
        {
          verification,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await submissionRef.set({
        businessId: me.businessId,
        tier: "tier2",
        status: "pending",
        payload: { idType, idNumber },
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true, tier: "tier2", status: "pending" });
    }

    if (tier === "tier3") {
      // Tier 3: proof of address (upload) -> pending admin review
      const proofUrls = cleanUrls(body.proofUrls);
      if (proofUrls.length < 1) {
        return NextResponse.json({ ok: false, error: "Upload proof of address" }, { status: 400 });
      }

      verification.tier3 = {
        status: "pending",
        proofUrls,
        submittedAtMs: nowMs,
        updatedAtMs: nowMs,
        adminNote: null,
      };

      await bizRef.set(
        {
          verification,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await submissionRef.set({
        businessId: me.businessId,
        tier: "tier3",
        status: "pending",
        payload: { proofUrls },
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true, tier: "tier3", status: "pending" });
    }

    return NextResponse.json({ ok: false, error: "Unknown tier" }, { status: 400 });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}