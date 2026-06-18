import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Clock, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameOverCelebration from "./GameOverCelebration";
import { aiValidateWord } from "@/lib/aiGame";
import type { GameSession } from "@/hooks/useGameSessions";

interface WordChainState {
  words: string[];
  scores: Record<string, number>;
  lastLetter: string;
  turnTimeLimit?: number;
  failedPlayer?: string;
}

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (
    sessionId: string,
    boardState: any,
    nextTurn: string,
    winnerId?: string | null,
    isDraw?: boolean
  ) => Promise<void>;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => Promise<void>;
}

const TURN_TIME_SECONDS = 30;

const parseState = (boardState: any): WordChainState => {
  if (boardState && typeof boardState === "object" && !Array.isArray(boardState)) {
    return {
      words: boardState.words ?? [],
      scores: boardState.scores ?? {},
      lastLetter: boardState.lastLetter ?? "",
      failedPlayer: boardState.failedPlayer,
    };
  }
  return { words: [], scores: {}, lastLetter: "" };
};

const WordChain: React.FC<Props> = ({
  session,
  userId,
  partnerName,
  onMakeMove,
  onBack,
  onPlayAgain,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsEndRef = useRef<HTMLDivElement>(null);

  const game = session;
  const opponentId = game.created_by === userId ? game.opponent_id : game.created_by;
  const isMyTurn = game.current_turn === userId;
  const gameOver = game.status === "completed";
  const state = useMemo(() => parseState(game.board_state), [game.board_state]);

  // Auto-scroll to latest word
  useEffect(() => {
    wordsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.words.length]);

  // Focus input on my turn
  useEffect(() => {
    if (isMyTurn && !gameOver) {
      inputRef.current?.focus();
    }
  }, [isMyTurn, gameOver]);

  // Turn timer
  useEffect(() => {
    if (!isMyTurn || gameOver) {
      setTimeLeft(TURN_TIME_SECONDS);
      return;
    }
    setTimeLeft(TURN_TIME_SECONDS);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Time's up — forfeit
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, gameOver, game.updated_at]);

  const handleTimeout = useCallback(async () => {
    if (!isMyTurn || gameOver) return;
    const newState: WordChainState = {
      ...state,
      failedPlayer: userId,
    };
    await onMakeMove(game.id, newState as any, opponentId, opponentId);
  }, [isMyTurn, gameOver, state, userId, opponentId, game.id, onMakeMove]);

  const validateWord = (word: string): string | null => {
    const clean = word.trim().toLowerCase();
    if (clean.length < 2) return "Word must be at least 2 letters";
    if (!/^[a-zA-Z]+$/.test(clean)) return "Letters only!";
    if (state.words.map((w) => w.toLowerCase()).includes(clean))
      return "Already used!";
    if (state.lastLetter && clean[0] !== state.lastLetter.toLowerCase())
      return `Must start with "${state.lastLetter.toUpperCase()}"`;
    return null;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isMyTurn || gameOver) return;

      const clean = input.trim().toLowerCase();
      const err = validateWord(clean);
      if (err) {
        setError(err);
        setTimeout(() => setError(""), 2000);
        return;
      }

      // AI checks the word actually exists. Fails open — if the AI is
      // unavailable, the word is accepted so play never stalls.
      setChecking(true);
      const { valid } = await aiValidateWord(clean);
      setChecking(false);
      if (!valid) {
        setError("Hmm, that's not a real word");
        setTimeout(() => setError(""), 2200);
        return;
      }

      const wordScore = clean.length; // longer words = more points
      const newScores = { ...state.scores };
      newScores[userId] = (newScores[userId] || 0) + wordScore;

      const newState: WordChainState = {
        words: [...state.words, clean],
        scores: newScores,
        lastLetter: clean[clean.length - 1],
      };

      setInput("");
      setError("");
      await onMakeMove(game.id, newState as any, opponentId);
    },
    [input, isMyTurn, gameOver, state, userId, opponentId, game.id, onMakeMove]
  );

  const handleGiveUp = useCallback(async () => {
    if (!isMyTurn || gameOver) return;
    const newState: WordChainState = {
      ...state,
      failedPlayer: userId,
    };
    await onMakeMove(game.id, newState as any, opponentId, opponentId);
  }, [isMyTurn, gameOver, state, userId, opponentId, game.id, onMakeMove]);

  const myScore = state.scores[userId] || 0;
  const theirScore = state.scores[opponentId] || 0;
  const iWon = game.winner_id === userId;
  const theyWon = game.winner_id === opponentId;

  return (
    <div className="flex flex-col flex-1 bg-background">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border/50 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">Word Chain</h2>
          <p className="text-[10px] text-muted-foreground">
            vs {partnerName ?? "Partner"} · Longer words = more points
          </p>
        </div>
        {/* Scores */}
        <div className="flex gap-3 text-xs font-bold">
          <span className="text-primary">{myScore}</span>
          <span className="text-muted-foreground">—</span>
          <span className="text-destructive">{theirScore}</span>
        </div>
      </div>

      {/* Turn / Timer bar */}
      {!gameOver && (
        <div className="px-4 py-2 flex items-center justify-between border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <Zap className={`h-3.5 w-3.5 ${isMyTurn ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-xs font-semibold text-foreground">
              {isMyTurn ? "Your turn!" : `${partnerName ?? "Partner"}'s turn…`}
            </span>
          </div>
          {isMyTurn && (
            <div className="flex items-center gap-1.5">
              <Clock className={`h-3 w-3 ${timeLeft <= 10 ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={`text-xs font-mono font-bold ${timeLeft <= 10 ? "text-destructive" : "text-muted-foreground"}`}>
                {timeLeft}s
              </span>
            </div>
          )}
        </div>
      )}

      {/* Required letter hint */}
      {!gameOver && state.lastLetter && (
        <div className="px-4 pt-3 pb-1">
          <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Next word starts with</span>
            <span className="text-2xl font-black text-primary uppercase">{state.lastLetter}</span>
          </div>
        </div>
      )}

      {/* Word list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 scrollbar-thin">
        {state.words.length === 0 && !gameOver && (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">
              {isMyTurn ? "Type any word to start!" : "Waiting for first word…"}
            </p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {state.words.map((word, i) => {
            // Determine who played this word: creator plays even turns, opponent plays odd
            const isCreatorWord = i % 2 === 0;
            const isMyWord =
              (game.created_by === userId && isCreatorWord) ||
              (game.created_by !== userId && !isCreatorWord);
            return (
              <motion.div
                key={`${word}-${i}`}
                initial={{ opacity: 0, x: isMyWord ? 20 : -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`flex ${isMyWord ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2 max-w-[70%] ${
                    isMyWord
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "glass text-foreground rounded-bl-md"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{word}</span>
                    <span className={`text-[10px] font-bold ${isMyWord ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      +{word.length}
                    </span>
                  </div>
                  {/* Highlight chain letter */}
                  {i < state.words.length - 1 && (
                    <span className={`text-[9px] ${isMyWord ? "text-primary-foreground/40" : "text-muted-foreground/60"}`}>
                      …{word[word.length - 1].toUpperCase()}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={wordsEndRef} />
      </div>

      {gameOver && (
        <GameOverCelebration
          isWinner={iWon}
          isDraw={!iWon && !theyWon}
          partnerName={partnerName}
          myScore={myScore}
          opponentScore={theirScore}
          onExit={onBack}
          onRematch={() => onPlayAgain(opponentId)}
          customMessage={`${state.words.length} words played`}
        />
      )}

      {/* Input */}
      {!gameOver && (
        <div className="px-4 py-3 border-t border-border/50 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError("");
                }}
                placeholder={
                  isMyTurn
                    ? state.lastLetter
                      ? `Word starting with "${state.lastLetter.toUpperCase()}"…`
                      : "Type any word to start…"
                    : "Waiting…"
                }
                disabled={!isMyTurn}
                className="pr-10"
                autoComplete="off"
                autoCapitalize="off"
              />
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-6 left-0 text-[10px] text-destructive font-semibold"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <Button type="submit" size="icon" disabled={!isMyTurn || !input.trim() || checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          {isMyTurn && state.words.length > 0 && (
            <button
              onClick={handleGiveUp}
              className="w-full text-center text-[10px] text-muted-foreground mt-2 hover:text-destructive transition-colors"
            >
              Give up
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WordChain;
