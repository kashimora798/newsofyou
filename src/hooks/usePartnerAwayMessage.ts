import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_AWAY = "Partner is away for 5 min, sorry.";
const LATE_AWAY = "They are away sorry as they are late.";

interface BanSnapshot {
  banned_until: string;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function usePartnerAwayMessage(
  partnerUserId: string | null | undefined,
  partnerIsOnline: boolean | null | undefined,
  partnerLastSeen: string | null | undefined,
) {
  const [latestBan, setLatestBan] = useState<BanSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!partnerUserId) {
      setLatestBan(null);
      return;
    }

    const loadBan = async () => {
      const { data } = await supabase
        .from("user_bans")
        .select("banned_until")
        .eq("user_id", partnerUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestBan((data as BanSnapshot | null) ?? null);
    };

    loadBan();

    const timer = setInterval(() => setNow(Date.now()), 30000);
    const channel = supabase
      .channel(`partner-ban-${partnerUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_bans",
          filter: `user_id=eq.${partnerUserId}`,
        },
        () => {
          loadBan();
          setNow(Date.now());
        },
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [partnerUserId]);

  return useMemo(() => {
    if (!latestBan?.banned_until) return null;

    const banUntil = parseTime(latestBan.banned_until);
    if (!banUntil) return null;

    if (now < banUntil) {
      return ACTIVE_AWAY;
    }

    const lastSeen = parseTime(partnerLastSeen);
    const hasReturnedAfterBan = Boolean(
      partnerIsOnline || (lastSeen !== null && lastSeen > banUntil),
    );

    if (!hasReturnedAfterBan) {
      return LATE_AWAY;
    }

    return null;
  }, [latestBan, now, partnerIsOnline, partnerLastSeen]);
}
