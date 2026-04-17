import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "partner" | "demo" | "admin";

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole>("demo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      setRole(((data as any)?.role as UserRole) ?? "demo");
      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  return { role, loading };
}
