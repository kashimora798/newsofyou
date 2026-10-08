import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useFaceToFace — the hard-conversation room (build-plan Phase 8).
 *
 * Everything goes through the `face-to-face` edge function, so the browser never
 * holds a key and every rule (whose turn, the stop signal, the closing note)
 * is decided server-side.
 *
 * The softening path is deliberately two-step: `soften()` returns a suggestion,
 * the person reads it and can edit it, and `send()` decides which version is
 * actually stored — with their original kept beside it.
 */

export interface FtfSession {
  id: string;
  started_by: string;
  partner_id: string | null;
  topic: string;
  status: "waiting" | "active" | "paused" | "closed" | "stopped";
  stage: "rules" | "turns" | "closing" | "done";
  agreed_by: string[];
  turn_user_id: string | null;
  turn_count: number;
  max_turns: number;
  stop_flags: string[];
  close_note: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface FtfTurn {
  id: string;
  user_id: string;
  kind: "message" | "summary" | "resources" | "system";
  content: string;
  softened: boolean;
  flags: string[];
  created_at: string;
}

export interface FtfState {
  session: FtfSession | null;
  turns: FtfTurn[];
  me: string;
  my_turn: boolean;
  i_agreed: boolean;
  both_agreed: boolean;
  waiting_for_partner: boolean;
  stopped: boolean;
}

export interface FtfSoftened {
  gentler: string;
  need: string;
  land: string;
  parsed: boolean;
  unavailable?: boolean;
  safe?: boolean;
}

export function useFaceToFace(enabled = true) {
  const { user } = useAuth();
  const [state, setState] = useState<FtfState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<T | null> => {
      const { data, error: err } = await supabase.functions.invoke("face-to-face", { body });
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

  const refresh = useCallback(
    async (sessionId?: string | null) => {
      const data = await invoke<FtfState & { ok: boolean }>({ action: "state", session_id: sessionId ?? undefined });
      if (data) setState(data);
      setLoading(false);
      return data;
    },
    [invoke],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  const run = useCallback(
    async (label: string, body: Record<string, unknown>) => {
      setBusy(label);
      setError(null);
      try {
        return await invoke<Record<string, unknown>>(body);
      } finally {
        setBusy(null);
      }
    },
    [invoke],
  );

  const open = useCallback(
    async (topic: string) => {
      const data = await run("open", { action: "open", topic });
      await refresh();
      return data;
    },
    [refresh, run],
  );

  const join = useCallback(
    async (sessionId: string) => {
      await run("join", { action: "join", session_id: sessionId });
      await refresh(sessionId);
    },
    [refresh, run],
  );

  const agree = useCallback(
    async (sessionId: string) => {
      await run("agree", { action: "agree", session_id: sessionId });
      await refresh(sessionId);
    },
    [refresh, run],
  );

  const pause = useCallback(
    async (sessionId: string, paused: boolean) => {
      await run("pause", { action: "pause", session_id: sessionId, paused });
      await refresh(sessionId);
    },
    [refresh, run],
  );

  /** A suggestion only — nothing is stored and nothing is sent. */
  const soften = useCallback(
    async (sessionId: string, text: string) => {
      const data = await run("soften", { action: "soften", session_id: sessionId, text });
      if (!data) return null;
      if (data.stop) {
        // The draft itself tripped a safety stop — the room is about to stop.
        await refresh(sessionId);
        return { gentler: "", need: "", land: "", parsed: false, safe: false } as FtfSoftened;
      }
      return data as unknown as FtfSoftened;
    },
    [refresh, run],
  );

  const send = useCallback(
    async (sessionId: string, text: string, opts: { softened?: string; useSoftened?: boolean } = {}) => {
      const data = await run("send", {
        action: "send",
        session_id: sessionId,
        text,
        softened: opts.softened,
        use_softened: opts.useSoftened === true,
      });
      await refresh(sessionId);
      return data;
    },
    [refresh, run],
  );

  /** Close the room; the note comes back for both of them. */
  const close = useCallback(
    async (sessionId: string) => {
      const data = await run("close", { action: "close", session_id: sessionId });
      await refresh(sessionId);
      return data as { note?: string | null; aNeed?: string; bNeed?: string; nextStep?: string } | null;
    },
    [refresh, run],
  );

  const session = state?.session ?? null;
  const isStarter = Boolean(session && user && session.started_by === user.id);

  const partnerLabel = useMemo(() => (isStarter ? "them" : "him"), [isStarter]);

  return {
    state,
    session,
    turns: state?.turns ?? [],
    loading,
    busy,
    error,
    isStarter,
    partnerLabel,
    refresh,
    open,
    join,
    agree,
    pause,
    soften,
    send,
    close,
  };
}
