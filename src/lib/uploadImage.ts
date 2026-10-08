import { supabase } from "@/integrations/supabase/client";
import { prepareImageUpload, shrinkMediaEnabled, worthCompressing } from "@/lib/imageCompress";

/**
 * uploadImage — one door for every picture that is not a chat attachment
 * (avatars, wallpapers, stickers).
 *
 * It does the three things that must never be forgotten at an upload site:
 *
 *   1. **Shrink first.** A 12 MP phone photo becomes a sensible file before it
 *      ever touches the bucket, exactly as the chat does — unless the person
 *      turned shrinking off in Settings.
 *   2. **Write the preview sibling** (`name.thumb.webp`) so lists can show small
 *      versions and only open full masters when asked.
 *   3. **Give back the public URL**, so the caller carries on as before.
 *
 * The name keeps its extension in step with whatever the encoder produced, so a
 * JPEG that came out as WebP is not stored as a lie.
 */

export interface UploadedImage {
  url: string;
  path: string;
  /** null when the preview was not worth writing. */
  thumbPath: string | null;
  bytes: number;
  originalBytes: number;
  compressed: boolean;
  note: string;
}

export async function uploadImage(
  file: File,
  opts: {
    bucket?: string;
    /** e.g. `avatars` or `wallpapers/<user id>` — no leading or trailing slash. */
    prefix: string;
    /** Long-edge cap for the shrink, e.g. 512 for an avatar. */
    maxDimension?: number;
    /** Constrain the output. `image/png` keeps a sticker's transparency. */
    preferType?: "image/webp" | "image/jpeg" | "image/png";
  },
): Promise<UploadedImage> {
  const bucket = opts.bucket ?? "chat-images";
  const prepared = worthCompressing(file, shrinkMediaEnabled())
    ? await prepareImageUpload(file, {
        ...(opts.maxDimension ? { maxDimension: opts.maxDimension } : {}),
        ...(opts.preferType ? { preferType: opts.preferType } : {}),
      })
    : null;

  const toUpload = prepared?.file ?? file;
  const ext = (toUpload.name.split(".").pop() ?? "webp").toLowerCase();
  const path = `${opts.prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, toUpload);
  if (error) throw new Error(error.message);

  // The small sibling rides along, under a name the app can guess from the URL.
  let thumbPath: string | null = null;
  if (prepared?.thumb) {
    thumbPath = path.replace(/(\.[a-z0-9]+)$/i, ".thumb$1");
    await supabase.storage.from(bucket).upload(thumbPath, prepared.thumb).catch(() => undefined);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
    thumbPath,
    bytes: toUpload.size,
    originalBytes: file.size,
    compressed: prepared?.compressed ?? false,
    note: prepared?.note ?? `kept as is`,
  };
}

export default uploadImage;
