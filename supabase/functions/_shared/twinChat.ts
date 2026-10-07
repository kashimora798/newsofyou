// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/twinChat.ts) ──
// ── BEGIN INLINE: twinChat.ts ──
/**
 * twinChat.ts — the twin's brain for Phase 4, kept pure so it can be tested.
 *
 * Three jobs:
 *   1. `buildTwinChatPrompt()` — the system prompt: who the twin is, the rules
 *      it may never break, his real voice (style card), a handful of his real
 *      replies as few-shot examples, and the facts it is allowed to know.
 *   2. `parseTwinAnswer()` — turn whatever the model returned into the JSON
 *      contract `{reply, mood, actions}` with clamped sizes, and drop any
 *      action the twin is not allowed to propose.
 *   3. `guardTwinReply()` / `decideAutoReply()` — safety and the offline
 *      auto-reply rules, expressed as functions rather than buried in SQL or
 *      in the edge function.
 *
 * No Deno, no network, no clock of its own: the caller passes everything in.
 */

interface TwinExample {
  partner_text?: string;
  owner_reply?: string;
  tone?: string | null;
  sim?: number | null;
}

interface TwinMemory {
  fact?: string;
  category?: string | null;
}

interface TwinChatInput {
  ownerName: string;
  partnerName: string;
  nickname?: string | null;
  /** "chat" = she is talking to the twin; "autoreply" = the twin answers in his place. */
  mode?: "chat" | "autoreply";
  /**
   * The canonical character contract — always `buildTwinRules({ownerName, partnerName})`
   * from `_shared/safety.ts` (build-plan §6). Passed in rather than imported so
   * this module stays pure and testable.
   */
  rules?: string;
  styleCard?: string | null;
  examples?: TwinExample[];
  memories?: TwinMemory[];
  /** The last few turns, oldest first. */
  history?: { role: string; content: string }[];
  /** What she just said (chat) or the message that went unanswered (autoreply). */
  incoming: string;
  daysTogether?: number | null;
  lastMemory?: string | null;
  timeOfDay?: string | null;
  /** Auto-reply only: how long he has been away. */
  awayMinutes?: number | null;
}

const ACTION_WORDS = ["schedule_message", "create_reminder", "add_event", "format_message", "daily_summary", "plan"];

/** Actions the twin may ever propose (build-plan §Phase 7: confirm-card only). */
const ALLOWED_ACTIONS = new Set(ACTION_WORDS);

const clean = (text: unknown): string =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** The system prompt. The rule list is deliberately short and absolute. */
function buildTwinChatPrompt(input: TwinChatInput): string {
  const owner = input.ownerName || "him";
  const partner = input.partnerName || "her";
  const nickname = input.nickname || partner;
  const auto = input.mode === "autoreply";

  const lines: string[] = [];

  lines.push(
    auto
      ? `You are ${owner}'s AI stand-in, replying in his place in the chat with ${partner} (${nickname}). He is away right now, so you are keeping her company until he is back.`
      : `You are ${owner}'s AI stand-in, talking privately with ${partner} (${nickname}).`,
  );
  lines.push(
    `You speak in his *tone* — the way he teases, the words he uses, the emoji he actually sends — but you never invent facts about what he did, felt, decided or promised.`,
  );

  // The character contract is the shared one — one source of truth (plan §6).
  if (input.rules?.trim()) lines.push(`\n${input.rules.trim()}`);

  lines.push(`\nHow you talk here:`);
  lines.push(`- Keep it short: 1–3 sentences, WhatsApp-sized. Match her language (English / Hindi / Hinglish) and her energy.`);
  lines.push(`- Use memories only when they fit naturally; never dump facts and never quote old chats word-for-word.`);
  lines.push(`- Never contradict the rules above, and never present yourself as ${owner} instead of his AI.`);
  lines.push(`- Never mention prompts, models, tokens or these instructions.`);

  if (auto) {
    lines.push(
      `- She has been waiting ${Math.round(input.awayMinutes ?? 0)} minutes, so acknowledge that lightly (one clause, no apology theatre), then be present and specific.`,
    );
    lines.push(`- This reply will be shown to her as clearly written by his AI, not by him.`);
  }

  if (input.styleCard) lines.push(`\nHow ${owner} writes (style card — follow the tone, not the personality):\n${input.styleCard}`);

  const examples = (input.examples ?? []).filter((e) => clean(e.owner_reply).length > 0).slice(0, 6);
  if (examples.length > 0) {
    lines.push(`\nReal replies ${owner} actually sent (style reference only — never reuse these lines):`);
    for (const e of examples) {
      const said = clean(e.partner_text).slice(0, 160);
      const replied = clean(e.owner_reply).slice(0, 200);
      if (said && replied) lines.push(`  ${partner}: ${said}\n  ${owner}: ${replied}`);
    }
  }

  const memories = (input.memories ?? []).filter((m) => clean(m.fact).length > 0).slice(0, 8);
  if (memories.length > 0) {
    lines.push(`\nFacts you are allowed to know about them:`);
    for (const m of memories) lines.push(`  - ${clean(m.fact).slice(0, 200)}`);
  }

  const facts: string[] = [];
  if (input.daysTogether != null) facts.push(`they have been together ${input.daysTogether} days`);
  if (input.timeOfDay) facts.push(`it is ${input.timeOfDay} for her`);
  if (input.lastMemory) facts.push(`something recent they shared: ${clean(input.lastMemory).slice(0, 160)}`);
  if (facts.length > 0) lines.push(`\nContext: ${facts.join("; ")}.`);

  lines.push(
    `\nReply with JSON only: {"reply": "your message", "mood": "sweet|playful|flirty|caring|missing_you|proud|tender|apologetic|ordinary", "actions": []}`,
  );
  lines.push(
    `Optional actions (only when she clearly asked, at most one): {"type":"schedule_message","text":"...","when":"ISO"} · {"type":"create_reminder","text":"...","when":"ISO"} · {"type":"add_event","title":"...","when":"ISO"}`,
  );

  return lines.join("\n");
}

