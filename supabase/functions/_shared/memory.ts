// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/memory.ts) ──
// ── BEGIN INLINE: memory.ts ──
/**
 * memory.ts — the free half of memory 2.0 (build-plan Phase 5).
 *
 * The rule this file exists to enforce: **the twin notices with heuristics and
 * only thinks with the model when it is worth it.** Everything here is pure —
 * no Deno, no clock of its own, no network — so it runs in the nightly sweep,
 * in the "remember what matters" button, and in the tests, identically.
 *
 * Three jobs:
 *   1. `extractHighlights()` — the lines worth keeping from a day: promises,
 *      plans, dates, firsts, feelings, gifts, places, milestones. English and
 *      Hinglish, because that is how they actually talk.
 *   2. `extractFactCandidates()` — durable facts ("loves filter coffee",
 *      "birthday is 12 March") straight out of their own sentences. These are
 *      inserted with no AI call at all.
 *   3. `selectWorthAsking()` — the top ~5%, the only lines worth one model call.
 *
 * Nothing here writes to the database; the edge functions own that.
 */

export type MemoryCategory = "likes" | "dislikes" | "important" | "date" | "other";

export interface DayLine {
  id: string;
  user_id: string;
  username?: string | null;
  content: string;
  created_at: string;
}

export interface HighlightCandidate {
  message_id: string;
  user_id: string;
  day: string;
  kind: string;
  text: string;
  score: number;
}

export interface FactCandidate {
  fact: string;
  category: MemoryCategory;
  /** Which side of the couple the fact is about, by id — never by name. */
  about: "owner" | "partner";
  kind: string | null;
  message_id: string;
  day: string;
  importance: number;
  quote: string;
}

/**
 * Kind patterns, most specific first. Each entry is a list of spellings —
 * English, Hindi and Hinglish — because a lexicon that only reads English
 * misses most of what these two write.
 */
