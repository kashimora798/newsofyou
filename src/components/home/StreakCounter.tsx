import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStreakCelebratedDate, setStreakCelebratedDate } from "@/hooks/useSecretAchievements";
import StreakCelebration from "@/components/home/StreakCelebration";

const DAILY_TARGET = 50;

const StreakCounter: React.FC = () => {
  const { user } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayBothActive, setTodayBothActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  const calculate = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_streak_data" as any);

    if (error || !data) {
      setLoading(false);
      return;
    }

    const result = data as any;
    const todayMsgCount = result.today_count ?? 0;
    const todayUsers = result.today_user_count ?? 0;
    setTodayCount(todayMsgCount);
    setTodayBothActive(todayUsers >= 2);

    const streakDays: string[] = result.streak_days ?? [];
    if (streakDays.length === 0) {
      setLoading(false);
      return;
    }

    const sorted = [...streakDays].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Check if today qualifies (50+ msgs from both users)
    const todayQualifies = todayMsgCount >= DAILY_TARGET && todayUsers >= 2;
    
    // Build effective list including today if it qualifies but isn't in DB yet
    const effectiveDays = [...sorted];
    if (todayQualifies && effectiveDays[0] !== today) {
      effectiveDays.unshift(today);
    }

    const isActive = effectiveDays[0] === today || effectiveDays[0] === yesterday;

    let current = 0;
    let longest = 0;
    let streak = 1;

    for (let i = 1; i < effectiveDays.length; i++) {
      const curr = new Date(effectiveDays[i - 1]);
      const prev = new Date(effectiveDays[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        streak++;
      } else {
        if (i === 1 || isActive) longest = Math.max(longest, streak);
        if (i === 1 && isActive) current = streak;
        streak = 1;
      }
    }
    longest = Math.max(longest, streak);
    if (isActive && current === 0) current = streak;

    const finalCurrent = isActive ? Math.max(current, streak) : 0;
    setCurrentStreak(finalCurrent);
    setLongestStreak(longest);

    // Check if we should show celebration (new streak day achieved today)
    if (todayQualifies && user?.id) {
      const lastCelebratedDate = await getStreakCelebratedDate(user.id);
      if (lastCelebratedDate !== today) {
        setShowCelebration(true);
        await setStreakCelebratedDate(user.id, today);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    calculate();
    // Poll every 30s so streak updates as messages come in
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [calculate]);

  if (loading) return null;

  const progress = Math.min(todayCount, DAILY_TARGET);
  const progressPct = (progress / DAILY_TARGET) * 100;
  const targetMet = todayCount >= DAILY_TARGET && todayBothActive;

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Daily Streak
        </h3>

        {/* Streak counts */}
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

        {/* Daily target progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Today's Target
            </span>
            <span className={`text-xs font-bold ${targetMet ? "text-green-500" : "text-muted-foreground"}`}>
              {todayCount}/{DAILY_TARGET} msgs
              {targetMet && " ✅"}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPct}%`,
                background: targetMet
                  ? "linear-gradient(90deg, hsl(var(--online)), hsl(145 63% 39%))"
                  : "linear-gradient(90deg, hsl(var(--primary)), hsl(262 52% 66%))",
              }}
            />
            {/* Glow effect when close */}
            {progressPct >= 80 && !targetMet && (
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: "linear-gradient(90deg, transparent 70%, hsl(var(--primary) / 0.3))",
                }}
              />
            )}
          </div>

          {/* Status message */}
          <p className="text-[10px] text-center text-muted-foreground">
            {targetMet
              ? "🎉 Target met! Streak secured for today!"
              : !todayBothActive
                ? "💬 Both partners need to chat today"
                : `${DAILY_TARGET - todayCount} more messages to secure today's streak`
            }
          </p>
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
