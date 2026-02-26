// FILE: src/app/api/accelerator/ideas/route.ts

import { generateBusinessIdeas } from "@/lib/accelerator/ideas-engine";
import type { AcceleratorProfile } from "@/lib/accelerator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profile = body.profile as AcceleratorProfile;

    if (!profile || !Array.isArray(profile.interests) || profile.interests.length === 0) {
      return Response.json({ error: "Please select at least one interest" }, { status: 400 });
    }

    const ideas = generateBusinessIdeas(profile);

    return Response.json({ ok: true, ideas });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to generate ideas" }, { status: 500 });
  }
}
