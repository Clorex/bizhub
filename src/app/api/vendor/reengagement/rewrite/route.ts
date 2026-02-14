import { requireAnyRole } from "@/lib/auth/server";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

async function groqRewriteMessage(args: {
  currentMessage: string;
  audienceType: string;
  tone: string;
}): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const system = `You are a friendly WhatsApp message writer for Nigerian small businesses.

Your job is to rewrite/improve a re-engagement message that a vendor wants to send to past customers.

Rules:
- Keep it SHORT (max 3-4 sentences, under 280 characters ideally)
- Use simple, friendly Nigerian-English
- Sound personal and warm, not corporate or spammy
- No excessive punctuation or ALL CAPS
- No emojis unless the original had them
- Include a soft call-to-action
- Make it feel like a real person texting, not a bot

Audience types:
- "buyers_all" = all past buyers
- "buyers_first" = first-time buyers
- "buyers_repeat" = repeat customers
- "inactive_30/60/90" = customers who haven't bought in X days
- "abandoned" = people who started checkout but didn't pay
- "vip" = high-value customers

Tone options:
- "friendly" = warm and casual
- "professional" = polite but businesslike
- "urgent" = gentle urgency without being pushy

Return ONLY the rewritten message text. No quotes, no explanations.`;

  const user = `Rewrite this message for ${args.audienceType} customers with a ${args.tone} tone:

"${args.currentMessage}"

Return only the improved message text.`;

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 300,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Groq failed (${r.status})`);

  const content = j?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content");

  // Clean up the response
  let text = String(content).trim();
  // Remove surrounding quotes if present
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }

  return text;
}

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const plan = await getBusinessPlanResolved(me.businessId);
    const remixEnabled = !!plan?.features?.reengagementAiRemix;

    if (!remixEnabled) {
      return Response.json({
        ok: false,
        code: "FEATURE_LOCKED",
        error: "AI remix is not available on your plan.",
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const currentMessage = String(body?.message || "").trim();
    const audienceType = String(body?.audienceType || "buyers_all");
    const tone = String(body?.tone || "friendly");

    if (!currentMessage || currentMessage.length < 10) {
      return Response.json({
        ok: false,
        error: "Please provide a message to rewrite (at least 10 characters).",
      }, { status: 400 });
    }

    if (currentMessage.length > 1000) {
      return Response.json({
        ok: false,
        error: "Message is too long. Please keep it under 1000 characters.",
      }, { status: 400 });
    }

    const rewritten = await groqRewriteMessage({
      currentMessage,
      audienceType,
      tone,
    });

    return Response.json({
      ok: true,
      rewrittenMessage: rewritten,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    console.error("[rewrite] Error:", e?.message || e);
    return Response.json({ ok: false, error: e?.message || "Failed to rewrite message" }, { status: 500 });
  }
}
