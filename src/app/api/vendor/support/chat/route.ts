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

function modelCandidates() {
  const envModel = String(process.env.GEMINI_MODEL || "").trim();
  const list = [
    envModel,
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
    "gemini-pro",
  ].filter(Boolean);

  // unique
  return Array.from(new Set(list));
}

async function tryGeminiModel(params: {
  apiKey: string;
  model: string;
  message: string;
  history: HistoryMsg[];
}) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent` +
    `?key=${encodeURIComponent(params.apiKey)}`;

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
  if (!r.ok) {
    const msg = String(j?.error?.message || "AI request failed");
    return { ok: false as const, error: msg };
  }

  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: any) => String(p?.text || "")).join("") || "";

  const out = cleanText(text, 2500);
  if (!out) return { ok: false as const, error: "Empty reply" };

  return { ok: true as const, text: out };
}

async function geminiReply(params: { apiKey: string; message: string; history: HistoryMsg[] }) {
  const models = modelCandidates();

  let lastErr = "";
  for (const model of models) {
    const res = await tryGeminiModel({ ...params, model });
    if (res.ok) return res.text;
    lastErr = res.error;
    // try next model
  }

  throw new Error(lastErr || "AI support is unavailable right now");
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

    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

    // If no key, keep chat usable without crashing the app
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply:
          "Support chat is getting set up.\n\nFor now, please tell me:\n- What page you were on\n- What you clicked\n- What message you saw\n\nI’ll guide you with the next steps.",
      });
    }

    try {
      const reply = await geminiReply({ apiKey, message, history });
      return NextResponse.json({ ok: true, reply });
    } catch {
      // ✅ Do NOT expose provider error text to UI
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