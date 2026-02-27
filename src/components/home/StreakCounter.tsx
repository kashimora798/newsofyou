import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStreakCelebratedDate, setStreakCelebratedDate } from "@/hooks/useSecretAchievements";
import StreakCelebration from "@/components/home/StreakCelebration";
import { format } from "date-fns";

const StreakCounter: React.FC = () => {
  const { user } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [breakDate, setBreakDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  const calculate = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: messages, error } = await supabase
        .from("messages")
        .select("created_at")
        .order("created_at", { ascending: false });

      if (error || !messages || messages.length === 0) {
        setLoading(false);
        return;
      }

      // Group messages by date
      const daySet = new Set<string>();
      const todayStr = new Date().toISOString().slice(0, 10);
      let todayMsgCount = 0;

      for (const msg of messages) {
        const day = msg.created_at.slice(0, 10);
        daySet.add(day);
        if (day === todayStr) todayMsgCount++;
      }

      setTodayCount(todayMsgCount);

      // Current streak: go backwards from today
      let streak = 0;
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      let brokeOn: string | null = null;

      while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (daySet.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // This is the date with no messages — streak broke here
          brokeOn = dateStr;
          break;
        }
      }

      // Longest streak
      const sortedDays = Array.from(daySet).sort();
      let longest = 0;
      let tempStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) {
          tempStreak++;
        } else {
          longest = Math.max(longest, tempStreak);
          tempStreak = 1;
        }
      }
      longest = Math.max(longest, tempStreak);

      setCurrentStreak(streak);
      setLongestStreak(longest);
      setBreakDate(brokeOn);

      // Celebration check
      if (streak > 0 && user?.id) {
        const lastCelebratedDate = await getStreakCelebratedDate(user.id);
        if (lastCelebratedDate !== todayStr) {
          setShowCelebration(true);
          await setStreakCelebratedDate(user.id, todayStr);
        }
      }
    } catch (e) {
      console.error("Streak calculation error:", e);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [calculate]);

  if (loading) return null;

  const hasMessages = todayCount > 0;

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Daily Streak
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-2xl font-bold text-primary">
              {currentStreak > 0 ? `🔥 ${currentStreak}` : "0"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Current Streak</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-2xl font-bold text-foreground">🏆 {longestStreak}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Longest Streak</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Today</span>
            <span className={`text-xs font-bold ${hasMessages ? "text-green-500" : "text-muted-foreground"}`}>
              {todayCount} msgs {hasMessages && "✅"}
            </span>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            {hasMessages
              ? `🎉 Streak active! ${currentStreak} day${currentStreak !== 1 ? "s" : ""} and counting!`
              : "💬 Send a message to keep the streak alive!"
            }
          </p>

          {/* Show break date */}
          {breakDate && (
            <p className="text-[10px] text-center text-destructive/70 mt-1">
              📅 No messages on {format(new Date(breakDate + "T00:00:00"), "MMM d, yyyy")} — streak broke here
            </p>
          )}
        </div>
      </div>

      {showCelebration && (
        <StreakCelebration
          streakCount={currentStreak}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    </>
  );
};

export default StreakCounter;
