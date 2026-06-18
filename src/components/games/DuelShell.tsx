import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import GameOverCelebration from "./GameOverCelebration";
import type { DuelMatch } from "@/hooks/useDuelMatch";

interface Props {
  title: string;
  subtitle?: string;
  partnerName?: string;
  match: DuelMatch<any>;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
  children: React.ReactNode;
}

/**
 * Shared chrome for live-duel games: header, live score bar, connecting state,
 * round pill, and the game-over celebration. Each game renders its own play
 * area via `children`.
 */
const DuelShell: React.FC<Props> = ({
  title,
  subtitle,
  partnerName,
  match,
  onBack,
  onPlayAgain,
  children,
}) => {
  const { phase, round, totalRounds, myScore, oppScore, peerReady } = match;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack} className="p-2 rounded-full glass-subtle">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
          <p className="text-[10px] text-muted-foreground truncate">
            {subtitle ? `${subtitle} · ` : ""}vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase !== "connecting" && phase !== "gameover" && (
          <div className="text-[10px] font-bold text-muted-foreground tabular-nums">
            R{Math.min(round, totalRounds)}/{totalRounds}
          </div>
        )}
      </div>

      {/* Score bar */}
      {phase !== "connecting" && (
        <div className="px-4 pb-3 shrink-0">
          <div className="glass rounded-xl flex items-stretch overflow-hidden">
            <div className="flex-1 py-2 text-center bg-primary/5">
              <p className="text-xl font-black text-primary tabular-nums leading-none">{myScore}</p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">You</p>
            </div>
            <div className="w-px bg-border/60" />
            <div className="flex-1 py-2 text-center">
              <p className="text-xl font-black text-muted-foreground tabular-nums leading-none">{oppScore}</p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 truncate px-1">
                {partnerName ?? "Partner"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Play area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 relative">
        {phase === "connecting" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Both of you need this screen open to play live.
            </p>
          </div>
        ) : (
          children
        )}
      </div>

      {phase === "gameover" && (
        <GameOverCelebration
          isWinner={!match.isDraw && match.finalWinnerId !== null && match.finalWinnerId !== match.opponentId}
          isDraw={match.isDraw}
          partnerName={partnerName}
          myScore={myScore}
          opponentScore={oppScore}
          onExit={onBack}
          onRematch={() => onPlayAgain(match.opponentId)}
        />
      )}
    </div>
  );
};

export default DuelShell;
