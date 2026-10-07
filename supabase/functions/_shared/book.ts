// ── BEGIN INLINE: book.ts ──
/**
 * book.ts — composing a Book page out of a day (build-plan Phase 6).
 *
 * The point of this module is that a page must exist **without spending a
 * token**: anyone can open any day of the book and see something honest, built
 * from their own words. The LLM path (`writeWithTwin`) is the exception — it
 * runs only when a person taps "write it properly", one call per day, and the
 * result is stored so it is never paid for twice.
 *
 * Everything here is pure: `composeHeuristicPage()` takes the `book_day_material`
 * JSON and returns the row to store. No Deno, no network, no clock of its own —
 * which is what makes it testable outside the edge runtime.
 */

/** The moods a page can carry (kept small and legible on paper). */
const BOOK_MOODS = ["sweet", "playful", "flirty", "caring", "tender", "heavy", "ordinary"] as const;
type BookMood = (typeof BOOK_MOODS)[number];

interface MaterialLine {
  id?: string | number;
  who?: "owner" | "partner" | string;
  name?: string;
  text?: string;
  at?: string;
  type?: string;
  url?: string | null;
}

interface DayMaterial {
  day?: string;
  owner_name?: string;
  partner_name?: string;
  owner_ids?: string[];
  stats?: {
    messages?: number;
    photos?: number;
    first_at?: string | null;
    last_at?: string | null;
    sessions?: number;
    hours?: number;
    tone?: string;
  };
  lines?: MaterialLine[];
  photos?: string[];
  page?: Record<string, unknown> | null;
}

/** Map the free tone classifier onto the book's (slightly warmer) moods. */
function moodFromTone(tone: string | undefined, stats: DayMaterial["stats"]): BookMood {
  const hours = Number(stats?.hours ?? 0);
  const messages = Number(stats?.messages ?? 0);

  switch ((tone ?? "").toLowerCase()) {
    case "flirty":
      return "flirty";
    case "playful":
      return "playful";
    case "sweet":
      return messages > 400 ? "sweet" : "tender";
    case "caring":
      return "caring";
    case "sorry":
      return "heavy";
    case "serious":
      return hours >= 3 ? "heavy" : "tender";
    default:
      return messages >= 250 ? "playful" : messages >= 40 ? "ordinary" : "tender";
  }
}

const cleanLine = (text: string | undefined): string =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();

/** Very small stop-list: enough to keep titles from being "the the and". */
const STOP = new Set([
  "the", "and", "for", "you", "your", "yours", "with", "that", "this", "have", "has", "had", "was", "were", "are",
  "but", "not", "all", "can", "will", "would", "there", "here", "what", "when", "why", "how", "who", "from", "out",
  "about", "just", "like", "dont", "don", "did", "didn", "isn", "im", "i'm", "its", "it's", "too", "very", "much",
  "bahut", "hai", "hain", "kya", "nahi", "nahin", "bhi", "toh", "to", "ka", "ki", "ke", "mera", "meri", "tum",
  "aap", "main", "mai", "hum", "ek", "hi", "na", "ab", "aa", "ho", "kar", "karo", "raha", "rahi", "gaya", "gayi",
]);

