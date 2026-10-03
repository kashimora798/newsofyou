import React from "react";
import { Loader2 } from "lucide-react";
import SpellLogin from "@/components/login/SpellLogin";
import { useAuth } from "@/contexts/AuthContext";

/**
 * HiddenLogin — the quiet alternative door at `/you/login`.
 *
 * It renders the same spell login as `/real`, but it is meant to be typed by
 * memory rather than found by tapping around. `/real` (linked from the front
 * page as "Faculty & alumni") is the friendlier alias, and `?classic=1` still
 * reaches the original email/password screen if the spell door ever misbehaves.
 */
const HiddenLogin: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#050510]">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    );
  }

  return <SpellLogin />;
};

export default HiddenLogin;
