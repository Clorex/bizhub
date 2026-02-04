export type ReengagementSegment =
  | "buyers_all"
  | "buyers_first"
  | "buyers_repeat"
  | "inactive_30"
  | "inactive_60"
  | "inactive_90"
  | "abandoned"
  | "vip";

export type PlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type ReengagementPerson = {
  key: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;

  ordersCount?: number; // completed orders count
  totalSpent?: number; // optional
  lastOrderMs?: number; // completed last order
  lastOrderId?: string | null;
};

export type ReengagementFeatures = {
  reengagementSmartMessages?: boolean;
  reengagementAiRemix?: boolean;
};

function hash32(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0) || 1;
}

function pick<T>(seed: string, arr: T[]) {
  return arr[hash32(seed) % arr.length];
}

function firstName(fullName?: string | null) {
  const n = String(fullName || "").trim();
  if (!n) return "";
  return n.split(/\s+/).filter(Boolean)[0] || "";
}

function clampText(s: string, max = 1200) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim();
}

export function segmentLabel(seg: ReengagementSegment) {
  switch (seg) {
    case "buyers_all":
      return "Past buyers";
    case "buyers_first":
      return "First-time buyers";
    case "buyers_repeat":
      return "Repeat buyers";
    case "inactive_30":
      return "Inactive 30 days";
    case "inactive_60":
      return "Inactive 60 days";
    case "inactive_90":
      return "Inactive 90 days";
    case "vip":
      return "VIP customers";
    case "abandoned":
      return "Not completed";
  }
}

// Lightweight deterministic “rewrite” (no external AI call). Only runs when reengagementAiRemix is enabled.
function remixRewrite(base: string, seed: string) {
  let t = String(base || "").trim();

  const swaps: Array<[RegExp, string[]]> = [
    [/\bhello\b/gi, ["Hello", "Hi", "Hey"]],
    [/\bthank you\b/gi, ["Thanks so much", "Thank you", "Thanks a lot"]],
    [/\bif you need anything else\b/gi, ["If you need anything", "If you need help with anything", "If you need any assistance"]],
    [/\bavailable\b/gi, ["available", "here to help", "ready to assist"]],
    [/\breorder\b/gi, ["reorder", "order again", "restock"]],
    [/\bmy bizhub store\b/gi, ["my BizHub store", "my store on BizHub", "my BizHub shop"]],
  ];

  for (const [re, options] of swaps) {
    if (re.test(t)) {
      t = t.replace(re, pick(seed + re.source, options));
    }
  }

  const parts = t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2 && hash32(seed + "::swap") % 3 === 0) {
    const a = parts[0];
    parts[0] = parts[1];
    parts[1] = a;
    t = parts.join("\n\n");
  }

  return clampText(t, 1200);
}

export function composeSmartMessage(args: {
  planKey: PlanKey;
  features?: ReengagementFeatures;

  businessSlug?: string | null;
  businessName?: string | null;

  segment: ReengagementSegment;
  baseText: string;

  person: ReengagementPerson;

  rotationKey?: string;
}) {
  const planKey = (String(args.planKey || "FREE").toUpperCase() as PlanKey) || "FREE";

  const smartMessages = !!args.features?.reengagementSmartMessages;
  const aiRemix = planKey === "APEX" && !!args.features?.reengagementAiRemix;

  // If smart messages is OFF => return exactly what vendor typed (keeps old behavior)
  if (!smartMessages) return clampText(args.baseText, 1200);

  const seg = args.segment;
  const baseRaw = String(args.baseText || "").trim();
  const rot = String(args.rotationKey || "v1");

  const store = String(args.businessName || args.businessSlug || "my store").trim() || "my store";
  const fn = firstName(args.person.fullName);
  const seed = ["reengage", planKey, String(args.businessSlug || ""), String(args.person.key || ""), seg, rot].join("|");

  const greetVariants = fn ? [`Hi ${fn},`, `Hello ${fn},`, `Hey ${fn},`] : ["Hello,", "Hi,", "Hey,"];
  const closings = [`– ${store}`, `– ${store} (BizHub)`, `– ${store} on BizHub`];

  const extraLinesBySegment: Record<ReengagementSegment, string[]> = {
    buyers_all: [
      "If you need anything else, I’m here to help.",
      "If you want to reorder, I can help you quickly.",
      "I’m available if you have any questions.",
    ],
    buyers_first: [
      "Thanks again for your first order. If anything is unclear, reply and I’ll help.",
      "Hope you loved it. If you need help, I’m available.",
      "If you have feedback, I’d love to hear it.",
    ],
    buyers_repeat: [
      "Thank you for coming back. I really appreciate you.",
      "You’re a valued customer — thanks for shopping with me again.",
      "If you want to restock, I can help you reorder fast.",
    ],
    inactive_30: [
      "Just checking in — do you need to restock?",
      "We have fresh updates — want to reorder?",
      "If you need anything, I’m available to help.",
    ],
    inactive_60: [
      "It’s been a while — do you want to reorder?",
      "Quick check-in — anything you need help with?",
      "If you’d like recommendations, tell me what you need.",
    ],
    inactive_90: [
      "Long time — hope you’re doing well. Want to reorder?",
      "Just checking in. If you need anything, I’m available.",
      "If you want something new, I can suggest options.",
    ],
    vip: [
      "You’re one of my top customers — thank you. If you need anything, I’ll prioritize you.",
      "Quick VIP check-in — want to reorder? I’m available.",
      "Thanks for your support. Tell me what you need and I’ll help quickly.",
    ],
    abandoned: [
      "I noticed you started an order but didn’t complete payment.",
      "Do you still want the item? I can help you complete payment.",
      "If anything stopped you, tell me and I’ll assist.",
    ],
  };

  let body = baseRaw;

  // ✅ “AI remix” only if Admin enabled reengagementAiRemix for this plan (APEX)
  if (aiRemix) body = remixRewrite(body, seed + "::remix");

  const greet = pick(seed + "::greet", greetVariants);
  const closing = pick(seed + "::close", closings);
  const extra = pick(seed + "::extra", extraLinesBySegment[seg] || extraLinesBySegment.buyers_all);

  return clampText([greet, "", body, "", extra, "", closing].join("\n"), 1200);
}