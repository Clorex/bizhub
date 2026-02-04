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

function fallbackSupportReply(messageRaw: string) {
  const m = cleanText(messageRaw, 5000).toLowerCase();

  // Growth / views / sales
  if (
    m.includes("views") ||
    m.includes("sales") ||
    m.includes("customers") ||
    m.includes("grow") ||
    m.includes("market") ||
    m.includes("promotion") ||
    m.includes("promote")
  ) {
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
      "- Front, back, close-up, and how it looks in real life",
      "",
      "5) Share your store link consistently",
      "- WhatsApp status",
      "- WhatsApp groups",
      "- Instagram bio + stories",
      "",
      "6) Promote your best product (if available)",
      "- Start with your best seller, not your slowest product",
      "",
      "If you tell me your product name + price, I’ll suggest a better title and the best photo order.",
    ].join("\n");
  }

  // Payment issues
  if (m.includes("payment") || m.includes("paystack") || m.includes("card") || m.includes("failed")) {
    return [
      "For payment issues, try this:",
      "",
      "1) Ask the customer to try again",
      "2) If it still fails, try a different card or network",
      "3) If you have a payment reference, share it here and I’ll tell you what it means",
      "",
      "Tip: Don’t share OTP codes or card details.",
    ].join("\n");
  }

  // Withdrawals / payout
  if (m.includes("withdraw") || m.includes("payout") || m.includes("wallet") || m.includes("balance")) {
    return [
      "For withdrawals, check these:",
      "",
      "1) Confirm your payout details are complete (bank name, account number, account name)",
      "2) Make sure your withdrawal steps are completed",
      "3) If you see an error message, paste it here exactly",
      "",
      "If you tell me what you see on the withdrawal page, I’ll guide you step-by-step.",
    ].join("\n");
  }

  // Login / account
  if (m.includes("login") || m.includes("sign in") || m.includes("password") || m.includes("otp")) {
    return [
      "For account access:",
      "",
      "- If you can’t login, confirm you are using the correct email",
      "- If you’re asked for a code, check your email inbox and spam folder",
      "",
      "Important: Never share your OTP code with anyone.",
    ].join("\n");
  }

  // Default
  return [
    "I can help.",
    "",
    "Tell me 2 things:",
    "1) What were you trying to do?",
    "2) What message did you see (copy it here)?",
  ].join("\n");
}

async function callGroq(params: { apiKey: string; model: string; message: string; history: HistoryMsg[] }) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const system = buildSystemPrompt();

  const messages = [
    { role: "system", content: system },
    ...params.history.map((m) => ({ role: m.role, content: cleanText(m.text, 1500) })),
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
    const msg = String(j?.error?.message || j?.message || "Groq request failed");
    return { ok: false as const, status: r.status, error: msg };
  }

  const text = String(j?.choices?.[0]?.message?.content || "");
  const out = cleanText(text, 2500);
  if (!out) return { ok: false as const, status: 500, error: "Empty reply" };

  return { ok: true as const, text: out };
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

    // If no key in this environment, still reply (never blank)
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply: fallbackSupportReply(message),
        meta: { mode: "fallback_no_key" },
      });
    }

    const res = await callGroq({ apiKey, model, message, history });

    if (res.ok) {
      return NextResponse.json({ ok: true, reply: res.text, meta: { mode: "groq", model } });
    }

    // Log the real failure for you in Vercel logs (no key is logged)
    console.error("GROQ_SUPPORT_CHAT_FAILED", {
      status: res.status,
      error: res.error,
      model,
    });

    // Return helpful fallback answer to user
    // (so chat still feels “alive” even when Groq is down / rate-limited)
    const fallback = fallbackSupportReply(message);

    // If it looks like auth/key issues, add a small admin hint (still friendly)
    const hint =
      res.status === 401
        ? "\n\n(Quick note: Support assistant needs a valid key in production.)"
        : res.status === 429
          ? "\n\n(Quick note: Support assistant is busy right now. Try again shortly.)"
          : "";

    return NextResponse.json({
      ok: true,
      reply: fallback + hint,
      meta: { mode: "fallback_after_error", status: res.status },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}