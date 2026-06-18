import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DuelShell from "./DuelShell";
import { useDuelMatch } from "@/hooks/useDuelMatch";
import { EMOJI_RIDDLES } from "@/lib/emojiRiddleData";
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
  emojis: string;
  options: string[];
  answer: string;
}

const TOTAL = 6;

function buildRound(): RoundData {
  const item = EMOJI_RIDDLES[Math.floor(Math.random() * EMOJI_RIDDLES.length)];
  const options = [item.answer, ...item.decoys].sort(() => Math.random() - 0.5);
  return { emojis: item.emojis, options, answer: item.answer };
}

const EmojiRiddle: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
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
      title="Emoji Riddle"
      subtitle="Guess the movie from the emojis"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
        <div className="glass rounded-2xl w-full py-8 text-center">
          <span className="text-5xl tracking-widest">
            {phase === "countdown" ? "🎬" : roundData?.emojis}
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
                className={`min-h-12 py-2.5 px-4 rounded-2xl text-sm font-semibold transition-colors ${
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
              ? "⏱️ Nobody guessed it"
              : `${partnerName ?? "Partner"} guessed first`)}
        </p>
      </div>
    </DuelShell>
  );
};

export default EmojiRiddle;
