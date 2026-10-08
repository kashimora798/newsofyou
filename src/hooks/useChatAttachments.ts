import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { attachmentPath } from "@/lib/chatMedia";

/**
 * useChatAttachments — the extra facts a media bubble shows (width, height,
 * page count, the preview sibling).
 *
 * `messages` is never modified: everything here is keyed by the storage object
 * name that is already inside each URL, so a bubble can look up its own details
 * with one round trip for the whole visible window.
 */

export interface ChatAttachment {
  path: string;
  kind: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  pages: number | null;
  duration: number | null;
  thumb_path: string | null;
}

/** Save what we learned about an upload. Failures are silent by design. */
export async function saveChatAttachment(input: {
  path: string;
  kind?: "image" | "video" | "audio" | "document";
  mime?: string | null;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
  pages?: number | null;
  duration?: number | null;
  thumbPath?: string | null;
}): Promise<void> {
  try {
    await (supabase.rpc as any)("chat_attachment_save", {
      p_path: input.path,
      p_kind: input.kind ?? "image",
      p_mime: input.mime ?? null,
      p_bytes: input.bytes ?? null,
      p_width: input.width ?? null,
      p_height: input.height ?? null,
      p_pages: input.pages ?? null,
      p_duration: input.duration ?? null,
      p_thumb_path: input.thumbPath ?? null,
    });
  } catch {
    /* the bubble simply shows a little less */
  }
}

export function useChatAttachments(urls: (string | null | undefined)[]) {
  const [byPath, setByPath] = useState<Record<string, ChatAttachment>>({});
  const loaded = useRef<Set<string>>(new Set());

  // Only ask for paths we have never seen; a long thread does not re-fetch.
  const wanted = useMemo(() => {
    const paths = new Set<string>();
    for (const url of urls) {
      const path = attachmentPath(url);
      if (path && !loaded.current.has(path)) paths.add(path);
    }
    return Array.from(paths).sort();
  }, [urls]);

  const key = wanted.join("|");

  const load = useCallback(async () => {
    if (wanted.length === 0) return;
    const { data, error } = await (supabase.rpc as any)("chat_attachments_for", { p_paths: wanted });
    if (error) return;
    const rows = (data ?? []) as ChatAttachment[];
    for (const p of wanted) loaded.current.add(p);
    if (rows.length === 0) return;
    setByPath((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.path] = row;
      return next;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const forUrl = useCallback(
    (url?: string | null): ChatAttachment | null => {
      const path = attachmentPath(url);
      return path ? byPath[path] ?? null : null;
    },
    [byPath],
  );

  return { byPath, forUrl, refresh: load };
}
