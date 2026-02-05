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

function cleanModel(v: any) {
  return String(v || "")
    .trim()
    .replace(/^["']+/, "")
    .replace(/["']+$/, "")
    .trim();
}

function buildSystemPrompt() {
  return [
    "You are myBizHub customer care for vendors.",
    "Speak in friendly business language. No technical terms.",
    "Give step-by-step help with short bullets.",
    "If you need more details, ask 1–2 questions only.",
    "Do not ask for passwords, OTP codes, bank PINs, or card numbers.",
  ].join("\n");
}

function fallbackSupportReply(messageRaw: string) {
  const m = cleanText(messageRaw, 5000).toLowerCase();

  if (m.includes("views") || m.includes("sales") || m.includes("customers") || m.includes("grow")) {
    return [
      "To get more views and sales, do these 6 things:",
      "",
      "1) Fix your cover photo",
      "- Use a clear photo with good light",
      "- Make the product fill the frame (no dark/blurry pictures)",
      "",
      "2) Use a simple product name",
      "- Example: “Black Men’s Polo (Size M–XL)”",
      "",
      "3) Price and stock must be correct",
      "- Out of stock = people stop clicking",
      "",
      "4) Add 3–5 photos",
      "- Front, back, close-up, and real-life photo",
      "",
      "5) Share your store link consistently",
      "- WhatsApp status, WhatsApp groups, Instagram stories",
      "",
      "6) Promote your best product (if you have promotion)",
      "- Start with your best seller, not your slowest product",
      "",
      "If you tell me your product name + price, I’ll suggest a better title and photo order.",
    ].join("\n");
  }

  return [
    "I can help.",
    "",
    "Tell me 2 things:",
    "1) What were you trying to do?",
    "2) What message did you see (copy it here)?",
  ].join("\n");
}

async function groqRequest(params: {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: 0.35,
      max_tokens: 350,
    }),
  });

  const j = await r.json().catch(() => ({} as any));

  if (!r.ok) {
    const msg = String(j?.error?.message || j?.message || "Groq request failed");
    return { ok: false as const, status: r.status, error: msg };
  }

  const text = String(j?.choices?.[0]?.message?.content || "");
  const out = cleanText(text, 2500);
  if (!out) return { ok: false as const, status: 500, error: "Empty reply" };

  return { ok: true as const, text: out };
}

function modelFallbackList(primary: string) {
  // Try a few common Groq model IDs (some accounts differ)
  const list = [
    primary,
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
  ].map(cleanModel);

  return Array.from(new Set(list.filter(Boolean)));
}

function buildMessagesWithSystem(system: string, history: HistoryMsg[], message: string) {
  return [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: cleanText(m.text, 1500) })),
    { role: "user", content: message },
  ];
}

// Some providers reject role=system depending on model/account.
// This fallback format removes system role and places it inside the first user message.
function buildMessagesWithoutSystem(system: string, history: HistoryMsg[], message: string) {
  const sysAsUser = `Support rules:\n${system}\n\nCustomer message:\n`;
  return [
    { role: "user", content: sysAsUser + message },
    ...history.map((m) => ({ role: m.role, content: cleanText(m.text, 1500) })),
  ];
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
    const envModel = cleanModel(process.env.GROQ_MODEL || "llama-3.1-70b-versatile");
    const models = modelFallbackList(envModel);
    const system = buildSystemPrompt();

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply: fallbackSupportReply(message),
        meta: { mode: "fallback_no_key" },
      });
    }

    let last: any = null;

    for (const model of models) {
      // 1) Try normal system role
      let res = await groqRequest({
        apiKey,
        model,
        messages: buildMessagesWithSystem(system, history, message),
      });

      // 2) If Groq says request is invalid (400), retry without system role format
      if (!res.ok && res.status === 400) {
        res = await groqRequest({
          apiKey,
          model,
          messages: buildMessagesWithoutSystem(system, history, message),
        });
      }

      if (res.ok) {
        return NextResponse.json({ ok: true, reply: res.text, meta: { mode: "groq", model } });
      }

      last = { status: res.status, error: res.error, model };
    }

    console.error("GROQ_SUPPORT_CHAT_FAILED", last);

    return NextResponse.json({
      ok: true,
      reply: fallbackSupportReply(message),
      meta: { mode: "fallback_after_error", lastStatus: last?.status || 0, lastModel: last?.model || null },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}