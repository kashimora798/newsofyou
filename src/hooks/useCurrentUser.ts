import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserStatus = Tables<"user_status">;

export function useCurrentUser(userId: string | undefined) {
  const [currentUser, setCurrentUser] = useState<UserStatus | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("user_status")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (data) setCurrentUser(data);
    };
    fetch();
  }, [userId]);

  return currentUser;
}
