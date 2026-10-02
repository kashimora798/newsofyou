import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useTwinGreeting } from "@/hooks/useTwinGreeting";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import { useAuth } from "@/contexts/AuthContext";
import ConsentSheet from "@/components/twin/ConsentSheet";

/**
 * TwinGreeting — the handwritten note at the top of Home.
 *
 * Always labelled as AI (hard rule #7). Three shapes:
 *   - consented  → the greeting types itself out, mood glow, "saved" mood mark
 *   - no consent → a small, warm invitation to the consent sheet (she is the
 *                  only one who can accept it; he can open it too but the RPC
 *                  will refuse his account, which is intentional)
 *   - empty      → nothing at all (never an error box)
 */

const MOOD_GLOW: Record<string, string> = {
  sweet: "rgba(255,190,205,0.45)",
  playful: "rgba(255,220,150,0.40)",
  flirty: "rgba(255,150,190,0.50)",
  missing_you: "rgba(180,190,255,0.45)",
  proud: "rgba(255,215,140,0.45)",
  sleepy: "rgba(160,170,255,0.40)",
  cozy: "rgba(255,200,160,0.42)",
  celebratory: "rgba(255,235,170,0.55)",
  gentle_after_fight: "rgba(180,215,205,0.40)",
  live: "rgba(255,190,205,0.5)",
};

const TwinGreeting: React.FC = () => {
  const { user } = useAuth();
  const animationsEnabled = useAnimationsEnabled();
  const { greeting, loading, dismissed, dismiss, refresh, clearCache } = useTwinGreeting(Boolean(user));
  const [consentOpen, setConsentOpen] = useState(false);
  const [typed, setTyped] = useState("");


  // The server tells us which side of the couple is looking (id-based, not role-based).
  const isOwner = greeting?.is_owner_caller === true;

  const glow = useMemo(() => (greeting?.mood ? MOOD_GLOW[greeting.mood] ?? MOOD_GLOW.sweet : MOOD_GLOW.sweet), [greeting?.mood]);

  // Typewriter — instant when animations are off (prefers-reduced-motion).
  useEffect(() => {
    if (!greeting?.text) {
      setTyped("");
      return;
    }
    if (!animationsEnabled) {
      setTyped(greeting.text);
      return;
    }
    setTyped("");
    let i = 0;
    const step = Math.max(1, Math.round(greeting.text.length / 90));
    const timer = setInterval(() => {
      i += step;
      setTyped(greeting.text.slice(0, i));
      if (i >= greeting.text.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [greeting?.text, animationsEnabled]);

  if (dismissed || loading) return null;
  // `static` is the guaranteed last resort (empty bank) — still worth showing:
  // the twin should never silently disappear.
  if (!greeting) return null;

  // ── consent invitation ───────────────────────────────────────────────────
  if (greeting.source === "consent") {
    return (
      <>
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setConsentOpen(true)}
          className="mb-2 mt-1 flex items-center gap-2 self-start rounded-full border border-border/60 bg-muted/40 px-4 py-2 text-left text-xs text-muted-foreground backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            {isOwner
              ? "Your twin is ready — it just needs her okay ✨"
              : `${greeting.owner_name} left an AI version of himself here — want to meet it?`}
          </span>
        </motion.button>
        <ConsentSheet
          open={consentOpen}
          ownerName={greeting.owner_name}
          canAgree={!isOwner}
          onClose={() => setConsentOpen(false)}
          onAgreed={() => {
            setConsentOpen(false);
            clearCache();
            void refresh();
          }}
        />
      </>
    );
  }

  // ── the greeting ─────────────────────────────────────────────────────────
  const showCaret = animationsEnabled && typed.length < (greeting.text?.length ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative mb-2 mt-1 self-start"
    >
      <div
        className="pointer-events-none absolute -inset-x-4 -inset-y-3 rounded-3xl blur-2xl"
        style={{ background: `radial-gradient(ellipse at 20% 30%, ${glow}, transparent 70%)`, opacity: 0.55 }}
      />
      <div className="relative flex items-start gap-2">
        <p className="font-handwriting text-[21px] leading-snug text-foreground">
          {typed || "…"}
          {showCaret && <span className="ml-0.5 animate-pulse">|</span>}
        </p>
        <button
          onClick={dismiss}
          aria-label="hide greeting"
          className="mt-1 shrink-0 rounded-full p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative mt-1.5 flex items-center gap-1.5 pl-0.5">
        <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-[2px] text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {greeting.label}
        </span>
        {greeting.mood && greeting.mood !== "live" && (
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">{greeting.mood.replace(/_/g, " ")}</span>
        )}
      </div>
    </motion.div>
  );
};

export default TwinGreeting;
