export type Mood = "great" | "okay" | "slow";

export type MoodTipRes = {
  tip: string;
  actions: { label: string; url: string }[];
};

function clamp(s: any, max = 220) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() : t;
}

function safeUrl(u: any) {
  const url = String(u || "").trim();
  const allowed = new Set([
    "/vendor/orders",
    "/vendor/products",
    "/vendor/products/new",
    "/vendor/reengagement?segment=buyers_repeat",
    "/vendor/store",
    "/vendor/wallet",
    "/vendor",
  ]);
  if (allowed.has(url)) return url;
  if (url.startsWith("/vendor/orders/")) return url;
  return "";
}

async function groqChatJSON(args: { system: string; user: string; temperature?: number; model?: string }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const model =
    args.model ||
    process.env.GROQ_MODEL_MOOD ||
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

export async function groqMoodTip(args: {
  mood: Mood;
  storeSlug: string | null;
  snapshot: any;
}): Promise<MoodTipRes> {
  const system = `
You are myBizHub’s calm, friendly business companion.
Write in simple everyday Nigerian-English. No emojis. No jargon.

Return JSON only:
{
  "tip": string,
  "actions": [{ "label": string, "url": string }]
}

Rules:
- tip max 200 chars, make it feel personal
- actions max 2
Allowed urls:
- /vendor/orders
- /vendor/products
- /vendor/products/new
- /vendor/reengagement?segment=buyers_repeat
- /vendor/store
- /vendor/wallet
- /vendor
`;

  const user = `
Mood: ${args.mood}
StoreSlug: ${args.storeSlug || ""}
Snapshot JSON:
${JSON.stringify(args.snapshot || {}, null, 2)}

Give one short helpful tip for today plus up to 2 actions.
`;

  const raw = await groqChatJSON({ system, user, temperature: 0.75 });

  const tip = clamp(raw?.tip, 200) || "Today, do one small thing: share a product link and follow up with one buyer.";

  const actions = (Array.isArray(raw?.actions) ? raw.actions : [])
    .slice(0, 2)
    .map((a: any) => ({
      label: clamp(a?.label, 24) || "Open",
      url: safeUrl(a?.url),
    }))
    .filter((a: any) => !!a.url);

  return { tip, actions };
}