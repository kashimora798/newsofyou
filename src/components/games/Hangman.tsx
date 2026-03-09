import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Send, Lightbulb, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession } from "@/hooks/useGameSessions";

const WORD_LIST = [
  "PLANET", "GUITAR", "PUZZLE", "ROCKET", "CASTLE", "DRAGON", "PIRATE",
  "JUNGLE", "BRIDGE", "STORM", "FLAME", "CLOUD", "MAGIC", "GHOST",
  "ROBOT", "TIGER", "OCEAN", "NINJA", "EAGLE", "CANDY", "TOWER",
  "CROWN", "FROST", "BLAZE", "COMET", "DRIFT", "SPARK", "QUEST",
  "SWORD", "ORBIT", "SHIELD", "VOYAGE", "MARBLE", "CIPHER", "PRISM",
];

const MAX_WRONG = 6;
const MAX_NORMAL_HINTS = 2;
const MAX_AI_HINTS = 2;

interface HangmanState {
  word: string;
  guessed: string[];
  setter: string;
  phase: "setting" | "guessing" | "won" | "lost";
  hintsUsed?: number;
  aiHintsUsed?: number;
}

function getDefaultState(): HangmanState {
  return { word: "", guessed: [], setter: "", phase: "setting", hintsUsed: 0, aiHintsUsed: 0 };
}

function parseState(raw: any): HangmanState {
  if (raw && typeof raw === "object" && "word" in raw) return { hintsUsed: 0, aiHintsUsed: 0, ...raw } as HangmanState;
  return getDefaultState();
}

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, boardState: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

