/**
 * BondTreeHUD.tsx
 * Ambient romantic HUD for the Bond Tree forest page.
 * Shows the tree's growth stage, message count, and a back button.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getGrowthStage } from "./BondTree";

interface Props {
  totalMessages: number;
  onBack: () => void;
}

export default function BondTreeHUD({ totalMessages, onBack }: Props) {
  const stage = useMemo(() => getGrowthStage(totalMessages), [totalMessages]);

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Stage badge — top center */}
      <motion.div
        key={stage.label}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center"
      >
        <div
          className="px-5 py-2 rounded-full text-white text-xs font-bold tracking-widest uppercase"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}
        >
          🌳 {stage.label}
        </div>
      </motion.div>

      {/* Bottom panel */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-sm"
      >
        <div
          className="rounded-3xl p-5 text-center"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(16px)" }}
        >
          {/* Message count */}
          <p className="text-white/60 text-xs font-medium tracking-widest uppercase mb-1">
            Together you've sent
          </p>
          <motion.p
            key={totalMessages}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            className="text-white text-4xl font-black tabular-nums mb-1"
          >
            {totalMessages.toLocaleString()}
          </motion.p>
          <p className="text-white/60 text-xs mb-3">messages 💌</p>

          {/* Divider */}
          <div className="w-12 h-px bg-white/20 mx-auto mb-3" />

          {/* Description */}
          <p className="text-white/80 text-sm font-medium leading-relaxed italic">
            "{stage.description}"
          </p>
        </div>
      </motion.div>

      {/* Hint — drag to orbit */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 2, duration: 1.5 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 text-white/50 text-xs tracking-widest pointer-events-none"
      >
        drag to orbit · pinch to zoom
      </motion.p>
    </>
  );
}
