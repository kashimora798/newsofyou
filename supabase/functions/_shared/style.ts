/**
 * NewsOfYou — free style statistics (Phase 1E)
 * ============================================
 * The plan's rule: no training, no fine-tuning. Instead we measure how the
 * owner actually writes and hand those numbers (plus real reply pairs) to a
 * free model, which writes a short "style card". The twin uses the card.
 *
 * Everything here is pure and heuristic — no LLM, no database, so it can be
 * unit-tested offline and reused by the nightly job.
 */

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/style.ts) ──
// ── BEGIN INLINE: style.ts ──
/** Words that say nothing about style (English + Hinglish particles). */
const STYLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "doing", "done",
  "have", "has", "had", "i", "i'm", "im", "you", "you're", "your", "yours", "u", "ur", "he", "she",
  "it", "its", "we", "they", "me", "my", "mine", "our", "us", "him", "her", "them", "to", "of",
  "in", "on", "at", "for", "with", "from", "by", "as", "so", "not", "no", "yes", "ok", "okay",
  "just", "very", "too", "also", "will", "would", "can", "could", "should", "shall", "may", "might",
  "there", "here", "what", "when", "where", "who", "why", "how", "all", "any", "some", "one", "two",
  "get", "got", "go", "going", "went", "come", "coming", "came", "know", "think", "want", "need",
  "like", "really", "much", "more", "now", "out", "up", "down", "about", "because", "pls", "please",
  "hai", "hain", "ho", "hoga", "ka", "ki", "ke", "ko", "se", "me", "mein", "bhi", "toh", "to", "na",
  "kya", "kyun", "kaise", "kar", "karo", "karna", "raha", "rahi", "rahe", "tha", "thi", "the",
  "tum", "tu", "main", "mai", "hum", "acha", "achha", "theek", "thik", "yaar", "yr", "abhi", "ab",
  "aur", "ek", "koi", "kuch", "nahi", "nhi", "haan", "han", "mat", "bas", "kaafi", "bahut", "bht",
]);

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2764}]/u;

/**
 * Emoji as grapheme clusters, so "❤️" counts once (the variation selector is
 * not a separate emoji). Uses Intl.Segmenter when available, with a regex
 * fallback that merges trailing variation selectors.
 */
