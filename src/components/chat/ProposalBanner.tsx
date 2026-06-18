import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock } from "lucide-react";
import type { Proposal } from "@/hooks/useProposals";

interface ProposalBannerProps {
  incomingPending: Proposal[];
  active: Proposal | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onComplete: (id: string) => void;
  onExpire: (id: string) => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ProposalBanner: React.FC<ProposalBannerProps> = ({
  incomingPending,
  active,
  onAccept,
  onDecline,
  onComplete,
  onExpire,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const firedExpiryRef = React.useRef<string | null>(null);

  // Tick once a second only while there is an active time-limit pact.
  const hasCountdown = active?.type === "time_limit" && !!active.ends_at;
  useEffect(() => {
    if (!hasCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasCountdown]);

  // When the countdown reaches zero, complete it and notify the parent once.
  useEffect(() => {
    if (!hasCountdown || !active?.ends_at) return;
    const remaining = new Date(active.ends_at).getTime() - now;
    if (remaining <= 0 && firedExpiryRef.current !== active.id) {
      firedExpiryRef.current = active.id;
      onComplete(active.id);
      onExpire(active.id);
    }
  }, [hasCountdown, active, now, onComplete, onExpire]);

  const incoming = incomingPending[0] ?? null;

  return (
    <div className="shrink-0">
      <AnimatePresence>
        {incoming && (
          <motion.div
            key={`incoming-${incoming.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-primary/20 bg-primary/5"
          >
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-lg">🤝</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{incoming.title}</p>
                <p className="text-[10px] text-muted-foreground">Your partner proposed a pact — both must accept</p>
              </div>
              <button
                onClick={() => onDecline(incoming.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70"
                title="Decline"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => onAccept(incoming.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                title="Accept"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {active && (
          <motion.div
            key={`active-${active.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-card"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                <span className="font-medium">{active.title}</span>
                <span className="text-muted-foreground"> · active pact</span>
              </p>
              {hasCountdown && active.ends_at && (
                <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                  {formatRemaining(new Date(active.ends_at).getTime() - now)}
                </span>
              )}
              <button
                onClick={() => onComplete(active.id)}
                className="ml-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
              >
                End
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProposalBanner;
