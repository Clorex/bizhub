export type AiNudge = {
  tone: "info" | "warn";
  title: string;
  body: string;
  cta?: { label: string; url: string };
};

export type AiDailyCheckin = {
  suggestion: string;
  nudges: AiNudge[];
};

function clamp(s: any, max = 220) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() : t;
}

function sanitizeUrl(url: any) {
  const u = String(url || "").trim();
  const allowed = new Set([
    "/vendor",
    "/vendor/orders",
    "/vendor/products",
    "/vendor/products/new",
    "/vendor/reengagement",
    "/vendor/reengagement?segment=buyers_repeat",
    "/vendor/wallet",
    "/vendor/withdrawals",
    "/vendor/more",
  ]);
  if (allowed.has(u)) return u;
  // allow vendor/order details
  if (u.startsWith("/vendor/orders/")) return u;
  return "";
}

function safeTone(v: any): "info" | "warn" {
  return String(v || "").toLowerCase() === "warn" ? "warn" : "info";
}

async function groqChatJSON(args: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const model = args.model || "llama3-8b-8192";

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: typeof args.temperature === "number" ? args.temperature : 0.7,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(j?.error?.message || `Groq failed (${r.status})`);
  }

  const content = j?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content");

  return JSON.parse(content);
}

export async function groqGenerateDailyCheckin(args: {
  dayKey: string; // YYYY-MM-DD (Lagos)
  storeName: string;
  snapshot: any;
}): Promise<AiDailyCheckin> {
  const system = `
You are myBizHub’s calm business assistant.
Write simple, friendly, Nigerian-English style messages (no jargon).
Be helpful and not pushy. No emojis.
Return JSON only with fields: suggestion (string), nudges (array).

nudges: up to 3 items
Each item: { tone: "info"|"warn", title: string, body: string, cta?: { label: string, url: string } }

Allowed CTA urls:
- /vendor/orders
- /vendor/products
- /vendor/products/new
- /vendor/reengagement?segment=buyers_repeat
- /vendor/wallet
- /vendor/withdrawals
- /vendor

Rules:
- Suggestion should be one actionable step for today (max 180 chars).
- Nudges should be gentle reminders (1–2 sentences each).
- If there are disputes or pending confirmations, add a warn nudge.
- If there are no products, nudge to add product.
- If visits are high but orders low, nudge to improve product photos/prices/delivery info.
`;

  const user = `
DateKey: ${args.dayKey}
Store: ${args.storeName}

Business snapshot JSON:
${JSON.stringify(args.snapshot, null, 2)}

Write the best "suggestion" and "nudges" for THIS business today.
`;

  const raw = await groqChatJSON({
    system,
    user,
    temperature: 0.75,
  });

  const suggestion = clamp(raw?.suggestion, 180) || "Share one product link today and follow up with one past buyer.";

  const nudgesIn = Array.isArray(raw?.nudges) ? raw.nudges : [];
  const nudges: AiNudge[] = nudgesIn
    .slice(0, 3)
    .map((x: any) => {
      const title = clamp(x?.title, 60);
      const body = clamp(x?.body, 160);
      const tone = safeTone(x?.tone);

      const ctaUrl = sanitizeUrl(x?.cta?.url);
      const ctaLabel = clamp(x?.cta?.label, 24);

      return {
        tone,
        title: title || (tone === "warn" ? "Needs attention" : "Quick reminder"),
        body: body || "Small check‑in: open your dashboard and take one quick action today.",
        cta: ctaUrl ? { label: ctaLabel || "Open", url: ctaUrl } : undefined,
      };
    })
    .filter((n: AiNudge) => !!n.title && !!n.body);

  return { suggestion, nudges };
}