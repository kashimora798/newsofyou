import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daysTogether } from "@/lib/anniversary";
import { getStreakData } from "./useStreakState";

export interface WrappedData {
  totalMessages: number;
  daysTogether: number;
  avgPerDay: number;
  // per-person
  mine: { name: string; count: number; avgLength: number } | null;
  theirs: { name: string; count: number; avgLength: number } | null;
  // highlights
  busiestDay: { date: string; count: number } | null;
  nightOwlCount: number;
  topWords: { word: string; count: number }[];
  topEmoji: string | null;
  topEmojis: [string, number][];
  loveCount: number;
  lolCount: number;
  missCount: number;
  longestMessage: { length: number; username: string } | null;
  firstMessage: { content: string; username: string; date: string } | null;
  monthly: { month: string; count: number }[];
  // media
  photos: number;
  // games
  gamesPlayed: number;
  myWins: number;
  theirWins: number;
  // new additions
  forestCount: number;
  longestStreak: number;
  randomCompliment: string | null;
  randomBookmark: string | null;
}

export function useWrappedData(userId: string) {
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [{ data: basic }, { data: adv }, { data: games }, streak, { data: compls }, { data: bkmks }] = await Promise.all([
          supabase.rpc("get_chat_stats" as any),
          supabase.rpc("get_advanced_stats" as any),
          supabase
            .from("game_sessions")
            .select("winner_id, status, created_by, opponent_id")
            .eq("status", "completed"),
          getStreakData(userId),
          supabase.from("compliments").select("content").limit(20),
          supabase.from("bookmarks").select("message_id, note").limit(20),
        ]);

        // `bookmarks` has no text column: it points at a message (message_id) and may
        // carry a personal note. Show the bookmarked message, falling back to the note.
        let randomBookmark: string | null = null;
        if (bkmks?.length) {
          const pick = bkmks[Math.floor(Math.random() * bkmks.length)];
          if (pick.message_id) {
            const { data: bm } = await supabase
              .from("messages")
              .select("content")
              .eq("id", pick.message_id)
              .maybeSingle();
            randomBookmark = bm?.content?.trim() || null;
          }
          if (!randomBookmark) randomBookmark = pick.note?.trim() || null;
        }

        const b = (basic ?? {}) as any;
        const a = (adv ?? {}) as any;

        // Per-user split → mine / theirs
        let mine: WrappedData["mine"] = null;
        let theirs: WrappedData["theirs"] = null;
        if (Array.isArray(b.per_user)) {
          for (const u of b.per_user) {
            const entry = { name: u.name ?? "Unknown", count: u.count ?? 0, avgLength: u.avg_length ?? 0 };
            if (u.user_id === userId) mine = entry;
            else theirs = entry;
          }
        }

        // First message
        let firstMessage: WrappedData["firstMessage"] = null;
        if (b.first_message) {
          const fm = b.first_message;
          const d = fm.created_at ? new Date(fm.created_at) : null;
          firstMessage = {
            content: fm.content || "📷 a moment",
            username: fm.username ?? "Unknown",
            date: d
              ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
              : "",
          };
        }

        // Top emoji
        const topEmojis: [string, number][] = Array.isArray(b.top_emojis)
          ? b.top_emojis.map((e: any) => [e.emoji, e.count] as [string, number])
          : [];

        // Busiest day
        let busiestDay: WrappedData["busiestDay"] = null;
        if (a.records?.max_messages_day?.day) {
          const r = a.records.max_messages_day;
          const d = new Date(r.day);
          busiestDay = {
            date: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
            count: r.count ?? 0,
          };
        }

        // Games tally
        let gamesPlayed = 0;
        let myWins = 0;
        let theirWins = 0;
        if (Array.isArray(games)) {
          for (const g of games as any[]) {
            gamesPlayed++;
            if (g.winner_id === userId) myWins++;
            else if (g.winner_id) theirWins++;
          }
        }

        const total = b.total ?? 0;
        const days = daysTogether();

        const shaped: WrappedData = {
          totalMessages: total,
          daysTogether: days,
          avgPerDay: days > 0 ? Math.round(total / days) : total,
          mine,
          theirs,
          busiestDay,
          nightOwlCount: a.night_owl_count ?? 0,
          topWords: Array.isArray(a.top_words) ? a.top_words.slice(0, 18) : [],
          topEmoji: topEmojis[0]?.[0] ?? null,
          topEmojis,
          loveCount: a.keyword_counts?.love ?? 0,
          lolCount: a.keyword_counts?.lol ?? 0,
          missCount: a.keyword_counts?.miss ?? 0,
          longestMessage: a.records?.longest_message
            ? { length: a.records.longest_message.length ?? 0, username: a.records.longest_message.username ?? "" }
            : null,
          firstMessage,
          monthly: Array.isArray(a.monthly) ? a.monthly : [],
          photos: a.photos_count ?? 0,
          gamesPlayed,
          myWins,
          theirWins,
          forestCount: a.keyword_counts?.love ?? 0,
          longestStreak: streak?.longestStreak ?? 0,
          randomCompliment: compls?.length ? compls[Math.floor(Math.random() * compls.length)].content : null,
          randomBookmark,
        };

        if (!cancelled) {
          setData(shaped);
          setLoading(false);
        }
      } catch (e) {
        console.error("Wrapped data error:", e);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, loading, error };
}
