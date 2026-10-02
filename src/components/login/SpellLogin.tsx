import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { captureLoginSession } from "@/hooks/useLoginFingerprint";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import AuroraBackground from "@/components/login/AuroraBackground";

/**
 * SpellLogin — the romantic door at /you/login.
 *
 * Two softly glowing name cards (from twin_config, labels only) → tap one →
 * "whisper your spell" → the `spell-login` edge function resolves the account
 * server-side and returns a session, which we install with setSession().
 * No email ever reaches the browser.
 *
 * States: idle → name chosen → typing → checking → success → (wrong spell dims
 * the stars; too many attempts keeps them dim for a minute).
 */

interface LoginCard {
  key: "owner" | "partner";
  label: string;
}

interface SpellAnswer {
  session?: { access_token: string; refresh_token: string };
  userId?: string;
  error?: string;
  retry_after?: number;
  dim?: boolean;
}

const FALLBACK_CARDS: LoginCard[] = [
  { key: "owner", label: "Him" },
  { key: "partner", label: "Her" },
];

const SpellLogin: React.FC = () => {
  const navigate = useNavigate();
  const animationsEnabled = useAnimationsEnabled();

  const [cards, setCards] = useState<LoginCard[]>(FALLBACK_CARDS);
  const [selected, setSelected] = useState<LoginCard | null>(null);
  const [spell, setSpell] = useState("");
  const [reveal, setReveal] = useState(false);
  const [state, setState] = useState<"idle" | "checking" | "success" | "dimmed">("idle");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Name cards (labels only — never ids or emails).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await (supabase.rpc as any)("twin_login_cards");
        const payload = (data ?? null) as { owner_label?: string; partner_label?: string } | null;
        if (!cancelled && payload?.owner_label && payload?.partner_label) {
          setCards([
            { key: "owner", label: String(payload.owner_label) },
            { key: "partner", label: String(payload.partner_label) },
          ]);
        }
      } catch {
        /* keep the neutral fallback labels */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [selected]);

  const canSubmit = useMemo(() => spell.trim().length >= 4 && state !== "checking", [spell, state]);

  const submit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!selected || !canSubmit) return;

      setState("checking");
      setMessage("");

      try {
        const { data, error } = await supabase.functions.invoke("spell-login", {
          body: { name: selected.label, spell },
        });

        // Non-2xx lands in `error` with the body on `error.context`; read it so
        // the rate-limit answer ("dimmed", retry_after) reaches the screen.
        let payload = (data ?? {}) as SpellAnswer;
        if (error && !payload.error) {
          try {
            const body = await (error as { context?: Response }).context?.json();
            if (body) payload = body as SpellAnswer;
          } catch {
            /* fall through to the generic message */
          }
        }

        if (error || payload.error || !payload.session) {
          const tooMany = payload.error === "dimmed";
          setState(tooMany ? "dimmed" : "idle");
          setShake((n) => n + 1);
          setMessage(
            tooMany
              ? `the stars are dim for ${Math.max(1, Math.round((payload.retry_after ?? 60) / 60))} min…`
              : "the spell didn't work",
          );
          setSpell("");
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        if (sessionError) throw sessionError;

        setState("success");
        if (payload.userId) void captureLoginSession(payload.userId);

        // Route by role: partners to /home, everyone else to their dashboard.
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", payload.userId ?? "")
          .maybeSingle();
        const role = (profile as { role?: string } | null)?.role;
        const destination = role === "partner" ? "/home" : "/you/dashboard";

        setTimeout(() => navigate(destination, { replace: true }), animationsEnabled ? 900 : 120);
      } catch {
        setState("idle");
        setShake((n) => n + 1);
        setMessage("the spell didn't work");
      }
    },
    [selected, canSubmit, spell, navigate, animationsEnabled],
  );

  const dim = state === "dimmed";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050510] text-[#f5efe6]">
      <div
        className="transition-opacity duration-1000"
        style={{ opacity: dim ? 0.25 : 1, filter: dim ? "saturate(0.4)" : "none" }}
      >
        <AuroraBackground intensity={selected ? 1.6 : 1} />
      </div>

      {/* success bloom */}
      <AnimatePresence>
        {state === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30"
            style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,196,214,0.35), transparent 60%)" }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-white/35 transition-colors hover:text-white/70">
          <ArrowLeft className="h-3.5 w-3.5" />
          back
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center gap-10">
          <AnimatePresence mode="wait">
            {!selected ? (
              <motion.div
                key="cards"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center gap-8"
              >
                <p className="text-center text-sm font-light tracking-wide text-white/45">
                  someone left you a door…
                </p>
                <div className="flex flex-col items-center gap-5">
                  {cards.map((card, i) => (
                    <motion.button
                      key={card.key}
                      onClick={() => setSelected(card)}
                      whileHover={animationsEnabled ? { scale: 1.04 } : undefined}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15 * i, duration: 0.6 }}
                      className="group relative h-28 w-56 rounded-full border border-white/10 text-center backdrop-blur-md transition-colors hover:border-rose-200/40 sm:h-32 sm:w-64"
                      style={{
                        background:
                          "radial-gradient(circle at 50% 30%, rgba(255,214,224,0.22), rgba(255,214,224,0.04) 60%, transparent 75%)",
                        boxShadow: "0 0 60px -10px rgba(255,190,205,0.35)",
                      }}
                    >
                      <span className="font-heading text-xl tracking-wide text-white/90 sm:text-2xl">
                        {card.label}
                      </span>
                      <span className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        style={{ boxShadow: "0 0 80px -6px rgba(255,190,205,0.5)" }} />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="spell"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full"
              >
                <div className="mb-8 text-center">
                  <p className="font-heading text-2xl text-white/90">{selected.label}</p>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setSpell("");
                      setMessage("");
                      setState("idle");
                    }}
                    className="mt-1 text-[11px] text-white/35 underline-offset-2 hover:underline"
                  >
                    not you? choose again
                  </button>
                </div>

                <motion.form
                  onSubmit={submit}
                  key={shake}
                  animate={animationsEnabled && shake > 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
                  transition={{ duration: 0.45 }}
                  className="space-y-5"
                >
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={reveal ? "text" : "password"}
                      value={spell}
                      onChange={(e) => setSpell(e.target.value)}
                      placeholder="whisper your spell…"
                      autoComplete="current-password"
                      disabled={state === "checking" || state === "success" || dim}
                      className="h-14 w-full rounded-full border border-white/15 bg-white/5 px-6 pr-12 text-center font-light tracking-[0.2em] text-white placeholder:tracking-normal placeholder:text-white/30 outline-none transition-all focus:border-rose-200/50 focus:bg-white/[0.07]"
                      style={{ boxShadow: "0 0 40px -18px rgba(255,200,215,0.55) inset" }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setReveal((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
                      aria-label={reveal ? "hide spell" : "show spell"}
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex h-12 w-full items-center justify-center rounded-full border border-rose-100/25 bg-rose-100/10 text-sm tracking-wide text-rose-50/90 transition-all hover:bg-rose-100/15 disabled:opacity-35"
                    style={{ boxShadow: "0 0 50px -20px rgba(255,190,205,0.8)" }}
                  >
                    {state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "open"}
                  </button>
                </motion.form>

                <div className="mt-6 h-5 text-center text-xs text-rose-100/55" role="status" aria-live="polite">
                  {state === "checking" ? "listening…" : message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};

export default SpellLogin;
