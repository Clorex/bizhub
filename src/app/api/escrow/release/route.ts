// FILE: src/app/api/escrow/release/route.ts

import { releaseEscrowIfEligible } from "@/lib/escrow/releaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }

    const result = await releaseEscrowIfEligible({ orderId: String(orderId) });

    if ((result as any)?.ok === false) {
      const r = result as any;
      return Response.json({ error: r.error }, { status: r.status || 500 });
    }

    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e?.message || "Release failed" }, { status: 500 });
  }
}