import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";

interface DayStat {
  date: string;
  label: string;
  you: number;
  partner: number;
}

export function useWeeklyChecklistStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const today = new Date();
      const weekAgo = subDays(today, 6);
      const startDate = format(weekAgo, "yyyy-MM-dd");
      const endDate = format(today, "yyyy-MM-dd");

      const { data } = await supabase
        .from("daily_checklists")
        .select("user_id, is_completed, checklist_date")
        .gte("checklist_date", startDate)
        .lte("checklist_date", endDate);

      if (!data) { setLoading(false); return; }

      const dayStats: DayStat[] = [];
      for (let i = 0; i < 7; i++) {
        const d = subDays(today, 6 - i);
        const dateStr = format(d, "yyyy-MM-dd");
        const dayItems = (data as any[]).filter(item => item.checklist_date === dateStr);
        const myItems = dayItems.filter(item => item.user_id === user.id);
        const partnerItems = dayItems.filter(item => item.user_id !== user.id);

        const myTotal = myItems.length;
        const myDone = myItems.filter(i => i.is_completed).length;
        const partnerTotal = partnerItems.length;
        const partnerDone = partnerItems.filter(i => i.is_completed).length;

        dayStats.push({
          date: dateStr,
          label: format(d, "EEE"),
          you: myTotal > 0 ? Math.round((myDone / myTotal) * 100) : 0,
          partner: partnerTotal > 0 ? Math.round((partnerDone / partnerTotal) * 100) : 0,
        });
      }

      setStats(dayStats);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  return { stats, loading };
}