const BODY_PARTS = [
  <circle key="head" cx="200" cy="80" r="20" fill="none" stroke="currentColor" strokeWidth="3" />,
  <line key="body" x1="200" y1="100" x2="200" y2="160" stroke="currentColor" strokeWidth="3" />,
  <line key="larm" x1="200" y1="120" x2="170" y2="145" stroke="currentColor" strokeWidth="3" />,
  <line key="rarm" x1="200" y1="120" x2="230" y2="145" stroke="currentColor" strokeWidth="3" />,
  <line key="lleg" x1="200" y1="160" x2="175" y2="195" stroke="currentColor" strokeWidth="3" />,
  <line key="rleg" x1="200" y1="160" x2="225" y2="195" stroke="currentColor" strokeWidth="3" />,
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const Hangman: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const [game, setGame] = useState(session);
  const [state, setState] = useState<HangmanState>(() => parseState(session.board_state));
  const [wordInput, setWordInput] = useState("");
  const [hintText, setHintText] = useState<string | null>(null);
  const [aiHintText, setAiHintText] = useState<string | null>(null);
  const [aiHintLoading, setAiHintLoading] = useState(false);
  const [wordGuess, setWordGuess] = useState("");
  const [wordGuessResult, setWordGuessResult] = useState<string | null>(null);

  const opponentId = game.created_by === userId ? game.opponent_id : game.created_by;
  const iAmSetter = state.setter === userId;
  const iAmGuesser = state.phase === "guessing" && !iAmSetter;

  const wrongGuesses = state.guessed.filter((l) => !state.word.includes(l));
  const wrongCount = wrongGuesses.length;
  const wordLetters = state.word.split("");

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`game_hangman_${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const d = payload.new as any;
          setGame((prev) => ({ ...prev, ...d, board_state: d.board_state }));
          setState(parseState(d.board_state));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  // Set word
  const handleSetWord = useCallback(() => {
    const clean = wordInput.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (clean.length < 3 || clean.length > 12) return;
    const newState: HangmanState = {
      word: clean, guessed: [], setter: userId, phase: "guessing", hintsUsed: 0, aiHintsUsed: 0,
    };
    setState(newState);
    onMakeMove(game.id, newState, opponentId);
    setWordInput("");
    setHintText(null);
    setAiHintText(null);
  }, [wordInput, userId, game.id, opponentId, onMakeMove]);

  const handleRandomWord = useCallback(() => {
    const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const newState: HangmanState = {
      word, guessed: [], setter: userId, phase: "guessing", hintsUsed: 0, aiHintsUsed: 0,
    };
    setState(newState);
    onMakeMove(game.id, newState, opponentId);
    setHintText(null);
    setAiHintText(null);
  }, [userId, game.id, opponentId, onMakeMove]);

  // Guess a letter
  const handleGuess = useCallback((letter: string) => {
    if (!iAmGuesser || state.guessed.includes(letter)) return;
    const newGuessed = [...state.guessed, letter];
    const newWrong = newGuessed.filter((l) => !state.word.includes(l));
    const revealed = state.word.split("").every((l) => newGuessed.includes(l));
    const lost = newWrong.length >= MAX_WRONG;
    const newState: HangmanState = {
      ...state, guessed: newGuessed,
      phase: revealed ? "won" : lost ? "lost" : "guessing",
    };
    const winnerId = revealed ? userId : lost ? opponentId : null;
    setState(newState);
    onMakeMove(game.id, newState, lost || revealed ? userId : state.setter, winnerId, false);
  }, [iAmGuesser, state, userId, opponentId, game.id, onMakeMove]);

  // Guess the full word (with AI fuzzy matching)
  const handleWordGuess = useCallback(async () => {
    const clean = wordGuess.trim().toUpperCase();
    if (!clean || !iAmGuesser) return;
    setWordGuess("");
    setWordGuessResult(null);

    // Exact match
    if (clean === state.word) {
      const allLetters = [...new Set(state.word.split(""))];
      const newGuessed = [...new Set([...state.guessed, ...allLetters])];
      const newState: HangmanState = { ...state, guessed: newGuessed, phase: "won" };
      setState(newState);
      onMakeMove(game.id, newState, userId, userId, false);
      return;
    }

    // AI fuzzy check
    try {
      const { data, error } = await supabase.functions.invoke("guess-check", {
        body: { guess: clean, answer: state.word },
      });
      if (!error && data?.match) {
        const allLetters = [...new Set(state.word.split(""))];
        const newGuessed = [...new Set([...state.guessed, ...allLetters])];
        const newState: HangmanState = { ...state, guessed: newGuessed, phase: "won" };
        setState(newState);
        setWordGuessResult("🎉 Close enough!");
        onMakeMove(game.id, newState, userId, userId, false);
        return;
      }
    } catch (e) {
      console.error("Word guess check error:", e);
    }

    // Wrong word guess — costs 1 wrong guess
    const fakeWrongLetter = `?${clean.slice(0, 3)}`;
    const newGuessed = [...state.guessed, fakeWrongLetter];
    const newWrong = newGuessed.filter((l) => !state.word.includes(l));
    const lost = newWrong.length >= MAX_WRONG;
    const newState: HangmanState = {
      ...state, guessed: newGuessed,
      phase: lost ? "lost" : "guessing",
    };
    setState(newState);
    setWordGuessResult(`❌ "${clean}" is not the word!`);
    onMakeMove(game.id, newState, lost ? userId : state.setter, lost ? opponentId : null, false);
    setTimeout(() => setWordGuessResult(null), 2500);
  }, [wordGuess, iAmGuesser, state, userId, opponentId, game.id, onMakeMove]);


  const handleNormalHint = useCallback(() => {
    if (!iAmGuesser || (state.hintsUsed ?? 0) >= MAX_NORMAL_HINTS) return;
    const unrevealed = wordLetters.filter((l, i, arr) => !state.guessed.includes(l) && arr.indexOf(l) === i);
    if (unrevealed.length === 0) return;
    const hintLetter = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    setHintText(`💡 The word contains "${hintLetter}"!`);
    // Auto-guess the hint letter
    const newGuessed = [...state.guessed, hintLetter];
    const revealed = state.word.split("").every((l) => newGuessed.includes(l));
    const newState: HangmanState = {
      ...state, guessed: newGuessed, hintsUsed: (state.hintsUsed ?? 0) + 1,
      phase: revealed ? "won" : "guessing",
    };
    const winnerId = revealed ? userId : null;
    setState(newState);
    onMakeMove(game.id, newState, revealed ? userId : state.setter, winnerId, false);
  }, [iAmGuesser, state, wordLetters, userId, game.id, onMakeMove]);

  // AI hint — get a creative clue from AI
  const handleAiHint = useCallback(async () => {
    if (!iAmGuesser || (state.aiHintsUsed ?? 0) >= MAX_AI_HINTS || aiHintLoading) return;
    setAiHintLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hangman-hint", {
        body: { word: state.word, guessedLetters: state.guessed, wrongCount },
      });
      if (error) throw error;
      setAiHintText(data?.hint ?? "🤔 Think about it differently!");
      const newState: HangmanState = { ...state, aiHintsUsed: (state.aiHintsUsed ?? 0) + 1 };
      setState(newState);
      onMakeMove(game.id, newState, state.setter);
    } catch (e) {
      console.error("AI hint error:", e);
      setAiHintText("🤖 AI is busy, try again!");
    } finally {
      setAiHintLoading(false);
    }
  }, [iAmGuesser, state, wrongCount, aiHintLoading, game.id, onMakeMove]);

  const gameOver = state.phase === "won" || state.phase === "lost";
  const normalHintsLeft = MAX_NORMAL_HINTS - (state.hintsUsed ?? 0);
  const aiHintsLeft = MAX_AI_HINTS - (state.aiHintsUsed ?? 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack} className="p-2 rounded-full glass-subtle">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">Hangman</h2>
          <p className="text-[10px] text-muted-foreground">
            {state.phase === "setting"
              ? "Pick a word for your partner!"
              : iAmSetter
              ? `${partnerName ?? "Partner"} is guessing…`
              : `Guess the word!`}
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className="px-4 pb-3">
        <motion.div
          key={state.phase}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass rounded-xl p-3 text-center text-sm font-semibold ${
            gameOver
              ? state.phase === "won"
                ? iAmGuesser ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                : iAmGuesser ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              : state.phase === "setting"
              ? "bg-accent/10 text-accent-foreground"
              : iAmGuesser
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {state.phase === "setting"
            ? game.current_turn === userId
              ? "Choose a word for your partner to guess!"
              : `Waiting for ${partnerName ?? "partner"} to pick a word…`
            : state.phase === "won"
            ? iAmGuesser ? "🎉 You guessed it!" : `${partnerName ?? "Partner"} guessed your word!`
            : state.phase === "lost"
            ? iAmGuesser ? `💀 The word was "${state.word}"` : `🎉 They couldn't guess "${state.word}"!`
            : iAmGuesser
            ? `Your turn — ${MAX_WRONG - wrongCount} guesses left`
            : `${partnerName ?? "Partner"} is guessing… (${MAX_WRONG - wrongCount} left)`}
        </motion.div>
      </div>

      {/* Word Setting Phase */}
      {state.phase === "setting" && game.current_turn === userId && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Type a word (3–12 letters) or pick a random one
          </p>
          <div className="flex gap-2 w-full max-w-[300px]">
            <input
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 12))}
              placeholder="Enter a word…"
              className="flex-1 h-11 rounded-xl glass px-4 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Enter" && handleSetWord()}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSetWord}
              disabled={wordInput.trim().length < 3}
              className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleRandomWord}
            className="h-10 px-5 rounded-xl glass text-sm font-medium text-foreground"
          >
            🎲 Random Word
          </motion.button>
        </div>
      )}

      {/* Waiting for setter */}
      {state.phase === "setting" && game.current_turn !== userId && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            Waiting for {partnerName ?? "partner"} to choose a word…
          </p>
        </div>
      )}

      {/* Guessing Phase / Game Over */}
      {(state.phase === "guessing" || gameOver) && (
        <div className="flex-1 flex flex-col items-center px-4 gap-3 overflow-y-auto">
          {/* Hangman figure */}
          <svg viewBox="100 0 200 220" className="w-full max-w-[200px] h-auto text-foreground">
            <line x1="130" y1="210" x2="270" y2="210" stroke="currentColor" strokeWidth="3" />
            <line x1="150" y1="210" x2="150" y2="30" stroke="currentColor" strokeWidth="3" />
            <line x1="150" y1="30" x2="200" y2="30" stroke="currentColor" strokeWidth="3" />
            <line x1="200" y1="30" x2="200" y2="60" stroke="currentColor" strokeWidth="3" />
            {BODY_PARTS.slice(0, wrongCount).map((part, i) => (
              <motion.g
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {part}
              </motion.g>
            ))}
          </svg>

          {/* Word display */}
          <div className="flex gap-2 flex-wrap justify-center">
            {wordLetters.map((letter, i) => {
              const isRevealed = state.guessed.includes(letter) || gameOver;
              return (
                <motion.div
                  key={i}
                  initial={isRevealed ? { scale: 0.5 } : {}}
                  animate={{ scale: 1 }}
                  className={`w-9 h-11 rounded-lg flex items-center justify-center text-lg font-bold border-b-2 ${
                    isRevealed
                      ? gameOver && state.phase === "lost" && !state.guessed.includes(letter)
                        ? "text-destructive border-destructive/30 bg-destructive/5"
                        : "text-foreground border-primary/30 bg-primary/5"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isRevealed ? letter : ""}
                </motion.div>
              );
            })}
          </div>

          {/* Wrong guesses */}
          {wrongGuesses.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-center">
              <span className="text-[10px] text-muted-foreground mr-1">Wrong:</span>
              {wrongGuesses.map((l) => (
                <span key={l} className="text-xs font-bold text-destructive">{l}</span>
              ))}
            </div>
          )}

          {/* Hint bubbles */}
          <AnimatePresence>
            {hintText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass rounded-xl px-4 py-2 text-xs text-foreground text-center max-w-[280px]"
              >
                {hintText}
              </motion.div>
            )}
            {aiHintText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl px-4 py-2 text-xs text-center max-w-[280px] bg-accent/20 text-accent-foreground border border-accent/30"
              >
                🤖 {aiHintText}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint buttons */}
          {!gameOver && iAmGuesser && (
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleNormalHint}
                disabled={normalHintsLeft <= 0}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg glass text-xs font-medium text-foreground disabled:opacity-30"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Hint ({normalHintsLeft})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAiHint}
                disabled={aiHintsLeft <= 0 || aiHintLoading}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-accent/10 text-accent-foreground border border-accent/20 disabled:opacity-30"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiHintLoading ? "Thinking…" : `AI Hint (${aiHintsLeft})`}
              </motion.button>
            </div>
          )}

          {/* Keyboard */}
          {!gameOver && iAmGuesser && (
            <div className="grid grid-cols-9 gap-1.5 w-full max-w-[320px] mt-1">
              {ALPHABET.map((letter) => {
                const used = state.guessed.includes(letter);
                const correct = used && state.word.includes(letter);
                const wrong = used && !state.word.includes(letter);
                return (
                  <motion.button
                    key={letter}
                    whileTap={!used ? { scale: 0.8 } : {}}
                    onClick={() => handleGuess(letter)}
                    disabled={used}
                    className={`h-9 rounded-lg text-xs font-bold transition-colors ${
                      correct
                        ? "bg-primary/20 text-primary"
                        : wrong
                        ? "bg-destructive/10 text-destructive/40"
                        : "glass hover:bg-muted/50 text-foreground"
                    } disabled:cursor-default`}
                  >
                    {letter}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Setter watching */}
          {!gameOver && iAmSetter && (
            <p className="text-xs text-muted-foreground animate-pulse mt-4">
              {partnerName ?? "Partner"} is guessing your word…
            </p>
          )}
        </div>
      )}

      {/* Game Over Actions */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-6 pt-3 flex gap-3"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onPlayAgain(opponentId)}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex-1 h-11 rounded-xl glass font-semibold text-sm text-foreground flex items-center justify-center"
            >
              Back to Lobby
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Hangman;
