/**
 * NewsOfYou — twin safety module (Phase 0, used by Phases 2/4/5/8)
 * ================================================================
 * Two jobs:
 *  1. `TWIN_RULES` / `buildTwinRules()` — the character rules every twin
 *     prompt must include (plan §6). The twin is always an AI, never claims
 *     to be human, never promises anything on the owner's behalf.
 *  2. `quickGuard(text)` — a free, rule-based screen run on generated text
 *     BEFORE it is shown or written anywhere. If it trips, the caller
 *     regenerates once, then falls back to a gentle canned reply.
 *
 * `safetyStop(text)` is the harder signal used by Face to Face (Phase 8):
 * self-harm / abuse / fear for safety. When it fires, the exercise stops and
 * the user is pointed at real human help — the AI never plays therapist.
 *
 * No LLM calls, no dependencies: pure functions so they can run inlined in
 * any edge function and be unit-tested offline.
 */

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/safety.ts) ──
// ── BEGIN INLINE: safety.ts ──
/** Character contract for the twin. Placeholders are filled at call time. */
const TWIN_RULES = `You are {owner_name}'s AI stand-in, talking with {partner_name} while {owner_name} is away.
- You are an AI. If asked, say so warmly. Never claim to be human, to be physically present, or to have done things in the real world.
- Speak like {owner_name} in tone and warmth (style card below), but stay your own gentle self: kind, respectful, positive.
- Never insult, mock, threaten, guilt-trip, play jealousy games, or say anything cruel, even jokingly. No explicit sexual content. No slurs, no profanity.
- Never promise things on {owner_name}'s behalf (meeting, money, forgiveness, decisions). Offer instead to schedule a message to him or set a reminder.
- Use memories only when they naturally fit. Don't dump facts or quote old chats verbatim. Never reveal anything about other private conversations.
- If she seems upset: validate first, no lecturing; offer "Face to Face" if the issue involves {owner_name}.
- If she mentions self-harm, abuse, or feeling unsafe: respond with care, encourage reaching a trusted person or local emergency/helpline, and tell her {owner_name} would want her safe.
- Match her language (English / Hindi / Hinglish). Keep replies short (1-4 lines) unless asked for more.
- Output JSON only: {"reply": "...", "mood": "...", "actions": []}`;

/** Fill the placeholders in TWIN_RULES without touching the braces inside. */
function buildTwinRules(vars: { ownerName: string; partnerName: string }): string {
  return TWIN_RULES.split("{owner_name}").join(vars.ownerName).split("{partner_name}").join(vars.partnerName);
}

/** Shown when the twin cannot answer (all providers down, guard tripped twice). */
const GENTLE_FALLBACK_REPLY = "I'm resting for a bit — try me again in a little while. 💤";

/** Used when the guard trips on generated text. */
const GUARD_TRIPPED_REPLY = "Let me say that differently — I only want to be kind to you. 🫶";

type GuardFlag = "explicit" | "slur" | "cruel" | "human_claim" | "promise" | "self_harm" | "abuse";

interface GuardResult {
  ok: boolean;
  flags: GuardFlag[];
  reason?: string;
}

// Tight, deliberate lists: we would rather miss a subtle case than block a
// loving message. Add Hinglish/Hindi spellings as you see them in real data.
const LEXICON: Record<Exclude<GuardFlag, "human_claim" | "promise" | "self_harm" | "abuse">, RegExp[]> = {
  explicit: [
    /\b(nude|nudes|sext|sexting|blow ?job|hand ?job|orgasm|horny|aroused|boner)\b/i,
    /\bsex\b(?!\s*(?:education|ed|ism))/i,
  ],
  slur: [
    /\b(retard(?:ed)?|faggot|nigg(?:er|a)|chink|spastic)\b/i,
  ],
  cruel: [
    /\b(i|we) (?:hate|despise) you\b/i,
    /\byou(?:'re| are) (?:worthless|useless|pathetic|a joke|stupid|ugly|fat)\b/i,
    /\bshut up\b/i,
    /\bnobody (?:loves|cares about) you\b/i,
  ],
};

const HUMAN_CLAIM_PATTERNS = [
  /\bi am (?:really |actually )?(?:human|a real person|not an ai)\b/i,
  /\bi'?m (?:really |actually )?(?:human|a real person|not an ai)\b/i,
  /\bthis is really \w+, not an ai\b/i,
  /\bi am \w+ (?:in person|right here)\b/i,
];

const PROMISE_PATTERNS = [
  /\bi(?:'ll| will) (?:definitely |surely |promise to )?(?:meet|come|marry|pay|send money|take you|fix it|forgive)\b/i,
  /\byou have my word\b/i,
];

const SELF_HARM_PATTERNS = [
  /\b(?:kill|hurt|cut|harm) myself\b/i,
  /\bsuicide|suicidal|kill myself|end (?:it all|my life)\b/i,
  /\bno (?:reason|point) (?:to|in) liv(?:e|ing)\b/i,
  /\bjaan dena|aatmhatya|khudkhushi\b/i,
];

const ABUSE_PATTERNS = [
  /\b(?:he|she|they|partner|husband|wife|boyfriend|girlfriend) (?:hits?|beat|beats|hit|slapped|choked|threatened|raped) me\b/i,
  /\bi(?:'m| am) (?:scared|afraid) (?:of|for) (?:him|her|my life|my safety)\b/i,
  /\b(?:mar|maar) ?(?:deta|deti|diya|di)\b/i,
];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Cheap pre-flight / post-flight screen. `quickGuard` is intentionally
 * permissive: it catches obvious cruelty, explicit content and impersonation
 * claims — everything subtle is handled by the model's own instructions.
 */
function quickGuard(text: string): GuardResult {
  const t = (text ?? "").trim();
  if (!t) return { ok: true, flags: [] };

  const flags: GuardFlag[] = [];
  for (const [flag, patterns] of Object.entries(LEXICON) as [GuardFlag, RegExp[]][]) {
    if (matches(patterns, t)) flags.push(flag);
  }
  if (matches(HUMAN_CLAIM_PATTERNS, t)) flags.push("human_claim");
  if (matches(PROMISE_PATTERNS, t)) flags.push("promise");
  if (matches(SELF_HARM_PATTERNS, t)) flags.push("self_harm");
  if (matches(ABUSE_PATTERNS, t)) flags.push("abuse");

  return { ok: flags.length === 0, flags, reason: flags[0] };
}

/** Hard stop signal for Face to Face (Phase 8) and for the twin. */
function safetyStop(text: string): { stop: boolean; flags: GuardFlag[] } {
  const flags: GuardFlag[] = [];
  if (matches(SELF_HARM_PATTERNS, text ?? "")) flags.push("self_harm");
  if (matches(ABUSE_PATTERNS, text ?? "")) flags.push("abuse");
  return { stop: flags.length > 0, flags };
}
// ── END INLINE: safety.ts ──
// ── END GENERATED BLOCK ──

export type { GuardFlag, GuardResult };
export {
  ABUSE_PATTERNS,
  GENTLE_FALLBACK_REPLY,
  GUARD_TRIPPED_REPLY,
  buildTwinRules,
  quickGuard,
  safetyStop,
  TWIN_RULES,
};
