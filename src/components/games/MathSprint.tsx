import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DuelShell from "./DuelShell";
import { useDuelMatch } from "@/hooks/useDuelMatch";
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
  text: string;
  answer: number;
  options: number[];
}

const TOTAL = 6;

function buildRound(round: number): RoundData {
  // Difficulty ramps with round number.
  const hard = round > 3;
  const a = 2 + Math.floor(Math.random() * (hard ? 18 : 9));
  const b = 2 + Math.floor(Math.random() * (hard ? 12 : 9));
  const ops = hard ? ["+", "−", "×"] : ["+", "−"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  let big = Math.max(a, b);
  let small = Math.min(a, b);
  if (op === "+") answer = a + b;
  else if (op === "−") answer = big - small;
  else answer = a * b;
  const text = op === "−" ? `${big} − ${small}` : `${a} ${op} ${b}`;

  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const delta = Math.floor(Math.random() * 9) - 4 || 5;
    const cand = answer + delta;
    if (cand >= 0) opts.add(cand);
  }
  const options = [...opts].sort(() => Math.random() - 0.5);
  return { text, answer, options };
}

const MathSprint: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2200,
    roundTimeoutMs: 9000,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin, claimFoul } = match;
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (phase === "countdown" || phase === "playing") setPicked(null);
  }, [match.round, phase]);

  const handlePick = (n: number) => {
    if (phase !== "playing" || picked !== null || !roundData) return;
    setPicked(n);
    if (n === roundData.answer) claimWin();
    else claimFoul(); // wrong answer hands the round to opponent
  };

  return (
    <DuelShell
      title="Math Sprint"
      subtitle="Fastest correct answer wins"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[320px] flex flex-col items-center gap-5">
        <div className="glass rounded-2xl w-full py-7 text-center">
          <span className="text-4xl font-black text-foreground tabular-nums">
            {phase === "countdown" ? "…" : roundData ? `${roundData.text} = ?` : ""}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          {(roundData?.options ?? [0, 0, 0, 0]).map((n, i) => {
            const isAnswer = roundData && n === roundData.answer;
            const reveal = phase === "reveal";
            return (
              <motion.button
                key={`${match.round}-${i}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePick(n)}
                disabled={phase !== "playing" || picked !== null}
                className={`h-16 rounded-2xl text-2xl font-black tabular-nums transition-colors ${
                  reveal && isAnswer
                    ? "bg-emerald-500 text-white"
                    : picked === n
                    ? "bg-primary/20 text-primary"
                    : "glass text-foreground"
                } disabled:opacity-90`}
              >
                {phase === "countdown" ? "?" : n}
              </motion.button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center h-4">
          {phase === "reveal" &&
            (roundWinnerId === userId
              ? "⚡ You nailed it!"
              : roundWinnerId === null
              ? "⏱️ Nobody got it"
              : `${partnerName ?? "Partner"} was faster`)}
        </p>
      </div>
    </DuelShell>
  );
};

export default MathSprint;