/** The most distinctive word of the day — the seed of a title. */
function signatureWord(lines: MaterialLine[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const raw of cleanLine(line.text).toLowerCase().split(/[^a-z0-9\u0900-\u097F']+/)) {
      const word = raw.replace(/^'+|'+$/g, "");
      if (word.length < 4 || STOP.has(word) || /^\d+$/.test(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  let best: { word: string; n: number } | null = null;
  for (const [word, n] of counts) {
    if (!best || n > best.n || (n === best.n && word.length > best.word.length)) best = { word, n };
  }
  return best && best.n > 1 ? best.word : best?.word ?? null;
}

/** A plain, warm title that never pretends to be literature. */
function titleFromLines(lines: MaterialLine[], day?: string): string {
  const first = cleanLine(lines[0]?.text);
  const word = signatureWord(lines);
  const date = day ? new Date(`${day}T00:00:00`) : null;
  const stamp = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "long" })
    : "";

  if (word) {
    const pretty = word.charAt(0).toUpperCase() + word.slice(1);
    return `The ${pretty} day`;
  }
  if (first) {
    const short = first.length > 42 ? `${first.slice(0, 39).trim()}…` : first;
    return short;
  }
  return stamp ? `A quiet ${stamp}` : "A quiet day";
}

/** Pick the lines a page shows: the best few, in the order they were said. */
function pickExcerpts(lines: MaterialLine[], limit = 6): MaterialLine[] {
  const usable = lines
    .filter((l) => cleanLine(l.text).length >= 2)
    .map((l) => ({ ...l, text: cleanLine(l.text) }));

  if (usable.length <= limit) return usable;

  // Spread the picks across the day rather than clustering them: divide the
  // day into `limit` slices and take the best line from each.
  const size = Math.ceil(usable.length / limit);
  const picked: MaterialLine[] = [];
  for (let i = 0; i < usable.length && picked.length < limit; i += size) {
    const slice = usable.slice(i, i + size);
    const best = slice.reduce((a, b) => (b.text.length > a.text.length ? b : a), slice[0]);
    picked.push(best);
  }
  return picked.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
}

/**
 * Compose the free version of a page. Returns exactly the shape
 * `book_page_upsert()` expects.
 */
function composeHeuristicPage(material: DayMaterial) {
  const lines = Array.isArray(material?.lines) ? material.lines : [];
  const stats = material?.stats ?? {};
  const messages = Number(stats.messages ?? 0);

  const thin = messages < 4;
  const mood = moodFromTone(stats.tone, stats);
  const excerpt = pickExcerpts(lines, thin ? 3 : 6);

  return {
    day: material?.day ?? null,
    title: thin ? "A short day" : titleFromLines(lines, material?.day),
    subtitle: null as string | null,
    mood,
    excerpt,
    photo_url: Array.isArray(material?.photos) && material.photos.length > 0 ? String(material.photos[0]) : null,
    stats: {
      messages,
      photos: Number(stats.photos ?? 0),
      first_at: stats.first_at ?? null,
      last_at: stats.last_at ?? null,
      sessions: Number(stats.sessions ?? 0),
      hours: Number(stats.hours ?? 0),
      tone: stats.tone ?? "other",
    },
    generated_by: "heuristic" as const,
    status: thin ? ("thin" as const) : ("ready" as const),
  };
}

/**
 * The prompt for the one paid path: a title and a single line of prose for a
 * day that already happened. Written to be short — the excerpt is the point,
 * the words around it are only a frame.
 */
function buildBookPrompt(material: DayMaterial, styleCard?: string | null): { system: string; user: string } {
  const owner = material?.owner_name ?? "him";
  const partner = material?.partner_name ?? "her";
  const stats = material?.stats ?? {};
  const lines = pickExcerpts(Array.isArray(material?.lines) ? material.lines : [], 6);

  const transcript = lines
    .map((l) => `${l.who === "owner" ? owner : partner}: ${l.text}`)
    .join("\n");

  const system = [
    `You are helping write a private keepsake book for a couple: ${owner} and ${partner}.`,
    `For each day you are given real lines they said to each other. You write the book's frame, never their words.`,
    `Rules:`,
    `- Write a short title (3-6 words, lowercase is fine, no quotes) that captures the day without inventing facts.`,
    `- Write ONE line of prose (max 22 words) addressed to the two of them, warm and specific, in the voice of the book — never in ${owner}'s voice, never pretending to be a person.`,
    `- Never invent events that are not in the lines. Never mention AI, models, or that this was generated.`,
    `- No emoji in the title. At most one in the line. No clichés ("little did they know", "memories made").`,
    `- People may write in English, Hindi or Hinglish; match the language of the lines.`,
    styleCard ? `\nA voice guide for the book (follow the tone, not the personality):\n${styleCard}` : "",
    `\nReply with JSON only: {"title": "...", "subtitle": "..."}`,
  ].join("\n");

  const user = [
    `Day: ${material?.day ?? "unknown"}`,
    `Messages: ${stats.messages ?? 0} · sessions: ${stats.sessions ?? 0} · hours talking: ${stats.hours ?? 0} · tone: ${stats.tone ?? "other"}`,
    `Lines (in order):`,
    transcript || "(no usable lines)",
  ].join("\n");

  return { system, user };
}

/** Clamp whatever the model returns into something that fits on paper. */
function sanitizeWrittenPage(parsed: unknown, fallbackTitle: string): { title: string; subtitle: string | null } {
  const obj = (parsed ?? {}) as { title?: unknown; subtitle?: unknown };
  const rawTitle = cleanLine(String(obj.title ?? ""))
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?,;:]+$/g, "");
  const rawSubtitle = cleanLine(String(obj.subtitle ?? "")).replace(/^["'`]+|["'`]+$/g, "");

  const title = (rawTitle.length >= 3 ? rawTitle : fallbackTitle).slice(0, 64);
  const subtitle = rawSubtitle.length >= 6 ? rawSubtitle.slice(0, 200) : null;
  return { title, subtitle };
}
// ── END INLINE: book.ts ──

export type { BookMood, DayMaterial, MaterialLine };
export {
  BOOK_MOODS,
  buildBookPrompt,
  composeHeuristicPage,
  moodFromTone,
  pickExcerpts,
  sanitizeWrittenPage,
  signatureWord,
  titleFromLines,
};
