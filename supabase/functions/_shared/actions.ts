// ── BEGIN GENERATED BLOCK (source: supabase/functions/_shared/actions.ts) ──
// ── BEGIN INLINE: actions.ts ──
/**
 * actions.ts — assistant actions, kept pure so they can be tested (Phase 7).
 *
 * The contract of this file, in one line: **the model may only ever propose.**
 *
 *   request → one call → {kind, title, detail, payload, preview, when}
 *                               ↓ (validated here, clamped here)
 *                     a confirm card in the UI
 *                               ↓ (a person taps)
 *                    the edge function performs the write
 *
 * So this module's job is to be paranoid about whatever comes back: unknown
 * kinds are dropped, dates in the past are refused, strings are clamped, and a
 * schedule with no text is not a schedule. Nothing here touches the network.
 */

export type ActionKind =
  | "schedule_message"
  | "create_reminder"
  | "add_event"
  | "format_message"
  | "daily_summary"
  | "plan";

export const ACTION_KINDS: ActionKind[] = [
  "schedule_message",
  "create_reminder",
  "add_event",
  "format_message",
  "daily_summary",
  "plan",
];

/** The three kinds that write something — the only ones needing a tap. */
export const WRITE_KINDS: ActionKind[] = ["schedule_message", "create_reminder", "add_event"];

export interface ActionPayload {
  /** Who the write is for. Defaults to the person who asked. */
  for_user?: string;
  /** Some models put the time inside the payload — accepted, then normalised. */
  when?: string;
  /** schedule_message */
  text?: string;
  /** create_reminder */
  title?: string;
  note?: string;
  /** add_event */
  emoji?: string;
  description?: string;
  /** format_message — the suggestion itself */
  suggestion?: string;
  /** daily_summary / plan — the answer itself */
  answer?: string;
}

export interface ProposedAction {
  kind: ActionKind;
  title: string;
  detail: string | null;
  payload: ActionPayload;
  /** What will be written, verbatim, for the confirm card. */
  preview: string;
  /** ISO 8601 with offset, or null for the read kinds. */
  when: string | null;
  parsed: boolean;
}

const KINDS = new Set<string>(ACTION_KINDS);
const WRITES = new Set<string>(WRITE_KINDS);

const clampText = (v: unknown, max = 200): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Some models wrap JSON in prose — find the object. */
function parseActionJson(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return tryParse(text.slice(start, end + 1));
}

/**
 * A local wall-clock string plus an offset → a real instant.
 * Accepts "2026-10-09T19:00", "2026-10-09 19:00", "2026-10-09T19:00:30".
 * Returns null if it is not a date at all.
 */
function toIsoInZone(local: string, offsetMinutes = 330): string | null {
  const text = String(local ?? "").trim();

  // Anything already carrying a zone (…Z, +05:30) is an instant, not a wall
  // clock — applying the offset to it would shift the time twice.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;

  const [, y, mo, d, h, mi, s] = m;
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const stamp = `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}${off}`;

  return Number.isFinite(Date.parse(stamp)) ? stamp : null;
}

/** "Fri 9 Oct, 7:00 pm" — the label on the confirm card. */
function formatWhen(iso: string | null, timeZone = "Asia/Kolkata"): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * Validate and clamp whatever the model proposed. `now` is passed in so the
 * past/future checks are testable.
 */
