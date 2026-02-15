// FILE: src/app/api/achievements/route.ts

import { requireRole } from "@/lib/auth/server";
import { getUnseenAchievements, markAchievementsSeen } from "@/lib/achievements/server";
import type { AchievementKey } from "@/lib/achievements/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/achievements — fetch unseen achievements for the current user.
 * Query param: ?role=vendor|customer
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const role = url.searchParams.get("role") || "vendor";

    const me = await requireRole(req, role === "customer" ? "customer" : "owner");
    const actorId = role === "customer" ? me.uid : (me.businessId || me.uid);
    const actorType = role === "customer" ? "customer" : "vendor";

    const unseen = await getUnseenAchievements({ actorType, actorId });

    return Response.json({ ok: true, achievements: unseen });
  } catch (e: any) {
    return Response.json({ ok: false, achievements: [], error: e?.message }, { status: 200 });
  }
}

/**
 * POST /api/achievements — mark achievements as seen.
 * Body: { role: "vendor"|"customer", keys: ["vendor_first_order", ...] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = String(body.role || "vendor");
    const keys: AchievementKey[] = Array.isArray(body.keys) ? body.keys : [];

    if (!keys.length) return Response.json({ ok: true });

    const me = await requireRole(req, role === "customer" ? "customer" : "owner");
    const actorId = role === "customer" ? me.uid : (me.businessId || me.uid);
    const actorType = role === "customer" ? "customer" : "vendor";

    await markAchievementsSeen({ actorType, actorId, keys });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message }, { status: 200 });
  }
}
