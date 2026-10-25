/**
 * Client-side image compression, run before every upload to save storage.
 *
 * Strategy: shrink to a sensible max dimension and re-encode as WebP at a high-ish
 * quality (0.7–0.8). That is visually near-identical on a phone screen but typically
 * 70–90% smaller than a camera JPEG/PNG.
 *
 * Never makes a file bigger: if the result isn't at least ~5% smaller, or anything
 * fails (HEIC, huge image, old browser), the ORIGINAL file is uploaded untouched.
 */

export interface ImagePreset {
  /** Longest side in px. Smaller images are never upscaled. */
  maxDim: number;
  /** 0–1 encoder quality. */
  quality: number;
}

export const IMAGE_PRESETS = {
  /** Photos sent in chat. */
  chat: { maxDim: 1600, quality: 0.7 },
  /** Profile pictures. */
  avatar: { maxDim: 512, quality: 0.8 },
  /** Stickers / touch-reaction art (keeps transparency). */
  sticker: { maxDim: 512, quality: 0.8 },
  /** Chat wallpapers. */
  wallpaper: { maxDim: 1920, quality: 0.65 },
} satisfies Record<string, ImagePreset>;

/** Files under this size aren't worth re-encoding. */
const MIN_BYTES_TO_COMPRESS = 40 * 1024;

/** Formats we never touch: animated (GIF) or vector (SVG). */
const SKIP_TYPES = new Set(["image/gif", "image/svg+xml"]);

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // 'from-image' applies EXIF rotation so phone photos don't come out sideways.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function swapExtension(name: string, ext: string): string {
  const base = name && name.includes(".") ? name.replace(/\.[^.]+$/, "") : name || "image";
  return `${base}.${ext}`;
}

/**
 * Returns a compressed copy of an image, or the original if compression isn't
 * possible / worthwhile. Non-image inputs are returned as-is.
 */
export async function compressImage(file: File | Blob, preset: ImagePreset = IMAGE_PRESETS.chat): Promise<File | Blob> {
  try {
    const type = file.type || "";
    if (!type.startsWith("image/") || SKIP_TYPES.has(type)) return file;
    if (file.size < MIN_BYTES_TO_COMPRESS) return file;

    const { source, width, height, close } = await decode(file);
    try {
      if (!width || !height) return file;

      const scale = Math.min(1, preset.maxDim / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, w, h);

      // WebP first (keeps alpha for stickers). Some older Safari versions silently
      // return PNG for webp requests — detect that and treat it as "unsupported".
      let out = await toBlob(canvas, "image/webp", preset.quality);
      if (out && out.type !== "image/webp") out = null;

      // JPEG fallback only for sources that can't have transparency.
      if (!out && (type === "image/jpeg" || type === "image/jpg")) {
        out = await toBlob(canvas, "image/jpeg", Math.min(0.8, preset.quality + 0.05));
      }

      if (!out || out.size >= file.size * 0.95) return file;

      const ext = out.type === "image/webp" ? "webp" : "jpg";
      const name = "name" in file && (file as File).name ? swapExtension((file as File).name, ext) : `image.${ext}`;
      return new File([out], name, { type: out.type, lastModified: Date.now() });
    } finally {
      close();
    }
  } catch (err) {
    console.warn("[mediaCompression] compression skipped:", err);
    return file;
  }
}

// ─── Audio ─────────────────────────────────────────────────────────────────────

/**
 * Voice-note encoder bitrates (bits/second), passed to MediaRecorder.
 *
 * Voice is mono speech, so Opus at 24 kbps still sounds natural (Opus is built for
 * this) while being ~5x smaller than the browser default. AAC (iOS Safari, mp4)
 * needs a bit more for the same clarity. This only changes the encoder bitrate — it
 * does not touch pitch, speed or add any effect.
 */
export const VOICE_BITRATE = {
  opus: 24_000,
  aac: 32_000,
} as const;

export function voiceBitrateFor(mimeType: string): number {
  return mimeType.includes("mp4") || mimeType.includes("aac") ? VOICE_BITRATE.aac : VOICE_BITRATE.opus;
}
