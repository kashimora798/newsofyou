import { GAME_CATALOG } from "./gameCatalog";

// Phase 1 — secret slash-command router + text-trigger detector.
//
// Slash / phrase commands REPLACE the message: the SENDER computes the result so
// both screens render the exact same outcome (a downloaded GIF couldn't
// guarantee that). The result is stored in `content` with a special
// `message_type` and syncs via the normal realtime message flow.
//
// Rich text triggers ("sorry", "good night", …) are normal messages that ALSO
// fire a full-screen overlay on both screens.

export type SecretMessageType = "coinflip" | "diceroll" | "eightball" | "lucky" | "rps" | "surprise" | "bored";

export interface ParsedSecretCommand {
  message_type: SecretMessageType;
  /** Stored in message `content`. For "surprise" it's the chosen overlay key. */
  result: string;
  /** rps needs a throw picker before anything is sent. */
  interactive?: boolean;
}

const EIGHT_BALL_ANSWERS = [
  "It is certain", "Without a doubt", "Yes — definitely", "You may rely on it",
  "Most likely", "Outlook good", "Yes", "Signs point to yes",
  "Reply hazy, try again", "Ask again later", "Better not tell you now",
  "Cannot predict now", "Don't count on it", "My reply is no",
  "Outlook not so good", "Very doubtful",
];

// Effects a "surprise me" can randomly pick (no result payload needed).
const SURPRISE_POOL = ["heartbeat", "mend", "fire", "mirror", "sunrise", "starrynight"];

function randomCoin() { return Math.random() < 0.5 ? "heads" : "tails"; }
function randomDie() { return String(1 + Math.floor(Math.random() * 6)); }
function randomAnswer() { return EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)]; }

export function parseSecretCommand(text: string): ParsedSecretCommand | null {
  const t = text.trim().toLowerCase();

  if (t === "/flip" || t === "/coin" || t === "/coinflip") {
    return { message_type: "coinflip", result: randomCoin() };
  }
  if (t === "/dice" || t === "/roll" || t === "/die") {
    return { message_type: "diceroll", result: randomDie() };
  }
  if (t === "/8ball" || t === "/8" || t === "/eightball") {
    return { message_type: "eightball", result: randomAnswer() };
  }
  if (t === "/lucky" || t === "/luckynumber") {
    return { message_type: "lucky", result: String(1 + Math.floor(Math.random() * 99)) };
  }
  if (t === "/rps" || t === "/rock") {
    return { message_type: "rps", result: "", interactive: true };
  }

  // Phrase commands
  if (/^\s*surprise\s*me\s*$/i.test(t)) {
    return { message_type: "surprise", result: SURPRISE_POOL[Math.floor(Math.random() * SURPRISE_POOL.length)] };
  }
  if (/^\s*(?:i'?m|i\s+am)\s+bored\s*!*$|^\s*so\s*bored\s*!*$|^\s*bored\s*!*$/i.test(t)) {
    const quickGames = GAME_CATALOG.filter(g => g.category === "quick" && g.status === "ready");
    const pick = quickGames[Math.floor(Math.random() * quickGames.length)];
    return { message_type: "bored", result: pick.type };
  }

  return null;
}

// ── Rich text triggers ──────────────────────────────────────────────────────

export type RichTriggerType = "heartbeat" | "mend" | "fire" | "mirror" | "sunrise" | "starrynight";

const RICH_TRIGGERS: [RegExp, RichTriggerType][] = [
  [/\bare\s*you\s*there\b|\b(?:r|are)\s*(?:u|you)\s*there\b|\byou\s*there\?*/i, "heartbeat"],
  [/\bi'?m\s*sorry\b|\bso+\s*sorry\b|\bsorry\b|\bforgive\s*me\b|maaf/i, "mend"],
  [/\bi'?m\s*angry\b|\bso+\s*angry\b|\bangry\b|😤|😠|😡/i, "fire"],
  [/good\s*morning|\bgm\b|suprabhat/i, "sunrise"],
  [/good\s*night|\bgn\b|shubh\s*ratri/i, "starrynight"],
  [/^\s*same\s*$|\bsame\s*here\b|\bsa+me\b/i, "mirror"],
];

export function detectRichTrigger(content: string): RichTriggerType | null {
  if (!content) return null;
  for (const [regex, type] of RICH_TRIGGERS) {
    if (regex.test(content)) return type;
  }
  return null;
}

// ── Rock-paper-scissors helpers ─────────────────────────────────────────────

export type RpsThrow = "rock" | "paper" | "scissors";
export const RPS_EMOJI: Record<RpsThrow, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
export const RPS_LABEL: Record<RpsThrow, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

export function randomRpsThrow(): RpsThrow {
  return (["rock", "paper", "scissors"] as RpsThrow[])[Math.floor(Math.random() * 3)];
}

export function rpsOutcome(mine: RpsThrow, opp: RpsThrow): "win" | "lose" | "draw" {
  if (mine === opp) return "draw";
  const beats: Record<RpsThrow, RpsThrow> = { rock: "scissors", paper: "rock", scissors: "paper" };
  return beats[mine] === opp ? "win" : "lose";
}

export function encodeRps(mine: RpsThrow, opp: RpsThrow, outcome: string) { return `${mine}|${opp}|${outcome}`; }
export function decodeRps(s: string): { mine: RpsThrow; opp: RpsThrow; outcome: string } {
  const [mine, opp, outcome] = (s || "rock|rock|draw").split("|");
  return { mine: mine as RpsThrow, opp: opp as RpsThrow, outcome: outcome ?? "draw" };
}

/** Commands surfaced for autocomplete / hints. */
export const SECRET_COMMANDS: { cmd: string; label: string; emoji: string }[] = [
  { cmd: "/flip", label: "Flip a coin", emoji: "🪙" },
  { cmd: "/dice", label: "Roll a dice", emoji: "🎲" },
  { cmd: "/8ball", label: "Ask the magic 8-ball", emoji: "🎱" },
  { cmd: "/lucky", label: "Reveal your lucky number", emoji: "🍀" },
  { cmd: "/rps", label: "Rock · Paper · Scissors", emoji: "✊" },
  { cmd: "/garden", label: "Visit your secret garden", emoji: "🌱" },
  { cmd: "I'm bored", label: "Spin the wheel for a random game", emoji: "🎡" },
];
