/**
 * Forest.tsx — /forest, "Our Tree".
 *
 * The tree that grows as you talk. It used to be a WebGL scene loading millions
 * of pixels of bark and grass to draw one tree; it is now a single SVG that
 * draws instantly, works with no signal once the app is cached, and asks the
 * database for one number instead of the whole conversation.
 *
 * Everything you could read on the old screen is still here: the stage, the
 * count, how far the next stage is, and your days together.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import { useTreeGrowth } from "@/hooks/useTreeGrowth";
import OurTree from "@/components/tree/OurTree";
import { GROWTH_STAGES, getGrowthStage, stageHint, stageProgress } from "@/lib/treeGrowth";
import { daysTogether } from "@/lib/anniversary";

export default function Forest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const animations = useAnimationsEnabled();
  const { totalMessages, loading, error, refresh } = useTreeGrowth(user?.id);

  const stage = useMemo(() => getGrowthStage(totalMessages), [totalMessages]);
  const progress = useMemo(() => stageProgress(totalMessages), [totalMessages]);
  const hint = useMemo(() => stageHint(totalMessages), [totalMessages]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0b0817] text-white">
      {/* a soft sky, drawn with CSS only */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[62%]"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1f4d 0%, #0b0817 70%)" }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="rounded-full bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest backdrop-blur">
          🌸 {stage.label}
        </span>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-white/70">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Growing your tree…</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={animations ? { opacity: 0, scale: 0.92 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="w-full"
            >
              <OurTree totalMessages={totalMessages} still={!animations} />
            </motion.div>

            <motion.div
              initial={animations ? { opacity: 0, y: 18 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mt-2 w-full max-w-sm rounded-3xl bg-white/[0.07] p-5 text-center backdrop-blur"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                {totalMessages.toLocaleString()} message{totalMessages === 1 ? "" : "s"} ·{" "}
                {daysTogether().toLocaleString()} days together
              </p>
              <p className="mt-2 text-sm italic text-white/80">“{stage.description}”</p>

              {hint && (
                <>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.round(progress * 100)}%`, background: stage.tint }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/55">{hint}</p>
                </>
              )}

              {error && (
                <button
                  onClick={() => void refresh()}
                  className="mt-3 text-[11px] text-white/60 underline underline-offset-4"
                >
                  Couldn’t read the count — tap to try again
                </button>
              )}
            </motion.div>

            {/* the ladder — where you are, and what is next */}
            <div className="mt-5 flex w-full max-w-sm items-center justify-center gap-1.5">
              {GROWTH_STAGES.map((s) => {
                const reached = totalMessages >= s.minMessages;
                return (
                  <div
                    key={s.key}
                    title={s.label}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ background: reached ? s.tint : "rgba(255,255,255,0.12)" }}
                  />
                );
              })}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
              <Sparkles className="h-3 w-3" />
              it grows every time you talk
            </p>
          </>
        )}
      </main>
    </div>
  );
}
