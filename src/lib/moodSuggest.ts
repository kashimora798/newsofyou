/**
 * Local mood detection for the sticker-suggest chip.
 *
 * Instant + offline — no edge call (the old ai-sticker-suggest function 404'd
 * and a network round-trip is the wrong tradeoff for a tiny suggestion chip).
 * Keyword-matches the draft and returns an emotion label + a few emojis.
 */

interface MoodRule {
  emotion: string;
  emojis: string[];
  patterns: RegExp;
}

const RULES: MoodRule[] = [
  { emotion: "laughing", emojis: ["😂", "🤣", "😆"], patterns: /\b(lol|lmao|haha+|hehe|rofl|funny|😂|🤣)\b/i },
  { emotion: "love", emojis: ["❤️", "🥰", "😍"], patterns: /\b(love( you|u)?|luv|ily|miss( you|u)?|❤️|😍|🥰)\b/i },
  { emotion: "kiss", emojis: ["😘", "💋", "🥰"], patterns: /\b(kiss|muah|mwah|😘|💋)\b/i },
  { emotion: "sad", emojis: ["😢", "😭", "🥺"], patterns: /\b(sad|cry|crying|hurt|upset|😢|😭|🥺)\b/i },
  { emotion: "missing you", emojis: ["🥺", "💕", "🫂"], patterns: /\b(miss(ing)?( you| u)?|come back|lonely)\b/i },
  { emotion: "tired", emojis: ["😴", "🥱", "😪"], patterns: /\b(tired|sleepy|exhausted|sleep|goodnight|good night|gn)\b/i },
  { emotion: "morning", emojis: ["🌅", "☀️", "😊"], patterns: /\b(good ?morning|gm|morning)\b/i },
  { emotion: "celebrate", emojis: ["🎉", "🥳", "✨"], patterns: /\b(congrat|congrats|yay|woohoo|celebrate|party|🎉|🥳)\b/i },
  { emotion: "angry", emojis: ["😡", "😤", "🙄"], patterns: /\b(angry|mad|annoyed|ugh|hate|😡|😤)\b/i },
  { emotion: "fire", emojis: ["🔥", "💯", "😎"], patterns: /\b(fire|lit|awesome|amazing|cool|🔥|💯)\b/i },
  { emotion: "thankful", emojis: ["🙏", "🥹", "💖"], patterns: /\b(thank( you| u)?|thanks|thx|grateful|🙏)\b/i },
  { emotion: "sorry", emojis: ["🥺", "🙏", "😔"], patterns: /\b(sorry|apolog|my bad|forgive)\b/i },
  { emotion: "hungry", emojis: ["😋", "🍕", "🤤"], patterns: /\b(hungry|food|eat|pizza|dinner|lunch|🍕|🤤)\b/i },
  { emotion: "excited", emojis: ["🤩", "✨", "😆"], patterns: /\b(excited|can't wait|cant wait|so happy|yess+)\b/i },
];

export interface MoodSuggestion {
  emotion: string;
  emojis: string[];
}

/** Returns a mood suggestion for the draft, or null if nothing strong matches. */
export function detectMood(draft: string): MoodSuggestion | null {
  const text = (draft ?? "").trim();
  if (text.length < 2) return null;
  for (const rule of RULES) {
    if (rule.patterns.test(text)) {
      return { emotion: rule.emotion, emojis: rule.emojis };
    }
  }
  return null;
}
