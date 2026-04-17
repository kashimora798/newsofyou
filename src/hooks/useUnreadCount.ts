import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCount(userId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      const { count: c } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .neq("user_id", userId)
        .eq("seen", false);
      setCount(c ?? 0);
    };

    fetch();

    const channel = supabase
      .channel("unread-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Update tab title
  useEffect(() => {
    document.title = count > 0 ? `(${count}) EduflowAi` : "EduflowAi";
  }, [count]);

  return count;
}
