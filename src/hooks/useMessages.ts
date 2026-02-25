import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { check1111OnSend, checkJinx, markTimeTraveler } from "@/hooks/useSecretAchievements";

type Message = Tables<"messages">;

const PAGE_SIZE = 50;

const URL_REGEX = /https?:\/\/[^\s]+/;

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

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      const sorted = data.reverse();
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
      .select("*")
      .order("created_at", { ascending: false })
      .lt("created_at", oldestRef.current)
      .limit(PAGE_SIZE);

    if (data && data.length > 0) {
      const sorted = data.reverse();
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
    
    const msgData: any = {
      content: content || null,
      user_id: userId,
      username,
      ...extras,
    };

    const { data, error } = await supabase.from("messages").insert(msgData).select().single();

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

    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const newMsg = payload.new as Message;
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
        console.log("Realtime subscription status:", status);
      });

    // Polling fallback for seen/delivered status every 3s
    const statusPoll = setInterval(async () => {
      const ids = unseenIdsRef.current.slice(-20);
      if (ids.length === 0) return;

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
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusPoll);
    };
  }, [userId, fetchMessages]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage };
}
