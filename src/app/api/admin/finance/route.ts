
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const financeSnap = await adminDb.collection("platform").doc("finance").get();
    const finance = financeSnap.exists ? (financeSnap.data() as any) : null;

    const ledgerSnap = await adminDb
      .collection("platformLedger")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const ledger = ledgerSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return Response.json({
      ok: true,
      finance: finance
        ? {
            balanceKobo: Number(finance.balanceKobo || 0),
            subscriptionRevenueKobo: Number(finance.subscriptionRevenueKobo || 0),
            boostRevenueKobo: Number(finance.boostRevenueKobo || 0),
            updatedAt: finance.updatedAt ?? null,
          }
        : {
            balanceKobo: 0,
            subscriptionRevenueKobo: 0,
            boostRevenueKobo: 0,
            updatedAt: null,
          },
      ledger,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Unauthorized" },
      { status: 401 }
    );
  }
}