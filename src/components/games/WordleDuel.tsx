import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession } from "@/hooks/useGameSessions";
import GameOverCelebration from "./GameOverCelebration";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

const WORD_BANK = [
  "HEART", "PIZZA", "SWEET", "SMILE", "BEACH", "CHIPS", "CHAI", "MUSIC", "DANCE",
  "STARS", "HAPPY", "SPARK", "SHINE", "DREAM", "LIGHT", "PARTY", "CROWN", "FLAME",
  "MANGO", "CLOUD", "LUCKY", "MAGIC", "ANGEL", "ROYAL", "ROBOT", "TIGER", "OCEAN"
];

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

const WordleDuel: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "playing" | "gameover">("connecting");
  const [targetWord, setTargetWord] = useState("");

  // Play states
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [mySolved, setMySolved] = useState(false);
  const [mySolvedTime, setMySolvedTime] = useState<number | null>(null);

  // Opponent progress states
  const [oppGuessesCount, setOppGuessesCount] = useState(0);
  const [oppSolved, setOppSolved] = useState(false);
  const [oppSolvedTime, setOppSolvedTime] = useState<number | null>(null);
  const [oppProgressBlocks, setOppProgressBlocks] = useState(""); // e.g. "🟩🟩🟨⬜⬜"

  // Timing
  const startTimeRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const getFeedbackBlocks = (guess: string, target: string): string => {
    const feedback = Array(WORD_LENGTH).fill("⬜");
    const targetArr = target.split("");
    const guessArr = guess.split("");

    // First pass: Greens
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === targetArr[i]) {
        feedback[i] = "🟩";
        targetArr[i] = "";
        guessArr[i] = "";
      }
    }

    // Second pass: Yellows
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] !== "") {
        const idx = targetArr.indexOf(guessArr[i]);
        if (idx !== -1) {
          feedback[i] = "🟨";
          targetArr[idx] = "";
        }
      }
    }

    return feedback.join("");
  };

  const checkGameCompletion = useCallback((
    currentGuesses: string[], 
    solved: boolean, 
    solvedTime: number | null, 
    oSolved: boolean, 
    oGuessesCount: number,
    oSolvedTime: number | null
  ) => {
    const iAmDone = solved || currentGuesses.length >= MAX_GUESSES;
    const opponentDone = oSolved || oGuessesCount >= MAX_GUESSES;

    if (iAmDone && opponentDone && isHost) {
      setTimeout(() => {
        // Tally results
        const myAttempts = solved ? currentGuesses.length : 99;
        const oppAttempts = oSolved ? oGuessesCount : 99;

        let winnerId: string | null = null;
        let isDraw = false;

        if (myAttempts < oppAttempts) {
          winnerId = userId;
        } else if (oppAttempts < myAttempts) {
          winnerId = opponentId;
        } else {
          // Tie on guess count, check speed (time)
          if (solved && oSolved && solvedTime !== null && oSolvedTime !== null) {
            if (solvedTime < oSolvedTime) {
              winnerId = userId;
            } else if (oSolvedTime < solvedTime) {
              winnerId = opponentId;
            } else {
              isDraw = true;
            }
          } else {
            isDraw = true;
          }
        }

        const finalScores = {
          [userId]: solved ? currentGuesses.length : 0,
          [opponentId]: oSolved ? oGuessesCount : 0
        };

        send("over", { winnerId, isDraw, scores: finalScores, targetWord });
        onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, isDraw);
      }, 500);
    }
  }, [isHost, opponentId, userId, send, onMakeMove, session.id, targetWord]);

  const handleGuessSubmit = () => {
    if (phase !== "playing" || currentGuess.length !== WORD_LENGTH || guesses.length >= MAX_GUESSES || mySolved) return;

    const guess = currentGuess.toUpperCase();
    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setCurrentGuess("");

    const isCorrect = guess === targetWord;
    const blocks = getFeedbackBlocks(guess, targetWord);
    
    let solvedTime: number | null = null;
    if (isCorrect) {
      setMySolved(true);
      const now = Date.now();
      solvedTime = now - (startTimeRef.current ?? now);
      setMySolvedTime(solvedTime);
    }

    // Broadcast guess progress
    send("progress", {
      round: 1,
      guessesCount: nextGuesses.length,
      solved: isCorrect,
      feedbackBlocks: blocks,
      solvedTime
    });

    checkGameCompletion(
      nextGuesses,
      isCorrect,
      solvedTime,
      oppSolved,
      oppGuessesCount,
      oppSolvedTime
    );
  };

  const handleKeyPress = (key: string) => {
    if (key === "ENTER") {
      handleGuessSubmit();
    } else if (key === "BACK") {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((prev) => prev + key);
    }
  };

  // Broadcast setup
  useEffect(() => {
    const channel = supabase.channel(`wordle_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
          setTargetWord(word);
          setPhase("instructions");
          send("start_game", { word });
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
          setTargetWord(word);
          setPhase("instructions");
          send("start_game", { word });
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setTargetWord(payload.word);
        setPhase("instructions");
      })
      .on("broadcast", { event: "play_click" }, () => {
        startTimeRef.current = Date.now();
        setPhase("playing");
      })
      .on("broadcast", { event: "progress" }, ({ payload }) => {
        setOppGuessesCount(payload.guessesCount);
        setOppSolved(payload.solved);
        setOppProgressBlocks(payload.feedbackBlocks);
        setOppSolvedTime(payload.solvedTime);

        checkGameCompletion(
          guesses,
          mySolved,
          mySolvedTime,
          payload.solved,
          payload.guessesCount,
          payload.solvedTime
        );
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setPhase("gameover");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          send("join", {});
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, isHost, phase, guesses, mySolved, mySolvedTime, oppGuessesCount, oppSolved, oppSolvedTime, send, checkGameCompletion]);

  const handleStartPlay = () => {
    startTimeRef.current = Date.now();
    setPhase("playing");
    send("play_click", {});
  };

  // Keyboard helper to style keys (Green/Yellow/Gray)
  const getLetterStatus = (): Record<string, "green" | "yellow" | "gray"> => {
    const statuses: Record<string, "green" | "yellow" | "gray"> = {};
    guesses.forEach((guess) => {
      for (let i = 0; i < WORD_LENGTH; i++) {
        const char = guess[i];
        if (targetWord[i] === char) {
          statuses[char] = "green";
        } else if (targetWord.includes(char)) {
          if (statuses[char] !== "green") {
            statuses[char] = "yellow";
          }
        } else {
          if (statuses[char] !== "green" && statuses[char] !== "yellow") {
            statuses[char] = "gray";
          }
        }
      }
    });
    return statuses;
  };

  const letterStatuses = getLetterStatus();

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Wordle Duel 🟩🟨</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            vs {partnerName ?? "Partner"}
          </p>
        </div>
      </div>

      {/* Main Play Space */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Keep this screen open to start the Wordle battle!
            </p>
          </div>
        )}

        {phase === "instructions" && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-5">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                Both of you get the **same 5-letter word** to guess. You have **6 attempts**. Winner is whoever guesses it in fewer attempts. If tied, the faster guesser wins!
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 w-full text-center shadow-sm flex flex-col items-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Get Ready to Duel!</h3>
              <p className="text-xs text-muted-foreground mt-1">Guesses reveal standard green/yellow/gray blocks</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Duel
            </button>
          </div>
        )}

        {phase === "playing" && (
          <div className="w-full max-w-[330px] flex-1 flex flex-col justify-between py-1">
            {/* Wordle Grid */}
            <div className="grid grid-rows-6 gap-1 w-full max-w-[260px] mx-auto flex-1 content-center">
              {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
                const guess = guesses[rowIndex] ?? "";
                const isCurrentRow = rowIndex === guesses.length;

                return (
                  <div key={rowIndex} className="grid grid-cols-5 gap-1.5 justify-center">
                    {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
                      let char = "";
                      let bgColor = "bg-card border-border/50";
                      let textColor = "text-foreground";

                      if (isCurrentRow) {
                        char = currentGuess[colIndex] ?? "";
                        bgColor = char ? "bg-card border-primary/50" : "bg-card border-border/30";
                      } else if (guess) {
                        char = guess[colIndex];
                        const feedback = getFeedbackBlocks(guess, targetWord);
                        const block = Array.from(feedback)[colIndex];
                        
                        if (block === "🟩") {
                          bgColor = "bg-emerald-500 border-emerald-500";
                          textColor = "text-white";
                        } else if (block === "🟨") {
                          bgColor = "bg-amber-500 border-amber-500";
                          textColor = "text-white";
                        } else {
                          bgColor = "bg-muted border-border/55";
                          textColor = "text-muted-foreground opacity-75";
                        }
                      }

                      return (
                        <div
                          key={colIndex}
                          className={`aspect-square w-full rounded-lg border-2 flex items-center justify-center text-lg font-black transition-all leading-none ${bgColor} ${textColor}`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Live Partner progress indicator */}
            <div className="my-2 bg-muted/40 rounded-xl px-3 py-2 flex items-center justify-between text-xs shrink-0">
              <span className="text-muted-foreground truncate max-w-[140px]">
                {partnerName ?? "Partner"}: {oppGuessesCount}/6 guesses
              </span>
              <span className="text-base tracking-wider tabular-nums leading-none">
                {oppSolved ? "🎉 Solved!" : oppProgressBlocks || "⬜⬜⬜⬜⬜"}
              </span>
            </div>

            {/* Virtual Keyboard */}
            <div className="flex flex-col gap-1 w-full shrink-0">
              {[
                ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
              ].map((row, i) => (
                <div key={i} className="flex justify-center gap-1 w-full">
                  {row.map((key) => {
                    const status = letterStatuses[key];
                    const isBig = key === "ENTER" || key === "BACK";
                    
                    let bg = "bg-muted/70 text-foreground";
                    if (status === "green") bg = "bg-emerald-500 text-white";
                    else if (status === "yellow") bg = "bg-amber-500 text-white";
                    else if (status === "gray") bg = "bg-muted text-muted-foreground opacity-45";

                    return (
                      <button
                        key={key}
                        disabled={mySolved || guesses.length >= MAX_GUESSES}
                        onClick={() => handleKeyPress(key)}
                        className={`h-9 rounded-md flex items-center justify-center font-bold text-xs select-none transition-colors ${bg} ${
                          isBig ? "px-2.5 text-[10px] flex-1 max-w-[60px]" : "w-7 flex-1"
                        }`}
                      >
                        {key === "BACK" ? "⌫" : key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={mySolved && (!oppSolved || (guesses.length < oppGuessesCount) || (guesses.length === oppGuessesCount && (mySolvedTime ?? 0) < (oppSolvedTime ?? 0)))}
            isDraw={(!mySolved && !oppSolved) || (mySolved && oppSolved && guesses.length === oppGuessesCount && mySolvedTime === oppSolvedTime)}
            partnerName={partnerName}
            myScore={mySolved ? guesses.length : 0}
            opponentScore={oppSolved ? oppGuessesCount : 0}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
            scoreLabel="Attempts (lower wins, 0 = DNF)"
          />
        )}
      </div>
    </div>
  );
};

export default WordleDuel;
