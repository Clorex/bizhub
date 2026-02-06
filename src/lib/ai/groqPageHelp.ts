type HelpAction = { label: string; url: string };

export type PageHelpResponse = {
  answer: string;
  quickSteps: string[];
  actions: HelpAction[];
};

function clamp(s: any, max = 220) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() : t;
}

function safeUrl(u: any) {
  const url = String(u || "").trim();
  if (!url) return "";
  const allowed = [
    "/vendor",
    "/vendor/orders",
    "/vendor/products",
    "/vendor/products/new",
    "/vendor/analytics",
    "/vendor/reengagement",
    "/vendor/reengagement?segment=buyers_repeat",
    "/vendor/wallet",
    "/vendor/withdrawals",
    "/vendor/store",
    "/vendor/more",
    "/vendor/promote/faq",
    "/vendor/promote/faq/chat",
  ];
  if (allowed.includes(url)) return url;
  if (url.startsWith("/vendor/orders/")) return url;
  if (url.startsWith("/b/")) return url;
  return "";
}

async function groqChatJSON(args: { system: string; user: string; temperature?: number; model?: string }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");

  // ✅ Use a supported model (old llama3-8b-8192 was deprecated)
  const model =
    args.model ||
    process.env.GROQ_MODEL_PAGE_HELP ||
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
      temperature: typeof args.temperature === "number" ? args.temperature : 0.5,
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

export async function groqPageHelp(args: {
  path: string;
  pageTitle: string;
  pageHint?: string;
  question: string;
}): Promise<PageHelpResponse> {
  const system = `
You are myBizHub’s in-app helper.
Explain the CURRENT page simply and answer the user's question.
Use plain everyday words. No jargon. No emojis.

Return JSON only:
{
  "answer": string,
  "quickSteps": string[],
  "actions": [{ "label": string, "url": string }]
}

Only use allowed URLs:
- /vendor
- /vendor/orders
- /vendor/products
- /vendor/products/new
- /vendor/analytics
- /vendor/reengagement
- /vendor/reengagement?segment=buyers_repeat
- /vendor/wallet
- /vendor/withdrawals
- /vendor/store
- /vendor/more
- /vendor/promote/faq/chat
- /vendor/promote/faq
- /b/<slug>
- /vendor/orders/<orderId>

Keep answer <= 1200 chars.
`;

  const user = `
PageTitle: ${args.pageTitle}
Path: ${args.path}
PageHint: ${String(args.pageHint || "")}

UserQuestion: ${args.question}
`;

  const raw = await groqChatJSON({ system, user, temperature: 0.55 });

  const answer = clamp(raw?.answer, 1200) || "Tell me what you’re trying to do on this page.";

  const quickSteps = (Array.isArray(raw?.quickSteps) ? raw.quickSteps : [])
    .slice(0, 5)
    .map((x: any) => clamp(x, 90))
    .filter(Boolean);

  const actions = (Array.isArray(raw?.actions) ? raw.actions : [])
    .slice(0, 4)
    .map((a: any) => ({
      label: clamp(a?.label, 24) || "Open",
      url: safeUrl(a?.url),
    }))
    .filter((a: any) => !!a.url);

  return { answer, quickSteps, actions };
}