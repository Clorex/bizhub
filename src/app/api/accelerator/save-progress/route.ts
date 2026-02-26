// FILE: src/app/api/accelerator/save-progress/route.ts

import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireMe(req);
    const body = await req.json();

    const { step, profile, selectedIdeaId, simulation, actionPlan, completedAt } = body;

    await adminDb
      .collection("users")
      .doc(me.uid)
      .set(
        {
          acceleratorProgress: {
            currentStep: Number(step) || 1,
            profile: profile || null,
            selectedIdeaId: selectedIdeaId || null,
            simulation: simulation || null,
            actionPlan: actionPlan || null,
            completedAt: completedAt || null,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to save progress" }, { status: 500 });
  }
}
