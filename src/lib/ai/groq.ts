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
    "/vendor/reengagement?segment=buyers_repeat",
    "/vendor/wallet",
    "/vendor/withdrawals",
    "/vendor/more",
  ]);
  if (allowed.has(u)) return u;
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

  // ✅ Supported model (old llama3-8b-8192 is deprecated)
  const model =
    args.model ||
    process.env.GROQ_MODEL_DAILY_CHECKIN ||
    process.env.GROQ_MODEL_DAILY ||
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant";

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
  if (!r.ok) throw new Error(j?.error?.message || `Groq failed (${r.status})`);

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
You are myBizHub’s calm, friendly business companion.

Write in simple everyday Nigerian-English. No jargon. No emojis.
Make it feel personal and human.

Return JSON only:
{
  "suggestion": string,
  "nudges": [
    { "tone": "info"|"warn", "title": string, "body": string, "cta"?: { "label": string, "url": string } }
  ]
}

Limits:
- suggestion: max 180 chars
- nudges: 0 to 3 items
- title max 60 chars
- body max 160 chars

Allowed CTA urls:
- /vendor
- /vendor/orders
- /vendor/products
- /vendor/products/new
- /vendor/reengagement?segment=buyers_repeat
- /vendor/wallet
- /vendor/withdrawals
- /vendor/more

Style:
- suggestion should feel like: "Today, do this one thing…"
- nudges should feel gentle: "Just a quick reminder…"
- If disputes or pending confirmations exist, add a warn nudge (calm but clear).
`;

  const user = `
DateKey: ${args.dayKey}
Store: ${args.storeName}

Business snapshot JSON:
${JSON.stringify(args.snapshot, null, 2)}

Write the best suggestion + gentle nudges for THIS store today.
`;

  const raw = await groqChatJSON({
    system,
    user,
    temperature: 0.75,
  });

  const suggestion =
    clamp(raw?.suggestion, 180) ||
    "Today, share one product link and follow up with one past buyer.";

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
        title: title || (tone === "warn" ? "Quick attention needed" : "Small reminder"),
        body:
          body ||
          "Just a quick reminder: open your dashboard and take one small action today.",
        cta: ctaUrl ? { label: ctaLabel || "Open", url: ctaUrl } : undefined,
      };
    })
    .filter((n: AiNudge) => !!n.title && !!n.body);

  return { suggestion, nudges };
}