import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Star } from "lucide-react";
import SimulShell from "./SimulShell";
import { useSimulMatch } from "@/hooks/useSimulMatch";
import type { GameSession } from "@/hooks/useGameSessions";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

const TOTAL_ROUNDS = 3;

const NumberNinja: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  // Target magic numbers for the rounds
  const magicNumbers = useMemo(() => {
    return Array.from({ length: TOTAL_ROUNDS }, () => Math.floor(Math.random() * 10) + 1);
  }, []);

  const match = useSimulMatch<number, number>({
    session,
    userId,
    totalRounds: TOTAL_ROUNDS,
    makeRound: (n) => magicNumbers[(n - 1) % magicNumbers.length],
    resolveRound: (target, mine, theirs) => {
      if (mine === null || theirs === null) {
        return { meScore: 0, oppScore: 0, target, mine, theirs };
      }
      const diffMine = Math.abs(mine - target);
      const diffTheirs = Math.abs(theirs - target);
      let meScore = 0;
      let oppScore = 0;

      if (diffMine < diffTheirs) {
        meScore = 1;
      } else if (diffTheirs < diffMine) {
        oppScore = 1;
      } else {
        // Equal distance: both get a point
        meScore = 1;
        oppScore = 1;
      }
      return { meScore, oppScore, target, mine, theirs };
    },
    onMakeMove,
    revealMs: 2800,
  });

  const { phase, roundData: targetNum, myAnswer, oppAnswer, answered, roundResult, submit } = match;

  const renderSummary = () => {
    const isWinner = match.myScore > match.oppScore;
    const isDraw = match.myScore === match.oppScore;

    return (
      <div className="flex flex-col items-center text-center p-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">
          {isDraw ? "It's a Draw! 🤝" : isWinner ? "You Win! 🏆" : `${partnerName ?? "Partner"} Wins! 👑`}
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Final Score: {match.myScore} - {match.oppScore}
        </p>
        <div className="mt-6 w-full max-w-[280px] bg-card rounded-2xl p-4 ring-1 ring-border/50 text-left space-y-2 text-xs">
          <p className="font-semibold text-foreground border-b pb-1.5 mb-2">Round History</p>
          {match.history.map((h, i) => (
            <div key={i} className="flex justify-between items-center text-muted-foreground">
              <span>Round {h.round}: Magic was <strong className="text-foreground">{h.data}</strong></span>
              <span>You: {h.mine} vs Them: {h.theirs}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <SimulShell
      title="Number Ninja 🔢"
      subtitle="Find the magic target number"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
      renderSummary={renderSummary}
    >
      <div className="w-full max-w-[360px] flex flex-col items-center gap-4">
        {/* How to Play Guide */}
        {phase === "answering" && match.round === 1 && (
          <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-3.5 flex gap-2.5 items-start">
            <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-foreground leading-normal">
              <p className="font-bold mb-0.5 text-[13px] text-primary">How to Play</p>
              Both of you secretly pick a number from **1 to 10**. Whoever is closest to the secret **magic number** wins the round!
            </div>
          </div>
        )}

        {targetNum && (
          <div className="w-full flex flex-col items-center gap-4">
            {phase === "answering" ? (
              <>
                <div className="w-full text-center py-2">
                  <p className="text-[15px] font-semibold text-foreground">Pick a number secretly (1 - 10)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Closest to the magic target wins!</p>
                </div>

                <div className="grid grid-cols-5 gap-2 w-full">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                    const chosen = myAnswer === num;
                    return (
                      <motion.button
                         key={num}
                         whileTap={{ scale: 0.9 }}
                         onClick={() => submit(num)}
                         disabled={answered}
                         className={`aspect-square rounded-xl text-lg font-bold transition-all ease-spring flex items-center justify-center ${
                           chosen
                             ? "bg-primary text-primary-foreground shadow-sm scale-105"
                             : answered
                             ? "bg-muted text-muted-foreground opacity-55 cursor-default"
                             : "bg-card ring-1 ring-border/50 text-foreground hover:bg-muted/30"
                         }`}
                      >
                        {num}
                      </motion.button>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground h-4 mt-2">
                  {answered ? `Locked in 🔒 — waiting for ${partnerName ?? "partner"}…` : "Who is closer?"}
                </p>
              </>
            ) : (
              // Reveal phase
              <div className="w-full flex flex-col items-center gap-5">
                <div className="w-full flex flex-col items-center bg-primary/5 ring-1 ring-primary/10 rounded-3xl p-6 shadow-sm">
                  <span className="text-[12px] text-primary uppercase font-bold tracking-wider mb-1">Target Magic Number</span>
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-7xl font-black text-primary leading-none"
                  >
                    {roundResult?.target}
                  </motion.span>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className={`rounded-2xl p-4 text-center border ${
                    roundResult && Math.abs((roundResult.mine ?? 0) - roundResult.target) <= Math.abs((roundResult.theirs ?? 0) - roundResult.target)
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-card border-border/50"
                  }`}>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Your Pick</p>
                    <p className="text-3xl font-black text-foreground mt-1">{myAnswer ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {myAnswer && roundResult ? `Diff: ${Math.abs(myAnswer - roundResult.target)}` : ""}
                    </p>
                  </div>

                  <div className={`rounded-2xl p-4 text-center border ${
                    roundResult && Math.abs((roundResult.theirs ?? 0) - roundResult.target) <= Math.abs((roundResult.mine ?? 0) - roundResult.target)
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-card border-border/50"
                  }`}>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{partnerName ?? "Partner"}'s Pick</p>
                    <p className="text-3xl font-black text-foreground mt-1">{oppAnswer ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {oppAnswer && roundResult ? `Diff: ${Math.abs(oppAnswer - roundResult.target)}` : ""}
                    </p>
                  </div>
                </div>

                <motion.p
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xl font-bold text-foreground mt-2"
                >
                  {roundResult && roundResult.meScore > 0 && roundResult.oppScore > 0
                    ? "✨ It's a Tie!"
                    : roundResult && roundResult.meScore > 0
                    ? "🎉 You won this round!"
                    : `👊 ${partnerName ?? "Partner"} won this round`}
                </motion.p>
              </div>
            )}
          </div>
        )}
      </div>
    </SimulShell>
  );
};

export default NumberNinja;
