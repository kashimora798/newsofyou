import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLogin from "@/pages/AdminLogin";
import SpellLogin from "@/components/login/SpellLogin";
import { useAuth } from "@/contexts/AuthContext";

/**
 * SecretLogin — the real door at `/real` (reached from the front page's
 * "Faculty & alumni" link, or by anyone who already knows).
 *
 * Default: the spell login (two name cards + "whisper your spell").
 * Fallback: the original email/password screen, reachable with `?classic=1`
 * (remembered in sessionStorage for the rest of the browser session) or by
 * setting VITE_LEGACY_LOGIN=1 at build time. The preference is kept in
 * sessionStorage, never localStorage — a decoy visitor must not be able to
 * discover it by reopening the site tomorrow.
 */
const CLASSIC_KEY = "noy_login_classic";

const SecretLogin: React.FC = () => {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();

  const requestClassic = params.get("classic") === "1";
  useEffect(() => {
    if (requestClassic) sessionStorage.setItem(CLASSIC_KEY, "1");
    if (params.get("classic") === "0") sessionStorage.removeItem(CLASSIC_KEY);
  }, [requestClassic, params]);

  const envClassic = import.meta.env.VITE_LEGACY_LOGIN === "1";
  const storedClassic = typeof window !== "undefined" && sessionStorage.getItem(CLASSIC_KEY) === "1";
  const classic = requestClassic || envClassic || storedClassic;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#050510]">
        <div className="h-6 w-6 animate-spin rounded-full border border-white/20 border-t-white/70" />
      </div>
    );
  }

  return classic ? <AdminLogin /> : <SpellLogin />;
};

export default SecretLogin;
