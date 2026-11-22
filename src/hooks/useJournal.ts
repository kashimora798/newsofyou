import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  DEFAULT_STYLE, dayRangeISO, groupByMonth, normalizeStyle, summarizeDays,
  type DaySummary, type IndexRow, type JournalDayStyle, type MonthGroup,
} from "@/lib/journal";

type Message = Tables<"messages">;

const DAY_COLUMNS =
  "id, user_id, username, content, message_type, created_at, is_memory, emoji, image_url, " +
  "video, vidUrl, file_url, file_name, file_type, gif_url, sticker_url, duration, isReact";

const PAGE = 1000;
const MAX_PAGES = 40; // 40k messages is plenty for an index

/** Every day that has chat in it, with counts — fetched with a tiny column set. */
export function useJournalIndex() {
  const q = useQuery({
    queryKey: ["journal", "index"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<DaySummary[]> => {
      const rows: IndexRow[] = [];
      for (let p = 0; p < MAX_PAGES; p++) {
        const { data, error } = await supabase
          .from("messages")
          .select("created_at, message_type, image_url")
          .order("created_at", { ascending: true })
          .range(p * PAGE, p * PAGE + PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as IndexRow[]));
        if (!data || data.length < PAGE) break;
      }
      return summarizeDays(rows);
    },
  });

  const days = useMemo(() => q.data ?? [], [q.data]);
  const months: MonthGroup[] = useMemo(() => groupByMonth(days), [days]);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.key, d])), [days]);
  return { days, months, dayMap, loading: q.isLoading, error: q.error, refetch: q.refetch };
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
