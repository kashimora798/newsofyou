import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DuelShell from "./DuelShell";
import { useDuelMatch } from "@/hooks/useDuelMatch";
import type { GameSession } from "@/hooks/useGameSessions";
import { HelpCircle } from "lucide-react";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

interface Statement {
  text: string;
  answer: boolean;
  explanation: string;
}

const STATEMENTS: Statement[] = [
  // BTS
  { text: "Jungkook is the youngest member (Maknae) of BTS.", answer: true, explanation: "Yes, Jungkook is indeed the Golden Maknae! 💜" },
  { text: "BTS stands for 'Bangtan Sonyeondan' which translates to Bulletproof Boy Scouts.", answer: true, explanation: "Correct! That is their full Korean name. 💜" },
  { text: "BTS debuted in the year 2010.", answer: false, explanation: "False! BTS debuted on June 13, 2013. 💜" },
  { text: "Dynamite was BTS's first song entirely in English.", answer: true, explanation: "Correct! Dynamite released in 2020 was their first English single. 💜" },
  { text: "Jimin was the first member to join BTS.", answer: false, explanation: "False! RM (Namjoon) was the first member to join BTS. 💜" },
  
  // Indian pop culture, food, cricket
  { text: "Ranbir Kapoor's debut Bollywood movie was Saawariya.", answer: true, explanation: "Yes, he debuted alongside Sonam Kapoor in Saawariya (2007)!" },
  { text: "MS Dhoni has never scored an international century outside of Asia.", answer: true, explanation: "Correct! All of Dhoni's 16 international centuries were scored in Asia." },
  { text: "Biryani originally originated in Delhi, India.", answer: false, explanation: "False! Biryani has its roots in Persia and came to India during the Mughal era." },
  { text: "The first season of IPL (Indian Premier League) was won by Chennai Super Kings.", answer: false, explanation: "False! Rajasthan Royals won the inaugural IPL season in 2008." },
  { text: "Pani Puri is known as Golgappa in New Delhi.", answer: true, explanation: "Correct! It is called Golgappa in North India." },
  { text: "Maggi was originally invented in India.", answer: false, explanation: "False! Maggi originated in Switzerland in the late 19th century." },
  { text: "Virat Kohli debuted for India in international cricket in 2008.", answer: true, explanation: "Correct! Virat Kohli played his first ODI against Sri Lanka in August 2008." },
  { text: "3 Idiots movie is based on Chetan Bhagat's novel 'Five Point Someone'.", answer: true, explanation: "Yes! It is loosely based on Five Point Someone." },

  // Famous global things (known to teens)
  { text: "The 'i' in iPhone stands for 'Internet'.", answer: false, explanation: "False! Steve Jobs said the 'i' stands for internet, individual, instruct, inform, and inspire." },
  { text: "Spider-Man's real name in Marvel Comics is Peter Parker.", answer: true, explanation: "Correct! Peter Parker is the original web-slinger." },
  { text: "Instagram was launched in the year 2012.", answer: false, explanation: "False! Instagram launched in October 2010 (acquired by Facebook in 2012)." },
  { text: "Cristiano Ronaldo has won more Ballon d'Or awards than Lionel Messi.", answer: false, explanation: "False! Messi has 8, while Ronaldo has 5 Ballon d'Or awards." },
  { text: "Harry Potter's pet owl is named Hedwig.", answer: true, explanation: "Correct! Hedwig is his loyal snowy owl." }
];

const TOTAL_ROUNDS = 5;

// Host builds the round data
function buildRound(): Statement {
  return STATEMENTS[Math.floor(Math.random() * STATEMENTS.length)];
}

const TrueFalseBlitz: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const match = useDuelMatch<Statement>({
    session,
    userId,
    totalRounds: TOTAL_ROUNDS,
    countdownMs: 2200,
    roundTimeoutMs: 10000,
    makeRound: buildRound,
    onMakeMove,
  });

  const { phase, roundData, roundWinnerId, claimWin, claimFoul } = match;
  const [answeredOption, setAnsweredOption] = useState<boolean | null>(null);

  useEffect(() => {
    if (phase === "countdown" || phase === "playing") {
      setAnsweredOption(null);
    }
  }, [match.round, phase]);

  const handlePick = (option: boolean) => {
    if (phase !== "playing" || answeredOption !== null || !roundData) return;
    setAnsweredOption(option);
    if (option === roundData.answer) {
      claimWin();
    } else {
      claimFoul();
    }
  };

  return (
    <DuelShell
      title="True or False Blitz ✅❌"
      subtitle="React fast to statements!"
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
              A statement about BTS, Bollywood, Cricket, Food, or Pop Culture will appear. Race to tap **TRUE** or **FALSE** fastest!
            </div>
          </div>
        )}

        {/* Statement Display */}
        <div className="rounded-[24px] bg-card ring-1 ring-border/50 w-full min-h-[140px] px-6 py-8 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">STATEMENT</span>
          <p className="text-[17px] font-semibold text-foreground leading-relaxed">
            {phase === "countdown" ? "Get ready..." : roundData?.text ?? ""}
          </p>
        </div>

        {/* Choice Buttons */}
        <div className="grid grid-cols-2 gap-3.5 w-full mt-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={phase !== "playing" || answeredOption !== null}
            onClick={() => handlePick(true)}
            className={`py-5 rounded-2xl text-[16px] font-bold transition-all ease-spring flex items-center justify-center gap-1.5 ${
              phase === "reveal" && roundData?.answer === true
                ? "bg-emerald-500 text-white shadow-sm"
                : answeredOption === true
                ? "bg-primary text-primary-foreground shadow-sm"
                : phase !== "playing"
                ? "bg-muted text-muted-foreground opacity-60 cursor-default"
                : "bg-card ring-1 ring-border/50 text-foreground hover:bg-muted/30"
            }`}
          >
            ✅ TRUE
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={phase !== "playing" || answeredOption !== null}
            onClick={() => handlePick(false)}
            className={`py-5 rounded-2xl text-[16px] font-bold transition-all ease-spring flex items-center justify-center gap-1.5 ${
              phase === "reveal" && roundData?.answer === false
                ? "bg-emerald-500 text-white shadow-sm"
                : answeredOption === false
                ? "bg-primary text-primary-foreground shadow-sm"
                : phase !== "playing"
                ? "bg-muted text-muted-foreground opacity-60 cursor-default"
                : "bg-card ring-1 ring-border/50 text-foreground hover:bg-muted/30"
            }`}
          >
            ❌ FALSE
          </motion.button>
        </div>

        {/* Explanatory feedback */}
        <p className="text-[11px] text-muted-foreground text-center min-h-[1.5rem] px-4 mt-2 leading-relaxed">
          {phase === "reveal" && (
            roundWinnerId === userId
              ? `🎉 Correct! ${roundData?.explanation}`
              : roundWinnerId === null
              ? `⏱️ Time's up! ${roundData?.explanation}`
              : `👊 ${partnerName ?? "Partner"} got it first! ${roundData?.explanation}`
          )}
          {phase === "playing" && answeredOption !== null && (
            <span className="text-primary font-medium animate-pulse">Checking answer... 🔒</span>
          )}
        </p>
      </div>
    </DuelShell>
  );
};

export default TrueFalseBlitz;
