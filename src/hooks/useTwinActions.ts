import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useTwinActions — assistant actions (build-plan Phase 7).
 *
 * The twin proposes; a person taps; the edge function writes. This hook is the
 * only place the app talks to `twin-actions`, and it never writes anything the
 * person has not confirmed on screen.
 */

export type TwinActionKind =
  | "schedule_message"
  | "create_reminder"
  | "add_event"
  | "format_message"
  | "daily_summary"
  | "plan";

export interface TwinAction {
  id: string;
  kind: TwinActionKind;
  status: "proposed" | "confirmed" | "done" | "cancelled" | "expired" | "failed";
  title: string;
  detail?: string | null;
  preview?: string | null;
  when_at?: string | null;
  payload?: Record<string, unknown>;
  expires_at?: string | null;
  created_at?: string;
  executed_at?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

/** A read-kind answer that arrived without needing a tap. */
export interface TwinActionAnswer {
  kind: TwinActionKind;
  text: string;
  title: string;
}

interface ListPayload {
  open?: TwinAction[];
  recent?: TwinAction[];
  counts?: Record<string, number>;
}

export function useTwinActions(enabled = true) {
  const { user } = useAuth();
  const [open, setOpen] = useState<TwinAction[]>([]);
  const [recent, setRecent] = useState<TwinAction[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<TwinActionAnswer | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await (supabase.rpc as any)("twin_actions_list", { p_limit: 20 });
    if (err) {
      setError(err.message as string);
      return;
    }
    const payload = (data ?? {}) as ListPayload;
    setOpen(payload.open ?? []);
    setRecent(payload.recent ?? []);
    setCounts(payload.counts ?? {});
    loaded.current = true;
  }, [user]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  const invoke = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<T | null> => {
      const { data, error: err } = await supabase.functions.invoke("twin-actions", { body });
      if (err) {
        setError(err.message);
        return null;
      }
      if ((data as { error?: string })?.error) {
        setError((data as { error: string }).error);
        return null;
      }
      return data as T;
    },
    [],
  );

  /** "remind me to call mum at 7" → one card (or one answer, for reads). */
  const propose = useCallback(
    async (text: string, source = "twin_chat", conversationId?: number | null) => {
      setBusy("propose");
      setLastAnswer(null);
      try {
        const data = await invoke<{
          ok: boolean;
          reason?: string;
          action?: TwinAction;
          kind?: TwinActionKind;
          preview?: string;
          text?: string;
          when_label?: string | null;
        }>({ text, source, conversation_id: conversationId ?? undefined });

        if (!data) return { ok: false as const, reason: "unavailable" as const };
        if (!data.ok) return { ok: false as const, reason: data.reason ?? "not_an_action" };

        if (data.action) {
          await load();
          return { ok: true as const, action: data.action };
        }
        // a read kind: show the answer straight away
        setLastAnswer({ kind: data.kind ?? "format_message", text: data.text ?? "", title: data.preview ?? "" });
        await load();
        return { ok: true as const, answer: data.text ?? "" };
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  /** The tap. This is the only path that writes. */
  const confirm = useCallback(
    async (id: string) => {
      setBusy(id);
      setOpen((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a)));
      try {
        const data = await invoke<{ ok: boolean; status?: string; error?: string | null; result?: Record<string, unknown> }>({
          id,
          confirm: true,
        });
        await load();
        return data;
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  const cancel = useCallback(
    async (id: string) => {
      setBusy(id);
      setOpen((prev) => prev.filter((a) => a.id !== id));
      try {
        await invoke({ id, confirm: false });
        await load();
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  /** "How was today?" — read-only, cached per day, no tap needed. */
  const summarize = useCallback(
    async (day?: string) => {
      setBusy("summary");
      try {
        const data = await invoke<{ ok: boolean; answer?: string; day?: string }>({ summary: true, day });
        if (data?.answer) setLastAnswer({ kind: "daily_summary", text: data.answer, title: data.day ?? "today" });
        await load();
        return data?.answer ?? null;
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  /** "What should we do this weekend?" — grounded, read-only. */
  const plan = useCallback(
    async (request: string) => {
      setBusy("plan");
      try {
        const data = await invoke<{ ok: boolean; answer?: string }>({ plan: true, request });
        if (data?.answer) setLastAnswer({ kind: "plan", text: data.answer, title: request });
        await load();
        return data?.answer ?? null;
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  /** Rewrite a draft, keeping their meaning and language. */
  const reformat = useCallback(
    async (draft: string, tone?: string) => {
      setBusy("format");
      try {
        const data = await invoke<{ ok: boolean; suggestion?: string }>({ format: draft, tone });
        await load();
        return data?.suggestion ?? null;
      } finally {
        setBusy(null);
      }
    },
    [invoke, load],
  );

  const dismissAnswer = useCallback(() => setLastAnswer(null), []);

  return {
    open,
    recent,
    counts,
    busy,
    error,
    lastAnswer,
    dismissAnswer,
    load,
    propose,
    confirm,
    cancel,
    summarize,
    plan,
    reformat,
  };
}
