/**
 * NewsOfYou — greeting brain (Phase 2B)
 * ====================================
 * Free, deterministic, testable logic for choosing and personalising a
 * greeting. NO LLM calls live here (that is the whole point of the greeting
 * bank): the hot path is "pick a pre-written line, fill placeholders, log it".
 *
 * A live LLM greeting is allowed at most `greeting_live_per_day` times and only
 * when the caller passes `allowLive`; any failure falls back to the bank.
 */

// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/greet.ts) ──
// ── BEGIN INLINE: greet.ts ──
const GREETING_MOODS = [
  "sweet",
  "playful",
  "flirty",
  "missing_you",
  "proud",
  "sleepy",
  "cozy",
  "celebratory",
  "gentle_after_fight",
] as const;

const DAYPARTS = ["morning", "afternoon", "evening", "night"] as const;

type GreetingMood = (typeof GREETING_MOODS)[number];
type Daypart = (typeof DAYPARTS)[number];

/** Local hour -> daypart (5–11 morning, 12–16 afternoon, 17–21 evening, else night). */
function daypartAt(date: Date, timezoneOffsetHours: number): Daypart {
  const local = new Date(date.getTime() + timezoneOffsetHours * 3600 * 1000);
  const hour = local.getUTCHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function isGreetingMood(value: string): value is GreetingMood {
  return (GREETING_MOODS as readonly string[]).includes(value);
}

interface GreetContext {
  daypart: Daypart;
  /** Dominant tone of her last-24h messages ("sweet" | "hurtful" | ... ) */
  herToneToday?: string | null;
  /** Hours since the last greeting was shown (null = first time). */
  hoursSinceLastGreeting?: number | null;
  /** Days since she last opened the app (from user_status.last_seen). */
  daysSinceSeen?: number | null;
  /** Days until the anniversary (negative = just passed). */
  daysToAnniversary?: number | null;
  /** Days until her birthday (negative = just passed). */
  daysToBirthday?: number | null;
  /** The mood shown last time, so we can avoid repeating it. */
  lastMood?: string | null;
}

/**
 * Weighted mood choice. Deliberately transparent — every rule is one line so
 * it can be argued with and tested.
 */
function moodWeights(ctx: GreetContext): Record<GreetingMood, number> {
  const w: Record<GreetingMood, number> = {
    sweet: 3,
    playful: 2,
    flirty: 2,
    missing_you: 1,
    proud: 1,
    sleepy: 1,
    cozy: 1,
    celebratory: 1,
    gentle_after_fight: 0.4,
  };

  switch (ctx.daypart) {
    case "morning":
      w.sweet += 2;
      w.sleepy += 1.5;
      w.playful += 1;
      break;
    case "afternoon":
      w.playful += 2;
      w.proud += 1;
      break;
    case "evening":
      w.cozy += 2;
      w.missing_you += 1.5;
      break;
    case "night":
      w.sleepy += 2;
      w.flirty += 2;
      w.missing_you += 1;
      break;
  }

  const tone = (ctx.herToneToday ?? "").toLowerCase();
  if (tone === "hurtful" || tone === "serious") {
    w.gentle_after_fight += 6;
    w.cozy += 2;
    w.sweet += 1;
    w.flirty = 0;
    w.playful = 0;
  } else if (tone === "sweet") {
    w.sweet += 2;
    w.flirty += 1;
  } else if (tone === "playful") {
    w.playful += 2;
  } else if (tone === "sorry") {
    w.gentle_after_fight += 4;
    w.sweet += 2;
  }

  // Time apart.
  const hours = ctx.hoursSinceLastGreeting;
  if (hours !== null && hours !== undefined) {
    if (hours > 72) w.missing_you += 4;
    else if (hours > 24) w.missing_you += 2;
    else if (hours < 8) w.cozy += 1;
  }
  const away = ctx.daysSinceSeen;
  if (away !== null && away !== undefined && away >= 3) w.missing_you += 3;

  // Dates.
  const ann = ctx.daysToAnniversary;
  if (ann !== null && ann !== undefined && ann >= 0 && ann <= 7) w.celebratory += 5;
  const bday = ctx.daysToBirthday;
  if (bday !== null && bday !== undefined && bday >= 0 && bday <= 7) w.celebratory += 6;

  // Don't repeat the mood we just showed — unless it is the only one left.
  if (ctx.lastMood && isGreetingMood(ctx.lastMood)) {
    w[ctx.lastMood] = 0;
    if (Object.values(w).every((v) => v <= 0)) w[ctx.lastMood] = 1;
  }

  return w;
}

function pickMood(ctx: GreetContext, rand: () => number = Math.random): GreetingMood {
  const weights = moodWeights(ctx);
  const entries = Object.entries(weights).filter(([, v]) => v > 0) as [GreetingMood, number][];
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (total <= 0) return "sweet";

  let roll = rand() * total;
  for (const [mood, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return mood;
  }
  return entries[entries.length - 1][0];
}

interface TemplateVars {
  nickname?: string | null;
  ownerNickname?: string | null;
  ownerName?: string | null;
  partnerName?: string | null;
  daysTogether?: number | null;
  lastMemory?: string | null;
  date?: Date;
  timezoneOffsetHours?: number;
}

/** Fill {placeholders}; unknown placeholders are removed, never left raw. */
function fillTemplate(text: string, vars: TemplateVars): string {
  const date = vars.date ?? new Date();
  const tz = vars.timezoneOffsetHours ?? 5.5;
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(date);
  const map: Record<string, string> = {
    nickname: vars.nickname ?? vars.partnerName ?? "jaan",
    owner_nickname: vars.ownerNickname ?? vars.ownerName ?? "",
    owner_name: vars.ownerName ?? "",
    partner_name: vars.partnerName ?? "",
    days_together: vars.daysTogether !== null && vars.daysTogether !== undefined ? String(vars.daysTogether) : "",
    last_memory: vars.lastMemory ?? "",
    weekday,
    daypart: daypartAt(date, tz),
  };

  let out = text.replace(/\{(\w+)\}/g, (_m, key: string) => map[key] ?? "");
  // Tidy up artefacts from removed placeholders.
  out = out
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
  return out;
}

/** Placeholders a bank line may use, for validation while seeding. */
const ALLOWED_PLACEHOLDERS = ["nickname", "owner_nickname", "days_together", "last_memory", "weekday"];

function unknownPlaceholders(text: string): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((p) => !ALLOWED_PLACEHOLDERS.includes(p)))];
}

