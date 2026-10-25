/**
 * Single entry point for uploading chat media.
 *
 * ALL new files (images, voice notes, videos, audio, documents, avatars, stickers,
 * wallpapers) go to the dedicated storage project via `storageClient`. Nothing new
 * is written to the original project's storage any more.
 *
 * Existing media is untouched: message rows already hold full public URLs that
 * point at the original project's `chat-images` bucket, so they keep loading.
 */
import { supabase } from "@/integrations/supabase/client";
import { storageClient } from "@/integrations/supabase/storageClient";
import { compressImage, type ImagePreset } from "@/lib/mediaCompression";

/** Buckets that exist on the storage project (see supabase/storage-project/setup.sql). */
export type MediaBucket = "chat-images" | "documents";

/** The ORIGINAL project's bucket, read-only now. Old media lives here. */
export const LEGACY_BUCKET = "chat-images";

export interface UploadOptions {
  /** If set and the file is an image, it is compressed with this preset first. */
  image?: ImagePreset;
  /** Content type to use for non-image blobs (e.g. recorded audio). */
  contentType?: string;
}

export interface UploadResult {
  publicUrl: string | null;
  /** Final object path (extension may change if the image was re-encoded). */
  path: string;
  size: number;
  contentType: string;
  error: Error | null;
}

function swapExt(path: string, ext: string): string {
  return /\.[^./]+$/.test(path) ? path.replace(/\.[^./]+$/, `.${ext}`) : `${path}.${ext}`;
}

export async function uploadMedia(
  bucket: MediaBucket,
  path: string,
  input: File | Blob,
  options: UploadOptions = {},
): Promise<UploadResult> {
  let body: File | Blob = input;
  let finalPath = path;

  if (options.image && input.type.startsWith("image/")) {
    body = await compressImage(input, options.image);
    if (body !== input) {
      finalPath = swapExt(path, body.type === "image/webp" ? "webp" : "jpg");
    }
  }

  // A re-encoded image reports its own type. Otherwise prefer the caller's clean type
  // (e.g. "audio/webm" instead of "audio/webm;codecs=opus").
  const contentType =
    (body !== input ? body.type : options.contentType || body.type) || "application/octet-stream";

  const { error } = await storageClient.storage.from(bucket).upload(finalPath, body, {
    contentType,
    upsert: false,
    // File names are unique per upload, so they can be cached for a year (saves egress too).
    cacheControl: "31536000",
  });

  if (error) {
    return { publicUrl: null, path: finalPath, size: body.size, contentType, error: error as unknown as Error };
  }

  const { data } = storageClient.storage.from(bucket).getPublicUrl(finalPath);
  return { publicUrl: data.publicUrl, path: finalPath, size: body.size, contentType, error: null };
}

/**
 * Turns a stored media value into a loadable URL.
 *  - Full URLs (http/https/blob/data) are returned unchanged — this is every
 *    existing message, and it keeps pointing at the original storage.
 *  - A bare path like "avatars/abc.png" is resolved from the original project's
 *    `chat-images` bucket.
 */
export function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  return supabase.storage.from(LEGACY_BUCKET).getPublicUrl(value).data.publicUrl;
}