function parseActionProposal(
  raw: string,
  opts: { now?: Date; offsetMinutes?: number; defaultDetail?: string } = {},
): ProposedAction | null {
  const obj = parseActionJson(raw);
  if (!obj) return null;

  const kindRaw = clampText(obj.kind, 40).toLowerCase();
  if (!KINDS.has(kindRaw)) return null;
  const kind = kindRaw as ActionKind;

  const payloadRaw = (obj.payload && typeof obj.payload === "object" ? obj.payload : {}) as Record<string, unknown>;
  const payload: ActionPayload = {};

  const now = opts.now ?? new Date();
  const offsetMinutes = opts.offsetMinutes ?? 330;

  // ── dates: only for the three write kinds, never in the past ─────────────
  let when: string | null = null;
  if (WRITES.has(kind)) {
    const candidate = obj.when ?? payload.when ?? obj.when_at;
    when = toIsoInZone(String(candidate ?? ""), offsetMinutes);
    if (!when) return null; // a reminder without a time is not a reminder

    const at = Date.parse(when);
    const early = at < now.getTime() - 60_000; // a minute of slack for clock skew
    const tooFar = at > now.getTime() + 2 * 365 * 86_400_000;
    if (early || tooFar) return null;
  }

  // ── the payload, clamped per kind ───────────────────────────────────────
  if (kind === "schedule_message") {
    payload.text = clampText(obj.text ?? payloadRaw.text, 900);
    if (!payload.text) return null;
  }
  if (kind === "create_reminder") {
    payload.title = clampText(obj.title ?? payloadRaw.title, 120);
    payload.note = clampText(obj.note ?? payloadRaw.note, 300) || undefined;
    if (!payload.title) return null;
  }
  if (kind === "add_event") {
    payload.title = clampText(obj.title ?? payloadRaw.title, 120);
    payload.emoji = clampText(obj.emoji ?? payloadRaw.emoji, 8) || "📅";
    payload.description = clampText(obj.description ?? payloadRaw.description, 300) || undefined;
    if (!payload.title) return null;
  }
  if (kind === "format_message") {
    payload.suggestion = clampText(obj.text ?? obj.suggestion ?? payloadRaw.suggestion, 900);
    if (!payload.suggestion) return null;
  }
  if (kind === "daily_summary" || kind === "plan") {
    payload.answer = clampText(obj.answer ?? obj.text ?? payloadRaw.answer, 1200);
  }

  if (payloadRaw.for_user && /^[0-9a-f-]{36}$/i.test(String(payloadRaw.for_user))) {
    payload.for_user = String(payloadRaw.for_user);
  }

  const title = clampText(obj.title, 120) || defaultTitle(kind);
  const preview = clampText(obj.preview, 400) || describeAction(kind, payload, when ?? undefined);

  return {
    kind,
    title,
    detail: clampText(obj.detail ?? opts.defaultDetail, 400) || null,
    payload,
    preview,
    when,
    parsed: true,
  };
}

function defaultTitle(kind: ActionKind): string {
  switch (kind) {
    case "schedule_message":
      return "Send a message later";
    case "create_reminder":
      return "Set a reminder";
    case "add_event":
      return "Add to your calendar";
    case "format_message":
      return "Say it a little better";
    case "daily_summary":
      return "How today went";
    default:
      return "A little plan";
  }
}

/** The one line a person reads before tapping. */
function describeAction(kind: ActionKind, payload: ActionPayload, when?: string): string {
  const at = when ? formatWhen(when) : null;
  switch (kind) {
    case "schedule_message":
      return `Send “${payload.text ?? ""}”${at ? ` on ${at}` : ""}`;
    case "create_reminder":
      return `Remind about “${payload.title ?? ""}”${at ? ` on ${at}` : ""}`;
    case "add_event":
      return `${payload.emoji ?? "📅"} ${payload.title ?? ""}${at ? ` on ${at}` : ""}`;
    case "format_message":
      return payload.suggestion ?? "";
    case "daily_summary":
      return payload.answer ?? "";
    default:
      return payload.answer ?? "";
  }
}

/** Does this kind need a tap before anything happens? */
function needsConfirm(kind: ActionKind): boolean {
  return WRITES.has(kind);
}

/** Which table the write lands in — used by the executor and the audit row. */
function targetTable(kind: ActionKind): string | null {
  switch (kind) {
    case "schedule_message":
      return "scheduled_messages";
    case "create_reminder":
      return "reminders";
    case "add_event":
      return "shared_events";
    default:
      return null;
  }
}

// ── prompts ────────────────────────────────────────────────────────────────

const ACTION_RULES = `You may ONLY propose an action; you never perform one and you never claim it is done.
Kinds you can propose: schedule_message, create_reminder, add_event, format_message, daily_summary, plan.
- schedule_message: {"kind","title","text","when","preview"} — text is the message to send later, in the asker's own voice.
- create_reminder: {"kind","title","note","when","preview"}.
- add_event: {"kind","title","emoji","description","when","preview"}.
- format_message: {"kind","title","text","preview"} — text is the improved version of their draft, keep their meaning and language.
- daily_summary / plan: {"kind","title","answer"}.
"when" must be ISO-8601 with an offset. Never invent a date the asker did not give; if no time was said, use a sensible one and say so in "detail".`;

