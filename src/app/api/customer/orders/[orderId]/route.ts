import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const me = await requireMe(req);

    const doc = await adminDb.collection("orders").doc(orderId).get();
    if (!doc.exists) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const o: any = { id: doc.id, ...doc.data() };
    return Response.json({ ok: true, order: o });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}