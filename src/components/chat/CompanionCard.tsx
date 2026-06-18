import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Heart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompanionReaction } from "@/hooks/useAiCompanion";

interface CompanionCardProps {
  loading: boolean;
  result: CompanionReaction | null;
  onClose: () => void;
}

const toneStyles: Record<string, { icon: React.ReactNode; ring: string }> = {
  sweet: { icon: <Heart className="h-5 w-5 text-pink-500" />, ring: "border-pink-400/40" },
  hurtful: { icon: <ShieldCheck className="h-5 w-5 text-sky-500" />, ring: "border-sky-400/40" },
  neutral: { icon: <Sparkles className="h-5 w-5 text-primary" />, ring: "border-primary/40" },
};

const CompanionCard: React.FC<CompanionCardProps> = ({ loading, result, onClose }) => {
  const style = result ? toneStyles[result.tone] ?? toneStyles.neutral : toneStyles.neutral;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        className={`m-4 w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl ${style.ring}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          {style.icon}
          <h3 className="text-sm font-semibold text-foreground">Your companion</h3>
        </div>
        {loading ? (
          <p className="animate-pulse text-sm text-muted-foreground">Thinking it over…</p>
        ) : result?.reaction ? (
          <p className="text-sm leading-relaxed text-foreground">{result.reaction}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Couldn't reach the companion right now. Try again in a moment.</p>
        )}
        <Button onClick={onClose} variant="ghost" className="mt-3 w-full">Close</Button>
      </motion.div>
    </motion.div>
  );
};

export default CompanionCard;
