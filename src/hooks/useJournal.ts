import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  CHUNK_MONTHS, DEFAULT_FONT_PREFS, DEFAULT_STYLE, chunkRange, chunksToCover, dayRangeISO, groupByMonth, mergeDaySummaries,
  normalizeFontPrefs, normalizeStyle, summarizeDays, type JournalFontPrefs,
  type DaySummary, type IndexRow, type JournalDayStyle, type MonthGroup,
} from "@/lib/journal";

type Message = Tables<"messages">;

const DAY_COLUMNS =
  "id, user_id, username, content, message_type, created_at, is_memory, emoji, image_url, " +
  "video, vidUrl, file_url, file_name, file_type, gif_url, sticker_url, duration, isReact";

const PAGE = 1000;
const WAVE = 4; // extra pages fetched in parallel once the first page is full
const MAX_PAGES = 60;

type RangeBound = string | null;

async function fetchPage(from: RangeBound, to: RangeBound, p: number): Promise<IndexRow[]> {
  let q = supabase.from("messages").select("created_at, message_type, image_url");
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lt("created_at", to);
  // newest first, `id` as a tie-breaker so paging never skips / repeats rows
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(p * PAGE, p * PAGE + PAGE - 1);
  if (error) throw error;
  return (data ?? []) as IndexRow[];
}

/** One time window → day summaries. First page alone, then the rest in parallel waves. */
async function fetchRange(from: RangeBound, to: RangeBound): Promise<DaySummary[]> {
  const rows: IndexRow[] = [];
  const first = await fetchPage(from, to, 0);
  rows.push(...first);
  let done = first.length < PAGE;
  let next = 1;
  while (!done && next < MAX_PAGES) {
    const wave = await Promise.all(Array.from({ length: WAVE }, (_, i) => fetchPage(from, to, next + i)));
    for (const w of wave) {
      rows.push(...w);
      if (w.length < PAGE) done = true;
    }
    next += WAVE;
  }
  return summarizeDays(rows);
}

/* Tiny on-device cache so reopening the journal paints instantly (then refreshes). */
const IDX_CACHE = "journal:index:v2:";
function readIdx(key: string): { data: DaySummary[]; at: number } | undefined {
  try {
    const raw = localStorage.getItem(IDX_CACHE + key);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { data: DaySummary[]; at: number };
    return Array.isArray(v.data) ? v : undefined;
  } catch {
    return undefined;
  }
}
function writeIdx(key: string, data: DaySummary[]) {
  try {
    localStorage.setItem(IDX_CACHE + key, JSON.stringify({ data, at: Date.now() }));
  } catch { /* storage full / private mode */ }
}

/**
 * Days that have chat in them, with counts. Loads NEWEST FIRST: only the last
 * few months at first, then older windows on demand ("load older" / "load all").
 */
export function useJournalIndex(initialDay?: string | null) {
  const [chunks, setChunks] = useState(() => {
    const need = initialDay ? chunksToCover(initialDay) : 1;
    return Math.min(need, 4);
  });
  const [all, setAll] = useState(() => (initialDay ? chunksToCover(initialDay) > 4 : false));

  const windows = useMemo(() => {
    const list: { key: string; from: RangeBound; to: RangeBound }[] = [];
    for (let i = 0; i < chunks; i++) {
      const r = chunkRange(i);
      list.push({ key: `${r.from}|${r.to ?? "now"}`, from: r.from, to: r.to });
    }
    if (all) {
      const last = chunkRange(chunks - 1);
      list.push({ key: `start|${last.from}`, from: null, to: last.from });
    }
    return list;
  }, [chunks, all]);

  const results = useQueries({
    queries: windows.map((w, i) => {
      const cached = readIdx(w.key);
      return {
        queryKey: ["journal", "index", w.key],
        staleTime: i === 0 ? 1000 * 60 : 1000 * 60 * 10,
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.at,
        queryFn: async (): Promise<DaySummary[]> => {
          const data = await fetchRange(w.from, w.to);
          writeIdx(w.key, data);
          return data;
        },
      };
    }),
  });

  // oldest message ever (one tiny query) → tells us whether there is anything older to load
  const oldestQ = useQuery({
    queryKey: ["journal", "oldest"],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("messages")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as { created_at: string | null } | undefined)?.created_at ?? null;
    },
  });

  const stamp = results.map((r) => r.dataUpdatedAt).join(",");
  const days = useMemo(
    () => mergeDaySummaries(results.map((r) => r.data ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  );
  const months: MonthGroup[] = useMemo(() => groupByMonth(days), [days]);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.key, d])), [days]);

  const loadedFrom = chunkRange(chunks - 1).from;
  const oldest = oldestQ.data;
  const hasMore = !all && !!oldest && new Date(oldest).getTime() < new Date(loadedFrom).getTime();

  const loadOlder = useCallback(() => setChunks((c) => c + 1), []);
  const loadAll = useCallback(() => setAll(true), []);

  return {
    days, months, dayMap,
    loading: results[0].isLoading,
    loadingOlder: results.slice(1).some((r) => r.isFetching && !r.data),
    error: results[0].error,
    refetch: () => results[0].refetch(),
    hasMore, loadOlder, loadAll,
    /** months covered so far (for the "showing the last N months" hint) */
    loadedMonths: all ? null : chunks * CHUNK_MONTHS,
  };
}

