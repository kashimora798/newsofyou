import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Flame, Snowflake, Sparkles } from "lucide-react";
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

interface GuessItem {
  val: number;
  feed: string;
  emoji: string;
  color: string;
}

const HotOrCold: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  // Connection and Game States
  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "setting" | "guessing" | "reveal_round" | "gameover">("connecting");
  const [round, setRound] = useState(1);
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  
  // Game state variables
  const [myGuesses, setMyGuesses] = useState<GuessItem[]>([]);
  const [oppGuessesCount, setOppGuessesCount] = useState(0);
  const [lastOppGuess, setLastOppGuess] = useState<{ val: number; feed: string; emoji: string } | null>(null);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({}); // userId: guess count

  // Input states
  const [numChoice, setNumChoice] = useState(50);
  const [guessVal, setGuessVal] = useState("");
  const [isSettingLock, setIsSettingLock] = useState(false);

  const channelRef = useRef<any>(null);

  // Determine roles based on round
  // Round 1: Host sets target, Opponent guesses
  // Round 2: Opponent sets target, Host guesses
  const isSetter = (round === 1 && isHost) || (round === 2 && !isHost);
  const isGuesser = !isSetter;

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const getFeedback = (guess: number, target: number): { text: string; emoji: string; color: string } => {
    const diff = Math.abs(guess - target);
    if (diff === 0) return { text: "Correct!", emoji: "🎉", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    if (diff === 1) return { text: "On Fire! (Extremely Close)", emoji: "❤️‍🔥", color: "text-red-500 bg-red-500/10 border-red-500/20" };
    if (diff <= 5) return { text: "Burning Hot!", emoji: "🥵", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" };
    if (diff <= 15) return { text: "Hot", emoji: "🔥", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    if (diff <= 30) return { text: "Warm", emoji: "🌡️", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" };
    return { text: "Freezing Cold", emoji: "🥶", color: "text-blue-600 bg-blue-600/10 border-blue-600/20" };
  };

  // Handle guess submission (for local guesser)
  const handleGuess = () => {
    const val = parseInt(guessVal);
    if (isNaN(val) || val < 1 || val > 100 || targetNumber === null) return;
    
    const feed = getFeedback(val, targetNumber);
    const newGuess: GuessItem = {
      val,
      feed: feed.text,
      emoji: feed.emoji,
      color: feed.color
    };
    
    const nextGuesses = [newGuess, ...myGuesses];
    setMyGuesses(nextGuesses);
    setGuessVal("");

    const isCorrect = val === targetNumber;

    // Send guess update to partner
    send("guess", {
      round,
      by: userId,
      val,
      guessCount: nextGuesses.length,
      feed: feed.text,
      emoji: feed.emoji,
      correct: isCorrect
    });

    if (isCorrect) {
      // Completed local guesser turn!
      setRoundScores(prev => ({ ...prev, [userId]: nextGuesses.length }));
      setPhase("reveal_round");
      
      if (round === 1) {
        // Wait and go to Round 2
        setTimeout(() => {
          if (isHost) {
            setRound(2);
            setTargetNumber(null);
            setPhase("setting");
            setMyGuesses([]);
            setOppGuessesCount(0);
            setLastOppGuess(null);
            send("next_round", {});
          }
        }, 3000);
      } else {
        // Round 2 completed, Host calculates game over
        setTimeout(() => {
          if (isHost) {
            const finalScores = { ...roundScores, [userId]: nextGuesses.length };
            const creatorGuesses = finalScores[session.created_by];
            const opponentGuesses = finalScores[session.opponent_id];
            
            let winnerId: string | null = null;
            let draw = false;
            
            if (creatorGuesses < opponentGuesses) {
              winnerId = session.created_by;
            } else if (opponentGuesses < creatorGuesses) {
              winnerId = session.opponent_id;
            } else {
              draw = true;
            }
            
            send("over", { winnerId, isDraw: draw, scores: finalScores });
            onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, draw);
          }
        }, 3000);
      }
    }
  };

  // Lock target number (for local setter)
  const handleLockNumber = () => {
    setIsSettingLock(true);
    setTargetNumber(numChoice);
    send("set_target", { round, num: numChoice });
    setPhase("guessing");
  };

  // Realtime Broadcast Channel subscription
  useEffect(() => {
    const channel = supabase.channel(`hotcold_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
      })
      .on("broadcast", { event: "set_target" }, ({ payload }) => {
        // The opponent set their target number
        setTargetNumber(payload.num);
        setPhase("guessing");
      })
      .on("broadcast", { event: "guess" }, ({ payload }) => {
        // The opponent guessed
        setOppGuessesCount(payload.guessCount);
        setLastOppGuess({ val: payload.val, feed: payload.feed, emoji: payload.emoji });
        
        if (payload.correct) {
          setRoundScores(prev => ({ ...prev, [opponentId]: payload.guessCount }));
          setPhase("reveal_round");
          
          if (round === 1) {
            // Advancing to round 2 will be driven by Host
            if (isHost) {
              setTimeout(() => {
                setRound(2);
                setTargetNumber(null);
                setPhase("setting");
                setMyGuesses([]);
                setOppGuessesCount(0);
                setLastOppGuess(null);
                send("next_round", {});
              }, 3000);
            }
          }
        }
      })
      .on("broadcast", { event: "next_round" }, () => {
        // Advanced to round 2
        setRound(2);
        setTargetNumber(null);
        setPhase("setting");
        setMyGuesses([]);
        setOppGuessesCount(0);
        setLastOppGuess(null);
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        // Game is completed
        setRoundScores(payload.scores);
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
  }, [session.id, round, targetNumber, roundScores, isHost, opponentId, send]);

  // Host starts setting on connection
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("setting");
    }
  }, [peerReady, phase]);

  // Game over state
  const isWinner = roundScores[userId] < roundScores[opponentId];
  const isDraw = roundScores[userId] === roundScores[opponentId];

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Hot or Cold 🥵🥶</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            Round {round} of 2 · vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase !== "connecting" && phase !== "gameover" && (
          <div className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {isSetter ? "Setter" : "Guesser"}
          </div>
        )}
      </div>

      {/* Main play space */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Both must open this screen to play!
            </p>
          </div>
        )}

        {phase === "setting" && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-5">
            {round === 1 && (
              <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-3.5 flex gap-2.5 items-start">
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-foreground leading-normal">
                  <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                  One player secretly chooses a number from **1 to 100**. The other guesses. You get feedback based on how close you are. Lower guesses wins!
                </div>
              </div>
            )}

            {isSetter ? (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-foreground">Set your secret number!</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag to pick a number (1-100) for your partner to guess</p>
                </div>

                <div className="w-full flex flex-col items-center bg-card ring-1 ring-border/50 rounded-3xl p-6 shadow-sm">
                  <span className="text-6xl font-black text-primary leading-none tabular-nums">{numChoice}</span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={numChoice}
                    onChange={(e) => setNumChoice(Number(e.target.value))}
                    disabled={isSettingLock}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary mt-6"
                  />
                  <div className="flex justify-between w-full text-[10px] text-muted-foreground mt-2 font-bold px-1">
                    <span>1</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>

                <button
                  onClick={handleLockNumber}
                  disabled={isSettingLock}
                  className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 disabled:opacity-50 transition-all text-sm"
                >
                  {isSettingLock ? "Confirming..." : "Lock Secret Number"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-3xl">🤫</div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Partner is choosing...</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {partnerName ?? "Partner"} is thinking of a secret number between 1 and 100.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "guessing" && (
          <div className="w-full max-w-[340px] flex flex-col items-stretch gap-4">
            {isGuesser ? (
              <>
                <div className="text-center mb-1">
                  <h3 className="text-base font-bold text-foreground">Guess the Secret Number!</h3>
                  <p className="text-xs text-muted-foreground">Type a number from 1 to 100</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={guessVal}
                    onChange={(e) => setGuessVal(e.target.value)}
                    placeholder="Enter 1-100"
                    onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                    className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-bold text-center text-lg"
                  />
                  <button
                    onClick={handleGuess}
                    className="py-3 px-5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm"
                  >
                    Guess
                  </button>
                </div>

                {/* Guess History */}
                <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 shadow-sm min-h-[160px] max-h-[200px] overflow-y-auto mt-2 flex flex-col gap-2">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Your Guesses ({myGuesses.length})</div>
                  {myGuesses.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                      No guesses yet! Give it a shot.
                    </div>
                  ) : (
                    myGuesses.map((g, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${g.color}`}
                      >
                        <span>Guess: {g.val}</span>
                        <span className="flex items-center gap-1">{g.emoji} {g.feed}</span>
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            ) : (
              // Setter screen watching guesser
              <div className="w-full flex flex-col items-center gap-5">
                <div className="w-full text-center">
                  <h3 className="text-base font-bold text-foreground">Your Partner is Guessing!</h3>
                  <p className="text-xs text-muted-foreground">Your secret number: <strong className="text-primary font-bold">{targetNumber}</strong></p>
                </div>

                <div className="w-full bg-card ring-1 ring-border/50 rounded-3xl p-6 text-center shadow-sm flex flex-col items-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Partner's Guess Count</p>
                  <span className="text-6xl font-black text-primary mt-2 tabular-nums">{oppGuessesCount}</span>
                </div>

                {lastOppGuess ? (
                  <motion.div
                    key={oppGuessesCount}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full flex flex-col items-center border border-dashed rounded-2xl p-3 bg-muted/40 text-xs"
                  >
                    <p className="text-muted-foreground">Last Guess: <strong className="text-foreground text-sm">{lastOppGuess.val}</strong></p>
                    <p className="flex items-center gap-1 mt-1 text-foreground font-semibold">
                      {lastOppGuess.emoji} {lastOppGuess.feed}
                    </p>
                  </motion.div>
                ) : (
                  <p className="text-xs text-muted-foreground">Waiting for their first move...</p>
                )}
              </div>
            )}
          </div>
        )}

        {phase === "reveal_round" && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-4xl">
              <Sparkles className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Target Guessed Correctly! 🎉</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The target number was <strong className="text-foreground">{targetNumber}</strong>.
              </p>
              <div className="mt-4 bg-card ring-1 ring-border/50 rounded-2xl px-5 py-3 text-xs inline-block text-left">
                {round === 1 ? (
                  <p className="text-muted-foreground">
                    {partnerName ?? "Partner"} finished with <strong className="text-foreground">{roundScores[opponentId] ?? oppGuessesCount}</strong> guesses!
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    You finished with <strong className="text-foreground">{roundScores[userId] ?? myGuesses.length}</strong> guesses!
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-primary font-medium animate-pulse mt-4">
              {round === 1 ? "Swapping roles for Round 2..." : "Calculating final scores..."}
            </p>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={isWinner}
            isDraw={isDraw}
            partnerName={partnerName}
            myScore={roundScores[userId] ?? 0}
            opponentScore={roundScores[opponentId] ?? 0}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
            // Custom label since LOWER guesses is better
            scoreLabel="Guesses (lower wins)"
          />
        )}
      </div>
    </div>
  );
};

export default HotOrCold;
