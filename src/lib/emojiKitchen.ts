/**
 * Emoji Kitchen via Tenor.
 *
 * Google's merged-emoji ("kitchen") images are exposed through Tenor's public
 * API, which knows every valid pair and the correct CDN URL — no date-code
 * guessing (our hand-maintained map was wrong for most pairs, hence the broken
 * images). We use the same free Tenor key the GIF picker already uses.
 *
 * Endpoint: GET https://tenor.googleapis.com/v2/featured?key=..&contentfilter=high
 *           &media_filter=png_transparent&component=proactive&q=<emojiA>_<emojiB>
 * Returns results whose media_formats.png_transparent.url is the mashup image.
 */

const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";

// Cache resolved pair → url (or null when no mashup exists) for the session.
const cache = new Map<string, string | null>();

function key(a: string, b: string): string {
  return [a, b].sort().join("~");
}

/**
 * Resolve the mashup image URL for two emojis (async). Returns null if Google
 * has no combination for that pair. Cached per session.
 */
export async function fetchMixUrl(a: string, b: string): Promise<string | null> {
  const k = key(a, b);
  if (cache.has(k)) return cache.get(k)!;

  try {
    const url =
      `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}` +
      `&contentfilter=high&media_filter=png_transparent&component=proactive` +
      `&collection=emoji_kitchen_v6&q=${encodeURIComponent(a + "_" + b)}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = (data.results ?? [])[0];
    const img = result?.media_formats?.png_transparent?.url ?? result?.url ?? null;
    cache.set(k, img);
    return img;
  } catch {
    cache.set(k, null);
    return null;
  }
}

/**
 * The emojis offered as mix "bases". Emoji Kitchen supports a huge set, but we
 * surface a curated, broadly-supported list (avoids tofu + keeps the grid sane).
 * Most pairings among these resolve to a real mashup.
 */
export const MIXABLE_BASES = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","😊","🙂","🙃","😉","😍","🥰","😘",
  "😋","😛","😜","🤪","🤨","😎","🥳","😏","😒","😔","😢","😭","😤","😠","😡","🤬",
  "🥺","😱","😨","😰","😳","🤯","😬","🙄","😴","😪","🤤","😷","🤢","🤮","🤧","🥵",
  "🥶","🤠","🤡","👻","💀","👽","🤖","😺","😻","🙀","❤️","🧡","💛","💚","💙","💜",
  "🖤","🤍","💔","❤️‍🔥","💖","💕","💯","🔥","✨","🌟","⭐","🌈","☀️","🌙","⚡","💥",
  "🎉","🎊","🎈","🎁","👍","👎","👌","🙏","👏","🙌","💪","🤝","🌹","🌸","🌺","🌻",
  "🍕","🍔","🍟","🍦","🍩","🍪","🎂","☕","🍺","🍷","🐶","🐱","🦊","🐻","🐼","🦁",
  "🐸","🐵","🦄","🐝","🦋","🍀","🌚","🌝","🎃","💩","🤞","✌️","🤟","🫶","🥹","🫠",
];
