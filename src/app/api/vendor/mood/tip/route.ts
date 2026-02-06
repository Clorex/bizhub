import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { groqMoodTip, type Mood } from "@/lib/ai/groqMoodTip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(s: any, max = 2000) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() : t;
}

function cleanMood(v: any): Mood {
  const m = String(v || "").toLowerCase();
  if (m === "great" || m === "okay" || m === "slow") return m;
  return "okay";
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    const body = await req.json().catch(() => ({} as any));

    const mood = cleanMood(body?.mood);
    const storeSlug = clamp(body?.storeSlug, 80) || null;

    // snapshot is optional; we use it to make tips relevant
    const snapshot = body?.snapshot && typeof body.snapshot === "object" ? body.snapshot : {};

    const out = await groqMoodTip({ mood, storeSlug, snapshot });

    return NextResponse.json({ ok: true, mood, ...out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}