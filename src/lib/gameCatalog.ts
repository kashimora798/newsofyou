import {
  Grid3X3, BookOpen, HelpCircle, LayoutGrid, PenTool, Zap, Calculator,
  Palette, Brain, Sparkles, Film, Smile, Search, Scale, Target,
  Thermometer, CheckSquare, MessageSquare, Type, Scroll, Image,
  AlertCircle, Hash, Flame, ListOrdered
} from "lucide-react";

export type GameCategory = "quick" | "classic";

export interface GameDef {
  type: string;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  category: GameCategory;
  /** rough round/match length, for the "~30s" badge */
  avgSeconds: number;
  /** live = both players must be on-screen at once (uses DuelShell / SimulShell / custom) */
  live?: boolean;
  /** beta games are hidden from the lobby until verified (Phase B) */
  status: "ready" | "beta";
}

// Single source of truth for every game — used by the lobby, ActiveGameCard
// labels, and the game loader.
export const GAME_CATALOG: GameDef[] = [
  // ⚡ 30-Second (live) games
  { type: "tap_duel", label: "Tap Duel", blurb: "Tap the instant the screen turns green.", icon: Zap, category: "quick", avgSeconds: 20, live: true, status: "ready" },
  { type: "color_clash", label: "Color Clash", blurb: "Tap the ink color, not the word. Tricky!", icon: Palette, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "math_sprint", label: "Math Sprint", blurb: "Fastest correct answer wins each round.", icon: Calculator, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "quiz_buzzer", label: "Quiz Buzzer", blurb: "Buzz in first with the right answer.", icon: Brain, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "memory_race", label: "Memory Race", blurb: "Race to clear all the matching pairs.", icon: Sparkles, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "emoji_riddle", label: "Emoji Riddle", blurb: "Guess the movie from the emojis fastest.", icon: Film, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "emoji_reflex", label: "Emoji Reflex", blurb: "Type the displayed emoji name fastest.", icon: Smile, category: "quick", avgSeconds: 25, live: true, status: "ready" },
  { type: "odd_one_out", label: "Odd One Out", blurb: "Spot what doesn't belong, fastest.", icon: Search, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "this_or_that", label: "This or That", blurb: "Pick fast — see how in-sync you are.", icon: Scale, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "number_ninja", label: "Number Ninja", blurb: "Pick secretly, closest to the magic number wins.", icon: Target, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "hot_cold", label: "Hot or Cold", blurb: "Guess the secret number with hot/cold feedback.", icon: Thermometer, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "true_false_blitz", label: "True or False", blurb: "Speed true/false quiz with BTS & pop culture.", icon: CheckSquare, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "word_blurt", label: "Word Blurt", blurb: "Type as many words in a category in 20 seconds.", icon: MessageSquare, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "wordle_duel", label: "Wordle Duel", blurb: "Solve the same 5-letter word in a race.", icon: Type, category: "quick", avgSeconds: 60, live: true, status: "ready" },
  { type: "caption_this", label: "Caption This", blurb: "Write a funny caption for stock photos and vote.", icon: Image, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "wrong_answers_only", label: "Wrong Answers", blurb: "Type funniest wrong answers judged by sassy AI.", icon: AlertCircle, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "sudoku_speedrun", label: "Sudoku Speedrun", blurb: "Race to solve a mini 4x4 Sudoku grid.", icon: Hash, category: "quick", avgSeconds: 60, live: true, status: "ready" },
  { type: "this_or_that_rapid", label: "Rapid Fire", blurb: "15 rapid-fire compatibility choices in 30 seconds.", icon: Flame, category: "quick", avgSeconds: 30, live: true, status: "ready" },
  { type: "memory_matrix", label: "Memory Matrix", blurb: "Grid memory test — recreate flashing tiles.", icon: LayoutGrid, category: "quick", avgSeconds: 40, live: true, status: "ready" },
  { type: "alphabet_sprint", label: "Alphabet Sprint", blurb: "A-Z back-and-forth category naming race.", icon: ListOrdered, category: "quick", avgSeconds: 60, live: true, status: "ready" },

  // ♟️ Classic / turn-based games
  { type: "tic_tac_toe", label: "Tic Tac Toe", blurb: "Classic 3×3 — first to three in a row.", icon: Grid3X3, category: "classic", avgSeconds: 120, status: "ready" },
  { type: "word_chain", label: "Word Chain", blurb: "Each word starts with the last letter.", icon: BookOpen, category: "classic", avgSeconds: 180, status: "ready" },
  { type: "hangman", label: "Hangman", blurb: "Set a word and let them guess it.", icon: HelpCircle, category: "classic", avgSeconds: 180, status: "ready" },
  { type: "bingo", label: "Bingo", blurb: "Fill your grid, call numbers, race to lines.", icon: LayoutGrid, category: "classic", avgSeconds: 300, status: "ready" },
  { type: "quick_draw", label: "Quick Draw", blurb: "Draw a word, your partner guesses it.", icon: PenTool, category: "classic", avgSeconds: 240, status: "ready" },
  { type: "story_battle", label: "Story Battle", blurb: "Cooperative line-by-line story writing.", icon: Scroll, category: "classic", avgSeconds: 180, status: "ready" },
  { type: "emoji_story", label: "Emoji Story", blurb: "Co-op emoji puzzles or classic turn guess.", icon: Smile, category: "classic", avgSeconds: 120, status: "ready" },
];

export const GAME_BY_TYPE: Record<string, GameDef> = Object.fromEntries(
  GAME_CATALOG.map((g) => [g.type, g]),
);

export const GAME_LABELS: Record<string, string> = Object.fromEntries(
  GAME_CATALOG.map((g) => [g.type, g.label]),
);

export function gamesByCategory(category: GameCategory): GameDef[] {
  return GAME_CATALOG.filter((g) => g.category === category && g.status === "ready");
}

/** Live game types — used to decide rendering/labels. */
export const LIVE_GAME_TYPES = new Set(GAME_CATALOG.filter((g) => g.live).map((g) => g.type));
