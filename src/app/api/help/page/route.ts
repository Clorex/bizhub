import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { groqPageHelp } from "@/lib/ai/groqPageHelp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(s: any, max = 800) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() : t;
}

export async function POST(req: Request) {
  try {
    // keep it inside authenticated app usage
    await requireAnyRole(req, ["owner", "staff", "admin"]);

    const body = await req.json().catch(() => ({} as any));

    const path = clamp(body?.path, 180);
    const pageTitle = clamp(body?.pageTitle, 80);
    const pageHint = clamp(body?.pageHint, 600);
    const question = clamp(body?.question, 500);

    if (!path) return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });
    if (!question) return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });

    const out = await groqPageHelp({
      path,
      pageTitle: pageTitle || "Page",
      pageHint,
      question,
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}