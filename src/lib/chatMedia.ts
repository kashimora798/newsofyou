/**
 * chatMedia.ts — the chat's media, laid out the way a messaging app does it.
 *
 * Three things live here, all pure so they can be tested without a browser:
 *
 *   1. **Album grouping.** Four photos picked at once arrive as four rows in
 *      `messages` (that table is append-only — we never merge them). This module
 *      decides which *consecutive* rows should be drawn as one grid, exactly the
 *      way a messaging app does: same sender, no caption, sent within a few
 *      minutes, nothing in between.
 *   2. **Album layout.** How many tiles, which one spans two rows, where the
 *      "+3" goes. WhatsApp geometry: 2 = side by side, 3 = one tall tile with
 *      two stacked beside it, 4 = 2×2, more = 2×2 with the count on the last.
 *   3. **Attachment details.** The little facts the bubble needs: which storage
 *      path a URL points at, the `.thumb` sibling's name, and the subtitle line
 *      under a document ("2 pages • 1.1 MB • PDF").
 */

import type { Tables } from "@/integrations/supabase/types";
import { humanBytes } from "@/lib/media";

type Msg = Tables<"messages">;

/** Photos sent within this window group together. */
export const ALBUM_GAP_MS = 3 * 60 * 1000;
/** Never draw more than this many tiles; the rest become "+N". */
export const ALBUM_MAX_TILES = 4;
/** A single album can hold at most this many photos. */
export const ALBUM_MAX = 10;

/** Is this message *only* a photo as far as the eye is concerned? */
export function isAlbumable(message: Msg): boolean {
  const type = String(message.message_type ?? "text").toLowerCase();
  if (type !== "image") return false;
  if (!message.image_url) return false;
  if ((message.content ?? "").trim().length > 0) return false; // a caption stands alone
  if (message.reply_to_id) return false; // replying to something is its own bubble
  return true;
}

export type RenderItem =
  | { kind: "message"; key: string; message: Msg }
  | { kind: "album"; key: string; messages: Msg[] };

/**
 * Walk the thread in order and decide what to draw. Groups are *runs*: a text
 * message, a different sender, or a long pause always breaks the run.
 */
export function groupImageAlbums(
  messages: Msg[],
  opts: { max?: number; gapMs?: number } = {},
): RenderItem[] {
  const max = Math.max(2, opts.max ?? ALBUM_MAX);
  const gap = Math.max(0, opts.gapMs ?? ALBUM_GAP_MS);
  const out: RenderItem[] = [];
  let run: Msg[] = [];

  const flush = () => {
    if (run.length === 1) out.push({ kind: "message", key: run[0].id, message: run[0] });
    else if (run.length > 1) out.push({ kind: "album", key: `album-${run[0].id}`, messages: [...run] });
    run = [];
  };

  for (const m of messages) {
    if (!isAlbumable(m)) {
      flush();
      out.push({ kind: "message", key: m.id, message: m });
      continue;
    }

    const prev = run[run.length - 1];
    const dt = prev ? Date.parse(m.created_at ?? "") - Date.parse(prev.created_at ?? "") : 0;
    const closeEnough = !prev || !Number.isFinite(dt) || dt <= gap;

    if (prev && (prev.user_id !== m.user_id || !closeEnough || run.length >= max)) flush();
    run.push(m);
  }

  flush();
  return out;
}

export interface AlbumTile {
  /** Which message in the group this tile shows. */
  index: number;
  /** Grid placement. */
  className: string;
  /** "+3" on the last tile when there are more photos than tiles. */
  overlay?: string;
}

export interface AlbumLayout {
  /** Tailwind grid classes for the cluster. */
  gridClass: string;
  /** The cluster's overall shape. */
  aspectClass: string;
  tiles: AlbumTile[];
  /** Photos that did not fit and are behind the "+N". */
  hidden: number;
}

