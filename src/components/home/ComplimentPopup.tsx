import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompliments } from "@/hooks/useCompliments";
import { Heart, X, Calendar, Sparkles } from "lucide-react";
import { formatFullDate } from "@/lib/dateUtils";

const ComplimentPopup: React.FC = () => {
  const { randomCompliment, dismissCompliment } = useCompliments();

  return (
    <AnimatePresence>
      {randomCompliment && (
        /* Backdrop — pointer-events blocked when not visible by AnimatePresence unmounting */
        <motion.div
          key={randomCompliment.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={dismissCompliment}
        >
          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative mx-5 w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.06) 100%)",
              border: "1px solid hsl(var(--primary) / 0.18)",
              boxShadow:
                "0 24px 64px -12px hsl(var(--primary) / 0.28), 0 0 0 1px hsl(var(--primary) / 0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="absolute top-4 right-4">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={dismissCompliment}
                className="p-1.5 rounded-full hover:bg-muted/80 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            </div>

            {/* Icon + label */}
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(330 80% 70% / 0.22))",
                }}
              >
                <Heart className="h-8 w-8 text-primary" />
              </motion.div>

              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="h-3 w-3 text-primary/60" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                  A Secret Compliment
                </p>
                <Sparkles className="h-3 w-3 text-primary/60" />
              </div>

              {/* Message */}
              <p className="text-base text-foreground font-medium leading-relaxed px-1 mb-2">
                &ldquo;{randomCompliment.content}&rdquo;
              </p>

              <p className="text-xs text-muted-foreground mb-5">
                Your partner left this just for you 💕
              </p>

              {/* Written date */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-5 px-3 py-2 rounded-xl bg-muted/40 w-full justify-center">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>Written {formatFullDate(randomCompliment.created_at)}</span>
              </div>

              {/* CTA button */}
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
