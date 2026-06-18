import React, { useEffect, useRef, useState } from "react";
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
  /** ms after reveal before it turns green (host-randomized, synced). */
  greenDelay: number;
}

const TOTAL = 5;

const TapDuel: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<RoundData>({
    session,
    userId,
    totalRounds: TOTAL,
    countdownMs: 2500,
    roundTimeoutMs: 7000,
    makeRound: () => ({ greenDelay: 800 + Math.floor(Math.random() * 3200) }),
    onMakeMove,
  });

  const { phase, roundData, revealAt, roundWinnerId, claimWin, claimFoul } = match;
  const [light, setLight] = useState<"wait" | "go">("wait");
  const [fouled, setFouled] = useState(false);
  const greenTimer = useRef<ReturnType<typeof setTimeout>>();

  // Schedule the wait→go transition for each playable round.
  useEffect(() => {
    if (phase === "playing" && roundData) {
      setLight("wait");
      setFouled(false);
      const goAt = revealAt + roundData.greenDelay;
      const delay = Math.max(0, goAt - Date.now());
      greenTimer.current = setTimeout(() => setLight("go"), delay);
      return () => clearTimeout(greenTimer.current);
    }
    if (phase === "reveal" || phase === "countdown") {
      setLight("wait");
    }
  }, [phase, roundData, revealAt]);

  const handleTap = () => {
    if (phase !== "playing" || fouled) return;
    if (light === "go") {
      claimWin();
    } else {
      // Tapped too early — concede the round.
      setFouled(true);
      claimFoul();
    }
  };

  const isWaiting = phase === "countdown";

  return (
    <DuelShell
      title="Tap Duel"
      subtitle="Tap the instant it turns green"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
    >
      <div className="w-full max-w-[320px] flex flex-col items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleTap}
          disabled={phase !== "playing"}
          className={`w-full aspect-square rounded-3xl flex items-center justify-center text-center transition-colors duration-75 select-none ${
            fouled
              ? "bg-destructive/20 text-destructive"
              : light === "go"
              ? "bg-emerald-500 text-white"
              : isWaiting
              ? "bg-muted text-muted-foreground"
              : "bg-rose-500/90 text-white"
          }`}
        >
          <span className="text-xl font-black px-6">
            {phase === "reveal"
              ? roundWinnerId === userId
                ? "⚡ You got it!"
                : roundWinnerId === null
                ? "⏱️ Too slow — tie"
                : `${partnerName ?? "Partner"} was faster`
              : fouled
              ? "Too early! 🙈"
              : light === "go"
              ? "TAP!"
              : isWaiting
              ? "Get ready…"
              : "Wait for green…"}
          </span>
        </motion.button>
        <p className="text-[11px] text-muted-foreground text-center h-4">
          {phase === "playing" && light === "wait" && !fouled && "Don't tap too early!"}
        </p>
      </div>
    </DuelShell>
  );
};

export default TapDuel;