/** One call turns a request into one card. */
function buildActionPrompt(input: {
  request: string;
  nowIso: string;
  tz: string;
  ownerName: string;
  partnerName: string;
  requester: "owner" | "partner";
}): { system: string; user: string } {
  const system = `${ACTION_RULES}

People: ${input.ownerName} (him), ${input.partnerName} (her). The asker is ${input.requester === "owner" ? input.ownerName : input.partnerName}.
Right now it is ${input.nowIso} (${input.tz}). Reply with ONLY the JSON object for one action, no prose. If the request is not one of the kinds, reply {"kind":"none"}.`;

  return { system, user: `Request: ${input.request}` };
}

/** "How was today?" — read-only, one call, cached per day. */
function buildSummaryPrompt(input: {
  ownerName: string;
  partnerName: string;
  day: string;
  lines: { who: string; text: string }[];
  highlights?: { kind: string; text: string }[];
}): { system: string; user: string } {
  const system =
    `You write a short, warm note about how a day went for a couple. People: ${input.ownerName} (him), ${input.partnerName} (her). ` +
    `Use ONLY what is in the lines — never invent events, feelings or facts. 3–5 short sentences, plain second person ("you two"), no bullet points, no headings. ` +
    `If the day was ordinary, say so kindly. End without a question.`;

  const lines = input.lines.map((l) => `${l.who}: ${l.text}`).join("\n");
  const kept = (input.highlights ?? []).map((h) => `[${h.kind}] ${h.text}`).join("\n");

  return {
    system,
    user: `Day: ${input.day}\n\nWhat the twin noticed:\n${kept || "(nothing in particular)"}\n\nThem that day:\n${lines}`,
  };
}

/** "What should we do this weekend?" — read-only, grounded in their own life. */
function buildPlanPrompt(input: {
  ownerName: string;
  partnerName: string;
  request: string;
  memories?: { fact: string }[];
  highlights?: { kind: string; text: string }[];
  upcoming?: { title: string; when: string }[];
}): { system: string; user: string } {
  const system =
    `You suggest something small and specific for a couple to do, in 3–6 short lines, using only what you are given. ` +
    `People: ${input.ownerName} (him), ${input.partnerName} (her). No generic advice, no "communicate more", no bullet lists with headings. ` +
    `You may propose at most one thing they should schedule, and say which day.`;

  const facts = (input.memories ?? []).map((m) => `- ${m.fact}`).join("\n") || "(nothing recorded)";
  const kept = (input.highlights ?? []).map((h) => `[${h.kind}] ${h.text}`).join("\n") || "(nothing recent)";
  const soon = (input.upcoming ?? []).map((u) => `- ${u.title} (${u.when})`).join("\n") || "(nothing on the calendar)";

  return {
    system,
    user: `They asked: ${input.request}\n\nWhat the twin knows:\n${facts}\n\nRecent moments worth building on:\n${kept}\n\nAlready on their calendar:\n${soon}`,
  };
}

/** "Say it a little better" — rewrite a draft, keep the meaning. */
function buildFormatPrompt(input: {
  draft: string;
  ownerName: string;
  partnerName: string;
  tone?: string | null;
  styleCard?: string | null;
}): { system: string; user: string } {
  const system =
    `You improve one message a person is about to send to ${input.partnerName}. Keep their meaning, their language (English / Hindi / Hinglish) and their length — ` +
    `make it clearer and warmer${input.tone ? `, leaning ${input.tone}` : ""}. No emoji unless they used one. Never add facts or promises they did not make. ` +
    `Reply with the rewritten message only, nothing else.` +
    (input.styleCard ? `\n\nHow ${input.ownerName} usually writes:\n${input.styleCard}` : "");

  return { system, user: `Draft:\n${input.draft}` };
}

export type { ActionPayload as TwinActionPayload };
export {
  ACTION_RULES,
  buildActionPrompt,
  buildFormatPrompt,
  buildPlanPrompt,
  buildSummaryPrompt,
  clampText,
  defaultTitle,
  describeAction,
  parseActionJson,
  formatWhen,
  needsConfirm,
  parseActionProposal,
  targetTable,
  toIsoInZone,
};
// ── END INLINE: actions.ts ──
// ── END GENERATED BLOCK ──
