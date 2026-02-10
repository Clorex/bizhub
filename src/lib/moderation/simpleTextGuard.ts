// FILE: src/lib/moderation/simpleTextGuard.ts
//
// Lightweight text moderation — blocks obvious profanity/hate speech.
// NOT a replacement for AI moderation. Just a first-pass filter.

const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|bastard|dick|pussy|cunt|nigga|nigger|faggot)\b/i,
  /\b(kill\s+you|i\s+will\s+hurt|death\s+threat|bomb\s+you)\b/i,
  /\b(scam+er|thie[fv]|fraud|criminal)\b/i,
];

/**
 * Guard for inbound text (reviews, comments).
 * Returns { blocked, reason }.
 */
export function simpleTextGuard(text: string): { blocked: boolean; reason?: string } {
  if (!text) return { blocked: false };

  const normalized = text.toLowerCase().trim();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason: "Inappropriate language detected" };
    }
  }

  return { blocked: false };
}

/**
 * Moderate outbound text (re-engagement messages, vendor comms).
 * Returns cleaned text with flagged words replaced, or null if too toxic.
 */
export function moderateOutboundText(text: string): {
  safe: boolean;
  cleaned: string;
  flagged: boolean;
} {
  if (!text || !text.trim()) {
    return { safe: true, cleaned: "", flagged: false };
  }

  let cleaned = text.trim();
  let flagged = false;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cleaned.toLowerCase())) {
      flagged = true;
      cleaned = cleaned.replace(pattern, "***");
    }
  }

  return {
    safe: !flagged,
    cleaned,
    flagged,
  };
}