/**
 * Choose the least-used line for a mood. The database does the same ordering
 * with `twin_greeting_pick`; this mirror exists so the UI can preview and the
 * behaviour can be unit-tested without a database.
 */
function pickFromBank<T extends { text: string; uses?: number | null; last_used_at?: string | null }>(
  rows: T[],
  opts: { avoidTexts?: string[]; rand?: () => number } = {},
): T | null {
  const avoid = new Set((opts.avoidTexts ?? []).map((t) => t.toLowerCase()));
  const usable = rows.filter((r) => r.text && !avoid.has(r.text.toLowerCase()));
  if (usable.length === 0) return null;

  const rand = opts.rand ?? Math.random;
  return usable
    .slice()
    .sort((a, b) => {
      const uses = (a.uses ?? 0) - (b.uses ?? 0);
      if (uses !== 0) return uses;
      const at = a.last_used_at ? Date.parse(a.last_used_at) : 0;
      const bt = b.last_used_at ? Date.parse(b.last_used_at) : 0;
      if (at !== bt) return at - bt;
      return rand() - 0.5;
    })[0];
}

/** Live greeting budget: at most `perDay` and never twice in one local day. */
function liveAllowed(
  ctx: { liveToday?: number | null; hoursSinceLastGreeting?: number | null },
  perDay = 1,
): boolean {
  if ((ctx.liveToday ?? 0) >= Math.max(perDay, 0)) return false;
  if (perDay <= 0) return false;
  // Don't burn an AI call on a quick page refresh.
  return (ctx.hoursSinceLastGreeting ?? 99) >= 6;
}

/** Static, always-available lines: used when the bank is empty AND AI is down. */
const STATIC_GREETINGS: Record<Daypart, string[]> = {
  morning: ["Good morning, {nickname}. I hope today is gentle with you. ☀️", "Morning, {nickname}. Thinking of you first, like always."],
  afternoon: ["Hey {nickname} — hope your afternoon is going okay. 🫶", "Just checking in, {nickname}. How's the day treating you?"],
  evening: ["Evening, {nickname}. The day's almost done — how are you? 🌆", "Hi {nickname}. Missing you a little extra right now."],
  night: ["Good night, {nickname}. Sleep well — I'll be here tomorrow. 🌙", "It's late, {nickname}. Rest well and dream something lovely."],
};

function staticGreeting(daypart: Daypart, rand: () => number = Math.random): string {
  const lines = STATIC_GREETINGS[daypart] ?? STATIC_GREETINGS.night;
  return lines[Math.floor(rand() * lines.length) % lines.length];
}
// ── END INLINE: greet.ts ──
// ── END GENERATED BLOCK ──

export type { Daypart, GreetContext, GreetingMood, TemplateVars };
export {
  ALLOWED_PLACEHOLDERS,
  DAYPARTS,
  daypartAt,
  fillTemplate,
  GREETING_MOODS,
  isGreetingMood,
  liveAllowed,
  moodWeights,
  pickFromBank,
  pickMood,
  staticGreeting,
  STATIC_GREETINGS,
  unknownPlaceholders,
};
