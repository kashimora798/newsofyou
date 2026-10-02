import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import AdminLogin from "@/pages/AdminLogin";
import SpellLogin from "@/components/login/SpellLogin";
import { useAuth } from "@/contexts/AuthContext";

/**
 * HiddenLogin — what `/you/login` renders.
 *
 * Default: the spell login (two name cards + "whisper your spell").
 * Fallback (build-plan §2A): the original email/password screen stays reachable
 *   - with `?classic=1`, or
 *   - after visiting `?classic=1` once (remembered in localStorage), or
 *   - by setting VITE_LEGACY_LOGIN=1 at build time.
 * Already-signed-in visitors are sent on by AdminLogin / SpellLogin themselves.
 */
const CLASSIC_KEY = "noy_login_classic";

const HiddenLogin: React.FC = () => {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();

  const requestClassic = params.get("classic") === "1";
  React.useEffect(() => {
    if (requestClassic) localStorage.setItem(CLASSIC_KEY, "1");
    if (params.get("classic") === "0") localStorage.removeItem(CLASSIC_KEY);
  }, [requestClassic, params]);

  const envClassic = import.meta.env.VITE_LEGACY_LOGIN === "1";
  const storedClassic = typeof window !== "undefined" && localStorage.getItem(CLASSIC_KEY) === "1";
  const classic = requestClassic || envClassic || storedClassic;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#050510]">
        <div className="h-6 w-6 animate-spin rounded-full border border-white/20 border-t-white/70" />
      </div>
    );
  }
  if (user && !classic) return <Navigate to="/home" replace />;

  return classic ? <AdminLogin /> : <SpellLogin />;
};

export default HiddenLogin;
