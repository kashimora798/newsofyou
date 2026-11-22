import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookHeart } from "lucide-react";
import { Heart, Sparkle, Star } from "./Decor";
import { plural } from "@/lib/journal";

interface Props {
  totals: { days: number; messages: number; photos: number };
  loading: boolean;
  lastDayLabel: string | null;
  onOpen: () => void;
  onContinue: () => void;
}

const SCRIPT = "'Kaushan Script', 'Pacifico', cursive";
const TYPE = "'Special Elite', 'Courier New', monospace";

/** Closed leather book. Tapping swings the cover open like a real one. */
const JournalCover: React.FC<Props> = ({ totals, loading, lastDayLabel, onOpen, onContinue }) => {
  const [opening, setOpening] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5" style={{ perspective: 1400 }}>
      <motion.button
        type="button"
        aria-label="Open the journal"
        disabled={loading}
        onClick={() => setOpening(true)}
        className="relative block overflow-hidden rounded-r-2xl rounded-l-md text-left outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        style={{
          width: 290,
          height: 400,
          transformOrigin: "left center",
          background: "linear-gradient(135deg, #8d3d52 0%, #6e2a40 55%, #561f33 100%)",
          boxShadow: "10px 12px 30px rgba(50,20,30,.45), inset 0 0 0 2px rgba(255,220,200,.12)",
        }}
        initial={{ opacity: 0, y: 18, rotateY: 0 }}
        animate={opening ? { rotateY: -150, opacity: 0.2 } : { opacity: 1, y: 0, rotateY: [0, -4, 0] }}
        transition={opening ? { duration: 0.75, ease: [0.45, 0, 0.2, 1] } : { duration: 0.6, rotateY: { delay: 1.2, duration: 1.4, repeat: Infinity, repeatDelay: 3.5 } }}
        onAnimationComplete={() => opening && onOpen()}
        whileHover={opening ? undefined : { y: -4 }}
      >
        {/* spine + stitching */}
        <div className="absolute inset-y-0 left-0 w-5" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.35), rgba(0,0,0,.05))" }} />
        <div className="absolute inset-3 left-7 rounded-lg border-2 border-dashed" style={{ borderColor: "rgba(255,225,205,.35)" }} />
        {/* gold title plate */}
        <div className="absolute inset-x-9 top-16 text-center">
          <Sparkle size={22} color="#f3d08a" className="mx-auto mb-1 journal-float" />
          <p style={{ fontFamily: TYPE, fontSize: 11, letterSpacing: ".3em", color: "#f3d08a" }} className="uppercase">the diary of</p>
          <h1 style={{ fontFamily: SCRIPT, fontSize: 46, lineHeight: 1.05, color: "#f6dca5", textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>Us</h1>
          <div className="mx-auto my-2 h-px w-24" style={{ background: "linear-gradient(90deg, transparent, #f3d08a, transparent)" }} />
          <p style={{ fontFamily: "Caveat, cursive", fontSize: 19, color: "#f3d6c8" }}>every little day, bound together</p>
        </div>
        <div className="absolute inset-x-0 bottom-28 flex items-center justify-center gap-3">
          <Star size={18} color="#f3d08a" /><Heart size={30} color="#f3a1b3" className="journal-float" /><Star size={18} color="#f3d08a" />
        </div>
        <div className="absolute inset-x-8 bottom-9 text-center" style={{ fontFamily: TYPE, fontSize: 11, color: "#f0cdbd" }}>
          {loading ? "gathering your pages…" : totals.days === 0 ? "a fresh book, waiting for you" : `${plural(totals.days, "day")} · ${plural(totals.messages, "note")} · ${plural(totals.photos, "photo")}`}
        </div>
        {/* ribbon */}
        <div className="absolute -bottom-1 right-10 h-14 w-4" style={{ background: "#e8b84a", clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)" }} />
      </motion.button>

      {!opening && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm text-foreground/70" style={{ fontFamily: "Caveat, cursive", fontSize: 20 }}>
            <BookHeart className="h-4 w-4" /> tap the cover to open
          </p>
          {lastDayLabel && !loading && (
            <button type="button" onClick={onContinue} className="rounded-full border border-primary/30 bg-card/80 px-4 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur hover:bg-card">
              Continue reading · {lastDayLabel}
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default JournalCover;