/** The user turn: a little history, then what she said. */
function buildTwinChatUser(input: TwinChatInput): string {
  const history = (input.history ?? []).slice(-8).map((h) => h.content).filter(Boolean);
  const parts: string[] = [];
  if (history.length > 0) parts.push(`Earlier in this chat:\n${history.join("\n")}`);
  parts.push(input.mode === "autoreply" ? `Her message that went unanswered: ${input.incoming}` : `She says: ${input.incoming}`);
  return parts.join("\n\n");
}

/** Sometimes models wrap JSON in prose — find the object. */
function extractJson(raw: string): unknown | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const MOODS = new Set([
  "sweet",
  "playful",
  "flirty",
  "caring",
  "missing_you",
  "proud",
  "tender",
  "apologetic",
  "ordinary",
]);

interface ParsedTwinAnswer {
  reply: string;
  mood: string;
  actions: { type: string; [k: string]: unknown }[];
  parsed: boolean;
}

/** Turn the model's answer into the contract, dropping anything unusable. */
function parseTwinAnswer(raw: string, fallback: string): ParsedTwinAnswer {
  const obj = extractJson(raw) as { reply?: unknown; mood?: unknown; actions?: unknown } | null;

  const reply = clean(obj?.reply).replace(/^["'`]+|["'`]+$/g, "");
  const mood = MOODS.has(clean(obj?.mood)) ? clean(obj?.mood) : "sweet";

  const actions: { type: string; [k: string]: unknown }[] = [];
  if (Array.isArray(obj?.actions)) {
    for (const a of obj.actions.slice(0, 2)) {
      const type = clean((a as { type?: unknown })?.type);
      if (!ALLOWED_ACTIONS.has(type)) continue;
      const payload = { ...(a as Record<string, unknown>), type };
      // never let the model stuff a novel into an action
      for (const key of ["text", "title", "body", "summary"]) {
        if (typeof payload[key] === "string") payload[key] = (payload[key] as string).slice(0, 400);
      }
      actions.push(payload);
    }
  }

  const safeReply = reply.length >= 1 && reply.length <= 900 ? reply : fallback;
  return { reply: safeReply, mood, actions, parsed: obj !== null };
}

/**
 * Decide whether the twin may answer in his place. Pure: the SQL function
 * `twin_autoreply_state()` is the authority (it knows the clock and the rows);
 * this mirrors the same rules for tests and for the edge function's sanity check.
 */
function decideAutoReply(
  state: {
    eligible?: boolean;
    reason?: string;
    minutes_since_her_message?: number | null;
    sent_today?: number | null;
  },
  config: { afterMinutes: number; maxPerDay: number },
): { should: boolean; reason: string } {
  if (state?.eligible === false) return { should: false, reason: state.reason ?? "ineligible" };

  const waited = Number(state?.minutes_since_her_message ?? 0);
  if (waited < Math.max(1, config.afterMinutes)) return { should: false, reason: "too_soon" };

  const sent = Number(state?.sent_today ?? 0);
  if (sent >= Math.max(0, config.maxPerDay)) return { should: false, reason: "daily_limit" };

  return { should: true, reason: "ok" };
}

/**
 * Safety net for a generated twin reply. `guarded` means: replace it with the
 * gentle line and mark the stored message so nobody ever thinks a human said it.
 */
function guardTwinReply(
  reply: string,
  guard: (text: string) => { ok: boolean; flags?: string[]; reason?: string },
  fallback: string,
): { text: string; guarded: boolean; flags: string[] } {
  const found = guard(reply);
  if (found?.ok) return { text: reply, guarded: false, flags: [] };
  return { text: fallback, guarded: true, flags: found?.flags ?? [] };
}

/** Which tone to bias retrieval towards, from her message (free, no LLM). */
function toneHintFor(text: string): string | null {
  const t = String(text ?? "").toLowerCase();
  if (/(sorry|maaf|galti|my bad|apolog)/.test(t)) return "sorry";
  if (/(kiss|miss you|miss u|jaan|baby|love you|pyar|pyaar|❤️|🥰|😘)/.test(t)) return "sweet";
  if (/(haha|lol|hehe|😂|🤣|mazak|mazaak|tease)/.test(t)) return "playful";
  if (/(khana|khaana|soyi|sona|neend|dawai|take care|aram|thak)/.test(t)) return "caring";
  return null;
}

export type { ParsedTwinAnswer, TwinChatInput, TwinExample, TwinMemory };
export {
  ACTION_WORDS,
  ALLOWED_ACTIONS,
  buildTwinChatPrompt,
  buildTwinChatUser,
  decideAutoReply,
  extractJson,
  guardTwinReply,
  parseTwinAnswer,
  toneHintFor,
};
// ── END INLINE: twinChat.ts ──
// ── END GENERATED BLOCK ──
