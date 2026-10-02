import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, Eye, HeartHandshake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * ConsentSheet — the honesty screen required by build-plan §7.1.
 *
 * Shown to HER before any twin feature produces a single word. Three short
 * sections (what it is / what it sees / what stays private), then Agree or
 * Not now. Consent is recorded server-side by `twin_record_consent()`, which
 * only her account can call.
 */

interface ConsentSheetProps {
  open: boolean;
  ownerName: string;
  /** Only her account can give consent — hide the button for anyone else. */
  canAgree?: boolean;
  onClose: () => void;
  onAgreed: () => void;
}

const ConsentSheet: React.FC<ConsentSheetProps> = ({ open, ownerName, canAgree = true, onClose, onAgreed }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const agree = async () => {
    setBusy(true);
    setError("");
    try {
      const { error: rpcError } = await (supabase.rpc as any)("twin_record_consent");
      if (rpcError) throw rpcError;
      onAgreed();
    } catch {
      setError("That didn't save — try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0b0b18]/95 p-6 text-[#f5efe6] shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-200" />
              <h2 className="font-heading text-lg">A virtual {ownerName}</h2>
            </div>

            <div className="space-y-4 text-sm text-white/75">
              <section className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-200/80" />
                <p>
                  This is an <strong className="font-semibold text-white">AI</strong> that talks in {ownerName}'s style —
                  not {ownerName} himself. It will always carry an “AI” tag, and it will say so if you ask.
                </p>
              </section>
              <section className="flex gap-3">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-rose-200/80" />
                <p>
                  To learn his voice, it reads <strong className="font-semibold text-white">your shared chat history</strong>{" "}
                  and remembers a few facts you two share. Small, redacted snippets only ever go to AI providers that are
                  marked as not training on data.
                </p>
              </section>
              <section className="flex gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-200/80" />
                <p>
                  Your own chats with it are <strong className="font-semibold text-white">private to you</strong> unless you
                  choose to show a conversation. You can switch the whole thing off and delete what it saved about you, any
                  time.
                </p>
              </section>
            </div>

            <div className="mt-6 space-y-2">
              {canAgree ? (
                <button
                  onClick={agree}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-rose-100/25 bg-rose-100/10 text-sm text-rose-50 transition-colors hover:bg-rose-100/15 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
                  I'm okay with it
                </button>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/60">
                  Only she can turn this on — that is the whole point. You can switch it off from Settings or /you/twin.
                </p>
              )}
              <button onClick={onClose} className="h-11 w-full rounded-full text-sm text-white/50 hover:text-white/80">
                Not now
              </button>
            </div>

            {error && <p className="mt-3 text-center text-xs text-rose-200/80">{error}</p>}
            <p className="mt-3 text-center text-[10px] text-white/30">
              You can turn it off later in Settings → AI, or whenever a greeting appears.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConsentSheet;
