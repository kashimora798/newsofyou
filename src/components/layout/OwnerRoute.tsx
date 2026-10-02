import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * OwnerRoute — only the twin's owner (twin_config.owner_user_id) gets through.
 * Used by /you/twin, where he edits the greeting bank, the style card and the
 * consent/enable switches.
 */
const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsOwner(null);
      return;
    }
    (async () => {
      try {
        const { data } = await (supabase.rpc as any)("twin_is_owner");
        if (!cancelled) setIsOwner(data === true);
      } catch {
        if (!cancelled) setIsOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || (user && isOwner === null)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/you/login" replace />;
  if (!isOwner) return <Navigate to="/home" replace />;

  return <>{children}</>;
};

export default OwnerRoute;
