import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;

/**
 * WhatsApp-style photo albums.
 *
 * Several photos sent together are stored as ordinary `image` rows (so old
 * clients, search, media panel etc. keep working) that share an album tag kept
 * in the existing `messages.emoji` JSON column — no schema change needed:
 *   emoji = { album: "<id>", i: <index>, n: <total> }
 * The UI folds consecutive rows with the same album id into ONE bubble.
 */
export interface AlbumMeta {
  album: string;
  i: number;
  n: number;
}

export function getAlbumMeta(m: Pick<Message, "emoji" | "message_type">): AlbumMeta | null {
  if (m.message_type !== "image") return null;
  const e = m.emoji as unknown;
  if (e && typeof e === "object" && !Array.isArray(e) && typeof (e as AlbumMeta).album === "string") {
    return e as AlbumMeta;
  }
  return null;
}

export type ChatItem =
  | { kind: "single"; key: string; message: Message }
  | { kind: "album"; key: string; messages: Message[]; /** the row that carries caption / status */ last: Message };

export function groupMessages(messages: Message[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const m of messages) {
    const meta = getAlbumMeta(m);
    const prev = items[items.length - 1];
    if (meta && prev?.kind === "album") {
      const prevMeta = getAlbumMeta(prev.messages[0]);
      if (prevMeta?.album === meta.album && prev.messages[0].user_id === m.user_id) {
        prev.messages.push(m);
        prev.messages.sort((a, b) => (getAlbumMeta(a)?.i ?? 0) - (getAlbumMeta(b)?.i ?? 0));
        prev.last = prev.messages[prev.messages.length - 1];
        continue;
      }
    }
    if (meta) {
      items.push({ kind: "album", key: `album-${meta.album}`, messages: [m], last: m });
    } else {
      items.push({ kind: "single", key: m.id, message: m });
    }
  }
  return items;
}

/** Emoji-only text ("😂", "❤️❤️") — rendered jumbo like WhatsApp. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|\s)+$/u;

export function jumboEmojiCount(text: string | null | undefined): number {
  if (!text) return 0;
  const t = text.trim();
  if (!t || t.length > 40 || !EMOJI_ONLY.test(t)) return 0;
  const seg = (Intl as any).Segmenter
    ? Array.from(new (Intl as any).Segmenter(undefined, { granularity: "grapheme" }).segment(t)).filter(
        (s: any) => s.segment.trim()
      ).length
    : Array.from(t.replace(/\s/g, "")).length;
  return seg >= 1 && seg <= 3 ? seg : 0;
}
