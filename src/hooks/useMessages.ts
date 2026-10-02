import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { check1111OnSend, checkJinx, markTimeTraveler } from "@/hooks/useSecretAchievements";

type Message = Tables<"messages">;

const PAGE_SIZE = 50;

const URL_REGEX = /https?:\/\/[^\s]+/;

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
      .lt("created_at", oldestRef.current)
      .limit(PAGE_SIZE);

    if (data && data.length > 0) {
      const sorted = (data as unknown as Message[]).reverse();
      oldestRef.current = sorted[0]?.created_at ?? oldestRef.current;
      setMessages(prev => [...sorted, ...prev]);
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
        // Secret achievement: Time Traveler - reached the very first messages
        if (userId) markTimeTraveler(userId);
      } else {
        setHasMore(data.length === PAGE_SIZE);
      }
    } else {
      setHasMore(false);
      if (userId) markTimeTraveler(userId);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, userId]);

  const sendMessage = useCallback(async (content: string, username: string, extras?: Partial<Message> & Record<string, any>) => {
    if (!userId) return;

    const validColumns = new Set([
      "user_id", "username", "content", "message_type", "reply_to_id",
      "file_url", "file_name", "file_type", "file_size", "duration",
      "image_url", "video", "vidUrl", "gif_url", "sticker_url",
      "revealed", "is_memory", "emoji", "link_title", "link_description",
      "link_image", "link_target_url", "link_preview_active", "status",
      "use_handwriting_font"
    ]);

    const rawData: any = {
      content: content || null,
      user_id: userId,
      username,
      ...extras,
    };

    const msgData: any = {};
    for (const key of Object.keys(rawData)) {
      if (validColumns.has(key)) {
        msgData[key] = rawData[key];
      }
    }

    const { data, error } = await supabase.from("messages").insert(msgData).select().single();
    if (error) {
      console.error("[useMessages] sendMessage insert error:", error);
    }

    // Optimistically add sent message to local state so it appears immediately
    if (!error && data) {
      // Secret achievement: 11:11
      check1111OnSend(userId);

      // Secret achievement: Jinx detection (run before updating state)
      if (content) {
        const last10 = messages.slice(-10);
        checkJinx(userId, content, data.created_at ?? new Date().toISOString(), last10);
      }

      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });

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

  // Keep messagesRef in sync for polling
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Track unseen message IDs for polling without nesting setMessages
  const unseenIdsRef = useRef<string[]>([]);

  // Keep unseenIdsRef in sync
  useEffect(() => {
    unseenIdsRef.current = messages
      .filter(m => m.user_id === userId && !m.seen)
      .map(m => m.id);
  }, [messages, userId]);

  useEffect(() => {
    if (!userId) return;
    fetchMessages();

    // Single catch-up pass: pull anything realtime would have delivered.
    // Runs once on reconnect and on each fallback-poll tick (only while disconnected).
    const catchUp = async () => {
      const lastMsg = messagesRef.current[messagesRef.current.length - 1];
      if (lastMsg?.created_at) {
        const { data } = await supabase
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .gt("created_at", lastMsg.created_at)
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

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage };
}
