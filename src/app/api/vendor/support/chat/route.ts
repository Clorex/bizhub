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

async function groqReply(params: { apiKey: string; model: string; message: string; history: HistoryMsg[] }) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const system = buildSystemPrompt();

  const messages = [
    { role: "system", content: system },
    ...params.history.map((m) => ({
      role: m.role,
      content: cleanText(m.text, 1500),
    })),
    { role: "user", content: params.message },
  ];

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      temperature: 0.35,
      max_tokens: 350,
    }),
  });

  const j = await r.json().catch(() => ({} as any));

  if (!r.ok) {
    // don’t leak provider error details to UI
    const msg = String(j?.error?.message || j?.message || "AI request failed");
    const err: any = new Error(msg);
    err.status = r.status;
    throw err;
  }

  const text = String(j?.choices?.[0]?.message?.content || "");
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
    const history: HistoryMsg[] = historyIn
      .map((x: any): HistoryMsg => ({
        role: x?.role === "assistant" ? "assistant" : "user",
        text: cleanText(x?.text, 1500),
      }))
      .filter((x) => !!x.text);

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    }

    const apiKey = String(process.env.GROQ_API_KEY || "").trim();
    const model = String(process.env.GROQ_MODEL || "llama-3.1-70b-versatile").trim();

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply:
          "Support chat is getting set up.\n\nFor now, please tell me:\n- What page you were on\n- What you clicked\n- What message you saw\n\nI’ll guide you with the next steps.",
      });
    }

    try {
      const reply = await groqReply({ apiKey, model, message, history });
      return NextResponse.json({
        ok: true,
        reply: reply || "I didn’t understand. Please tell me what you’re trying to do and what went wrong.",
      });
    } catch {
      return NextResponse.json({
        ok: true,
        reply:
          "Support chat is having trouble right now.\n\nPlease try again in a minute.\nIf it keeps happening, tell me what you were trying to do and what message you saw.",
      });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}