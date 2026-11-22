import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { check1111OnSend, checkJinx, markTimeTraveler } from "@/hooks/useSecretAchievements";
import { uploadMedia } from "@/lib/mediaStorage";
import { IMAGE_PRESETS } from "@/lib/mediaCompression";
import { toast } from "@/hooks/use-toast";

type Message = Tables<"messages">;

const PAGE_SIZE = 50;

const URL_REGEX = /https?:\/\/[^\s]+/;

const isTemp = (id: string) => id.startsWith("tmp_");
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(36).slice(2)}`);
/** Only these show up instantly (optimistic). Special effects wait for the server. */
const OPTIMISTIC_TYPES = new Set(["text", "gif", "sticker"]);

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// Explicit column list — avoids shipping unused columns x50 rows on every fetch.
const MESSAGE_COLUMNS =
  "id, user_id, username, content, message_type, created_at, " +
  "seen, seen_at, delivered, delivered_at, read_at, status, revealed, is_memory, " +
  "reply_to_id, emoji, image_url, video, vidUrl, " +
  "file_url, file_name, file_type, file_size, gif_url, sticker_url, duration, " +
  "link_title, link_description, link_image, link_target_url, link_preview_active, use_handwriting_font";

async function fetchAndStoreLinkPreview(messageId: string, url: string) {
  try {
    const { data } = await supabase.functions.invoke("fetch-link-preview", {
      body: { url },
    });
    if (data?.title) {
      await supabase
        .from("messages")
        .update({
          link_title: data.title,
          link_description: data.description,
          link_image: data.image,
          link_target_url: url,
          link_preview_active: true,
        } as any)
        .eq("id", messageId);
    }
  } catch {}
}

export function useMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const sorted = (data as unknown as Message[]).reverse();
      setMessages(sorted);
      oldestRef.current = sorted[0]?.created_at ?? null;
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!oldestRef.current || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .order("created_at", { ascending: false })
      // `lte` (not `lt`): photos sent as an album share one created_at, so a strict `lt`
      // could skip the rest of an album sitting on a page boundary. Duplicates are dropped below.
      .lte("created_at", oldestRef.current)
      .limit(PAGE_SIZE);

    const known = new Set(messagesRef.current.map(m => m.id));
    const fresh = data ? (data as unknown as Message[]).filter(m => !known.has(m.id)) : [];

    if (fresh.length > 0) {
      const sorted = fresh.reverse();
      oldestRef.current = sorted[0]?.created_at ?? oldestRef.current;
      setMessages(prev => [...sorted, ...prev]);
      if ((data?.length ?? 0) < PAGE_SIZE) {
        setHasMore(false);
        // Secret achievement: Time Traveler - reached the very first messages
        if (userId) markTimeTraveler(userId);
      }
    } else {
      setHasMore(false);
      if (userId) markTimeTraveler(userId);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, userId]);

  const VALID_COLUMNS = useRef(new Set([
    "user_id", "username", "content", "message_type", "reply_to_id",
    "file_url", "file_name", "file_type", "file_size", "duration",
    "image_url", "video", "vidUrl", "gif_url", "sticker_url",
    "revealed", "is_memory", "emoji", "link_title", "link_description",
    "link_image", "link_target_url", "link_preview_active", "status",
    "use_handwriting_font", "created_at",
  ])).current;

  /** A not-yet-confirmed local copy of a message. */
  const makeTemp = (row: Record<string, any>, offsetMs = 0): Message => ({
    id: `tmp_${uid()}`,
    created_at: new Date(Date.now() + offsetMs).toISOString(),
    seen: false, seen_at: null, delivered: false, delivered_at: null, read_at: null,
    content: null, message_type: "text", status: "sending",
    ...row,
  } as unknown as Message);

  /** Swap a temp row for the confirmed row (or just drop the temp if realtime already delivered it). */
  const settleTemp = (tempIds: string[], real: Message[]) => {
    setMessages(prev => {
      const have = new Set(prev.map(m => m.id));
      const toAdd = real.filter(r => !have.has(r.id));
      const out: Message[] = [];
      let placed = false;
      for (const m of prev) {
        if (tempIds.includes(m.id)) {
          if (!placed) { out.push(...toAdd); placed = true; }
        } else {
          out.push(m);
        }
      }
      if (!placed) out.push(...toAdd);
      return out;
    });
  };

  const dropTemps = (tempIds: string[]) => {
    setMessages(prev => prev.filter(m => {
      if (!tempIds.includes(m.id)) return true;
      const url = (m as any).image_url as string | null;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      return false;
    }));
  };

  const sendMessage = useCallback(async (content: string, username: string, extras?: Partial<Message> & Record<string, any>) => {
    if (!userId) return;

    const rawData: any = {
      content: content || null,
      user_id: userId,
      username,
      ...extras,
    };

    const msgData: any = {};
    for (const key of Object.keys(rawData)) {
      if (VALID_COLUMNS.has(key)) {
        msgData[key] = rawData[key];
      }
    }

    // ⚡ Optimistic: plain messages appear instantly, the network round-trip happens behind them.
    const optimistic = OPTIMISTIC_TYPES.has(msgData.message_type ?? "text");
    const temp = optimistic ? makeTemp(msgData) : null;
    if (temp) setMessages(prev => [...prev, temp]);

    const { data, error } = await supabase.from("messages").insert(msgData).select().single();
    if (error) {
      console.error("[useMessages] sendMessage insert error:", error);
      if (temp) dropTemps([temp.id]);
      return error;
    }

    if (data) {
      // Secret achievement: 11:11
      check1111OnSend(userId);

      // Secret achievement: Jinx detection (run before updating state)
      if (content) {
        const last10 = messagesRef.current.filter(m => !isTemp(m.id)).slice(-10);
        checkJinx(userId, content, data.created_at ?? new Date().toISOString(), last10);
      }

      if (temp) {
        settleTemp([temp.id], [data as Message]);
      } else {
        setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]));
      }

      // Auto-detect links and fetch preview
      if (content) {
        const urlMatch = content.match(URL_REGEX);
        if (urlMatch) {
          fetchAndStoreLinkPreview(data.id, urlMatch[0]);
        }
      }
    }

    return error;
  }, [userId]);

  /**
   * Send one or more photos. Previews show instantly (local blob URLs, "sending"
   * clock), uploads run 3-at-a-time in parallel with client-side compression, then
   * everything is stored with ONE insert. 2+ photos get an album tag so both chats
   * stack them into a single WhatsApp-style grid.
   */
  const sendImages = useCallback(async (
    files: File[],
    caption: string,
    username: string,
    extras?: Record<string, any>,
  ) => {
    if (!userId || files.length === 0) return null;

    const albumId = files.length > 1 ? uid() : null;
    const baseExtras: Record<string, any> = {};
    for (const k of Object.keys(extras ?? {})) if (VALID_COLUMNS.has(k)) baseExtras[k] = (extras as any)[k];

    const temps = files.map((f, i) =>
      makeTemp({
        ...baseExtras,
        user_id: userId,
        username,
        message_type: "image",
        image_url: URL.createObjectURL(f),
        content: i === files.length - 1 ? caption || null : null,
        emoji: albumId ? { album: albumId, i, n: files.length } : null,
        reply_to_id: i === files.length - 1 ? baseExtras.reply_to_id ?? null : null,
      }, i)
    );
    setMessages(prev => [...prev, ...temps]);

    const stamp = Date.now();
    const uploads = await mapLimit(files, 3, async (file, i) => {
      const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${stamp}_${i}_${Math.random().toString(36).slice(2)}.${ext}`;
      return uploadMedia("chat-images", path, file, { image: IMAGE_PRESETS.chat });
    });

    const ok = uploads
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => !u.error && u.publicUrl);

    if (ok.length === 0) {
      dropTemps(temps.map(t => t.id));
      const err = uploads[0]?.error ?? new Error("Upload failed");
      toast({ title: "Couldn't send photos", description: err.message, variant: "destructive" });
      return err;
    }
    if (ok.length < files.length) {
      toast({ title: `${files.length - ok.length} photo(s) failed to upload`, variant: "destructive" });
    }

    const n = ok.length;
    const album = n > 1 ? (albumId ?? uid()) : null;
    const rows = ok.map(({ u }, idx) => ({
      ...baseExtras,
      user_id: userId,
      username,
      message_type: "image",
      image_url: u.publicUrl,
      content: idx === n - 1 ? caption || null : null,
      emoji: album ? { album, i: idx, n } : null,
      reply_to_id: idx === n - 1 ? baseExtras.reply_to_id ?? null : null,
    }));

    const { data, error } = await supabase.from("messages").insert(rows as any).select();
    if (error || !data) {
      console.error("[useMessages] sendImages insert error:", error);
      dropTemps(temps.map(t => t.id));
      toast({ title: "Couldn't send photos", description: error?.message, variant: "destructive" });
      return error ?? new Error("insert failed");
    }

    temps.forEach(t => { const u = (t as any).image_url as string; if (u?.startsWith("blob:")) URL.revokeObjectURL(u); });
    settleTemp(temps.map(t => t.id), data as unknown as Message[]);
    check1111OnSend(userId);
    return null;
  }, [userId]);

  // Keep messagesRef in sync for polling
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Track unseen message IDs for polling without nesting setMessages
  const unseenIdsRef = useRef<string[]>([]);

  // Keep unseenIdsRef in sync
  useEffect(() => {
    unseenIdsRef.current = messages
      .filter(m => m.user_id === userId && !m.seen && !isTemp(m.id))
      .map(m => m.id);
  }, [messages, userId]);

  useEffect(() => {
    if (!userId) return;
    fetchMessages();

    // Single catch-up pass: pull anything realtime would have delivered.
    // Runs once on reconnect and on each fallback-poll tick (only while disconnected).
    const catchUp = async () => {
      const lastMsg = [...messagesRef.current].reverse().find(m => !isTemp(m.id));
      if (lastMsg?.created_at) {
        const { data } = await supabase
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .gte("created_at", lastMsg.created_at)
          .order("created_at", { ascending: true })
          .limit(50);
        if (data && data.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = (data as unknown as Message[]).filter(m => !existingIds.has(m.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
      }

      // Sync seen/delivered for our recently-sent, still-unseen messages.
      const ids = unseenIdsRef.current.slice(-20);
      if (ids.length > 0) {
        const { data } = await supabase
          .from("messages")
          .select("id, seen, seen_at, delivered, delivered_at")
          .in("id", ids);
        if (data && data.length > 0) {
          setMessages(curr =>
            curr.map(m => {
              const updated = data.find(d => d.id === m.id);
              if (updated && (updated.seen !== m.seen || updated.delivered !== m.delivered)) {
                return { ...m, ...updated };
              }
              return m;
            })
          );
        }
      }
    };

    // Fallback poll only runs while realtime is NOT connected.
    let fallbackPoll: ReturnType<typeof setInterval> | null = null;
    const startFallback = () => {
      if (fallbackPoll) return;
      catchUp(); // immediate catch-up on disconnect
      fallbackPoll = setInterval(catchUp, 4000);
    };
    const stopFallback = () => {
      if (fallbackPoll) {
        clearInterval(fallbackPoll);
        fallbackPoll = null;
      }
    };

    let channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.message_type === "letter" && newMsg.user_id !== userId) {
          try {
            const saved = JSON.parse(localStorage.getItem("saved_letters") || "[]");
            const deleted = JSON.parse(localStorage.getItem("deleted_letter_ids") || "[]");
            if (!deleted.includes(newMsg.id) && !saved.some((s: any) => s.messageId === newMsg.id)) {
              const extras = (newMsg as any).emoji as any;
              saved.unshift({
                messageId: newMsg.id,
                content: newMsg.content,
                savedAt: newMsg.created_at,
                senderName: newMsg.username || "Partner",
                paperIdx: extras?.letter_paper ?? 0,
                fontIdx: extras?.letter_font ?? 0,
                inkColor: extras?.letter_ink ?? null,
                decorations: extras?.letter_decorations ?? false,
              });
              localStorage.setItem("saved_letters", JSON.stringify(saved));
            }
          } catch {}
        }
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          // Our own optimistic copy arrives back via realtime — swap it in place, don't duplicate.
          if (newMsg.user_id === userId) {
            // Photos: sendImages() settles them itself (one clean swap, no flicker).
            if (newMsg.message_type === "image" && prev.some(m => isTemp(m.id) && m.message_type === "image")) return prev;
            const idx = prev.findIndex(m =>
              isTemp(m.id) &&
              (m.content ?? null) === (newMsg.content ?? null) &&
              (m.message_type ?? "text") === (newMsg.message_type ?? "text") &&
              ((m as any).gif_url ?? null) === ((newMsg as any).gif_url ?? null) &&
              ((m as any).sticker_url ?? null) === ((newMsg as any).sticker_url ?? null) &&
              (m.message_type !== "image")
            );
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = newMsg;
              return copy;
            }
          }
          return [...prev, newMsg];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe((status) => {
        // Realtime healthy -> no polling. Realtime down -> poll as a safety net.
        if (status === "SUBSCRIBED") {
          stopFallback();
          catchUp(); // close any gap that opened during (re)connection
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallback();
        }
      });

    return () => {
      supabase.removeChannel(channel);
      stopFallback();
    };
  }, [userId, fetchMessages]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, sendImages };
}
