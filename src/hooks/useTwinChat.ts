import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useTwinChat — her private chat with the twin (build-plan Phase 4).
 *
 * The twin answers in HIS voice but is always labelled as an AI (hard rule #7).
 * Threads are private to her at birth; sharing one with him is an explicit,
 * per-thread toggle (`twin_conversation_set_visibility`).
 *
 * All the thinking happens in the `twin-reply` edge function; this hook only
 * reads and writes through the guarded RPCs, so the browser never sees a key.
 */

export interface TwinConversation {
  id: number;
  title: string;
  visibility: "private" | "shared";
  msg_count: number;
  last_active_at: string | null;
  preview: string | null;
}

export interface TwinMessage {
  id: number;
  role: "partner" | "twin" | string;
  content: string;
  mood: string | null;
  actions: { type: string; [k: string]: unknown }[] | null;
  guarded: boolean;
  created_at: string;
}

/** A note the twin sent in his place while he was away (never a real message). */
export interface TwinAutoReply {
  id: number;
  text: string;
  mood: string | null;
  created_at: string | null;
  seen_at: string | null;
  status: string;
  reply_to_message_id: string | null;
}

export interface TwinConfigLite {
  owner_user_id: string;
  partner_user_id: string;
  owner_name: string;
  partner_name: string;
  partner_consented_at: string | null;
  twin_enabled: boolean;
  twin_chat_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_after_minutes: number;
  auto_reply_max_per_day: number;
  auto_reply_min_gap_minutes: number;
  timezone: string;
}

const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export function useTwinChat() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TwinConfigLite | null>(null);
  const [conversations, setConversations] = useState<TwinConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TwinMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = Boolean(user && config && user.id === config.owner_user_id);
  const isPartner = Boolean(user && config && user.id === config.partner_user_id);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const refreshList = useCallback(async () => {
    const { data, error: err } = await rpc("twin_conversation_list", { p_limit: 40 });
    if (err) {
      setError(err.message as string);
      return;
    }
    setConversations((data ?? []) as TwinConversation[]);
  }, []);

  const loadThread = useCallback(async (id: number) => {
    setLoadingThread(true);
    const { data, error: err } = await rpc("twin_conversation_messages", { p_conversation: id, p_limit: 60 });
    if (err) setError(err.message as string);
    else setMessages((data ?? []) as TwinMessage[]);
    setLoadingThread(false);
  }, []);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: cfg } = await (supabase as any)
        .from("twin_config")
        .select(
          "owner_user_id, partner_user_id, owner_name, partner_name, partner_consented_at, twin_enabled, twin_chat_enabled, auto_reply_enabled, auto_reply_after_minutes, auto_reply_max_per_day, auto_reply_min_gap_minutes, timezone",
        )
        .eq("id", 1)
        .maybeSingle();
      setConfig((cfg as TwinConfigLite) ?? null);
      await refreshList();
    } finally {
      setLoading(false);
    }
  }, [refreshList, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Opening the most recent thread keeps the page from ever being an empty box.
  useEffect(() => {
    if (activeId === null && conversations.length > 0) {
      const first = conversations[0].id;
      setActiveId(first);
      void loadThread(first);
    }
  }, [activeId, conversations, loadThread]);

  const open = useCallback(
    async (id: number) => {
      setActiveId(id);
      setError(null);
      await loadThread(id);
    },
    [loadThread],
  );

  const newChat = useCallback(async () => {
    const { data, error: err } = await rpc("twin_conversation_create", { p_title: null });
    if (err) {
      setError(err.message as string);
      return null;
    }
    const created = data as { id: number };
    setMessages([]);
    setActiveId(created.id);
    await refreshList();
    return created.id;
  }, [refreshList]);

  /**
   * Sends her line and waits for the twin. Her message is stored server-side
   * before the model is called, so a failure never eats what she wrote.
   */
  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || sending) return;
      setSending(true);
      setError(null);

      let conversationId = activeId;
      const optimisticId = -Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "partner",
          content: body,
          mood: null,
          actions: null,
          guarded: false,
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        const { data, error: err } = await supabase.functions.invoke("twin-reply", {
          body: conversationId ? { conversation_id: conversationId, text: body } : { text: body },
        });
        if (err) throw err;

        const payload = data as {
          conversation_id: number;
          reply?: { content?: string; mood?: string; actions?: unknown[] };
          error?: string;
        };
        if (payload?.error) throw new Error(payload.error);

        conversationId = payload.conversation_id ?? conversationId;
        if (conversationId) {
          setActiveId(conversationId);
          await loadThread(conversationId);
          await refreshList();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "The twin could not answer just now.");
        // Her message did reach the server; pull the truth back down.
        if (conversationId) await loadThread(conversationId);
        else await refreshList();
      } finally {
        setSending(false);
      }
    },
    [activeId, loadThread, refreshList, sending],
  );

  const rename = useCallback(
    async (id: number, title: string) => {
      await rpc("twin_conversation_rename", { p_conversation: id, p_title: title });
      await refreshList();
    },
    [refreshList],
  );

  /** Share this one thread with him — or take it back. Never global. */
  const setVisibility = useCallback(
    async (id: number, shared: boolean) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, visibility: shared ? "shared" : "private" } : c)));
      const { error: err } = await rpc("twin_conversation_set_visibility", { p_conversation: id, p_shared: shared });
      if (err) {
        setError(err.message as string);
        await refreshList();
        return;
      }
      await refreshList();
    },
    [refreshList],
  );

  const remove = useCallback(
    async (id: number) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      await rpc("twin_conversation_delete", { p_conversation: id });
      await refreshList();
    },
    [activeId, refreshList],
  );

  return {
    loading,
    loadingThread,
    sending,
    error,
    config,
    isOwner,
    isPartner,
    consented: Boolean(config?.partner_consented_at),
    chatEnabled: Boolean(config?.twin_chat_enabled) || isOwner,
    conversations,
    activeId,
    activeConversation,
    messages,
    open,
    newChat,
    send,
    rename,
    setVisibility,
    remove,
    refresh: load,
  };
}

