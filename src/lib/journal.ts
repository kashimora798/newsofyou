/**
 * Auto Journal — turns a day of chat into the pages of a scrapbook journal.
 *
 * Pure logic only (no React / Supabase) so it is easy to test:
 *   messages  ──►  blocks (text runs, photos, albums, gifs, audio…)  ──►  pages
 *
 * Every page is laid out on a FIXED logical canvas (PAGE_W × PAGE_H) that the UI
 * scales to fit the screen, so pagination can be computed up-front from
 * estimated block heights and still look identical on every device.
 */
import type { Tables } from "@/integrations/supabase/types";
import { groupMessages } from "@/lib/album";

type Message = Tables<"messages">;

/* ───────────────────────── canvas / layout constants ───────────────────────── */

export const PAGE_W = 400;
export const PAGE_H = 580;
export const PAGE_PAD_X = 34;
export const PAGE_PAD_TOP = 42;
export const PAGE_PAD_BOTTOM = 52;
export const LINE_H = 26;
/** Usable content height of a page, minus a safety margin. */
export const CONTENT_H = PAGE_H - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - 14;
/** Height of the day header that sits on the first page of a day. */
export const HEADER_H = 168;
/** Conservative characters-per-line for the handwriting font. */
export const CHARS_PER_LINE = 33;
/** Longest text block (in lines) before we start a new block. */
export const MAX_BLOCK_LINES = 8;

/* ───────────────────────── customisation palette ───────────────────────── */

export const ACCENTS = {
  rose: { label: "Rose", ink: "#c8324d", soft: "#fde4e8", tape: "#f7b6c2" },
  coral: { label: "Coral", ink: "#e0623f", soft: "#fde6dc", tape: "#f8c1aa" },
  honey: { label: "Honey", ink: "#c98a12", soft: "#fdf1cf", tape: "#f5d780" },
  sage: { label: "Sage", ink: "#4f8a5b", soft: "#e3f1e4", tape: "#b4d8b8" },
  teal: { label: "Teal", ink: "#2a8b8b", soft: "#dcf1f0", tape: "#a5dad7" },
  sky: { label: "Sky", ink: "#3b7dc4", soft: "#e0edfb", tape: "#acc9ee" },
  lilac: { label: "Lilac", ink: "#7a5bc2", soft: "#ebe4fa", tape: "#c9b8ee" },
  plum: { label: "Plum", ink: "#9b3f8a", soft: "#f6e1f1", tape: "#e3b0d8" },
  cocoa: { label: "Cocoa", ink: "#8a5a3c", soft: "#f1e4d8", tape: "#d9bb9f" },
  ink: { label: "Ink", ink: "#34384a", soft: "#e4e6ee", tape: "#b9bdce" },
} as const;
export type AccentKey = keyof typeof ACCENTS;

export const PAPERS = {
  dotted: { label: "Dotted", bg: "#fffdf8" },
  lined: { label: "Lined", bg: "#fffdf8" },
  grid: { label: "Grid", bg: "#fffdf8" },
  plain: { label: "Plain", bg: "#fffcf5" },
  kraft: { label: "Kraft", bg: "#ecd9bb" },
  blush: { label: "Blush", bg: "#fdf0f0" },
  mint: { label: "Mint", bg: "#eff8f1" },
  night: { label: "Night", bg: "#2b2d42" },
} as const;
export type PaperKey = keyof typeof PAPERS;

export const WASHI = {
  stripes: { label: "Stripes" },
  dots: { label: "Dots" },
  checks: { label: "Checks" },
  stars: { label: "Stars" },
  solid: { label: "Solid" },
  zigzag: { label: "Zigzag" },
} as const;
export type WashiKey = keyof typeof WASHI;

export const MOODS = [
  { key: "happy", emoji: "😊", label: "happy" },
  { key: "loved", emoji: "🥰", label: "loved" },
  { key: "silly", emoji: "🤪", label: "silly" },
  { key: "cozy", emoji: "☕", label: "cozy" },
  { key: "dreamy", emoji: "🌙", label: "dreamy" },
  { key: "tired", emoji: "😴", label: "sleepy" },
  { key: "sad", emoji: "🥲", label: "tender" },
  { key: "excited", emoji: "🎉", label: "excited" },
] as const;

