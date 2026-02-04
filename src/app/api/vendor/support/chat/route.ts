import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoryMsg = { role: "user" | "assistant"; text: string };

function cleanText(v: any, max = 2000) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max).trim();
}

function buildSystemPrompt() {
  return [
    "You are BizHub customer care for vendors.",
    "Speak in friendly business language. No technical terms.",
    "Give step-by-step help with short bullets.",
    "If you need more details, ask 1–2 questions only.",
    "Do not ask for passwords, OTP codes, bank PINs, or card numbers.",
    "If the user asks for something unsafe, warn them and redirect to safe steps.",
  ].join("\n");
}

async function geminiReply(params: { apiKey: string; message: string; history: HistoryMsg[] }) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(params.apiKey);

  const sys = buildSystemPrompt();

  const contents = [
    { role: "user", parts: [{ text: sys }] },
    ...params.history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: cleanText(m.text, 1500) }],
    })),
    { role: "user", parts: [{ text: params.message }] },
  ];

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 350,
      },
    }),
  });

  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || "AI support is unavailable right now");

  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: any) => String(p?.text || "")).join("") || "";

  return cleanText(text, 2500);
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as any));
    const message = cleanText(body?.message, 2000);

    const historyIn = Array.isArray(body?.history) ? (body.history as any[]) : [];

    // ✅ FIX: Force map() to return HistoryMsg so role stays "user" | "assistant"
    const history: HistoryMsg[] = historyIn
      .map((x: any): HistoryMsg => ({
        role: x?.role === "assistant" ? "assistant" : "user",
        text: cleanText(x?.text, 1500),
      }))
      .filter((x) => !!x.text);

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || "";

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply:
          "Support chat is getting set up.\n\nFor now, please describe the problem and include:\n- What page you were on\n- What you clicked\n- The message you saw\n\nThen try again after an update.",
      });
    }

    const reply = await geminiReply({ apiKey, message, history });

    return NextResponse.json({
      ok: true,
      reply: reply || "I didn’t understand. Please tell me what you’re trying to do and what went wrong.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}