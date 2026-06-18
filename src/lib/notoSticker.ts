/**
 * Map an emoji to its animated Noto-emoji GIF on Google's font CDN — the same
 * source the built-in sticker packs use. Not every emoji has an animated
 * version, so callers should treat a returned URL as best-effort (the <img>
 * onError can hide it).
 */
export function notoAnimatedUrl(emoji: string): string {
  const cps = Array.from(emoji)
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f") // drop variation selector for the path
    .join("_");
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${cps}/512.gif`;
}