export const EMOJI_CHOICES = [
  "🌷", "🌸", "🌻", "🍀", "🌿", "🍄", "🦋", "🐝", "🐞", "🐰", "🦊", "🐻",
  "☁️", "🌈", "☀️", "🌙", "⭐", "✨", "💫", "🔥", "❄️", "🍂", "🌊", "🏔️",
  "💌", "💕", "💖", "💘", "🫶", "🎀", "🧸", "🎈", "🎁", "🕯️", "📸", "🎧",
  "☕", "🧋", "🍓", "🍒", "🍑", "🍰", "🍕", "🍜", "🍿", "🍫", "🥐", "🍷",
  "📚", "✏️", "🎨", "🎬", "🎮", "✈️", "🚗", "🏡", "🌃", "🎂", "🥳", "😴",
] as const;

export interface JournalDayStyle {
  emojis: string[];
  accent: AccentKey;
  paper: PaperKey;
  washi: WashiKey;
  title: string | null;
  caption: string | null;
  mood: string | null;
}

export const DEFAULT_STYLE: JournalDayStyle = {
  emojis: [],
  accent: "rose",
  paper: "dotted",
  washi: "stripes",
  title: null,
  caption: null,
  mood: null,
};

/** Make sure a (possibly partial / foreign) row is a valid style. */
export function normalizeStyle(raw: Partial<Record<keyof JournalDayStyle, unknown>> | null | undefined): JournalDayStyle {
  const r = raw ?? {};
  return {
    emojis: Array.isArray(r.emojis) ? (r.emojis as unknown[]).filter((e): e is string => typeof e === "string").slice(0, 6) : [],
    accent: (typeof r.accent === "string" && r.accent in ACCENTS ? r.accent : DEFAULT_STYLE.accent) as AccentKey,
    paper: (typeof r.paper === "string" && r.paper in PAPERS ? r.paper : DEFAULT_STYLE.paper) as PaperKey,
    washi: (typeof r.washi === "string" && r.washi in WASHI ? r.washi : DEFAULT_STYLE.washi) as WashiKey,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 40) : null,
    caption: typeof r.caption === "string" && r.caption.trim() ? r.caption.trim().slice(0, 140) : null,
    mood: typeof r.mood === "string" && r.mood ? r.mood : null,
  };
}

/** Pick a stable-but-varied default accent for a day that has never been customised. */
export function autoAccent(dayKey: string): AccentKey {
  const keys = Object.keys(ACCENTS) as AccentKey[];
  const rnd = seeded(`accent:${dayKey}`);
  return keys[Math.floor(rnd() * keys.length)];
}

/* ───────────────────────── seeded randomness ───────────────────────── */

function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32): the same day always lays out the same way. */
export function seeded(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)];
}

