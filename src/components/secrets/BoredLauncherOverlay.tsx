import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GAME_CATALOG } from "@/lib/gameCatalog";

interface Props {
  gameType: string;
  isMine: boolean;
  onDismiss: () => void;
}

const SPIN_DURATION_MS = 2500;
const TICK_INTERVAL_MS = 100;

const BoredLauncherOverlay: React.FC<Props> = ({ gameType, isMine, onDismiss }) => {
  const navigate = useNavigate();
  const [displayGameLabel, setDisplayGameLabel] = useState<string>("Spinning...");
  const [isSpinning, setIsSpinning] = useState(true);

  useEffect(() => {
    const quickGames = GAME_CATALOG.filter((g) => g.category === "quick" && g.status === "ready");
    if (quickGames.length === 0) return;

    let ticks = 0;
    const maxTicks = SPIN_DURATION_MS / TICK_INTERVAL_MS;

    const interval = setInterval(() => {
      ticks++;
      // Pick a random game for the slot machine effect
      const randomGame = quickGames[Math.floor(Math.random() * quickGames.length)];
      setDisplayGameLabel(randomGame.label);

      if (ticks >= maxTicks) {
        clearInterval(interval);
        // Land on the actual chosen game
        const finalGame = GAME_CATALOG.find((g) => g.type === gameType);
        if (finalGame) setDisplayGameLabel(finalGame.label);
        setIsSpinning(false);

        // Wait a brief moment after landing, then navigate
        setTimeout(() => {
          onDismiss();
          if (isMine) {
            navigate(`/games?boredChallenge=${gameType}`);
          } else {
            navigate(`/games`);
          }
        }, 1200);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [gameType, isMine, navigate, onDismiss]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="relative flex flex-col items-center justify-center rounded-[32px] bg-background/80 p-8 shadow-2xl backdrop-blur-xl border border-white/10"
      >
        <p className="mb-2 text-sm font-medium tracking-widest text-muted-foreground uppercase">I'm Bored!</p>
        <h2 className="mb-8 text-2xl font-semibold text-foreground">Let's play...</h2>

        <div className="relative flex h-24 w-64 items-center justify-center overflow-hidden rounded-2xl bg-black/20 shadow-inner px-4 text-center">
          {isSpinning ? (
            <div className="text-3xl font-bold tracking-tight text-white/90 animate-pulse truncate max-w-full">
              {displayGameLabel}
            </div>
          ) : (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 350, damping: 15 }}
              className="text-3xl font-black tracking-tight text-primary-foreground bg-primary px-6 py-2 rounded-2xl shadow-lg border border-primary/20 line-clamp-1"
            >
              {displayGameLabel}
            </motion.div>
          )}
        </div>

        {!isSpinning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-12 font-medium text-white/80"
          >
            Launching...
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default BoredLauncherOverlay;
