import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  BellPlus,
  CalendarPlus,
  Check,
  ListChecks,
  Loader2,
  PenLine,
  Send,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TwinAction } from "@/hooks/useTwinActions";

/**
 * ActionCard — the confirm card (build-plan §Phase 7).
 *
 * One rule, printed on every write card: the twin proposes, you tap, and only
 * then does anything get written. A read card (a summary, a plan, a rewrite)
 * has nothing to confirm — it is just shown, with a copy button.
 */

const ICONS: Record<string, React.ElementType> = {
  schedule_message: Send,
  create_reminder: BellPlus,
  add_event: CalendarPlus,
  format_message: PenLine,
  daily_summary: Sun,
  plan: ListChecks,
};

const TONE: Record<string, string> = {
  schedule_message: "text-sky-300",
  create_reminder: "text-amber-300",
  add_event: "text-emerald-300",
  format_message: "text-violet-300",
  daily_summary: "text-rose-300",
  plan: "text-teal-300",
};

const WRITE_KINDS = new Set(["schedule_message", "create_reminder", "add_event"]);

function whenLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

interface ActionCardProps {
  action: TwinAction;
  onConfirm?: (id: string) => Promise<void> | void;
  onCancel?: (id: string) => Promise<void> | void;
  /** Read kinds arrive already answered. */
  text?: string | null;
}

const ActionCard: React.FC<ActionCardProps> = ({ action, onConfirm, onCancel, text }) => {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [copied, setCopied] = useState(false);

  const Icon = ICONS[action.kind] ?? Sparkles;
  const tone = TONE[action.kind] ?? "text-primary";
  const isWrite = WRITE_KINDS.has(action.kind);
  const done = action.status === "done";
  const failed = action.status === "failed";
  const dead = action.status === "cancelled" || action.status === "expired";
  const when = whenLabel(action.when_at);
  const answer = text ?? (action.payload?.answer as string | undefined) ?? (action.payload?.suggestion as string | undefined) ?? null;
  const willWrite = (action.preview ?? action.payload?.text ?? action.payload?.title ?? "") as string;

  const run = async (which: "confirm" | "cancel") => {
    if (!isWrite) return;
    setBusy(which);
    try {
      if (which === "confirm") await onConfirm?.(action.id);
      else await onCancel?.(action.id);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the sheet has a select-all fallback: the text is on screen anyway */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pane pane-glow overflow-hidden p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5">
          <Icon className={`h-3.5 w-3.5 ${tone}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-snug">{action.title}</p>
          {action.detail && <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{action.detail}</p>}

          {isWrite && (
            <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="text-[13px] leading-relaxed">{willWrite}</p>
              {when && <p className="mt-1 text-[11px] text-muted-foreground">{when}</p>}
            </div>
          )}

          {!isWrite && answer && (
            <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{answer}</p>
            </div>
          )}

          {/* actions row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {isWrite && action.status === "proposed" && (
              <>
                <Button size="sm" className="h-7 rounded-full px-3 text-[12px]" onClick={() => void run("confirm")} disabled={busy !== null}>
                  {busy === "confirm" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  <span className="ml-1.5">Yes, do it</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-3 text-[12px]"
                  onClick={() => void run("cancel")}
                  disabled={busy !== null}
                >
                  {busy === "cancel" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  <span className="ml-1.5">No</span>
                </Button>
              </>
            )}

            {isWrite && action.status === "confirmed" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> writing it now…
              </span>
            )}
            {done && isWrite && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-300">
                <Check className="h-3 w-3" /> done
              </span>
            )}
            {failed && (
              <span className="text-[11.5px] text-destructive">couldn&apos;t write it — {action.error ?? "try again later"}</span>
            )}
            {dead && <span className="text-[11.5px] text-muted-foreground">{action.status}</span>}

            {!isWrite && answer && (
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-[12px]" onClick={() => void copy()}>
                {copied ? <Check className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                <span className="ml-1.5">{copied ? "copied" : "use this"}</span>
              </Button>
            )}
          </div>

          {isWrite && action.status === "proposed" && (
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              {action.expires_at
                ? `nothing happens until you tap — this card fades away on its own`
                : `nothing happens until you tap`}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ActionCard;