/* ───────────────────────── dates ───────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar day key, e.g. "2026-03-03". */
export function dayKeyOf(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function dayRangeISO(dayKey: string): { from: string; to: string } {
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

const ORDINAL_WORDS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth",
  "eighteenth", "nineteenth", "twentieth", "twenty-first", "twenty-second", "twenty-third",
  "twenty-fourth", "twenty-fifth", "twenty-sixth", "twenty-seventh", "twenty-eighth",
  "twenty-ninth", "thirtieth", "thirty-first",
];
export const ordinalWord = (n: number) => ORDINAL_WORDS[n] ?? String(n);

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function describeDay(dayKey: string) {
  const d = parseDayKey(dayKey);
  return {
    weekday: WEEKDAYS[d.getDay()],
    month: MONTHS[d.getMonth()],
    monthShort: MONTHS[d.getMonth()].slice(0, 3),
    date: d.getDate(),
    dateWord: ordinalWord(d.getDate()),
    year: d.getFullYear(),
  };
}

/* ───────────────────────── message → block ───────────────────────── */

export type Highlight = {
  kind: "memory" | "bookmark" | "flag";
  emoji: string;
  /** margin note (bookmark note, or the remembered fact) */
  note?: string | null;
};

export interface TextEntry {
  id: string;
  time: string;
  text: string;
  highlight: Highlight | null;
}

export type Align = "left" | "center" | "right";

interface BlockBase {
  id: string;
  /** estimated rendered height in px (including margins) */
  height: number;
  /** deterministic decoration seed values */
  rot: number;
  align: Align;
  variant: number;
}

export type Block = BlockBase &
  (
    | { kind: "text"; mine: boolean; name: string; time: string; cont: boolean; entries: TextEntry[] }
    | { kind: "photo"; url: string; time: string; caption: string | null; mine: boolean; highlight: Highlight | null }
    | { kind: "album"; urls: string[]; time: string; caption: string | null; mine: boolean }
    | { kind: "gif"; url: string; time: string }
    | { kind: "sticker"; url: string }
    | { kind: "audio"; url: string; mime: string; duration: number; label: string; voice: boolean; mine: boolean; time: string }
    | { kind: "video"; url: string; time: string }
    | { kind: "file"; name: string; url: string }
  );

export interface MemoryFact {
  fact: string;
  created_at: string;
}
export interface BookmarkLite {
  message_id: string;
  category: string;
  note: string | null;
}

export const BOOKMARK_EMOJI: Record<string, string> = {
  restaurants: "🍽️",
  gift_ideas: "🎁",
  important: "⭐",
  funny: "😂",
  other: "📌",
};

const SKIP_TYPES = new Set([
  "touch_reaction", "coinflip", "diceroll", "eightball", "lucky", "rps",
  "surprise", "secret", "reaction", "system", "game", "game_invite", "proposal",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

export interface HighlightIndex {
  forMessage(m: Pick<Message, "id" | "content" | "is_memory">): Highlight | null;
}

/** Flags "important" messages using the remember tables: bookmarks, AI memories, and messages.is_memory. */
export function buildHighlighter(memories: MemoryFact[], bookmarks: BookmarkLite[]): HighlightIndex {
  const bm = new Map(bookmarks.map((b) => [b.message_id, b]));
  const facts = memories.map((m) => ({ raw: m.fact, n: norm(m.fact) })).filter((f) => f.n.length >= 8);
  return {
    forMessage(m) {
      const b = bm.get(m.id);
      if (b) return { kind: "bookmark", emoji: BOOKMARK_EMOJI[b.category] ?? "📌", note: b.note };
      if (m.is_memory) return { kind: "memory", emoji: "💛" };
      const c = m.content ? norm(m.content) : "";
      if (c.length >= 8) {
        for (const f of facts) {
          if (f.n.includes(c) || c.includes(f.n)) return { kind: "memory", emoji: "💛", note: f.raw };
        }
      }
      return null;
    },
  };
}

/** Greedy word-wrap used only to estimate how many lines a paragraph will take. */
export function wrapLines(text: string, perLine = CHARS_PER_LINE): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of para.split(/\s+/)) {
      while (word.length > perLine) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, perLine));
        word = word.slice(perLine);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= perLine) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

/** Split a very long message into chunks of at most `maxLines` estimated lines. */
export function chunkText(text: string, maxLines = MAX_BLOCK_LINES): string[] {
  const lines = wrapLines(text);
  if (lines.length <= maxLines) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines).join(" ").trim());
  return chunks.filter(Boolean);
}

