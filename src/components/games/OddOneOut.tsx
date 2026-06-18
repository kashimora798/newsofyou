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
  items: string[];
  oddIndex: number;
  why: string;
}

// Each puzzle: three items share a category, one doesn't belong.
const PUZZLES: { items: string[]; odd: string; why: string }[] = [
  { items: ["🍎", "🍌", "🍇"], odd: "🥕", why: "Carrot is a vegetable" },
  { items: ["🐶", "🐱", "🐭"], odd: "🚗", why: "Car isn't an animal" },
  { items: ["⚽", "🏀", "🎾"], odd: "🍕", why: "Pizza isn't a ball" },
  { items: ["🌧️", "❄️", "🌈"], odd: "🍔", why: "Burger isn't weather" },
  { items: ["✈️", "🚀", "🚁"], odd: "🐢", why: "Turtle doesn't fly" },
  { items: ["🌹", "🌻", "🌷"], odd: "🦋", why: "Butterfly isn't a flower" },
  { items: ["🎸", "🥁", "🎺"], odd: "📱", why: "Phone isn't an instrument" },
  { items: ["🐟", "🐬", "🐙"], odd: "🦁", why: "Lion doesn't live in water" },
  { items: ["☕", "🥤", "🧃"], odd: "🪑", why: "Chair isn't a drink" },
  { items: ["🔴", "🟢", "🔵"], odd: "⭐", why: "Star isn't a colored circle" },
  { items: ["🧤", "🧣", "🧥"], odd: "🍩", why: "Donut isn't clothing" },
  { items: ["🐝", "🦋", "🐜"], odd: "🐘", why: "Elephant isn't an insect" },
  { items: ["📕", "📗", "📘"], odd: "🍰", why: "Cake isn't a book" },
  { items: ["🌙", "⭐", "☀️"], odd: "🚲", why: "Bicycle isn't in the sky" },
];

const TOTAL = 6;

function buildRound(): RoundData {
  const p = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
  const all = [...p.items, p.odd];
  // Shuffle and track where the odd one landed.
  const indexed = all.map((v, i) => ({ v, isOdd: i === p.items.length }));
  indexed.sort(() => Math.random() - 0.5);
  return {
    items: indexed.map((x) => x.v),
    oddIndex: indexed.findIndex((x) => x.isOdd),
    why: p.why,
  };
}

const OddOneOut: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2400,
    roundTimeoutMs: 9000,
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
    if (idx === roundData.oddIndex) claimWin();
    else claimFoul();
  };

  return (
    <DuelShell
      title="Odd One Out"
      subtitle="Spot what doesn't belong"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[340px] flex flex-col items-center gap-5">
        <div className="rounded-[20px] bg-card ring-1 ring-border/50 w-full py-4 text-center shadow-sm">
          <p className="text-[13px] font-semibold text-foreground">Which one doesn't belong?</p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          {(roundData?.items ?? ["", "", "", ""]).map((emoji, i) => {
            const isOdd = roundData && i === roundData.oddIndex;
            const reveal = phase === "reveal";
            return (
              <motion.button
                key={`${match.round}-${i}`}
                whileTap={{ scale: 0.92 }}
                onClick={() => handlePick(i)}
                disabled={phase !== "playing" || picked !== null}
                className={`aspect-square rounded-[18px] text-5xl flex items-center justify-center transition-colors ease-spring ${
                  reveal && isOdd
                    ? "bg-emerald-500/90 ring-2 ring-emerald-500"
                    : reveal && picked === i
                    ? "bg-destructive/20 ring-2 ring-destructive/40"
                    : picked === i
                    ? "bg-primary/20"
                    : "bg-card ring-1 ring-border/50"
                }`}
              >
                {phase === "countdown" ? "❓" : emoji}
              </motion.button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center min-h-[1rem] px-4">
          {phase === "reveal" &&
            (roundWinnerId === userId
              ? `✅ ${roundData?.why}`
              : roundWinnerId === null
              ? `⏱️ ${roundData?.why}`
              : `${partnerName ?? "Partner"} got it — ${roundData?.why}`)}
        </p>
      </div>
    </DuelShell>
  );
};

export default OddOneOut;
