import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserStatus = Tables<"user_status">;

export function usePartner(currentUserId: string | undefined) {
  const [partner, setPartner] = useState<UserStatus | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchPartner = async () => {
      const { data } = await supabase
        .from("user_status")
        .select("*")
        .neq("user_id", currentUserId)
        .limit(1)
        .single();
      if (data) setPartner(data);
    };

    fetchPartner();

    const channel = supabase
      .channel("partner-status")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "user_status",
        filter: `user_id=neq.${currentUserId}`,
      }, (payload) => {
        setPartner(payload.new as UserStatus);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  return partner;
}