/** WhatsApp geometry, in one place. */
export function albumLayout(count: number): AlbumLayout {
  const shown = Math.max(1, Math.min(count, ALBUM_MAX_TILES));
  const hidden = Math.max(0, count - shown);

  // 2 photos sit side by side; 3–4 make a square block.
  const gridClass = count >= 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-1";
  const aspectClass = count >= 3 ? "aspect-square" : "aspect-[2/1]";

  const tiles: AlbumTile[] = [];
  for (let i = 0; i < shown; i++) {
    tiles.push({
      index: i,
      // The first photo stretches down when there are exactly three.
      className: count === 3 && i === 0 ? "row-span-2" : "",
      overlay: i === shown - 1 && hidden > 0 ? `+${hidden}` : undefined,
    });
  }

  return { gridClass, aspectClass, tiles, hidden };
}

/** The storage object name behind a public URL — our key for extra details. */
export function attachmentPath(url?: string | null): string | null {
  if (!url) return null;
  const clean = String(url).split("?")[0].split("#")[0];
  const segment = clean.split("/").filter(Boolean).pop();
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `a1b2.webp` → `a1b2.thumb.webp` — the sibling the uploader writes. */
export function thumbPathFor(path: string): string {
  return String(path).replace(/(\.[a-z0-9]+)$/i, ".thumb$1");
}

/** The same URL, pointed at the preview instead of the master. */
export function thumbUrlFor(url: string): string | null {
  if (!/\.(jpe?g|png|webp|avif|gif)$/i.test(url.split("?")[0])) return null;
  return url.replace(/(\.[a-z0-9]+)(\?.*)?$/i, ".thumb$1$2");
}

/** Colour + label for the square on the left of a document card. */
export function documentStyle(fileType: string, fileName: string): { label: string; bg: string; fg: string } {
  const type = String(fileType ?? "").toLowerCase();
  const name = String(fileName ?? "").toLowerCase();

  // The real extension, or nothing at all — never a chopped-up filename.
  const ext = (/\.[a-z0-9]{1,6}$/i.exec(name)?.[0] ?? "").slice(1).toUpperCase();
  const pick = (fallback: string) => ext || fallback;

  const has = (needle: string) => type.includes(needle) || name.endsWith(`.${needle}`);

  if (has("pdf")) return { label: "PDF", bg: "#e8503a", fg: "#fff" };
  if (type.includes("word") || has("doc") || has("docx")) return { label: pick("DOC"), bg: "#2b579a", fg: "#fff" };
  if (type.includes("sheet") || type.includes("excel") || has("csv") || has("xls") || has("xlsx"))
    return { label: pick("XLS"), bg: "#1f7244", fg: "#fff" };
  if (type.includes("presentation") || has("ppt") || has("pptx")) return { label: pick("PPT"), bg: "#c0461f", fg: "#fff" };
  if (has("zip") || has("rar") || has("tar") || type.includes("compress")) return { label: pick("ZIP"), bg: "#8a6d1f", fg: "#fff" };
  if (type.includes("text")) return { label: pick("TXT"), bg: "#4a5568", fg: "#fff" };
  return { label: pick("FILE"), bg: "#5a5f6d", fg: "#fff" };
}

export interface DocumentMetaFacts {
  pages?: number | null;
  bytes?: number | null;
  fileName: string;
  fileType?: string | null;
}

/**
 * "2 pages • 1.1 MB • PDF" — exactly the line under a document in WhatsApp, and
 * only the parts we actually know.
 */
export function documentSubtitle(facts: DocumentMetaFacts): string {
  const parts: string[] = [];
  const pages = Number(facts.pages ?? 0);
  if (Number.isFinite(pages) && pages > 0) parts.push(`${pages} page${pages === 1 ? "" : "s"}`);

  const bytes = Number(facts.bytes ?? 0);
  if (Number.isFinite(bytes) && bytes > 0) parts.push(humanBytes(bytes));

  const label = documentStyle(facts.fileType ?? "", facts.fileName).label;
  if (label && label !== "FILE") parts.push(label);

  return parts.join(" • ") || "file";
}

/** True when the file is a photo the chat should show instead of a card. */
export function isImageFile(fileType?: string | null, fileName?: string | null): boolean {
  const type = String(fileType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(String(fileName ?? ""));
}
