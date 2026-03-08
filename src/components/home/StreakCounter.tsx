import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getStreakCelebratedDate, setStreakCelebratedDate } from "@/hooks/useSecretAchievements";
import StreakCelebration from "@/components/home/StreakCelebration";
import { getStreakData } from "@/hooks/useStreakState";
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
      const data = await getStreakData(user.id);
      setCurrentStreak(data.currentStreak);
      setLongestStreak(data.longestStreak);
      setTodayCount(data.todayCount);
      setBreakDate(data.streakBrokenOn);

      // Celebration check
      if (data.currentStreak > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
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
    const interval = setInterval(calculate, 60000); // Check every 60s instead of 30s
    return () => clearInterval(interval);
  }, [calculate]);

  if (loading) return null;

  const hasMessages = todayCount > 0;

  return (
    <>
      <div className="glass rounded-2xl p-4">
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
