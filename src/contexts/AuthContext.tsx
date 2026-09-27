import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { captureLoginSession } from "@/hooks/useLoginFingerprint";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const INVALID_USER_ERROR = "INVALID_USER";
const INVALID_REDIRECT = "/you/login?invalid=1";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const getActiveBan = async (userId: string) => {
    const { data } = await supabase
      .from("user_bans")
      .select("banned_until")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const bannedUntil = (data as { banned_until?: string } | null)?.banned_until;
    if (!bannedUntil) return false;

    return new Date(bannedUntil).getTime() > Date.now();
  };

  const enforceBanIfNeeded = async (userId: string) => {
    try {
      const isBanned = await getActiveBan(userId);
      if (isBanned) {
        await forceInvalidUserLogout();
      }
    } catch {
      // Keep auth usable even if ban lookups fail transiently.
    }
  };

  const forceInvalidUserLogout = async () => {
    const currentUserId = session?.user?.id;
    if (currentUserId) {
      try {
        await (supabase.rpc as any)("update_user_status", {
          p_user_id: currentUserId,
          p_is_online: false,
          p_last_seen: new Date().toISOString(),
          p_activity_state: "offline",
        });
      } catch {
        // silent
      }
    }
    setSession(null);
    sessionStorage.setItem("invalidUser", "1");
    const usedAttempts = Number(sessionStorage.getItem("invalidAttempts") ?? "0");
    sessionStorage.setItem("invalidAttempts", String(Math.min(usedAttempts + 1, 5)));
    await supabase.auth.signOut();
    window.location.replace(INVALID_REDIRECT);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep callback sync to avoid auth deadlocks.
      setSession(nextSession);
      setLoading(false);

      if (nextSession?.user) {
        void enforceBanIfNeeded(nextSession.user.id);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setLoading(false);

      if (nextSession?.user) {
        void enforceBanIfNeeded(nextSession.user.id);
      }
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // Ban enforcement is primarily server-side (RLS via is_banned()).
    // This realtime channel gives an immediate client-side logout when a ban
    // lands; a one-time check on mount covers a ban created while offline.
    void enforceBanIfNeeded(userId);

    const channel = supabase
      .channel(`ban-watch-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_bans",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const bannedUntil = (payload.new as { banned_until?: string } | null)?.banned_until;
          if (!bannedUntil) return;
          if (new Date(bannedUntil).getTime() > Date.now()) {
            await forceInvalidUserLogout();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const signedInUserId = data.user?.id;
    if (!signedInUserId) return { error: null };

    const isBanned = await getActiveBan(signedInUserId);
    if (isBanned) {
      await forceInvalidUserLogout();
      return { error: new Error(INVALID_USER_ERROR) };
    }

    sessionStorage.removeItem("invalidUser");
    sessionStorage.removeItem("invalidAttempts");

    // Capture fingerprint + device + location asynchronously — never blocks login
    void captureLoginSession(signedInUserId);

    return { error: null };
  };

  const signOut = async () => {
    const currentUserId = session?.user?.id;
    if (currentUserId) {
      try {
        await (supabase.rpc as any)("update_user_status", {
          p_user_id: currentUserId,
          p_is_online: false,
          p_last_seen: new Date().toISOString(),
          p_activity_state: "offline",
        });
      } catch (err) {
        console.warn("Failed to set user offline before signing out:", err);
      }
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      <OnlineStatusTracker userId={session?.user?.id} />
      {children}
    </AuthContext.Provider>
  );
};

const OnlineStatusTracker: React.FC<{ userId: string | undefined }> = ({ userId }) => {
  useOnlineStatus(userId);
  return null;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
