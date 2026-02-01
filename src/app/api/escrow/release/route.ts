// FILE: src/app/api/escrow/release/route.ts
import { NextResponse } from "next/server";
import { releaseEscrowIfEligible } from "@/lib/escrow/releaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const result = await releaseEscrowIfEligible({ orderId: String(orderId) });

    if ((result as any)?.ok === false) {
      const r = result as any;
      return NextResponse.json({ error: r.error }, { status: r.status || 500 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Release failed" }, { status: 500 });
  }
}