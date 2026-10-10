import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, ArrowLeft, Shuffle } from "lucide-react";
import { useGameActions } from "@/contexts/GameActionsContext";

interface ConfettiProps {
  delay: number;
  color: string;
}

const Confetti: React.FC<ConfettiProps> = ({ delay, color }) => {
  const x = useMemo(() => Math.random() * 100, []);
  const rotation = useMemo(() => Math.random() * 720 - 360, []);
  const size = useMemo(() => 6 + Math.random() * 8, []);
  const duration = useMemo(() => 2 + Math.random() * 1.5, []);
  const shape = useMemo(() => (Math.random() > 0.5 ? "50%" : "2px"), []);

  return (
    <motion.div
      initial={{ y: -20, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: "100vh", opacity: 0, rotate: rotation, scale: 0.3 }}
      transition={{ duration, delay, ease: "easeIn" }}
      className="fixed z-50 pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: shape,
        left: `${x}%`,
        top: 0,
      }}
    />
  );
};

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

interface GameOverCelebrationProps {
  isWinner: boolean;
  isDraw: boolean;
  partnerName?: string;
  myScore?: number;
  opponentScore?: number;
  onExit: () => void;
  onRematch: () => void;
  customMessage?: string;
  /** What the numbers mean, e.g. "Guesses (lower wins)". Games already pass it; it was silently dropped before. */
  scoreLabel?: string;
}

const GameOverCelebration: React.FC<GameOverCelebrationProps> = ({
  isWinner,
  isDraw,
  partnerName,
  myScore,
  opponentScore,
  onExit,
  onRematch,
  customMessage,
  scoreLabel,
}) => {
  const [rematchRequested, setRematchRequested] = useState(false);
  const { onDifferentGame } = useGameActions();

  const confettiParticles = useMemo(() => {
    if (!isWinner) return [];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      delay: Math.random() * 1,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
  }, [isWinner]);

  const handleRematch = () => {
    setRematchRequested(true);
    onRematch();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 bg-background/90 backdrop-blur-md flex items-center justify-center p-6"
    >
      {/* Confetti for winner */}
      {confettiParticles.map((p) => (
        <Confetti key={p.id} delay={p.delay} color={p.color} />
      ))}

      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="w-full max-w-sm glass rounded-3xl p-8 text-center space-y-5 shadow-2xl"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
        >
          {isWinner ? (
            <div className="h-20 w-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
          ) : isDraw ? (
            <div className="h-20 w-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <span className="text-4xl">🤝</span>
            </div>
          ) : (
            <div className="h-20 w-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <span className="text-4xl">😢</span>
            </div>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-black text-foreground">
            {isWinner ? "You Won! 🎉" : isDraw ? "It's a Draw!" : "You Lost!"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {customMessage ??
              (isWinner
                ? `Great game against ${partnerName ?? "your partner"}!`
                : isDraw
                ? "Well played by both!"
                : `${partnerName ?? "Your partner"} wins this round!`)}
          </p>
        </motion.div>

        {/* Scores */}
        {(myScore !== undefined && opponentScore !== undefined) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center gap-8"
          >
            <div>
              <p className="text-2xl font-black text-primary">{myScore}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">You</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-2xl font-black text-muted-foreground">{opponentScore}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {partnerName ?? "Partner"}
              </p>
            </div>
          </motion.div>
        )}
        {scoreLabel && myScore !== undefined && opponentScore !== undefined && (
          <p className="-mt-3 text-center text-[11px] text-muted-foreground">{scoreLabel}</p>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3 pt-2"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="flex-1 h-12 rounded-2xl glass font-semibold text-sm text-foreground flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Lobby
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleRematch}
            disabled={rematchRequested}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RotateCcw className={`h-4 w-4 ${rematchRequested ? "animate-spin" : ""}`} />
            {rematchRequested ? "Waiting…" : "Rematch"}
          </motion.button>
        </motion.div>
        
        {onDifferentGame && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-3"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDifferentGame}
              className="w-full h-12 rounded-2xl bg-secondary/80 text-secondary-foreground font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Shuffle className="h-4 w-4" /> Different Game
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default GameOverCelebration;
