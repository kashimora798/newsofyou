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

const EMOJIS = ["🍕", "🚀", "🐶", "🌈", "⚽", "🎸", "🍩", "🦊", "🌻", "🎈", "🐬", "🍓"];
const PAIRS = 6; // 12 cards, 3×4 grid

interface RoundData {
  /** shuffled emoji layout shared by both players (same grid each device) */
  layout: string[];
}

const TOTAL = 3;

function buildRound(): RoundData {
  const chosen = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, PAIRS);
  const layout = [...chosen, ...chosen].sort(() => Math.random() - 0.5);
  return { layout };
}

const MemoryRace: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2500,
    roundTimeoutMs: 45000,
    revealMs: 2200,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin } = match;
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  // Reset board each new round.
  useEffect(() => {
    setFlipped([]);
    setMatched([]);
    setBusy(false);
  }, [match.round]);

  // Win when all pairs matched.
  useEffect(() => {
    if (phase === "playing" && roundData && matched.length === roundData.layout.length && matched.length > 0) {
      claimWin();
    }
  }, [matched, phase, roundData, claimWin]);

  const handleFlip = (i: number) => {
    if (phase !== "playing" || busy || !roundData) return;
    if (flipped.includes(i) || matched.includes(i)) return;
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setBusy(true);
      const [a, b] = next;
      if (roundData.layout[a] === roundData.layout[b]) {
        setTimeout(() => {
          setMatched((m) => [...m, a, b]);
          setFlipped([]);
          setBusy(false);
        }, 380);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 760);
      }
    }
  };

  const layout = roundData?.layout ?? Array(PAIRS * 2).fill("");
  const showCard = (i: number) => flipped.includes(i) || matched.includes(i);

  return (
    <DuelShell
      title="Memory Race"
      subtitle="Clear all the pairs first"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[320px] flex flex-col items-center gap-4">
        <div className="grid grid-cols-4 gap-2 w-full">
          {layout.map((emoji, i) => {
            const open = showCard(i);
            const isMatched = matched.includes(i);
            return (
              <motion.button
                key={`${match.round}-${i}`}
                whileTap={open ? {} : { scale: 0.92 }}
                onClick={() => handleFlip(i)}
                disabled={phase !== "playing" || open || busy}
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-colors ${
                  isMatched ? "bg-emerald-500/20" : open ? "bg-primary/10" : "glass"
                }`}
              >
                <motion.span
                  key={open ? "front" : "back"}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                >
                  {phase === "countdown" ? "" : open ? emoji : "❓"}
                </motion.span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center h-4">
          {phase === "reveal"
            ? roundWinnerId === userId
              ? "⚡ Cleared first!"
              : roundWinnerId === null
              ? "⏱️ Time's up — tie"
              : `${partnerName ?? "Partner"} cleared first`
            : `${matched.length / 2}/${PAIRS} pairs found`}
        </p>
      </div>
    </DuelShell>
  );
};

export default MemoryRace;
