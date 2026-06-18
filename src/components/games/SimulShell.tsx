import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import GameOverCelebration from "./GameOverCelebration";
import type { SimulMatch } from "@/hooks/useSimulMatch";

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif";

interface Props {
  title: string;
  subtitle?: string;
  partnerName?: string;
  match: SimulMatch<any, any>;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
  /** Custom game-over summary (compatibility %, etc.). If omitted, a generic
   *  win/lose celebration is shown. */
  renderSummary?: () => React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared chrome for "simultaneous reveal" games (sibling of DuelShell): header,
 * round progress dots, connecting state, and a custom or default game-over view.
 */
const SimulShell: React.FC<Props> = ({ title, subtitle, partnerName, match, onBack, onPlayAgain, renderSummary, children }) => {
  const { phase, round, totalRounds, peerReady, finalWinnerId, isDraw, myScore, oppScore } = match;

  return (
    <div className="flex flex-col h-full bg-background" style={{ fontFamily: APPLE_FONT }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-semibold text-foreground truncate tracking-tight">{title}</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            {subtitle ? `${subtitle} · ` : ""}vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase !== "connecting" && phase !== "gameover" && (
          <div className="text-[12px] font-bold text-muted-foreground tabular-nums">
            {Math.min(round, totalRounds)}/{totalRounds}
          </div>
        )}
      </div>

      {/* Progress dots */}
      {phase !== "connecting" && phase !== "gameover" && (
        <div className="flex items-center justify-center gap-1.5 py-2.5 shrink-0">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ease-spring ${
                i < round - 1 ? "w-1.5 bg-primary" : i === round - 1 ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 relative">
        {phase === "connecting" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-[15px] font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[12px] text-muted-foreground max-w-[230px]">
              Both of you need this screen open to play.
            </p>
          </div>
        ) : phase === "gameover" ? (
          renderSummary ? (
            <SummaryFrame onExit={onBack} onPlayAgain={() => onPlayAgain(match.opponentId)}>
              {renderSummary()}
            </SummaryFrame>
          ) : (
            <GameOverCelebration
              isWinner={!isDraw && finalWinnerId !== null && finalWinnerId !== match.opponentId}
              isDraw={isDraw}
              partnerName={partnerName}
              myScore={myScore}
              opponentScore={oppScore}
              onExit={onBack}
              onRematch={() => onPlayAgain(match.opponentId)}
            />
          )
        ) : (
          children
        )}
      </div>
    </div>
  );
};

const SummaryFrame: React.FC<{ onExit: () => void; onPlayAgain: () => void; children: React.ReactNode }> = ({ onExit, onPlayAgain, children }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.94, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 26 }}
    className="w-full max-w-sm flex flex-col items-center"
  >
    {children}
    <div className="flex gap-2.5 mt-7 w-full">
      <button onClick={onExit} className="flex-1 py-3 rounded-[14px] bg-muted/70 text-foreground text-[15px] font-semibold tappable">
        Back
      </button>
      <button onClick={onPlayAgain} className="flex-1 py-3 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold tappable">
        Play again
      </button>
    </div>
  </motion.div>
);

export default SimulShell;
