// FILE: src/app/api/accelerator/simulate/route.ts

import { simulateProfit } from "@/lib/accelerator/profit-simulator";
import type { BusinessIdea } from "@/lib/accelerator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { idea, capitalInput, marketingSpendPercent } = body;

    if (!idea || !capitalInput) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = simulateProfit({
      idea: idea as BusinessIdea,
      capitalInput: Number(capitalInput),
      marketingSpendPercent: Number(marketingSpendPercent) || 15,
    });

    return Response.json({ ok: true, simulation: result });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Simulation failed" }, { status: 500 });
  }
}