/**
 * useTwinAutoReplies — the twin's notes in the couple's real chat.
 *
 * `replies` are standing twin answers he never followed up on: they are shown
 * as a clearly-labelled AI line, not as a message from him. `maybeAnswer()` is
 * the only trigger — the client asks, the SQL function in `twin-reply` decides,
 * and at most one attempt leaves the device every few minutes.
 */
export function useTwinAutoReplies(enabled: boolean, partnerOffline: boolean) {
  const [replies, setReplies] = useState<TwinAutoReply[]>([]);
  const [notesEnabled, setNotesEnabled] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const lastAttempt = useRef(0);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await rpc("twin_autoreply_for_chat", { p_hours: 72 });
    if (error) return;
    const payload = data as { enabled?: boolean; replies?: TwinAutoReply[] } | null;
    setNotesEnabled(Boolean(payload?.enabled));
    setReplies(payload?.replies ?? []);

    const { data: cfg } = await (supabase as any).from("twin_config").select("owner_name").eq("id", 1).maybeSingle();
    setOwnerName((cfg?.owner_name as string) ?? null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setReplies([]);
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  /** Ask the twin to answer, if he has been away long enough. Cheap when not. */
  const maybeAnswer = useCallback(async () => {
    if (!enabled || !partnerOffline) return;
    if (Date.now() - lastAttempt.current < 5 * 60_000) return;
    lastAttempt.current = Date.now();
    setGenerating(true);
    try {
      await supabase.functions.invoke("twin-reply", { body: { auto: true } });
      await load();
    } catch {
      /* silence is the right failure here */
    } finally {
      setGenerating(false);
    }
  }, [enabled, partnerOffline, load]);

  useEffect(() => {
    void maybeAnswer();
  }, [maybeAnswer]);

  const ack = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    await rpc("twin_autoreply_ack", { p_ids: ids });
  }, []);

  const dismiss = useCallback(async (id: number) => {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    await rpc("twin_autoreply_dismiss", { p_id: id });
  }, []);

  return { replies, notesEnabled, ownerName, generating, load, maybeAnswer, ack, dismiss };
}
