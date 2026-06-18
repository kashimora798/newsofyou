import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DuelShell from "./DuelShell";
import { useDuelMatch } from "@/hooks/useDuelMatch";
import { TRIVIA } from "@/lib/triviaData";
import type { GameSession } from "@/hooks/useGameSessions";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

interface RoundData {
  q: string;
  options: string[];
  answer: string;
}

const TOTAL = 6;

function buildRound(): RoundData {
  const item = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  const answer = item.options[0];
  const options = [...item.options].sort(() => Math.random() - 0.5);
  return { q: item.q, options, answer };
}

const QuizBuzzer: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2500,
    roundTimeoutMs: 12000,
    revealMs: 2000,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin, claimFoul } = match;
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "countdown" || phase === "playing") setPicked(null);
  }, [match.round, phase]);

  const handlePick = (opt: string) => {
    if (phase !== "playing" || picked !== null || !roundData) return;
    setPicked(opt);
    if (opt === roundData.answer) claimWin();
    else claimFoul();
  };

  return (
    <DuelShell
      title="Quiz Buzzer"
      subtitle="Buzz in with the right answer first"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
        <div className="glass rounded-2xl w-full py-6 px-5 text-center min-h-[96px] flex items-center justify-center">
          <span className="text-lg font-bold text-foreground leading-snug">
            {phase === "countdown" ? "Get ready…" : roundData?.q}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 w-full">
          {(roundData?.options ?? ["", "", "", ""]).map((opt, i) => {
            const reveal = phase === "reveal";
            const correct = roundData && opt === roundData.answer;
            return (
              <motion.button
                key={`${match.round}-${i}`}
                whileTap={{ scale: 0.97 }}
                onClick={() => handlePick(opt)}
                disabled={phase !== "playing" || picked !== null}
                className={`min-h-12 py-2.5 px-4 rounded-2xl text-sm font-semibold text-left transition-colors ${
                  reveal && correct
                    ? "bg-emerald-500 text-white"
                    : picked === opt
                    ? correct
                      ? "bg-emerald-500 text-white"
                      : "bg-destructive/20 text-destructive"
                    : "glass text-foreground"
                }`}
              >
                {phase === "countdown" ? "…" : opt}
              </motion.button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center h-4">
          {phase === "reveal" &&
            (roundWinnerId === userId
              ? "⚡ Correct & first!"
              : roundWinnerId === null
              ? "⏱️ Nobody buzzed in"
              : `${partnerName ?? "Partner"} buzzed first`)}
        </p>
      </div>
    </DuelShell>
  );
};

export default QuizBuzzer;