/** All messages of one local calendar day, oldest first. */
export function useJournalDayMessages(dayKey: string | null) {
  return useQuery({
    queryKey: ["journal", "day", dayKey],
    enabled: !!dayKey,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<Message[]> => {
      const { from, to } = dayRangeISO(dayKey!);
      const out: Message[] = [];
      for (let p = 0; p < 10; p++) {
        const { data, error } = await supabase
          .from("messages")
          .select(DAY_COLUMNS)
          .gte("created_at", from)
          .lt("created_at", to)
          .order("created_at", { ascending: true })
          .range(p * PAGE, p * PAGE + PAGE - 1);
        if (error) throw error;
        out.push(...((data ?? []) as unknown as Message[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
  });
}

/* ───────────────────────── per-day styles ───────────────────────── */

// `journal_days` isn't in the generated Supabase types until they are regenerated.
/* eslint-disable @typescript-eslint/no-explicit-any */

const LS_KEY = "journal:styles:v1";

function readLocal(): Record<string, JournalDayStyle> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, Partial<JournalDayStyle>>;
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normalizeStyle(v)]));
  } catch {
    return {};
  }
}

function writeLocal(map: Record<string, JournalDayStyle>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* storage full / private mode */ }
}

/**
 * Day customisations (emoji, colour, paper…). Shared via the `journal_days`
 * table; if the table isn't there yet we transparently keep them on-device.
 */
export function useJournalStyles(userId: string | undefined) {
  const [styles, setStyles] = useState<Record<string, JournalDayStyle>>(() => readLocal());
  const [synced, setSynced] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await (supabase as any).from("journal_days").select("*");
      if (!alive) return;
      if (error) {
        setSynced(false);
        return;
      }
      setSynced(true);
      const remote: Record<string, JournalDayStyle> = {};
      for (const row of (data ?? []) as any[]) remote[row.day] = normalizeStyle(row);
      setStyles((prev) => {
        const merged = { ...prev, ...remote };
        writeLocal(merged);
        return merged;
      });
    })();
    return () => { alive = false; };
  }, []);

  const styleFor = useCallback((day: string): JournalDayStyle => styles[day] ?? DEFAULT_STYLE, [styles]);
  const hasStyle = useCallback((day: string) => !!styles[day], [styles]);

  const saveStyle = useCallback(
    async (day: string, style: JournalDayStyle) => {
      const clean = normalizeStyle(style);
      setStyles((prev) => {
        const next = { ...prev, [day]: clean };
        writeLocal(next);
        return next;
      });
      const { error } = await (supabase as any).from("journal_days").upsert({
        day,
        emojis: clean.emojis,
        accent: clean.accent,
        paper: clean.paper,
        washi: clean.washi,
        title: clean.title,
        caption: clean.caption,
        mood: clean.mood,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      });
      setSynced(!error);
      qc.invalidateQueries({ queryKey: ["journal", "styles"] });
      return { synced: !error };
    },
    [userId, qc],
  );

  return { styleFor, hasStyle, saveStyle, synced };
}

/* ───────────────────────── font preference ───────────────────────── */

const FONT_KEY = "journal:font:v1";

/** Chosen journal handwriting + size, remembered on this device. */
export function useJournalFont() {
  const [prefs, setPrefs] = useState<JournalFontPrefs>(() => {
    try {
      return normalizeFontPrefs(JSON.parse(localStorage.getItem(FONT_KEY) ?? "null"));
    } catch {
      return DEFAULT_FONT_PREFS;
    }
  });
  const update = useCallback((patch: Partial<JournalFontPrefs>) => {
    setPrefs((prev) => {
      const next = normalizeFontPrefs({ ...prev, ...patch });
      try { localStorage.setItem(FONT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { prefs, setFont: update };
}
