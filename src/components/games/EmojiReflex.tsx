import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import DuelShell from "./DuelShell";
import { useDuelMatch } from "@/hooks/useDuelMatch";
import type { GameSession } from "@/hooks/useGameSessions";
import { HelpCircle, Send } from "lucide-react";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

interface EmojiDef {
  emoji: string;
  names: string[];
}

const EMOJI_POOL: EmojiDef[] = [
  { emoji: "🍎", names: ["apple", "seb", "fruit"] },
  { emoji: "🐶", names: ["dog", "kutta", "kutte", "puppy"] },
  { emoji: "🍕", names: ["pizza", "pizzas"] },
  { emoji: "🚗", names: ["car", "gaadi", "gadi"] },
  { emoji: "⚽", names: ["soccer", "football", "ball"] },
  { emoji: "🎸", names: ["guitar", "music"] },
  { emoji: "👑", names: ["crown", "taj", "king"] },
  { emoji: "🍔", names: ["burger", "burgers"] },
  { emoji: "🦄", names: ["unicorn"] },
  { emoji: "🎈", names: ["balloon", "gubbara", "baloon"] },
  { emoji: "🍩", names: ["donut", "doughnut"] },
  { emoji: "🍟", names: ["fries", "french fries", "finger chips"] },
  { emoji: "🐼", names: ["panda"] },
  { emoji: "🐱", names: ["cat", "billi", "kitten"] },
  { emoji: "🌈", names: ["rainbow", "indradhanush"] },
  { emoji: "🔥", names: ["fire", "aag", "hot"] },
  { emoji: "💀", names: ["skull", "haddi", "danger"] },
  { emoji: "👽", names: ["alien", "jaadu", "jadu"] },
  { emoji: "🚀", names: ["rocket", "space"] },
  { emoji: "🍿", names: ["popcorn", "popcorns"] },
];

const TOTAL_ROUNDS = 5;

// Host builds the round data
function buildRound(): EmojiDef {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

const EmojiReflex: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<EmojiDef>({
    session,
    userId,
    totalRounds: TOTAL_ROUNDS,
    countdownMs: 2200,
    roundTimeoutMs: 12000,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin, claimFoul } = match;
  const [typedVal, setTypedVal] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear inputs when a new round starts
  useEffect(() => {
    if (phase === "countdown" || phase === "playing") {
      setTypedVal("");
      setHasSubmitted(false);
      if (phase === "playing") {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [match.round, phase]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== "playing" || hasSubmitted || !roundData) return;

    const val = typedVal.trim().toLowerCase();
    if (!val) return;

    setHasSubmitted(true);
    
    // Check if the input is either the exact emoji or one of its matching names
    const isCorrect = val === roundData.emoji || roundData.names.includes(val);

    if (isCorrect) {
      claimWin();
    } else {
      claimFoul();
    }
  };

  return (
    <DuelShell
      title="Emoji Reflex 😱"
      subtitle="Type the emoji fastest!"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
        {/* How to Play */}
        {phase === "playing" && match.round === 1 && (
          <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-3 flex gap-2.5 items-start">
            <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[11px] text-foreground leading-normal">
              <p className="font-bold mb-0.5 text-primary">How to Play</p>
              A random emoji will pop up. Type the emoji itself OR its name (English/Hinglish, e.g., type **gaadi** or **car** for 🚗) as fast as you can!
            </div>
          </div>
        )}

        {/* Emoji Display Card */}
        <div className="rounded-[24px] bg-card ring-1 ring-border/50 w-full py-8 text-center shadow-sm relative overflow-hidden flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2">TYPE THIS EMOJI</span>
          <motion.span
            key={match.round}
            initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            className="text-7xl leading-none select-none my-2"
          >
            {phase === "countdown" ? "❓" : roundData?.emoji ?? ""}
          </motion.span>
        </div>

        {/* Typing Input */}
        <form onSubmit={handleSubmit} className="w-full flex gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={typedVal}
            onChange={(e) => setTypedVal(e.target.value)}
            disabled={phase !== "playing" || hasSubmitted}
            placeholder={phase === "playing" ? "Type emoji or its name..." : "Get ready..."}
            className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-center text-sm"
          />
          <button
            type="submit"
            disabled={phase !== "playing" || hasSubmitted || !typedVal.trim()}
            className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Feedback message */}
        <p className="text-[11px] text-muted-foreground text-center h-4 mt-2">
          {phase === "reveal" && (
            roundWinnerId === userId
              ? "⚡ Speed Ninja! You got it!"
              : roundWinnerId === null
              ? `⏱️ Too slow! Correct answers: ${roundData?.names.join(", ")}`
              : `${partnerName ?? "Partner"} was faster! Answer was: ${roundData?.emoji} (${roundData?.names[0]})`
          )}
          {phase === "playing" && hasSubmitted && (
            <span className="text-primary font-medium">Submitting... 🔒</span>
          )}
        </p>
      </div>
    </DuelShell>
  );
};

export default EmojiReflex;
