// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/ftf.ts) ──
// ── BEGIN INLINE: ftf.ts ──
/**
 * ftf.ts — Face to Face, the hard-conversation room (build-plan Phase 8).
 *
 * What this module is for: making it easier to say a difficult thing without
 * hurting the person you are saying it to — and knowing when **not** to keep
 * mediating at all.
 *
 * Three jobs, all pure:
 *   1. `FTF_RULES` — the six ground rules both people agree to before the first
 *      word. Same text for both; the room will not start until they agree.
 *   2. `buildSoftenPrompt()` / `parseSoften()` — rewrite one person's turn so
 *      the *point* survives and the blame does not. The rewrite is a suggestion:
 *      the person reads it, can edit it, and only what they send is stored
 *      (with their original kept beside it, so nobody is ever misquoted).
 *   3. `safetyResources()` / `shouldStop()` — the moment a turn carries a
 *      self-harm or abuse signal, the room stops and real help is shown. The
 *      assistant never tries to "handle" that.
 *
 * Nothing here talks to a network or a clock.
 */

export type FtfStopFlag = "self_harm" | "abuse" | string;

export interface FtfTurn {
  id?: string;
  user_id: string;
  kind: string;
  content: string;
  softened?: boolean;
  flags?: string[];
  created_at?: string;
}

export interface SoftenedTurn {
  /** The rewrite. Never sent automatically. */
  gentler: string;
  /** One line of "what I actually need", for the sender to check. */
  need: string;
  /** One line of "how this may land", for the sender to consider. */
  land: string;
  parsed: boolean;
}

/** The ground rules. Short on purpose — nobody reads a manifesto mid-argument. */
const FTF_RULES = `Six rules for this room, for both of us:
1. One thing at a time. We finish one, then the next.
2. I talk about what I felt and what I need — not about what is wrong with you.
3. No name-calling, no mocking, no "you always / you never".
4. Either of us can say "pause" and we stop, without a penalty.
5. Nothing said here gets used as a weapon later, or forwarded.
6. The AI only helps us say things more clearly. It never takes a side, and it never decides anything for us.`;

/** The prompt for one rewrite. Grounded, never sanitising the complaint away. */
function buildSoftenPrompt(input: {
  draft: string;
  senderName: string;
  partnerName: string;
  topicsSoFar?: string[];
}): { system: string; user: string } {
  const system =
    `You help ${input.senderName} say something difficult to ${input.partnerName} without hurting them. ` +
    `Rewrite their message so that:\n` +
    `- every concrete fact and the actual complaint stay — never soften the problem away or turn it into "never mind";\n` +
    `- blame goes: no "you always", "you never", "you made me", no mockery, no threats, no sarcasm;\n` +
    `- it is written in first person about their own feelings and needs ("I felt… when…; what I need is…");\n` +
    `- it stays their language (English / Hindi / Hinglish) and about as long as what they wrote;\n` +
    `- nothing new is added: no facts, no apologies they did not offer, no promises.\n` +
    `Reply with JSON only: {"gentler": "...", "need": "one short line: what they actually need", "land": "one short line: how it may land on ${input.partnerName}"}`;

  const earlier = (input.topicsSoFar ?? []).filter(Boolean).slice(-6);
  const user = earlier.length
    ? `Already said in this room:\n${earlier.map((t) => `- ${t}`).join("\n")}\n\nNew message to rewrite:\n${input.draft}`
    : `Message to rewrite:\n${input.draft}`;

  return { system, user };
}

/** Some models wrap JSON in prose — find the object. Renamed to stay unique. */
function parseFtfJson(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const attempt = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = attempt(text);
  if (direct) return direct;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return attempt(text.slice(start, end + 1));
}

