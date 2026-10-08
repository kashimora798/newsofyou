/**
 * imageCompress.ts — the DOM half of media compression (Phase 9).
 *
 * `media.ts` holds the maths and the rules; this file does the actual decode →
 * draw → encode, using `createImageBitmap` when the browser has it and a plain
 * `<img>` otherwise. Everything happens on the device: no upload, no edge
 * function, no key.
 *
 * What it produces, and why:
 *   - `blob`  the master: long edge capped (2400), WebP when available, quality
 *             walked down only until it fits. This is what the chat shows and
 *             what "view full size" opens. One file, best trade-off.
 *   - `thumb` a 480px grid preview. Optional, never a substitute for the master.
 *
 * It never invents detail: if the original was already small, it is returned
 * untouched (`compressed: false`).
 */

import {
  MEDIA_LIMITS,
  encodeWithinTarget,
  fitWithin,
  humanBytes,
  needsThumb,
  pickOutputType,
  type CompressOptions,
} from "@/lib/media";

export interface PreparedUpload {
  /** What to upload. Same as the input file when nothing was worth doing. */
  file: File;
  /** The small grid preview, when one was made. */
  thumb: File | null;
  compressed: boolean;
  originalBytes: number;
  bytes: number;
  width: number | null;
  height: number | null;
  note: string;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  const anyWindow = window as unknown as { createImageBitmap?: (f: Blob) => Promise<ImageBitmap> };
  if (anyWindow.createImageBitmap) {
    try {
      const bitmap = await anyWindow.createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* HEIC and old browsers land here — fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("could not read that image"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function draw(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/** Filename with a new extension — presigned URLs and storage don't care. */
function renameFor(file: File, type: string, suffix = ""): string {
  const base = (file.name || "photo").replace(/\.[^.]+$/, "");
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return `${base}${suffix}.${ext}`;
}

/**
 * Compress one image for upload. Safe to call on anything: a GIF, a video or a
 * tiny image comes back untouched.
 */
export async function prepareImageUpload(file: File, opts: CompressOptions = {}): Promise<PreparedUpload> {
  const maxDimension = opts.maxDimension ?? MEDIA_LIMITS.maxDimension;
  const targetBytes = opts.targetBytes ?? 1_800_000;
  const untouched: PreparedUpload = {
    file,
    thumb: null,
    compressed: false,
    originalBytes: file.size,
    bytes: file.size,
    width: null,
    height: null,
    note: `kept as is (${humanBytes(file.size)})`,
  };

  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    return untouched; // unreadable here — let the upload try anyway
  }

  try {
    const fit = fitWithin(decoded.width, decoded.height, maxDimension);
    const canvas = draw(decoded.source, fit.width, fit.height);
    const type = pickOutputType(canvas, opts.preferType);

    const encoded = await encodeWithinTarget(
      (quality) => toBlob(canvas, type, quality),
      {
        originalBytes: file.size,
        targetBytes,
        minQuality: opts.minQuality ?? MEDIA_LIMITS.minQuality,
        ceiling: opts.quality ?? MEDIA_LIMITS.quality,
      },
    );

    if (!encoded) return untouched;

    // Nothing gained? Keep the original (a re-encode that is bigger is a loss).
    const worthIt = fit.scaled || encoded.blob.size < file.size * 0.92;
    if (!worthIt) return untouched;

    const master = new File([encoded.blob], renameFor(file, type), { type, lastModified: Date.now() });

    let thumb: File | null = null;
    const thumbWidth = opts.thumbWidth ?? MEDIA_LIMITS.thumbWidth;
    if (needsThumb(fit.width, thumbWidth)) {
      try {
        const thumbFit = fitWithin(fit.width, fit.height, thumbWidth);
        const thumbCanvas = draw(decoded.source, thumbFit.width, thumbFit.height);
        const thumbBlob = await toBlob(thumbCanvas, type, 0.72);
        if (thumbBlob && thumbBlob.size < encoded.blob.size) {
          thumb = new File([thumbBlob], renameFor(file, type, ".thumb"), { type, lastModified: Date.now() });
        }
      } catch {
        /* a missing thumb is fine */
      }
    }

    return {
      file: master,
      thumb,
      compressed: true,
      originalBytes: file.size,
      bytes: master.size,
      width: fit.width,
      height: fit.height,
      note:
        `${humanBytes(file.size)} → ${humanBytes(master.size)}` +
        `${fit.scaled ? `, ${fit.width}×${fit.height}` : ""}` +
        `${thumb ? ` + ${humanBytes(thumb.size)} preview` : ""}`,
    };
  } finally {
    decoded.close?.();
  }
}

/**
 * Would this file benefit? Used to decide whether to bother at all — cheaper
 * than decoding, so it runs on every attachment.
 */
export function worthCompressing(file: File, settingEnabled: boolean): boolean {
  if (/^image\/gif$/i.test(file.type) || /^video\//i.test(file.type)) return false;
  const looksLikeImage = /^image\//i.test(file.type) || (!file.type && /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name));
  if (!looksLikeImage) return false;
  if (file.size > MEDIA_LIMITS.alwaysShrinkAboveBytes) return true;
  return settingEnabled && file.size > MEDIA_LIMITS.compressAboveBytes;
}

/** Relative URL of the grid preview that sits next to a master. */
export function thumbUrlFor(url: string): string {
  return url.replace(/(\.[a-z0-9]+)$/i, ".thumb$1");
}

// ── the setting ───────────────────────────────────────────────────────────
const SETTING_KEY = "noys:shrink-media";

/** On by default: it saves the couple's storage and nobody can see the loss. */
export function shrinkMediaEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SETTING_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setShrinkMedia(enabled: boolean): void {
  try {
    localStorage.setItem(SETTING_KEY, enabled ? "1" : "0");
  } catch {
    /* private mode: the default applies */
  }
}
