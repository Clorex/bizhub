import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const ids = toIdList((body as any)?.ids);

    if (ids.length === 0) {
      return Response.json({ ok: true, orders: [] });
    }

    const refs = ids.map((id) => adminDb.collection("orders").doc(id));

    // getAll exists on Firestore but types can be awkward in some setups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snaps: any[] = await (adminDb as any).getAll(...refs);

    const orders = snaps
      .filter((s) => s && s.exists)
      .map((s) => ({ id: s.id, ...s.data() }));

    return Response.json({ ok: true, orders });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
