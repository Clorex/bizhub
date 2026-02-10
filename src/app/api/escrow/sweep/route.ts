// FILE: src/app/api/escrow/sweep/route.ts

import { adminDb } from "@/lib/firebase/admin";
import { releaseEscrowIfEligible } from "@/lib/escrow/releaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best used with a cron that calls this endpoint every 1–2 minutes.
 * It releases due escrow orders (held + holdUntilMs passed) unless disputed.
 */
export async function POST() {
  try {
    const snap = await adminDb
      .collection("orders")
      .where("escrowStatus", "==", "held")
      .limit(300)
      .get();

    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const now = Date.now();
    const due = list
      .filter((o) => Number(o.holdUntilMs || 0) > 0)
      .filter((o) => Number(o.holdUntilMs || 0) <= now)
      .slice(0, 60); // keep it light per call

    let released = 0;
    let skipped = 0;

    for (const o of due) {
      const res = await releaseEscrowIfEligible({ orderId: String(o.id) });
      if ((res as any)?.ok === true && String((res as any)?.message || "").toLowerCase().includes("released")) released++;
      else skipped++;
    }

    return Response.json({ ok: true, scannedHeld: list.length, due: due.length, released, skipped });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Sweep failed" }, { status: 500 });
  }
}