import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompliments } from "@/hooks/useCompliments";
import { Heart, X, Calendar, Sparkles } from "lucide-react";
import { formatFullDate } from "@/lib/dateUtils";

const ComplimentPopup: React.FC = () => {
  const { randomCompliment, dismissCompliment } = useCompliments();

  // Allow ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && randomCompliment) {
        dismissCompliment();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [randomCompliment, dismissCompliment]);

  return (
    <AnimatePresence>
      {randomCompliment && (
        <motion.div
          key={randomCompliment.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={dismissCompliment}
        >
          {/* Card Modal with max-height and flex-col layout */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="relative w-full max-w-sm max-h-[85dvh] flex flex-col rounded-3xl p-5 shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.98) 70%, hsl(var(--primary) / 0.08) 100%)",
              border: "1px solid hsl(var(--primary) / 0.22)",
              boxShadow: "0 24px 64px -12px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--primary) / 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Close button & badge */}
            <div className="flex items-center justify-between shrink-0 pb-2 border-b border-border/40">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Secret Compliment
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={dismissCompliment}
                className="p-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            {/* Scrollable body content */}
            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-3.5 scrollbar-thin" style={{ WebkitOverflowScrolling: "touch" }}>
              {/* Icon */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="h-14 w-14 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(330 80% 70% / 0.25))",
                  }}
                >
                  <Heart className="h-7 w-7 text-primary fill-primary/20" />
                </motion.div>
              </div>

              {/* Message Content */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/30">
                <p className="text-sm sm:text-base text-foreground font-medium leading-relaxed whitespace-pre-wrap select-text">
                  &ldquo;{randomCompliment.content}&rdquo;
                </p>
              </div>

              <p className="text-xs text-center text-muted-foreground font-medium">
                Your partner left this just for you 💕
              </p>

              {/* Written date */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-3 py-2 rounded-xl bg-muted/30 justify-center">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>Written {formatFullDate(randomCompliment.created_at)}</span>
              </div>
            </div>

            {/* Sticky Action button at bottom */}
            <div className="pt-3 shrink-0 border-t border-border/40">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={dismissCompliment}
                className="w-full py-3 rounded-2xl text-sm font-bold text-primary-foreground transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(330 80% 58%))",
                  boxShadow: "0 4px 16px -4px hsl(var(--primary) / 0.4)",
                }}
              >
                Aww, thank you! 🥰
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ComplimentPopup;
