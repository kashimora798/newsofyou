// Static content for Phase 2 easter eggs — fortunes, love quotes, the secret
// garden's flower vocabulary, and the planet-sequence unlock. All local, no
// network, no assets.

export const COUPLE_FORTUNES = [
  "A long-awaited message will make you smile today.",
  "The one who reads this is luckier than they know.",
  "Two hearts that beat together never lose their rhythm.",
  "Something you've been waiting to hear is coming soon.",
  "Your patience with each other will be rewarded.",
  "A small surprise will brighten an ordinary day.",
  "The distance between you matters less than you fear.",
  "Laughter shared today becomes a memory tomorrow.",
  "Say the thing you've been holding back — it lands well.",
  "An old inside joke will resurface and warm you both.",
  "Your next adventure together is closer than it appears.",
  "Kindness given freely returns to you doubled.",
  "A quiet evening together is worth more than gold.",
  "The best is yet to come — and you'll meet it side by side.",
  "Trust the feeling; it's pointing you somewhere good.",
];

export const LOVE_QUOTES = [
  "You are my favorite notification. 💕",
  "Every love story is beautiful, but ours is my favorite.",
  "I still get butterflies, and I hope I always will.",
  "Home isn't a place — it's you.",
  "In a sea of people, my eyes will always search for you.",
  "You're the first thing I think of and the last thing I miss.",
  "Loving you is my favorite thing to do.",
  "Wherever you are is where I belong.",
  "You + Me = always.",
  "I'd choose you, in a hundred lifetimes, in any version of reality.",
  "Your hand in mine is my favorite place to be.",
  "You make ordinary moments feel like magic.",
  "I love you more than yesterday, less than tomorrow.",
  "Forever isn't long enough with you.",
];

// Secret garden: keyword → flower. Saying these words "grows" flowers over time.
// Counts are derived from message history (no separate table needed).
export interface GardenFlower {
  key: string;
  emoji: string;
  label: string;
  /** matched against message content (case-insensitive substring). */
  match: string;
}

export const GARDEN_FLOWERS: GardenFlower[] = [
  { key: "love", emoji: "🌹", label: "Roses of Love", match: "love" },
  { key: "miss", emoji: "🌻", label: "Sunflowers of Longing", match: "miss" },
  { key: "happy", emoji: "🌼", label: "Daisies of Joy", match: "happy" },
  { key: "cute", emoji: "🌷", label: "Tulips of Affection", match: "cute" },
  { key: "thank", emoji: "🌸", label: "Blossoms of Gratitude", match: "thank" },
  { key: "sorry", emoji: "🥀", label: "Blooms of Apology", match: "sorry" },
  { key: "beautiful", emoji: "🌺", label: "Hibiscus of Beauty", match: "beautiful" },
  { key: "forever", emoji: "🪷", label: "Lotus of Forever", match: "forever" },
];

// Planet sequence unlock — typing all 8 planets in order (one message) unlocks
// the galaxy theme.
export const PLANETS_IN_ORDER = [
  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
];

export function detectPlanetSequence(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  let cursor = 0;
  for (const planet of PLANETS_IN_ORDER) {
    const idx = lower.indexOf(planet, cursor);
    if (idx === -1) return false;
    cursor = idx + planet.length;
  }
  return true;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Mystery prizes (every 50th message) ─────────────────────────────────────
export const MYSTERY_PRIZES = [
  { emoji: "🎁", title: "Surprise Hug Coupon", note: "Redeemable anytime, no questions asked." },
  { emoji: "🍫", title: "Sweet Treat Token", note: "One dessert, on the house." },
  { emoji: "🎟️", title: "Movie Night Pass", note: "Winner picks the film." },
  { emoji: "💐", title: "Bouquet of Compliments", note: "Expect three nice things today." },
  { emoji: "⭐", title: "Wish Granted", note: "Ask for one small thing — it's yours." },
  { emoji: "☕", title: "Lazy Morning Voucher", note: "Breakfast in bed, you earned it." },
  { emoji: "🎶", title: "Dedicated Song", note: "A track picked just for you." },
];
