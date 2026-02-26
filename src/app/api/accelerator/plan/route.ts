// FILE: src/app/api/accelerator/plan/route.ts

import { generate7DayPlan } from "@/lib/accelerator/plan-generator";
import type { BusinessIdea } from "@/lib/accelerator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idea = body.idea as BusinessIdea;

    if (!idea || !idea.title) {
      return Response.json({ error: "Missing idea" }, { status: 400 });
    }

    const plan = generate7DayPlan(idea);

    return Response.json({ ok: true, plan });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to generate plan" }, { status: 500 });
  }
}