export const formatClock = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${pad2(d.getMinutes())}${ampm}`;
};

// Block heights (px), tuned together with the components that render them.
export const H = {
  textHeader: 24,
  textGap: 14,
  entryGap: 3,
  photo: { polaroid: 262, taped: 224, stamp: 244, torn: 218 },
  caption: 30,
  album2: 206,
  album3: 262,
  album4: 300,
  gif: 206,
  sticker: 124,
  audio: 176,
  video: 204,
  file: 62,
  remember: { base: 54, perFact: 28 },
} as const;
export const PHOTO_VARIANTS = ["polaroid", "taped", "stamp", "torn"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

export interface BuildOptions {
  dayKey: string;
  currentUserId: string | undefined;
  highlighter: HighlightIndex;
}

const isTextual = (m: Message) => {
  const t = m.message_type ?? "text";
  return (t === "text" || t === "letter") && !!m.content?.trim();
};

/** Turn the day's raw messages into ordered, height-estimated journal blocks. */
export function buildBlocks(messages: Message[], { dayKey, currentUserId, highlighter }: BuildOptions): Block[] {
  const usable = messages.filter((m) => {
    if ((m as { isReact?: boolean | null }).isReact) return false;
    if (m.id.startsWith("tmp_")) return false;
    const t = m.message_type ?? "text";
    if (SKIP_TYPES.has(t)) return false;
    return true;
  });

  const items = groupMessages(usable);
  const blocks: Block[] = [];
  let run: Extract<Block, { kind: "text" }> | null = null;
  let runLines = 0;

  const decor = (id: string) => {
    const rnd = seeded(`${dayKey}:${id}`);
    return {
      rot: Math.round((rnd() * 7 - 3.5) * 10) / 10,
      align: pick(rnd, ["left", "center", "right"] as const) as Align,
      variant: Math.floor(rnd() * 1000),
    };
  };

  const flush = () => {
    if (run) {
      run.height = H.textHeader * (run.cont ? 0 : 1) + runLines * LINE_H + (run.entries.length - 1) * H.entryGap + H.textGap;
      blocks.push(run);
    }
    run = null;
    runLines = 0;
  };

  const pushText = (m: Message, text: string, cont: boolean) => {
    const mine = m.user_id === currentUserId;
    const lines = wrapLines(text).length;
    const hl = highlighter.forMessage(m);
    if (run && (run.mine !== mine || runLines + lines > MAX_BLOCK_LINES)) flush();
    if (!run) {
      run = {
        kind: "text", id: `t-${m.id}-${blocks.length}`, height: 0, mine,
        name: m.username?.split(" ")[0] || (mine ? "Me" : "Love"),
        time: formatClock(m.created_at), cont, entries: [], ...decor(m.id),
      };
    }
    run.entries.push({ id: m.id + (cont ? "-c" : ""), time: formatClock(m.created_at), text, highlight: hl });
    runLines += lines;
  };

  for (const item of items) {
    if (item.kind === "album") {
      flush();
      const urls = item.messages.map((m) => m.image_url).filter((u): u is string => !!u);
      const last = item.last;
      const caption = item.messages.map((m) => m.content?.trim()).find(Boolean) ?? null;
      for (let i = 0; i < urls.length; i += 4) {
        const part = urls.slice(i, i + 4);
        const n = part.length;
        const base = n === 1 ? H.photo.polaroid : n === 2 ? H.album2 : n === 3 ? H.album3 : H.album4;
        const cap = i + 4 >= urls.length && caption ? H.caption : 0;
        if (n === 1) {
          blocks.push({
            kind: "photo", id: `${last.id}-a${i}`, url: part[0], time: formatClock(last.created_at),
            caption: cap ? caption : null, mine: last.user_id === currentUserId, highlight: null,
            height: base + cap, ...decor(`${last.id}-a${i}`),
          });
        } else {
          blocks.push({
            kind: "album", id: `${last.id}-a${i}`, urls: part, time: formatClock(last.created_at),
            caption: cap ? caption : null, mine: last.user_id === currentUserId,
            height: base + cap, ...decor(`${last.id}-a${i}`),
          });
        }
      }
      continue;
    }

    const m = item.message;
    const mine = m.user_id === currentUserId;
    const t = m.message_type ?? "text";

    if ((t === "voice_note" || t === "audio") && m.file_url) {
      flush();
      blocks.push({
        kind: "audio", id: m.id, url: m.file_url, mime: m.file_type ?? (t === "voice_note" ? "audio/webm" : "audio/mpeg"),
        duration: m.duration ?? 0, label: t === "audio" ? m.file_name ?? "a song" : "voice note",
        voice: t === "voice_note", mine, time: formatClock(m.created_at), height: H.audio, ...decor(m.id),
      });
      continue;
    }
    if (m.video && m.vidUrl) {
      flush();
      blocks.push({ kind: "video", id: m.id, url: m.vidUrl, time: formatClock(m.created_at), height: H.video, ...decor(m.id) });
      continue;
    }
    if (m.gif_url) {
      flush();
      blocks.push({ kind: "gif", id: m.id, url: m.gif_url, time: formatClock(m.created_at), height: H.gif, ...decor(m.id) });
      continue;
    }
    if (m.sticker_url) {
      flush();
      blocks.push({ kind: "sticker", id: m.id, url: m.sticker_url, height: H.sticker, ...decor(m.id) });
      continue;
    }
    if (m.image_url) {
      flush();
      const d = decor(m.id);
      const variant = PHOTO_VARIANTS[d.variant % PHOTO_VARIANTS.length];
      const caption = m.content?.trim() ? m.content.trim().slice(0, 110) : null;
      blocks.push({
        kind: "photo", id: m.id, url: m.image_url, time: formatClock(m.created_at), caption, mine,
        highlight: highlighter.forMessage(m), height: H.photo[variant] + (caption ? H.caption : 0), ...d,
      });
      continue;
    }
    if (m.file_url && t !== "text") {
      flush();
      blocks.push({ kind: "file", id: m.id, name: m.file_name ?? "a file", url: m.file_url, height: H.file, ...decor(m.id) });
      continue;
    }
    if (isTextual(m)) {
      const chunks = chunkText(m.content!.trim());
      chunks.forEach((c, i) => pushText(m, c, i > 0));
    }
  }
  flush();
  return blocks;
}

/* ───────────────────────── pagination ───────────────────────── */

export interface JournalPage {
  index: number;
  blocks: Block[];
  /** facts to show in the "remember" sticky on the first page */
  isFirst: boolean;
}

export interface PaginateOptions {
  /** extra height reserved at the top of page 1 (header + remember note) */
  firstReserved?: number;
}

export function paginate(blocks: Block[], { firstReserved = HEADER_H }: PaginateOptions = {}): JournalPage[] {
  const pages: JournalPage[] = [];
  let cur: Block[] = [];
  let used = 0;
  let cap = Math.max(120, CONTENT_H - firstReserved);

  const close = () => {
    pages.push({ index: pages.length, blocks: cur, isFirst: pages.length === 0 });
    cur = [];
    used = 0;
    cap = CONTENT_H;
  };

  for (const src of blocks) {
    const b = { ...src } as Block; // never mutate the caller's (memoised) blocks
    if (used + b.height > cap && cur.length > 0) close();
    // a continuation block that lands at the top of a page gets its header back
    if (cur.length === 0 && b.kind === "text" && b.cont) {
      b.height += H.textHeader;
      b.cont = false;
    }
    cur.push(b);
    used += b.height;
  }
  if (cur.length > 0 || pages.length === 0) close();
  return pages;
}

/** Height of the remember sticky for `n` facts (0 → no sticky). */
export function rememberHeight(n: number): number {
  return n > 0 ? H.remember.base + n * H.remember.perFact : 0;
}

/* ───────────────────────── index (months / days) ───────────────────────── */

export interface DaySummary {
  key: string;
  count: number;
  photos: number;
  audio: number;
}

export interface MonthGroup {
  key: string; // yyyy-mm
  year: number;
  month: number; // 0-based
  label: string;
  days: DaySummary[];
  count: number;
  photos: number;
}

export interface IndexRow {
  created_at: string | null;
  message_type: string | null;
  image_url: string | null;
  gif_url?: string | null;
}

export function summarizeDays(rows: IndexRow[]): DaySummary[] {
  const map = new Map<string, DaySummary>();
  for (const r of rows) {
    if (!r.created_at) continue;
    const t = r.message_type ?? "text";
    if (SKIP_TYPES.has(t)) continue;
    const key = dayKeyOf(r.created_at);
    const s = map.get(key) ?? { key, count: 0, photos: 0, audio: 0 };
    s.count += 1;
    if (r.image_url) s.photos += 1;
    if (t === "voice_note" || t === "audio") s.audio += 1;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function groupByMonth(days: DaySummary[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const d of days) {
    const mk = monthKeyOf(d.key);
    let g = map.get(mk);
    if (!g) {
      const [y, m] = mk.split("-").map(Number);
      g = { key: mk, year: y, month: m - 1, label: MONTHS[m - 1], days: [], count: 0, photos: 0 };
      map.set(mk, g);
    }
    g.days.push(d);
    g.count += d.count;
    g.photos += d.photos;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Calendar cells (Sunday-first) for a month: nulls pad the leading weekdays. */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);
  return cells;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
