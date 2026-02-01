// FILE: src/app/api/vendor/onboard/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireMe } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function ensureUniqueSlug(base: string) {
  const clean = slugify(base);
  if (!clean) return `biz-${Math.random().toString(36).slice(2, 7)}`;

  const snap = await adminDb.collection("businesses").where("slug", "==", clean).limit(1).get();
  if (snap.empty) return clean;

  return `${clean}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);

    const body = await req.json();
    const { businessName, businessSlug, description } = body;

    if (!businessName) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    // If already onboarded, return current profile
    const userRef = adminDb.collection("users").doc(me.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : null;

    if (userData?.businessId) {
      return NextResponse.json({
        ok: true,
        alreadyOnboarded: true,
        businessId: userData.businessId,
        businessSlug: userData.businessSlug,
      });
    }

    const slug = await ensureUniqueSlug(businessSlug || businessName);

    // Create business
    const bizRef = adminDb.collection("businesses").doc();
    const businessId = bizRef.id;

    // NOTE (Batch 10 rule): No time-based trials.
    // Free is unlimited time, restricted by planConfig.
    await bizRef.set({
      name: businessName,
      slug,
      description: description ?? "",

      payoutDetails: {
        bankName: "",
        accountNumber: "",
        accountName: "",
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create wallet
    await adminDb.collection("wallets").doc(businessId).set(
      {
        businessId,
        pendingBalanceKobo: 0,
        availableBalanceKobo: 0,
        totalEarnedKobo: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Save user profile
    await userRef.set(
      {
        uid: me.uid,
        email: me.email ?? null,
        role: "owner",
        businessId,
        businessSlug: slug,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, businessId, businessSlug: slug });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Vendor onboard failed" }, { status: 500 });
  }
}