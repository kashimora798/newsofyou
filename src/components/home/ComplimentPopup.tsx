import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, Calendar, Sparkles } from "lucide-react";
import { formatFullDate } from "@/lib/dateUtils";
import type { Compliment } from "@/hooks/useCompliments";

interface ComplimentPopupProps {
  compliment?: Compliment | null;
  onDismiss?: () => void;
}

const ComplimentPopup: React.FC<ComplimentPopupProps> = ({ compliment, onDismiss }) => {
  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && compliment && onDismiss) {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compliment, onDismiss]);

  if (!compliment) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={compliment.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm select-none"
        onClick={onDismiss}
      >
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative w-full max-w-sm max-h-[82dvh] flex flex-col rounded-3xl p-5 shadow-2xl bg-card border border-primary/25"
          style={{
            boxShadow: "0 24px 64px -12px hsl(var(--primary) / 0.35), 0 0 0 1px hsl(var(--primary) / 0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between shrink-0 pb-3 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                A Secret Compliment
              </span>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div
            className="flex-1 overflow-y-auto py-4 px-1 space-y-4 scrollbar-thin select-text"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Heart Animation */}
            <div className="flex justify-center select-none">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="h-14 w-14 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/20"
              >
                <Heart className="h-7 w-7 text-primary fill-primary/30" />
              </motion.div>
            </div>

            {/* Note text */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/40">
              <p className="text-sm sm:text-base text-foreground font-medium leading-relaxed whitespace-pre-wrap">
                &ldquo;{compliment.content}&rdquo;
              </p>
            </div>

            <p className="text-xs text-center text-muted-foreground font-medium select-none">
              Your partner left this just for you 💕
            </p>

            {/* Date */}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-3 py-2 rounded-xl bg-muted/30 justify-center select-none">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>Written {formatFullDate(compliment.created_at)}</span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3 shrink-0 border-t border-border/50">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-3 rounded-2xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 active:scale-98 transition-all shadow-lg shadow-primary/25 cursor-pointer"
            >
              Aww, thank you! 🥰
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ComplimentPopup;
