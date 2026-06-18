import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Heart, HeartOff, Send } from "lucide-react";
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

const CATEGORIES = [
  "Bollywood Movies 🎬",
  "Indian Cities 🌆",
  "Countries of the world 🌍",
  "Fruits & Vegetables 🍎",
  "Famous Global Brands 🏷️",
  "K-Pop & Global Music 🎵",
  "Marvel & Cartoon Characters 🦸"
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const TURN_TIMEOUT_SEC = 10;

const AlphabetSprint: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "playing" | "gameover">("connecting");
  const [category, setCategory] = useState("");

  // Game states
  const [letterIndex, setLetterIndex] = useState(0); // index in ALPHABET (0 = 'A')
  const [currentTurn, setCurrentTurn] = useState(""); // userId whose turn it is
  const [lives, setLives] = useState<Record<string, number>>({ [userId]: 3, [opponentId]: 3 });
  
  // Input/History states
  const [inputText, setInputText] = useState("");
  const [submittedWords, setSubmittedWords] = useState<{ letter: string; word: string; authorName: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(TURN_TIMEOUT_SEC);

  const channelRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ letterIndex, currentTurn, lives, timeLeft, phase });

  stateRef.current = { letterIndex, currentTurn, lives, timeLeft, phase };

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const handleStartPlay = () => {
    setPhase("playing");
    send("play_click", {});
  };

  const handleWordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== "playing" || currentTurn !== userId || !inputText.trim()) return;

    const word = inputText.trim();
    const targetLetter = ALPHABET[letterIndex];
    const isCorrect = word.toUpperCase().startsWith(targetLetter);

    setInputText("");

    if (isCorrect) {
      const nextWordEntry = { letter: targetLetter, word, authorName: "You" };
      setSubmittedWords(prev => [...prev, nextWordEntry]);
      
      const nextIdx = letterIndex + 1;
      const isSprintDone = nextIdx >= ALPHABET.length;
      
      if (isSprintDone) {
        handleGameFinished(userId, lives);
      } else {
        setLetterIndex(nextIdx);
        setCurrentTurn(opponentId);
        setTimeLeft(TURN_TIMEOUT_SEC);
        send("word_added", {
          word,
          letter: targetLetter,
          by: userId,
          nextIndex: nextIdx,
          nextTurn: opponentId,
          livesLeft: lives
        });
      }
    } else {
      // Incorrect letter match, lose a life
      const nextLives = { ...lives, [userId]: Math.max(0, lives[userId] - 1) };
      setLives(nextLives);
      
      const isDead = nextLives[userId] <= 0;
      if (isDead) {
        handleGameFinished(opponentId, nextLives);
      } else {
        // Keep turn but advance letter index to help them move forward
        const nextIdx = letterIndex + 1;
        const isSprintDone = nextIdx >= ALPHABET.length;
        if (isSprintDone) {
          handleGameFinished(opponentId, nextLives);
        } else {
          setLetterIndex(nextIdx);
          setCurrentTurn(opponentId);
          setTimeLeft(TURN_TIMEOUT_SEC);
          send("foul_life", {
            by: userId,
            nextIndex: nextIdx,
            nextTurn: opponentId,
            livesLeft: nextLives
          });
        }
      }
    }
  };

  const handleTimeout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Whichever player timed out loses a life
    const activePlayer = stateRef.current.currentTurn;
    const nextLives = { ...stateRef.current.lives, [activePlayer]: Math.max(0, stateRef.current.lives[activePlayer] - 1) };
    setLives(nextLives);

    const isDead = nextLives[activePlayer] <= 0;
    if (isDead) {
      const winner = activePlayer === userId ? opponentId : userId;
      handleGameFinished(winner, nextLives);
    } else {
      const nextIdx = stateRef.current.letterIndex + 1;
      const isSprintDone = nextIdx >= ALPHABET.length;
      
      if (isSprintDone) {
        const winner = nextLives[userId] === nextLives[opponentId] ? null : nextLives[userId] > nextLives[opponentId] ? userId : opponentId;
        handleGameFinished(winner, nextLives);
      } else {
        setLetterIndex(nextIdx);
        const nextTurn = activePlayer === userId ? opponentId : userId;
        setCurrentTurn(nextTurn);
        setTimeLeft(TURN_TIMEOUT_SEC);
        
        if (activePlayer === userId) {
          send("foul_life", {
            by: userId,
            nextIndex: nextIdx,
            nextTurn,
            livesLeft: nextLives
          });
        }
      }
    }
  };

  const handleGameFinished = (winnerId: string | null, finalLives = lives) => {
    const finalScores = {
      [userId]: finalLives[userId] * 10,
      [opponentId]: finalLives[opponentId] * 10
    };
    send("over", { winnerId, scores: finalScores });
    onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, winnerId === null);
  };

  // Timer loop
  useEffect(() => {
    if (phase === "playing") {
      setTimeLeft(TURN_TIMEOUT_SEC);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Handle timeout locally if it's my turn
            if (stateRef.current.currentTurn === userId) {
              handleTimeout();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentTurn]);

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`sprint_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
          setCategory(cat);
          setPhase("instructions");
          setCurrentTurn(userId);
          send("start_game", { category: cat, turn: userId });
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
          setCategory(cat);
          setPhase("instructions");
          setCurrentTurn(userId);
          send("start_game", { category: cat, turn: userId });
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setCategory(payload.category);
        setCurrentTurn(payload.turn);
        setPhase("instructions");
      })
      .on("broadcast", { event: "play_click" }, () => {
        setPhase("playing");
      })
      .on("broadcast", { event: "word_added" }, ({ payload }) => {
        setSubmittedWords(prev => [...prev, { letter: payload.letter, word: payload.word, authorName: partnerName ?? "Partner" }]);
        setLetterIndex(payload.nextIndex);
        setCurrentTurn(payload.nextTurn);
        setLives(payload.livesLeft);
        setTimeLeft(TURN_TIMEOUT_SEC);
      })
      .on("broadcast", { event: "foul_life" }, ({ payload }) => {
        setLetterIndex(payload.nextIndex);
        setCurrentTurn(payload.nextTurn);
        setLives(payload.livesLeft);
        setTimeLeft(TURN_TIMEOUT_SEC);
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setLives({
          [userId]: Math.round(payload.scores[userId] / 10),
          [opponentId]: Math.round(payload.scores[opponentId] / 10)
        });
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
  }, [session.id, isHost, phase, partnerName, userId, opponentId, send]);

  // Handle local choices
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("instructions");
    }
  }, [peerReady, phase]);

  const isWinner = lives[userId] > lives[opponentId];
  const isDraw = lives[userId] === lives[opponentId];
  const myTurn = currentTurn === userId;

  const renderHeartIcons = (playerLives: number) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => {
          const active = i < playerLives;
          return active ? (
            <Heart key={i} className="h-4.5 w-4.5 text-primary fill-primary shrink-0" />
          ) : (
            <HeartOff key={i} className="h-4.5 w-4.5 text-muted-foreground opacity-40 shrink-0" />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Alphabet Sprint 🔡</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            vs {partnerName ?? "Partner"}
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Keep this screen open to start the alphabet sprint!
            </p>
          </div>
        )}

        {phase === "instructions" && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                Take turns writing words in the category starting from **A to Z** in order. You get **10 seconds** per turn. Wrong answer or timeout loses a life! Start with 3 lives.
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 w-full text-center shadow-sm">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">CATEGORY</span>
              <h3 className="text-lg font-bold text-primary">"{category}"</h3>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Sprint
            </button>
          </div>
        )}

        {phase === "playing" && (
          <div className="w-full max-w-[340px] flex-1 flex flex-col justify-between py-2">
            {/* Category Banner */}
            <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center shadow-xs">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">CATEGORY</span>
              <h3 className="text-sm font-bold text-foreground mt-0.5">{category}</h3>
            </div>

            {/* Lives and Turn bar */}
            <div className="bg-card ring-1 ring-border/50 rounded-xl p-3 flex justify-between items-center my-3 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground font-bold">Your Lives</span>
                {renderHeartIcons(lives[userId])}
              </div>

              <div className="flex flex-col items-center">
                {myTurn ? (
                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-bold animate-pulse">
                    Your Turn
                  </span>
                ) : (
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-3 py-1 font-semibold">
                    {partnerName ?? "Partner"}'s Turn
                  </span>
                )}
                <span className="text-[10px] text-primary font-bold tabular-nums mt-1.5 leading-none">
                  {timeLeft}s left
                </span>
              </div>

              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[90px]">{partnerName ?? "Partner"}</span>
                {renderHeartIcons(lives[opponentId])}
              </div>
            </div>

            {/* Alphabet letter prompt */}
            <div className="bg-primary/5 border border-primary/15 rounded-3xl p-6 text-center shadow-xs flex flex-col items-center my-1">
              <span className="text-[10px] text-primary uppercase font-black tracking-widest">NEXT LETTER</span>
              <span className="text-7xl font-black text-primary leading-none my-3 tabular-nums select-none animate-bounce">
                {ALPHABET[letterIndex]}
              </span>
              <span className="text-xs text-muted-foreground">Type a word starting with {ALPHABET[letterIndex]}</span>
            </div>

            {/* Word history logs */}
            <div className="flex-1 min-h-[90px] max-h-[120px] bg-card ring-1 ring-border/50 rounded-2xl p-3 shadow-inner overflow-y-auto flex flex-col gap-1.5 content-start mt-2">
              {submittedWords.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  History is empty
                </div>
              ) : (
                submittedWords.slice(-3).map((w, i) => (
                  <div key={i} className="flex justify-between items-center text-xs border-b border-border/30 pb-1">
                    <span className="font-bold text-primary">{w.letter}: {w.word}</span>
                    <span className="text-[9px] text-muted-foreground font-semibold">{w.authorName}</span>
                  </div>
                ))
              )}
            </div>

            {/* Submit Box */}
            <form onSubmit={handleWordSubmit} className="w-full flex gap-2 mt-3 relative">
              <input
                disabled={!myTurn}
                autoFocus={myTurn}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={myTurn ? `Type starting with ${ALPHABET[letterIndex]}...` : "Waiting for partner..."}
                className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
              />
              <button
                type="submit"
                disabled={!myTurn || !inputText.trim()}
                className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={isWinner}
            isDraw={isDraw}
            partnerName={partnerName}
            myScore={lives[userId] * 10}
            opponentScore={lives[opponentId] * 10}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
            scoreLabel="Lives left score"
          />
        )}
      </div>
    </div>
  );
};

export default AlphabetSprint;
