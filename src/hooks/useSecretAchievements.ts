import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Server-synced Secret Achievement Detection
 * All state is stored in `user_achievement_state` table for cross-device sync.
 */

// Helper: upsert achievement state field
async function setAchievementFlag(userId: string, field: string, value: any) {
  const { data: existing } = await supabase
    .from("user_achievement_state" as any)
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await supabase
      .from("user_achievement_state" as any)
      .update({ [field]: value, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("user_achievement_state" as any)
      .insert({ user_id: userId, [field]: value } as any);
  }
}

// Helper: get achievement state
export async function getAchievementState(userId: string) {
  const { data } = await supabase
    .from("user_achievement_state" as any)
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) {
    // Create initial row
    const { data: created } = await supabase
      .from("user_achievement_state" as any)
      .insert({ user_id: userId } as any)
      .select()
      .single();
    return created as any;
  }
  return data as any;
}

// ──────────────────────────────────────────────
// 1. Check 11:11 on message send
// ──────────────────────────────────────────────
export async function check1111OnSend(userId: string) {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = now.getMinutes();
  if (h === 11 && m === 11) {
    await setAchievementFlag(userId, "event_1111", true);
  }
}

// ──────────────────────────────────────────────
// 2. Check Jinx - call after sending a message
// ──────────────────────────────────────────────
export async function checkJinx(
  userId: string,
  sentContent: string,
  sentAt: string,
  recentMessages: { content: string | null; created_at: string | null; user_id: string | null }[]
) {
  if (!sentContent) return;

  const sentTime = new Date(sentAt).getTime();
  const normalizedSent = sentContent.trim().toLowerCase();

  for (const msg of recentMessages) {
    if (!msg.content || !msg.created_at || msg.user_id === userId) continue;
    const msgTime = new Date(msg.created_at).getTime();
    const timeDiff = Math.abs(sentTime - msgTime);
    if (timeDiff <= 3000 && msg.content.trim().toLowerCase() === normalizedSent) {
      await setAchievementFlag(userId, "event_jinx", true);
      return;
    }
  }
}

// ──────────────────────────────────────────────
// 3. Check New Year - call on app load
// ──────────────────────────────────────────────
export async function checkNewYear(userId: string) {
  const now = new Date();
  if (now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 5) {
    await setAchievementFlag(userId, "event_newyear", true);
  }
}

// ──────────────────────────────────────────────
// 4. Mark Time Traveler
// ──────────────────────────────────────────────
export async function markTimeTraveler(userId: string) {
  await setAchievementFlag(userId, "event_timetraveler", true);
}

// ──────────────────────────────────────────────
// 5. The One Who Waits
// ──────────────────────────────────────────────
export function useWaiterAchievement(userId: string | undefined, partnerOnline: boolean | undefined | null) {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (checkedRef.current) return;

    const run = async () => {
      const state = await getAchievementState(userId);
      if (state?.event_waiter) return;

      if (partnerOnline === true) {
        // Partner online - reset
        await supabase
          .from("user_achievement_state" as any)
          .update({ waiter_open_count: 0, waiter_start_time: 0, updated_at: new Date().toISOString() } as any)
          .eq("user_id", userId);
        return;
      }

      if (partnerOnline === false) {
        const now = Date.now();
        const startTime = state?.waiter_start_time ?? 0;

        if (!startTime || now - startTime > 24 * 60 * 60 * 1000) {
          await supabase
            .from("user_achievement_state" as any)
            .update({ waiter_start_time: now, waiter_open_count: 1, updated_at: new Date().toISOString() } as any)
            .eq("user_id", userId);
          return;
        }

        const count = (state?.waiter_open_count ?? 0) + 1;
        const updates: any = { waiter_open_count: count, updated_at: new Date().toISOString() };
        if (count >= 20) updates.event_waiter = true;

        await supabase
          .from("user_achievement_state" as any)
          .update(updates)
          .eq("user_id", userId);
      }
    };

    run();
    checkedRef.current = true;
  }, [userId, partnerOnline]);
}

// ──────────────────────────────────────────────
// 6. Time Capsule
// ──────────────────────────────────────────────
export async function markTimeCapsule(userId: string) {
  await setAchievementFlag(userId, "event_timecapsule", true);
}

// ──────────────────────────────────────────────
// Streak celebration tracking (server-synced)
// ──────────────────────────────────────────────
export async function getStreakCelebratedDate(userId: string): Promise<string | null> {
  const state = await getAchievementState(userId);
  return state?.streak_celebrated_date ?? null;
}

export async function setStreakCelebratedDate(userId: string, date: string) {
  await setAchievementFlag(userId, "streak_celebrated_date", date);
}

// ──────────────────────────────────────────────
// Unlocked achievements tracking (server-synced)
// ──────────────────────────────────────────────
export async function getUnlockedAchievements(userId: string): Promise<string[]> {
  const state = await getAchievementState(userId);
  return (state?.unlocked_achievements as string[]) ?? [];
}

export async function setUnlockedAchievements(userId: string, ids: string[]) {
  await setAchievementFlag(userId, "unlocked_achievements", JSON.stringify(ids));
}
