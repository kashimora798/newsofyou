import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import {
  isAnniversaryWindow,
  isAnniversaryToday,
  daysUntilAnniversary,
  yearsTogether,
  ordinal,
  hasAutoLaunchedThisSession,
  markAutoLaunched,
} from "@/lib/anniversary";

/**
 * Surfaces the "Our Year Wrapped" entry point during the anniversary window,
 * and AUTO-LAUNCHES the experience once per session on the actual day.
 * Renders nothing outside the window.
 */
const AnniversaryBanner: React.FC = () => {
  const navigate = useNavigate();
  const inWindow = isAnniversaryWindow();
  const today = isAnniversaryToday();

  // Auto-launch on the day (once per session).
  useEffect(() => {
    if (today && !hasAutoLaunchedThisSession()) {
      markAutoLaunched();
      navigate("/wrapped");
    }
  }, [today, navigate]);

  if (!inWindow) return null;

  const years = yearsTogether();
  const until = daysUntilAnniversary();
  const yearLabel = years >= 1 ? `${ordinal(years)} anniversary` : "1 year together";

  const subtitle = today
    ? "It's the big day! Tap to relive your year 💞"
    : until <= 7 && until > 0
    ? `${until} day${until === 1 ? "" : "s"} to go — a surprise awaits ✨`
    : "Relive your year together 💞";

  return (
    <motion.button
      onClick={() => navigate("/wrapped")}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full rounded-2xl p-4 overflow-hidden text-left"
      style={{ background: "linear-gradient(120deg, #4c1d95 0%, #be123c 60%, #f59e0b 100%)" }}
    >
      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)" }}
        animate={{ x: ["-120%", "120%"] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
      />
      <div className="relative z-10 flex items-center gap-3">
        <motion.div
          animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 2.6, repeat: Infinity }}
          className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Our Year Wrapped · {yearLabel}</p>
          <p className="text-white/80 text-[11px] mt-0.5 truncate">{subtitle}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
      </div>
    </motion.button>
  );
};

export default AnniversaryBanner;
