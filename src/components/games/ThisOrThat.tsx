import React, { useMemo } from "react";
import { motion } from "framer-motion";
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

type Choice = "a" | "b";
interface Prompt { a: string; b: string; }

const PROMPTS: Prompt[] = [
  { a: "Coffee ☕", b: "Tea 🍵" },
  { a: "Morning 🌅", b: "Night 🌙" },
  { a: "Text 💬", b: "Call 📞" },
  { a: "Dog 🐕", b: "Cat 🐈" },
  { a: "Beach 🏖️", b: "Mountains ⛰️" },
  { a: "Sweet 🍫", b: "Spicy 🌶️" },
  { a: "Movies 🎬", b: "Music 🎵" },
  { a: "Pizza 🍕", b: "Burger 🍔" },
  { a: "Summer ☀️", b: "Winter ❄️" },
  { a: "Books 📚", b: "Games 🎮" },
  { a: "City 🌆", b: "Village 🏡" },
  { a: "Cricket 🏏", b: "Football ⚽" },
  { a: "Bollywood 🎬", b: "Hollywood 🎥" },
  { a: "Window seat 🪟", b: "Aisle seat 💺" },
  { a: "Early bird 🐦", b: "Night owl 🦉" },
  { a: "Plan it 🗓️", b: "Go with flow 🌊" },
];

const TOTAL = 8;

const ThisOrThat: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const deck = useMemo(() => [...PROMPTS].sort(() => Math.random() - 0.5), []);

  const match = useSimulMatch<Prompt, Choice>({
    session,
    userId,
    totalRounds: TOTAL,
    makeRound: (n) => deck[(n - 1) % deck.length],
    resolveRound: (_data, mine, theirs) => {
      const same = mine != null && mine === theirs;
      return { meScore: same ? 1 : 0, oppScore: same ? 1 : 0, match: same };
    },
    decideWinner: () => null, // compatibility game — you win together
    onMakeMove,
    revealMs: 2400,
  });

  const { phase, roundData: prompt, myAnswer, oppAnswer, answered, roundResult, submit } = match;

  const renderSummary = () => {
    const matches = match.myScore;
    const pct = Math.round((matches / TOTAL) * 100);
    const label =
      pct >= 80 ? "Soulmates! 💞" :
      pct >= 60 ? "Super in sync! ✨" :
      pct >= 40 ? "Nicely balanced ⚖️" :
      "Opposites attract 🧲";
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-[13px] text-muted-foreground uppercase tracking-widest">Compatibility</p>
        <p className="text-[72px] font-bold text-primary leading-none mt-1 tabular-nums">{pct}%</p>
        <p className="text-[18px] font-semibold text-foreground mt-2">{label}</p>
        <p className="text-[14px] text-muted-foreground mt-1">You matched on {matches} of {TOTAL}</p>
      </div>
    );
  };

  return (
    <SimulShell
      title="This or That"
      subtitle="Pick fast, see how you match"
      partnerName={partnerName}
      match={match}
      onBack={onBack}
      onPlayAgain={onPlayAgain}
      renderSummary={renderSummary}
    >
      {prompt && (
        <div className="w-full max-w-[360px] flex flex-col items-center gap-5">
          {phase === "answering" ? (
            <>
              <p className="text-[15px] font-semibold text-foreground">Pick one — secretly</p>
              <div className="grid grid-cols-1 gap-3 w-full">
                {(["a", "b"] as Choice[]).map((opt) => {
                  const chosen = myAnswer === opt;
                  return (
                    <motion.button
                      key={opt}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => submit(opt)}
                      disabled={answered}
                      className={`rounded-[20px] py-6 text-[22px] font-bold transition-colors ease-spring ${
                        chosen ? "bg-primary text-primary-foreground" : answered ? "bg-card ring-1 ring-border/40 text-muted-foreground opacity-60" : "bg-card ring-1 ring-border/50 text-foreground"
                      }`}
                    >
                      {prompt[opt]}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[12px] text-muted-foreground h-4">
                {answered ? `Locked in 🔒 — waiting for ${partnerName ?? "partner"}…` : ""}
              </p>
            </>
          ) : (
            // reveal
            <>
              <div className="grid grid-cols-2 gap-3 w-full">
                <RevealCard label="You" value={myAnswer ? prompt[myAnswer] : "—"} accent />
                <RevealCard label={partnerName ?? "Partner"} value={oppAnswer ? prompt[oppAnswer] : "—"} />
              </div>
              <motion.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-[24px] font-bold ${roundResult?.match ? "text-emerald-500" : "text-muted-foreground"}`}
              >
                {roundResult?.match ? "✨ Match!" : "↔️ Opposites!"}
              </motion.p>
            </>
          )}
        </div>
      )}
    </SimulShell>
  );
};

const RevealCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`rounded-[18px] py-5 px-3 text-center ${accent ? "bg-primary/10 ring-1 ring-primary/20" : "bg-card ring-1 ring-border/50"}`}>
    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1 truncate">{label}</p>
    <p className="text-[18px] font-bold text-foreground">{value}</p>
  </div>
);

export default ThisOrThat;
