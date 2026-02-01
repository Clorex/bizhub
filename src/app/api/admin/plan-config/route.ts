// FILE: src/app/api/admin/plan-config/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { fallbackPlanConfig } from "@/lib/vendor/planConfigServer";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const snap = await adminDb.collection("platform").doc("planConfig").get();
    const cfg = snap.exists ? (snap.data() as any) : null;

    return NextResponse.json({
      ok: true,
      config: cfg?.plans ? cfg : fallbackPlanConfig(),
      exists: !!cfg?.plans,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));
    const plans = body?.plans;

    if (!plans || typeof plans !== "object") {
      return NextResponse.json({ ok: false, error: "plans object required" }, { status: 400 });
    }

    await adminDb.collection("platform").doc("planConfig").set(
      {
        plans,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}