const KIND_PATTERNS: { kind: string; weight: number; patterns: RegExp[] }[] = [
  {
    kind: "milestone",
    weight: 0.32,
    patterns: [
      /\b(engagement|engaged|proposal|propose|roka|sagai|shaadi|shadi|marriage|married|moved in|move in)\b/i,
      /\b(first anniversary|saalgirah)\b/i,
    ],
  },
  {
    kind: "promise",
    weight: 0.28,
    patterns: [
      /\b(i promise|promise you|pinky promise|i swear|you have my word)\b/i,
      /\b(pakka|vada|wada|kasam|vaada)\b/i,
      /\b(i(?:'ll| will) (?:definitely |surely )?(?:come|meet|be there|call|do it))\b/i,
    ],
  },
  {
    kind: "first",
    weight: 0.26,
    patterns: [/\b(first time|for the first time|pehli baar|pehla|pehli)\b/i],
  },
  {
    kind: "date",
    weight: 0.24,
    patterns: [
      /\b(birthday|janamdin|janmdin|happy bday|hbd|anniversary|saalgirah|dob|date of birth)\b/i,
      /\b(\d{1,2}(?:st|nd|rd|th)?\s?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i,
      /\b(\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)var)\b/i,
    ],
  },
  {
    kind: "gift",
    weight: 0.2,
    patterns: [
      /\b(gift|surprise|present)\b/i,
      /\b(laaya|layi|laye|diya|diye|bought you|got you)\b/i,
    ],
  },
  {
    kind: "place",
    weight: 0.16,
    patterns: [
      /\b(ghar|home|office|station|airport|cafe|restaurant|mandir|temple|hospital|market|chowk)\b/i,
      /\b(goa|manali|jaipur|delhi|mumbai|bangalore|pune|shimla|rishikesh|udaipur)\b/i,
    ],
  },
  {
    kind: "feeling",
    weight: 0.18,
    patterns: [
      /\b(i miss you|miss you|miss u|yaad aa rahi|yaad aata|tumhari yaad)\b/i,
      /\b(i love you|love you|love u|pyar|pyaar|jaan|baby)\b/i,
      /\b(sorry|maaf|gussa|hurt|loney|akela|thank you|grateful)\b/i,
    ],
  },
  {
    kind: "plan",
    weight: 0.14,
    patterns: [
      /\b(kal|tomorrow|next week|agle hafte|this weekend|tonight|aaj raat|milte hai|milna|meet up|dinner|movie|trip)\b/i,
      /\b(plan|decide kar|final kar)\b/i,
    ],
  },
];

const HEART_OR_SPARK = /[❤️💛💚💙💜🧡💕💖💗💓💞💘😍🥰😘😻🫶✨]/u;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/**
 * The same two filters the SQL side uses (`twin_is_ignored_message` /
 * `twin_is_placeholder_content`, from the Phase 1 tuning migration). Kept here
 * so a function that pulls its own `messages` rows still reads only real words.
 */
const MECHANICAL_TYPES = new Set(["touch_reaction", "reaction", "react", "coinflip", "rps", "bored", "system"]);
const PLACEHOLDER = /^\[(voice note|voice|sticker|gif|image|photo|video|file|document|media|deleted)\]$/i;
const ONLY_EMOJI = /^[\s\p{So}\p{Sk}\u200D\uFE0E\uFE0F]+$/u;

/** A tap, a game outcome, a system row — not something anyone said. */
function isMechanicalMessage(messageType: string | null | undefined): boolean {
  return MECHANICAL_TYPES.has(String(messageType ?? "text").toLowerCase());
}

/** A caption with no words in it. */
function isPlaceholderContent(content: string | null | undefined): boolean {
  const t = String(content ?? "").trim();
  return t === "" || PLACEHOLDER.test(t) || ONLY_EMOJI.test(t);
}

/** Strip a line down to text we can compare and store. */
function normalize(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(text: string, max = 180): string {
  return normalize(text).slice(0, max);
}

/** The first (most specific) kind that fits, or null. */
function kindOf(text: string): { kind: string; weight: number } | null {
  const t = String(text ?? "");
  for (const entry of KIND_PATTERNS) {
    if (entry.patterns.some((p) => p.test(t))) return { kind: entry.kind, weight: entry.weight };
  }
  return null;
}

/**
 * How much a line deserves to be kept. Deliberately boring: length in the
 * "says something" band, a kind, warmth, a concrete detail (a digit or a name).
 */
function highlightScore(text: string, kind: string | null): number {
  const t = normalize(text);
  if (t.length < 8) return 0;

  let score = 0.3;
  if (t.length >= 24 && t.length <= 220) score += 0.12;
  if (t.length >= 60) score += 0.05;
  if (t.length < 14) score -= 0.12;

  const entry = KIND_PATTERNS.find((e) => e.kind === kind);
  if (entry) score += entry.weight;

  if (HEART_OR_SPARK.test(t)) score += 0.12;
  else if (EMOJI.test(t)) score += 0.05;
  if (/[!]/.test(t)) score += 0.05;
  if (/\d/.test(t)) score += 0.06;
  if (/\b(sirf|always|never|sabse|favourite|favorite|best)\b/i.test(t)) score += 0.06;
  if (t.endsWith("?")) score -= 0.08;
  // A wall of forwarded text is not a memory.
  if (/^https?:\/\//.test(t)) score -= 0.3;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

/**
 * Keep the lines worth remembering from one day. At most `maxPerDay`, never the
 * same sentence twice, strongest first. `minScore` is the bar for a line with
 * no recognized kind to still qualify (as "other").
 */
function extractHighlights(
  lines: DayLine[],
  opts: { day: string; maxPerDay?: number; minScore?: number } = { day: "" },
): HighlightCandidate[] {
  const maxPerDay = Math.max(1, opts.maxPerDay ?? 4);
  const minScore = opts.minScore ?? 0.45;
  const seen = new Set<string>();
  const out: HighlightCandidate[] = [];

  for (const line of lines ?? []) {
    const text = clean(line.content);
    if (text.length < 8) continue;

    const found = kindOf(text);
    const kind = found?.kind ?? "other";
    const score = highlightScore(text, found?.kind ?? null);
    if (!found && score < Math.max(minScore, 0.6)) continue;
    if (score < 0.35) continue;

    const key = `${kind}:${text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]+/gi, "").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      message_id: line.id,
      user_id: line.user_id,
      day: opts.day || (line.created_at ?? "").slice(0, 10),
      kind,
      text,
      score,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, maxPerDay);
}

/** Sentence-ish splitter used by the fact patterns. */
function sentences(text: string): string[] {
  return normalize(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tidy a captured phrase into something a person would recognize: no leading
 * "mujhe / hai / that", no trailing "hai / is", no dangling punctuation.
 * Hinglish word order puts the verb at the end, so both ends need work.
 */
function phrase(text: string, max = 45, cutClause = false): string {
  const base = cutClause ? clean(text, max).split(/[;,]/)[0] : clean(text, max);
  return base
    .replace(/^(?:mujhe|mujhko|mein|main|mai|i|to|that|ki|ka|ke|hai|h|is)\s+/i, "")
    .replace(/\s+(?:hai|h|is|tha|thi|the|raha|rahi|rahe|kar|karna|hoti|hota)$/i, "")
    .replace(/[.!,;:\s]+$/, "")
    .trim();
}

const FACT_PATTERNS: { category: MemoryCategory; build: (m: RegExpMatchArray) => string | null; pattern: RegExp }[] = [
  // "my favourite food is rajma chawal" / "mera favourite colour blue hai"
  {
    category: "likes",
    pattern: /\b(?:my|mera|meri|apna)\s+(?:favourite|favorite|fav)\s+(.{2,30}?)\s+(?:is|hai|h)\s+(.{2,40})/i,
    build: (m) => {
      const what = phrase(m[1], 30, true);
      const value = phrase(m[2], 40, true);
      return what && value ? `favourite ${what}: ${value}` : null;
    },
  },
  // "I love filter coffee" / "mujhe barish bahut pasand hai"
  {
    category: "likes",
    pattern: /\b(?:i|main|mai|mein|mujhe|hum)\s+(?:really\s+|bahut\s+|bohot\s+|too\s+)?(?:love|like|pasand)\s+(?:to\s+)?(.{3,45})/i,
    build: (m) => {
      const v = phrase(m[1], 45, true);
      return v.length >= 3 ? `loves ${v}` : null;
    },
  },
  // "I hate crowds" / "mujhe noise pasand nahi"
  {
    category: "dislikes",
    pattern: /\b(?:i|main|mai|mujhe)\s+(?:really\s+|bahut\s+|bohot\s+)?(?:hate|dislike|can't stand|cant stand)\s+(.{3,45})/i,
    build: (m) => {
      const v = phrase(m[1], 45, true);
      return v.length >= 3 ? `dislikes ${v}` : null;
    },
  },
  {
    category: "dislikes",
    pattern: /\b(.{3,40}?)\s+pasand nahi\b/i,
    build: (m) => {
      const v = phrase(m[1], 40, true);
      return v.length >= 3 ? `dislikes ${v}` : null;
    },
  },
  // "allergic to peanuts"
  {
    category: "important",
    pattern: /\ballergic to\s+(.{2,40})/i,
    build: (m) => `allergic to ${clean(m[1], 40)}`,
  },
  // "remember I have an exam on the 12th"
  {
    category: "important",
    pattern: /\b(?:remember|yaad rakhna|note kar|don't forget|dont forget|bhoolna nahi)\b[:,]?\s*(.{4,90})/i,
    build: (m) => {
      const v = clean(m[1], 90).replace(/[.!,;:\s]+$/, "");
      return v.length >= 4 ? `remember: ${v}` : null;
    },
  },
  // "my birthday is 12 March" / "mera birthday 12 march hai"
  {
    category: "date",
    pattern:
      /\b(?:my|mera|meri|tumhara|your)?\s*(birthday|janamdin|janmdin|anniversary|saalgirah)\b[^0-9]{0,14}(\d{1,2}(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,2}(?:st|nd|rd|th)?)/i,
    build: (m) => {
      const what = clean(m[1], 20).toLowerCase();
      const when = phrase(m[2], 20);
      return when ? `${what}: ${when}` : null;
    },
  },
];

/**
 * Durable facts from their own sentences — no AI, no guessing. Precision beats
 * recall on purpose: a wrong memory is worse than a missing one.
 */
function extractFactCandidates(
  lines: DayLine[],
  opts: { ownerId: string; max?: number; day?: string },
): FactCandidate[] {
  const max = Math.max(1, opts.max ?? 8);
  const out: FactCandidate[] = [];
  const seen = new Set<string>();

  for (const line of lines ?? []) {
    const text = normalize(line.content);
    if (text.length < 8) continue;

    const day = opts.day || (line.created_at ?? "").slice(0, 10);
    const found = kindOf(text);
    const about: "owner" | "partner" = line.user_id === opts.ownerId ? "owner" : "partner";

    for (const { category, pattern, build } of FACT_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;
      const fact = build(match);
      if (!fact) continue;

      const key = fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        fact,
        category,
        about,
        kind: found?.kind ?? null,
        message_id: line.id,
        day,
        importance: Number(
          Math.min(1, 0.4 + (category === "important" ? 0.25 : category === "date" ? 0.3 : 0.15)).toFixed(3),
        ),
        quote: clean(text, 120),
      });
      break; // one fact per sentence is plenty
    }
  }

  return out.slice(0, max);
}

/** Higher = more worth remembering. Recency is the only clock used. */
function importanceOf(candidate: { kind?: string | null; importance?: number; day?: string | null }, today?: string): number {
  let base = candidate.importance ?? 0.5;
  const entry = KIND_PATTERNS.find((e) => e.kind === candidate.kind);
  if (entry) base = Math.max(base, 0.45 + entry.weight);
  if (candidate.day && today) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${candidate.day}T00:00:00Z`)) / 86_400_000);
    if (Number.isFinite(days)) base += days <= 2 ? 0.1 : days <= 7 ? 0.05 : 0;
  }
  return Math.max(0, Math.min(1, Number(base.toFixed(3))));
}

/**
 * The top slice — the only lines worth a model call (plan §Phase 5: heuristics
 * for everything, LLM for the top 5%). Always capped, never zero when there is
 * something good to ask about.
 */
function selectWorthAsking<T extends { importance?: number; score?: number }>(
  candidates: T[],
  opts: { percent?: number; cap?: number; minImportance?: number } = {},
): T[] {
  const percent = Math.max(1, Math.min(100, opts.percent ?? 5));
  const cap = Math.max(0, opts.cap ?? 2);
  const minImportance = opts.minImportance ?? 0.6;

  const ranked = [...(candidates ?? [])].sort(
    (a, b) => (b.importance ?? b.score ?? 0) - (a.importance ?? a.score ?? 0),
  );
  if (ranked.length === 0 || cap === 0) return [];

  const take = Math.max(1, Math.min(cap, Math.ceil((ranked.length * percent) / 100)));
  return ranked.filter((c) => (c.importance ?? c.score ?? 0) >= minImportance).slice(0, take);
}

/** Facts that say the same thing, however they were phrased. */
function dedupeFacts<T extends { fact: string }>(facts: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of facts ?? []) {
    const key = normalize(f.fact)
      .toLowerCase()
      .replace(/^(loves|dislikes|likes|remember:)\s*/, "")
      .replace(/[^a-z0-9\u0900-\u097F ]+/gi, "")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** The one prompt the sweep may spend a call on (build-plan §5 / Phase 5). */
function buildMemoryPrompt(
  lines: { who: string; text: string }[],
  names: { ownerName: string; partnerName: string },
): { system: string; user: string } {
  const system =
    `You read a few lines a couple wrote to each other and extract only facts that will still be true in a month. ` +
    `People: ${names.ownerName} (him), ${names.partnerName} (her). ` +
    `Capture preferences, favourites, dates, allergies, people, places, promises that matter — NOT moods, plans for tomorrow, or chatter. ` +
    `Write each fact as a short third-person phrase (max 12 words), in English, e.g. "loves filter coffee", "birthday is 12 March". ` +
    `Reply with ONLY JSON: {"facts":[{"fact":"...","category":"likes|dislikes|important|date|other","about":"${names.ownerName}|${names.partnerName}"}]}. ` +
    `At most 5 facts. If nothing is durable, return {"facts":[]}.`;

  const user = lines.map((l) => `${l.who}: ${l.text}`).join("\n");
  return { system, user: `Lines:\n${user}` };
}

/** Pull the good stuff out of one day, in one call. */
function summarizeDay(
  lines: DayLine[],
  opts: { day: string; ownerId: string; maxHighlights?: number; maxFacts?: number },
): { highlights: HighlightCandidate[]; facts: FactCandidate[] } {
  return {
    highlights: extractHighlights(lines, { day: opts.day, maxPerDay: opts.maxHighlights ?? 4 }),
    facts: extractFactCandidates(lines, { ownerId: opts.ownerId, day: opts.day, max: opts.maxFacts ?? 6 }),
  };
}

export type { DayLine as MemoryDayLine };
export {
  buildMemoryPrompt,
  clean,
  dedupeFacts,
  extractFactCandidates,
  extractHighlights,
  highlightScore,
  importanceOf,
  isMechanicalMessage,
  isPlaceholderContent,
  phrase,
  KIND_PATTERNS,
  kindOf,
  normalize,
  selectWorthAsking,
  summarizeDay,
};
// ── END INLINE: memory.ts ──
// ── END GENERATED BLOCK ──
