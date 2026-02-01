// FILE: src/app/api/marketing/optout/route.ts
import { NextResponse } from "next/server";
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(s: any) {
  return String(s || "").trim().toLowerCase().slice(0, 80);
}

export async function GET(req: Request) {
  try {
    const me = await requireMe(req);

    const ref = adminDb.collection("users").doc(me.uid);
    const snap = await ref.get();
    const d = snap.exists ? (snap.data() as any) : {};

    const prefs = d?.marketingPrefs || {};
    const globalOptOut = !!prefs.globalOptOut;

    const storeOptOutSlugs: string[] = Array.isArray(prefs.storeOptOutSlugs)
      ? prefs.storeOptOutSlugs.map(String).filter(Boolean).slice(0, 500)
      : [];

    return NextResponse.json({ ok: true, globalOptOut, storeOptOutSlugs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);

    const body = await req.json().catch(() => ({}));
    const storeSlug = cleanSlug(body.storeSlug);
    const optOut = body.optOut === true;

    if (!storeSlug) return NextResponse.json({ ok: false, error: "storeSlug required" }, { status: 400 });

    const ref = adminDb.collection("users").doc(me.uid);

    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const d = snap.exists ? (snap.data() as any) : {};
      const prefs = d?.marketingPrefs || {};

      const cur: string[] = Array.isArray(prefs.storeOptOutSlugs)
        ? prefs.storeOptOutSlugs.map(String).filter(Boolean)
        : [];

      const set = new Set(cur.map((x) => x.toLowerCase()));
      if (optOut) set.add(storeSlug);
      else set.delete(storeSlug);

      t.set(
        ref,
        {
          marketingPrefs: {
            ...prefs,
            storeOptOutSlugs: Array.from(set).slice(0, 500),
            updatedAtMs: Date.now(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}