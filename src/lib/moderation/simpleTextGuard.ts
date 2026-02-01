// FILE: src/lib/moderation/simpleTextGuard.ts
/**
 * MVP moderation filter (free): blocks sexual content, bullying/harassment patterns.
 * Later, can be replaced with a paid moderation API, but this is immediate + local.
 */

function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const BLOCK_LIST = [
  // sexual harassment / explicit
  "sex",
  "nude",
  "naked",
  "hookup",
  "fuck",
  "suck",
  "blowjob",
  "porn",
  "dick",
  "pussy",
  "rape",
  "molest",
  "nudes",
  "send nudes",

  // bullying / threats
  "idiot",
  "stupid",
  "bastard",
  "fool",
  "kill you",
  "die",
  "thief",
  "i will deal with you",
  "i will ruin you",
  "you are useless",
];

export type ModerationResult = { ok: true } | { ok: false; reason: string; hit?: string };

export function moderateOutboundText(text: string): ModerationResult {
  const t = normalize(text);
  if (!t) return { ok: false, reason: "Empty message" };

  for (const w of BLOCK_LIST) {
    if (t.includes(w)) {
      return { ok: false, reason: "Blocked by safety policy", hit: w };
    }
  }

  // crude repeated insult pattern
  if (/(?:\bidiot\b|\bstupid\b|\bfool\b).*(?:\bidiot\b|\bstupid\b|\bfool\b)/.test(t)) {
    return { ok: false, reason: "Blocked by safety policy", hit: "repeated_insult" };
  }

  return { ok: true };
}