function extractEmojis(text: string): string[] {
  const segmenter = (Intl as { Segmenter?: new (locale?: string, opts?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (segmenter) {
    try {
      const seg = new segmenter(undefined, { granularity: "grapheme" });
      const out: string[] = [];
      for (const part of seg.segment(text)) {
        const g = part.segment;
        if (EMOJI_RE.test(g.replace(/\u{FE0F}/u, ""))) out.push(g.replace(/\u{FE0F}/u, "") + (g.includes("\u{FE0F}") ? "\u{FE0F}" : ""));
      }
      return out;
    } catch {
      /* fall through to regex */
    }
  }
  return text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?/gu) ?? [];
}
const HINGLISH_MARKERS =
  /\b(hai|hain|nahi|nhi|kya|tum|tu|main|mai|hum|bhi|toh|yaar|acha|achha|theek|thik|bahut|bht|kaafi|mat|bas|abhi|phir|fir|kyun|kaise|karo|raha|rahi|dil|pyar|pyaar|jaan|soya|khana|khaana|ghar|kaam|kal|aaj|subah|raat|din|baat)\b/gi;
const LAUGH_PATTERNS: [string, RegExp][] = [
  ["haha", /\bha(?:ha)+h?\b/gi],
  ["hehe", /\bhe(?:he)+\b/gi],
  ["lol", /\blol+\b/gi],
  ["emoji_joy", /😂|🤣/g],
];

interface StyleStats {
  total_messages: number;
  avg_chars: number;
  median_chars: number;
  p90_chars: number;
  top_words: { word: string; n: number }[];
  top_openers: { word: string; n: number }[];
  top_closers: { word: string; n: number }[];
  emojis: { emoji: string; n: number }[];
  laugh_styles: { style: string; n: number }[];
  hinglish_ratio: number;
  pet_names: { name: string; n: number }[];
  exclamation_ratio: number;
  question_ratio: number;
  messages_per_daypart: { daypart: string; n: number }[];
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']{2,}/g) ?? []).filter((w) => w.length > 2);
}

/** Top-N helper that keeps the result stable and small. */
function topN(counts: Map<string, number>, n: number, min = 1): { word: string; n: number }[] {
  return [...counts.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([word, count]) => ({ word, n: count }));
}

function daypartOf(iso: string, timezoneOffsetHours = 5.5): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const hour = new Date(t + timezoneOffsetHours * 3600 * 1000).getUTCHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Measure how someone writes from their own sent messages.
 * `nicknames` = the names they use for the other person (from twin_config).
 */
function computeStyleStats(
  messages: { content: string; created_at: string }[],
  nicknames: string[] = [],
): StyleStats {
  const words = new Map<string, number>();
  const openers = new Map<string, number>();
  const closers = new Map<string, number>();
  const emojis = new Map<string, number>();
  const laughs = new Map<string, number>();
  const pets = new Map<string, number>();
  const dayparts = new Map<string, number>();
  const lengths: number[] = [];
  let hinglishHits = 0;
  let tokens = 0;
  let exclamations = 0;
  let questions = 0;

  const nicknameSet = new Set(nicknames.map((n) => n.toLowerCase()).filter(Boolean));

  for (const m of messages ?? []) {
    const content = (m?.content ?? "").trim();
    if (!content) continue;
    lengths.push(content.length);
    if (content.includes("!")) exclamations++;
    if (content.includes("?")) questions++;

    const toks = tokenize(content);
    tokens += toks.length;
    hinglishHits += (content.match(HINGLISH_MARKERS) ?? []).length;

    for (const w of toks) {
      if (STYLE_STOPWORDS.has(w)) continue;
      words.set(w, (words.get(w) ?? 0) + 1);
      if (nicknameSet.has(w)) pets.set(w, (pets.get(w) ?? 0) + 1);
    }

    const first = toks[0];
    if (first) openers.set(first, (openers.get(first) ?? 0) + 1);
    const rawLast = (content.toLowerCase().match(/[a-z']{2,}/g) ?? []).pop();
    if (rawLast) closers.set(rawLast, (closers.get(rawLast) ?? 0) + 1);

    for (const e of extractEmojis(content)) emojis.set(e, (emojis.get(e) ?? 0) + 1);
    for (const [style, re] of LAUGH_PATTERNS) {
      const n = (content.match(re) ?? []).length;
      if (n > 0) laughs.set(style, (laughs.get(style) ?? 0) + n);
    }

    const dp = daypartOf(m?.created_at ?? "");
    dayparts.set(dp, (dayparts.get(dp) ?? 0) + 1);
  }

  const adaptiveMin = lengths.length >= 50 ? 3 : 1;
  const sorted = [...lengths].sort((a, b) => a - b);
  const at = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);

  return {
    total_messages: lengths.length,
    avg_chars: sorted.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    median_chars: at(0.5),
    p90_chars: at(0.9),
    top_words: topN(words, 40, adaptiveMin),
    top_openers: topN(openers, 12, 1),
    top_closers: topN(closers, 12, 1),
    emojis: topN(new Map([...emojis.entries()].map(([k, v]) => [k, v])), 15, 1).map((e) => ({ emoji: e.word, n: e.n })),
    laugh_styles: topN(laughs, 6, 1).map((l) => ({ style: l.word, n: l.n })),
    hinglish_ratio: tokens > 0 ? Number((hinglishHits / tokens).toFixed(3)) : 0,
    pet_names: topN(pets, 8, 1).map((p) => ({ name: p.word, n: p.n })),
    exclamation_ratio: lengths.length ? Number((exclamations / lengths.length).toFixed(2)) : 0,
    question_ratio: lengths.length ? Number((questions / lengths.length).toFixed(2)) : 0,
    messages_per_daypart: [...dayparts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([daypart, n]) => ({ daypart, n })),
  };
}

/**
 * Prompt for the style card: measurements + real reply pairs, asking for a
 * short, editable voice profile. Kept here so the wording is versioned.
 */
function buildStylePrompt(
  stats: StyleStats,
  pairs: { partner_text: string; owner_reply: string; tone?: string | null }[],
  names: { ownerName: string; partnerName: string },
): { system: string; user: string } {
  const exemplars = (pairs ?? [])
    .slice(0, 60)
    .map((p, i) => `${i + 1}. [${p.tone ?? "other"}] She: ${p.partner_text}\n   He replied: ${p.owner_reply}`)
    .join("\n");

  return {
    system:
      `You analyse how ${names.ownerName} writes to ${names.partnerName} and produce a STYLE CARD that a small AI ` +
      `will use to imitate him. Be concrete and specific: quote his real phrases. ` +
      `Max 400 words. Use these headings exactly: VOICE, HOW HE OPENS, HOW HE CLOSES, FAVOURITE PHRASES, ` +
      `BY MOOD (sweet / playful / flirty / caring / serious / sorry), DO, DON'T, EMOJI & LAUGH STYLE, HINGLISH. ` +
      `Do not invent facts, do not include anything private that is not needed for tone, and never include ` +
      `phone numbers, addresses or links. Output plain text only (no JSON, no markdown headers beyond the words above).`,
    user:
      `MEASUREMENTS (from ${stats.total_messages} of his messages):\n` +
      `${JSON.stringify(stats, null, 1)}\n\n` +
      `REAL EXAMPLES of her message and his actual reply:\n${exemplars || "(none yet)"}\n\n` +
      `Write the style card.`,
  };
}
// ── END INLINE: style.ts ──
// ── END GENERATED BLOCK ──

export type { StyleStats };
export { buildStylePrompt, computeStyleStats, daypartOf, extractEmojis, STYLE_STOPWORDS, topN };
