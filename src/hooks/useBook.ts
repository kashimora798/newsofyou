import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useBook — the Book's data (build-plan Phase 6).
 *
 * Three reads and one write, all through guarded RPCs:
 *   - `book_days`   the table of contents (a day + whether it has a page)
 *   - `book_stats`  the cover numbers (days, messages, favourites)
 *   - `book-page`   the edge function: fetches, composes, or writes one day
 *
 * Opening the book never spends an AI call. Only `writePage()` (the explicit
 * "write it properly" tap) does, and the page is stored afterwards.
 */

export interface BookDayRow {
  day: string;
  msg_count: number;
  hours: number | null;
  first_at: string | null;
  last_at: string | null;
  top_mood: string | null;
  page_id: number | null;
  title: string | null;
  mood: string | null;
  favorite: boolean;
  has_note: boolean;
  ai_touched: boolean;
}

export interface BookStats {
  days_total: number;
  days_written: number;
  favorites: number;
  llm_written: number;
  tokens_used: number;
  first_day: string | null;
  last_day: string | null;
  messages: number;
}

export interface BookConfig {
  id: number;
  title: string;
  subtitle: string;
  dedication: string;
  cover_style: "midnight" | "parchment" | "rose" | "starlight";
  hide_private: boolean;
}

export interface BookPageLine {
  id?: string | number;
  who?: "owner" | "partner" | string;
  name?: string;
  text?: string;
  at?: string;
  type?: string;
  url?: string | null;
}

export interface BookPage {
  id: number;
  day: string;
  title: string | null;
  subtitle: string | null;
  mood: string | null;
  excerpt: BookPageLine[];
  photo_url: string | null;
  stats: Record<string, unknown>;
  note: string;
  favorite: boolean;
  generated_by: "heuristic" | "llm";
  model: string | null;
  ai_touched: boolean;
  status: "ready" | "thin";
}

/** The table of contents. */
export function useBookDays(limit = 120) {
  const { user } = useAuth();
  const [days, setDays] = useState<BookDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await (supabase.rpc as any)("book_days", {
      p_limit: limit,
      p_offset: 0,
      p_only_pages: false,
      p_favorites: false,
    });
    if (err) setError(err.message as string);
    else setDays((data ?? []) as BookDayRow[]);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { days, loading, error, reload: load };
}

/** Cover numbers + the cover text itself. */
export function useBookMeta() {
  const { user } = useAuth();
  const [stats, setStats] = useState<BookStats | null>(null);
  const [config, setConfig] = useState<BookConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [statsRes, configRes] = await Promise.all([
      (supabase.rpc as any)("book_stats"),
      (supabase as any).from("book_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (statsRes.data) setStats(statsRes.data as BookStats);
    if (configRes.data) setConfig(configRes.data as BookConfig);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCover = useCallback(
    async (patch: Partial<Pick<BookConfig, "title" | "subtitle" | "dedication" | "cover_style" | "hide_private">>) => {
      const { error } = await (supabase.rpc as any)("book_set_config", {
        p_title: patch.title ?? null,
        p_subtitle: patch.subtitle ?? null,
        p_dedication: patch.dedication ?? null,
        p_cover_style: patch.cover_style ?? null,
        p_hide_private: patch.hide_private ?? null,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { stats, config, loading, reload: load, saveCover };
}

/** One day: fetch, compose (free) or write (one AI call). */
export function useBookPage(day: string | null) {
  const { user } = useAuth();
  const [page, setPage] = useState<BookPage | null>(null);
  const [loading, setLoading] = useState(Boolean(day));
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spentCall, setSpentCall] = useState(false);

  const fetchPage = useCallback(
    async (options?: { write?: boolean; force?: boolean }) => {
      if (!user || !day) return;
      options?.write ? setWriting(true) : setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("book-page", {
          body: { day, write: options?.write === true, force: options?.force === true },
        });
        let payload = (data ?? {}) as { page?: BookPage; spent_call?: boolean; error?: string };
        if (fnErr && !payload.error) {
          try {
            const body = await (fnErr as { context?: Response }).context?.json();
            if (body) payload = body as typeof payload;
          } catch {
            /* keep the generic message */
          }
        }
        if (!payload.page) throw new Error(payload.error ?? "Could not open that day");
        setPage(payload.page);
        setSpentCall(Boolean(payload.spent_call));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open that day");
      } finally {
        setLoading(false);
        setWriting(false);
      }
    },
    [user, day],
  );

  useEffect(() => {
    if (!day || !user) {
      setPage(null);
      setLoading(false);
      return;
    }
    setPage(null);
    void fetchPage();
  }, [day, user, fetchPage]);

  const writePage = useCallback(() => fetchPage({ write: true, force: false }), [fetchPage]);

  const saveNote = useCallback(
    async (note: string) => {
      if (!day || !page) return;
      const { error: err } = await (supabase.rpc as any)("book_page_note", { p_day: day, p_note: note });
      if (err) throw err;
      setPage((p) => (p ? { ...p, note } : p));
    },
    [day, page],
  );

  const toggleFavorite = useCallback(async () => {
    if (!day || !page) return;
    const next = !page.favorite;
    setPage((p) => (p ? { ...p, favorite: next } : p));
    const { error: err } = await (supabase.rpc as any)("book_page_favorite", { p_day: day, p_favorite: next });
    if (err) setPage((p) => (p ? { ...p, favorite: !next } : p));
  }, [day, page]);

  return { page, loading, writing, error, spentCall, writePage, saveNote, toggleFavorite, reload: fetchPage };
}
