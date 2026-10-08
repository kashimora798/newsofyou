/**
 * media.ts — keeping storage small without losing the picture (Phase 9).
 *
 * Two honest facts, and everything here follows from them:
 *
 *   1. **Pixels can't be invented.** If a photo was shrunk to 800px, the 4000px
 *      original is gone. No amount of later processing brings it back.
 *   2. **Codecs can be swapped.** A 4 MB JPEG re-encoded as WebP at the same
 *      pixel size and *visually identical quality* is usually 300–600 KB. Same
 *      picture, a tenth of the storage. That is the one free lunch available,
 *      and it is what this module spends it on.
 *
 * So the house style is: keep ONE best-trade-off master per photo (long edge
 * capped, modern codec, quality high enough that nobody can tell), plus an
 * optional small preview for grids. The master is what "full quality" opens.
 *
 * Nothing here touches the network — it is DOM-only image maths, so it can be
 * unit-tested with a fake canvas and reused by any upload path.
 */

export interface CompressOptions {
  /** Long edge cap. 2400 keeps a phone photo sharp on any screen. */
  maxDimension?: number;
  /** JPEG/WebP quality for the master. 0.85 is the "nobody can tell" line. */
  quality?: number;
  /** Keep trying lower quality until the file fits this. */
  targetBytes?: number;
  /** Never go below this — a blurry file is worse than a big one. */
  minQuality?: number;
  /** Output mime. WebP wins; Safari < 14 falls back to JPEG automatically. */
  preferType?: "image/webp" | "image/jpeg" | "image/png";
  /** Also produce a grid-sized preview (never used as the master). */
  thumbWidth?: number;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  type: string;
  quality: number;
  /** null when nothing was gained. */
  thumb: { blob: Blob; width: number; height: number; bytes: number } | null;
  originalBytes: number;
  note: string;
}

export const MEDIA_LIMITS = {
  /** Above this, compress before uploading (bytes). */
  compressAboveBytes: 600 * 1024,
  /** Chat buckets have a hard ceiling; stay well under it. */
  maxUploadBytes: 25 * 1024 * 1024,
  /** Images bigger than this are always resized, whatever the setting says. */
  alwaysShrinkAboveBytes: 4 * 1024 * 1024,
  maxDimension: 2400,
  thumbWidth: 480,
  quality: 0.85,
  minQuality: 0.62,
} as const;

const IMAGE_TYPES = /^image\/(jpeg|jpg|png|webp|heic|heif|avif)$/i;

/** Is this something we can actually decode and re-encode? */
export function isCompressibleImage(file: { type?: string; name?: string }): boolean {
  const type = String(file.type ?? "").toLowerCase();
  if (IMAGE_TYPES.test(type)) return true;
  // Some Android browsers send an empty type for camera photos.
  return !type && /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(String(file.name ?? ""));
}

/** GIFs and videos keep their bytes: re-encoding them is a different job. */
export function isPassthrough(file: { type?: string }): boolean {
  const type = String(file.type ?? "").toLowerCase();
  return /^video\//.test(type) || type === "image/gif" || /^audio\//.test(type);
}

/**
 * Decimal units, the way phones and storage dashboards show them: 3.4 MB means
 * 3,400,000 bytes. Matches what a person sees in their gallery, so the "less"
 * in the toast is the same number they can verify.
 */
export function humanBytes(bytes: number): string {
  const b = Number(bytes ?? 0);
  if (b < 1000) return `${b} B`;
  if (b < 1_000_000) return `${Math.round(b / 1000)} KB`;
  return `${(b / 1_000_000).toFixed(b < 10_000_000 ? 1 : 0)} MB`;
}

/** "3.4 MB → 480 KB (86% less)" — what the toast says. */
export function describeSavings(before: number, after: number): string {
  if (!before || after >= before) return `${humanBytes(after)} — already about as small as it gets`;
  const pct = Math.round((1 - after / before) * 100);
  return `${humanBytes(before)} → ${humanBytes(after)} (${pct}% less)`;
}

/** Should this file go through the compressor at all? */
export function shouldCompress(
  file: { type?: string; name?: string; size: number },
  opts: { enabled: boolean; compressAboveBytes?: number; alwaysShrinkAboveBytes?: number } = { enabled: true },
): boolean {
  if (isPassthrough(file)) return false;
  if (!isCompressibleImage(file)) return false;
  if (file.size > (opts.alwaysShrinkAboveBytes ?? MEDIA_LIMITS.alwaysShrinkAboveBytes)) return true;
  return opts.enabled && file.size > (opts.compressAboveBytes ?? MEDIA_LIMITS.compressAboveBytes);
}

/** Fit a width×height into a square cap, keeping the aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; scaled: boolean } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDimension || longEdge === 0) return { width, height, scaled: false };
  const scale = maxDimension / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/**
 * The quality to start at. Small files stay high-quality (no point mangling
 * them); big files start lower so one pass usually lands under the target.
 */
export function startingQuality(originalBytes: number, targetBytes: number, ceiling: number = MEDIA_LIMITS.quality): number {
  if (originalBytes <= targetBytes) return ceiling;
  const overshoot = originalBytes / Math.max(targetBytes, 1);
  // 2× over → ~0.8, 4× → ~0.72, 8× → ~0.66 …
  const estimate = ceiling - Math.log2(Math.max(overshoot, 1)) * 0.06;
  return Math.max(MEDIA_LIMITS.minQuality, Math.min(ceiling, Number(estimate.toFixed(3))));
}

/** Bigger than a preview needs? Then a thumb is worth making. */
export function needsThumb(width: number, thumbWidth: number = MEDIA_LIMITS.thumbWidth): boolean {
  return width > thumbWidth * 1.4;
}

/**
 * Decode → resize → re-encode, lowering quality until the target is met.
 * `encode` and `decode` are injected so this logic is testable without a DOM.
 */
export async function encodeWithinTarget(
  encode: (quality: number) => Promise<Blob | null>,
  opts: { originalBytes: number; targetBytes?: number; minQuality?: number; ceiling?: number } = { originalBytes: 0 },
): Promise<{ blob: Blob; quality: number } | null> {
  const target = opts.targetBytes ?? MEDIA_LIMITS.maxUploadBytes;
  const floor = opts.minQuality ?? MEDIA_LIMITS.minQuality;

  let quality = startingQuality(opts.originalBytes, target, opts.ceiling ?? MEDIA_LIMITS.quality);
  let best: Blob | null = null;
  let bestQuality = quality;

  for (let attempt = 0; attempt < 4; attempt++) {
    const blob = await encode(quality);
    if (!blob) break;
    if (!best || blob.size < best.size) {
      best = blob;
      bestQuality = quality;
    }
    if (blob.size <= target || quality <= floor) break;
    quality = Math.max(floor, Number((quality - 0.08).toFixed(3)));
  }

  return best ? { blob: best, quality: bestQuality } : null;
}

/** Pick the best output type this browser will actually encode. */
export function pickOutputType(canvas: { toDataURL(type?: string): string }, prefer: CompressOptions["preferType"]): string {
  try {
    const probe = canvas.toDataURL(prefer ?? "image/webp");
    if (probe.startsWith("data:image/webp")) return "image/webp";
  } catch {
    /* fall through */
  }
  return "image/jpeg";
}
