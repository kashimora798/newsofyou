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

const COLORS = [
  { name: "RED", hex: "#ef4444" },
  { name: "BLUE", hex: "#3b82f6" },
  { name: "GREEN", hex: "#22c55e" },
  { name: "YELLOW", hex: "#eab308" },
  { name: "PURPLE", hex: "#8b5cf6" },
  { name: "PINK", hex: "#ec4899" },
];

interface RoundData {
  word: string;
  inkIndex: number; // index into COLORS — the correct answer
  options: number[]; // indices into COLORS
}

const TOTAL = 6;

function buildRound(): RoundData {
  const inkIndex = Math.floor(Math.random() * COLORS.length);
  let wordIndex = Math.floor(Math.random() * COLORS.length);
  // Bias toward a mismatching word for the classic Stroop effect.
  if (wordIndex === inkIndex && Math.random() > 0.25) {
    wordIndex = (wordIndex + 1 + Math.floor(Math.random() * (COLORS.length - 1))) % COLORS.length;
  }
  const opts = new Set<number>([inkIndex]);
  while (opts.size < 4) opts.add(Math.floor(Math.random() * COLORS.length));
  const options = [...opts].sort(() => Math.random() - 0.5);
  return { word: COLORS[wordIndex].name, inkIndex, options };
}

const ColorClash: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2200,
    roundTimeoutMs: 7000,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin, claimFoul } = match;
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (phase === "countdown" || phase === "playing") setPicked(null);
  }, [match.round, phase]);

  const handlePick = (idx: number) => {
    if (phase !== "playing" || picked !== null || !roundData) return;
    setPicked(idx);
    if (idx === roundData.inkIndex) claimWin();
    else claimFoul();
  };

  return (
    <DuelShell
      title="Color Clash"
      subtitle="Tap the INK color, not the word"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[320px] flex flex-col items-center gap-5">
        <div className="glass rounded-2xl w-full py-8 text-center">
          <span
            className="text-4xl font-black tracking-wide"
            style={{ color: phase === "countdown" || !roundData ? undefined : COLORS[roundData.inkIndex].hex }}
          >
            {phase === "countdown" ? "…" : roundData?.word}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          {(roundData?.options ?? [0, 1, 2, 3]).map((idx, i) => {
            const reveal = phase === "reveal";
            const correct = roundData && idx === roundData.inkIndex;
            return (
              <motion.button
                key={`${match.round}-${i}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePick(idx)}
                disabled={phase !== "playing" || picked !== null}
                className={`h-14 rounded-2xl text-sm font-black transition-all ${
                  reveal && correct ? "ring-2 ring-offset-2 ring-offset-background ring-white" : ""
                } ${picked === idx && !correct ? "opacity-40" : ""}`}
                style={{
                  backgroundColor: phase === "countdown" ? "hsl(var(--muted))" : COLORS[idx].hex,
                  color: "#fff",
                }}
              >
                {phase === "countdown" ? "?" : ""}
              </motion.button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center h-4">
          {phase === "reveal"
            ? roundWinnerId === userId
              ? "⚡ Correct & fastest!"
              : roundWinnerId === null
              ? "⏱️ Nobody got it"
              : `${partnerName ?? "Partner"} was faster`
            : "Tap the color it's PRINTED in"}
        </p>
      </div>
    </DuelShell>
  );
};

export default ColorClash;