const tidy = (v: unknown, max: number): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Whatever came back, only a usable rewrite is kept. */
function parseSoften(raw: string, fallbackDraft: string): SoftenedTurn {
  const obj = parseFtfJson(raw);
  const gentler = tidy(obj?.gentler ?? obj?.reply ?? obj?.text, 900);

  if (!obj || gentler.length < 4) {
    return { gentler: fallbackDraft, need: "", land: "", parsed: false };
  }

  return {
    gentler,
    need: tidy(obj?.need ?? obj?.what_i_need, 160),
    land: tidy(obj?.land ?? obj?.how_it_may_land, 160),
    parsed: true,
  };
}

/**
 * The moment the room stops. Deliberately broad on purpose: a missed flag is a
 * person left alone with something terrible; a false positive only costs one
 * conversation being interrupted with an offer of help.
 */
const STOP_PATTERNS: { flag: FtfStopFlag; patterns: RegExp[] }[] = [
  {
    flag: "self_harm",
    patterns: [
      /\b(?:kill|hurt|cut|harm)(?:ing)? myself\b/i,
      /\b(?:want|wanna|going) to die\b/i,
      /\bsuicid(?:e|al)\b/i,
      /\bend (?:it all|my life|everything)\b/i,
      /\bno (?:reason|point) (?:to|in) liv(?:e|ing)\b/i,
      /\bjaan den[ae]|jaan de dung[ai]|aatmhatya|khudkhushi|khatam kar (?:dunga|dungi) (?:sab|apna)\b/i,
      /\bmar (?:jaunga|jaungi|jaana|jana|jaaun|jaun)\b/i,
      /\bmarna chah(?:ta|ti) (?:hoon|hun)\b/i,
      /\bjeena nahi chaht(?:a|i)\b/i,
    ],
  },
  {
    flag: "abuse",
    patterns: [
      /\b(?:he|she|they|partner|husband|wife|boyfriend|girlfriend|papa|dad|father|uncle|bhai) (?:hits?|beat|beats|hit|slapped|choked|threatened|raped|touched) me\b/i,
      /\bi(?:'m| am) (?:scared|afraid) (?:of|for) (?:him|her|them|my life|my safety)\b/i,
      /\b(?:mar|maar) ?(?:deta|deti|diya|di)\b/i,
      /\b(?:force|forced|forcing) (?:me|kar)/i,
      /\b(?:ghar|ghar mein) (?:nahi|na) (?:jaana|jaana) chahti\b/i,
    ],
  },
];

/** Which flags a piece of text carries (if any). */
function stopFlags(text: string): FtfStopFlag[] {
  const t = String(text ?? "");
  const flags: FtfStopFlag[] = [];
  for (const { flag, patterns } of STOP_PATTERNS) {
    if (patterns.some((p) => p.test(t))) flags.push(flag);
  }
  return flags;
}

/** Convenience: does this stop the room? */
function shouldStop(text: string): { stop: boolean; flags: FtfStopFlag[] } {
  const flags = stopFlags(text);
  return { stop: flags.length > 0, flags };
}

/**
 * What both of them see when a room stops. Real Indian helplines, in the order
 * someone would actually use them. The AI steps out of the way entirely.
 */
function safetyResources(flags: FtfStopFlag[] = []): string {
  const head =
    flags.includes("abuse")
      ? "I'm going to stop helping here, because what you just wrote is not something a chat should carry."
      : "I'm going to stop helping here, because you just wrote something about not being safe, and that matters much more than anything I was doing.";

  return [
    head,
    "",
    "Please talk to a real person today — one of these, or anyone you trust:",
    "• Tele-MANAS (India, 24×7): 14416 — free, and they speak Hindi and English",
    "• AASRA (24×7): 98204 66726",
    "• KIRAN mental-health helpline (24×7): 1800-599-0019",
    "• iCall (Mon–Sat, 10am–8pm): 91529 87821",
    "• If someone is hurting you: Women's Helpline 181 · Police 112 · Childline 1098",
    "",
    "If you are in immediate danger, call 112 now.",
    "",
    "This room is paused, not closed. Anything you two want to say to each other can still be said — but not through me.",
  ].join("\n");
}

/** Whose turn is it now? Kept here so the UI and the SQL never disagree. */
function nextTurn(current: string | null, a: string, b: string | null): string | null {
  if (!b) return current ?? a;
  if (!current) return a;
  return current === a ? b : a;
}

/** Has the room gone on long enough to deserve a closing note? */
function shouldOfferClosing(session: { turn_count?: number; max_turns?: number; stage?: string }): boolean {
  if (session.stage === "closing") return true;
  const count = Number(session.turn_count ?? 0);
  const max = Number(session.max_turns ?? 24);
  return count >= max;
}

/**
 * The closing note: what each of them said they needed, and one next step.
 * The prompt asks for JSON so the room can render it as three short blocks.
 */
function buildClosingPrompt(input: {
  ownerName: string;
  partnerName: string;
  topic: string;
  turns: FtfTurn[];
}): { system: string; user: string } {
  const system =
    `Two people just finished a hard conversation about "${input.topic}". ` +
    `Write a short closing note that helps them remember it kindly. ` +
    `Reply with JSON only: {"note": "3-5 short sentences, plain and warm, no advice, no therapy-speak", ` +
    `"needs_${input.ownerName.toLowerCase().replace(/[^a-z]/g, "") || "a"}": "one line — what he asked for", ` +
    `"needs_${input.partnerName.toLowerCase().replace(/[^a-z]/g, "") || "b"}": "one line — what she asked for", ` +
    `"next_step": "one concrete, small thing they agreed to try"}. ` +
    `Use only what is in their words. If they did not agree anything, say so gently in next_step rather than inventing it.`;

  const transcript = input.turns
    .filter((t) => t.kind === "message" && t.content.trim())
    .map((t) => `${t.user_id === "owner" ? input.ownerName : input.partnerName}: ${t.content}`)
    .join("\n");

  return { system, user: `Their conversation:\n${transcript.slice(0, 5000)}` };
}

/** Whatever the model returned, reduced to what the note card renders. */
function parseClosing(raw: string, fallback: { note: string }): {
  note: string;
  aNeed: string;
  bNeed: string;
  nextStep: string;
  parsed: boolean;
} {
  const obj = parseFtfJson(raw);
  const note = tidy(obj?.note, 1200);
  const values = Object.values(obj ?? {});
  const needs = values.filter((v) => typeof v === "string").slice(0, 4) as string[];

  return {
    note: note.length >= 10 ? note : fallback.note,
    aNeed: tidy(obj?.needs_a ?? needs[0], 200),
    bNeed: tidy(obj?.needs_b ?? needs[1], 200),
    nextStep: tidy(obj?.next_step ?? obj?.nextStep, 200),
    parsed: Boolean(obj && note.length >= 10),
  };
}

/** A free closing note — used when the model is out of quota or fails. */
function heuristicClosing(turns: FtfTurn[], names: { a: string; b: string }): string {
  const spoken = turns.filter((t) => t.kind === "message" && t.content.trim());
  const a = spoken.filter((t) => t.user_id === "owner").length;
  const b = spoken.filter((t) => t.user_id === "partner").length;
  if (spoken.length === 0) {
    return "The room is closed — nothing was said this time, and that is allowed too. The door stays open.";
  }
  return (
    `You both came into this room instead of letting it sit: ${names.a} said ${a} thing${a === 1 ? "" : "s"}, ` +
    `${names.b} said ${b}. Nobody has to have won it. ` +
    `If something is still open, the next move is a small one — one sentence, one hour, no history.`
  );
}

export type { FtfStopFlag as FtfStopFlagType, FtfTurn as FtfTurnRow };
export {
  buildClosingPrompt,
  buildSoftenPrompt,
  FTF_RULES,
  heuristicClosing,
  nextTurn,
  parseClosing,
  parseFtfJson,
  parseSoften,
  safetyResources,
  shouldOfferClosing,
  shouldStop,
  stopFlags,
};
// ── END INLINE: ftf.ts ──
// ── END GENERATED BLOCK ──
