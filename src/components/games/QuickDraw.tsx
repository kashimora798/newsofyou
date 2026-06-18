import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Eraser, Undo2, Clock, Send, Eye, Trash2, RefreshCw, Loader2 } from "lucide-react";
import GameOverCelebration from "./GameOverCelebration";
import { supabase } from "@/integrations/supabase/client";
import { aiDrawWords } from "@/lib/aiGame";
import type { GameSession } from "@/hooks/useGameSessions";

const WORD_BANK = [
  // Easy objects & animals
  "sun", "cat", "dog", "tree", "house", "car", "flower", "star", "moon", "fish",
  "heart", "bird", "cloud", "rain", "snow", "fire", "book", "cake", "hat", "shoe",
  "apple", "banana", "guitar", "clock", "chair", "table", "phone", "lamp", "key",
  "pizza", "rocket", "robot", "dragon", "crown", "sword", "beach", "snowman", "cactus",
  "penguin", "elephant", "dolphin", "turtle", "spider", "mushroom", "castle",
  // Fun & playful
  "taco", "donut", "ice cream", "lollipop", "cookie", "cupcake", "waffle",
  "unicorn", "ghost", "alien", "wizard", "mermaid", "pirate", "ninja",
  "rainbow", "lightning", "tornado", "sunrise", "bonfire", "sunset",
  "skateboard", "balloon", "kite", "slide", "swing", "trampoline",
  "mustache", "glasses", "bow tie", "top hat", "magic wand",
  "frog", "snail", "ladybug", "bee", "bunny", "pig", "chicken", "duck", "owl",
  "watermelon", "cherry", "avocado", "hot dog", "popcorn", "pancake", "smoothie",
  "pillow", "blanket", "teddy bear", "candle", "treasure chest", "compass",
  // Emoji-style fun 🎨
  "happy face", "winking face", "heart eyes", "surprised face", "sleepy face",
  "thumbs up", "peace sign", "high five", "flexing arm", "dancing person",
];

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isEraser?: boolean;
}

interface QuickDrawState {
  phase: "choosing" | "drawing" | "result";
  drawer: string;
  word: string;
  strokes: Stroke[];
  guesses: string[];
  guessed: boolean;
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
}

interface QuickDrawProps {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, boardState: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => Promise<void>;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => Promise<void>;
}

const COLORS = [
  "hsl(var(--foreground))",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899",
];
const WIDTHS = [3, 6, 10];
const TIMER_SECONDS = 60;

const QuickDraw: React.FC<QuickDrawProps> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;
  const raw = session.board_state as any;
  const state: QuickDrawState = useMemo(() => ({
    phase: raw?.phase ?? "choosing",
    drawer: raw?.drawer ?? session.created_by,
    word: raw?.word ?? "",
    strokes: Array.isArray(raw?.strokes) ? raw.strokes : [],
    guesses: Array.isArray(raw?.guesses) ? raw.guesses : [],
    guessed: raw?.guessed ?? false,
    round: raw?.round ?? 1,
    totalRounds: raw?.totalRounds ?? 6,
    scores: raw?.scores ?? {},
  }), [raw, session.created_by]);

  const isDrawer = state.drawer === userId;
  const isGuesser = !isDrawer;
  const gameOver = state.round > state.totalRounds && state.phase === "result";

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [penColor, setPenColor] = useState(COLORS[0]);
  const [penWidth, setPenWidth] = useState(WIDTHS[0]);
  const [eraserMode, setEraserMode] = useState(false);
  const [guess, setGuess] = useState("");
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);

  // Sync remote strokes
  useEffect(() => {
    if (isGuesser) setLocalStrokes(state.strokes);
  }, [state.strokes, isGuesser]);

  // Fetch fun, age-appropriate things to draw from AI, falling back to the local
  // word bank if the AI is unavailable.
  const fetchWordOptions = useCallback(async () => {
    setLoadingWords(true);
    const ai = await aiDrawWords();
    const pool = (ai && ai.length >= 3 ? ai : [...WORD_BANK]).sort(() => Math.random() - 0.5);
    setWordOptions(pool.slice(0, 3));
    setLoadingWords(false);
  }, []);

  // Fresh words each new round.
  useEffect(() => { setWordOptions([]); }, [state.round]);

  useEffect(() => {
    if (state.phase === "choosing" && isDrawer && wordOptions.length === 0 && !loadingWords) {
      fetchWordOptions();
    }
  }, [state.phase, isDrawer, wordOptions.length, loadingWords, fetchWordOptions]);

  // Timer
  useEffect(() => {
    if (state.phase !== "drawing" || state.guessed) return;
    setTimer(TIMER_SECONDS);
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          // Time's up — move to result
          if (isDrawer) {
            handleTimeUp();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.round, state.guessed]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = "hsl(var(--card))";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const allStrokes = isDrawer ? localStrokes : state.strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? "hsl(var(--card))" : stroke.color;
      ctx.lineWidth = stroke.isEraser ? 20 : stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * rect.width, stroke.points[i].y * rect.height);
      }
      ctx.stroke();
    }

    // Current stroke in progress
    if (currentStroke.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = eraserMode ? "hsl(var(--card))" : penColor;
      ctx.lineWidth = eraserMode ? 20 : penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(currentStroke[0].x * rect.width, currentStroke[0].y * rect.height);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x * rect.width, currentStroke[i].y * rect.height);
      }
      ctx.stroke();
    }
  }, [localStrokes, state.strokes, currentStroke, isDrawer, penColor, penWidth]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer || state.phase !== "drawing" || state.guessed) return;
    e.preventDefault();
    setIsDrawing(true);
    setCurrentStroke([getPos(e)]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    // Sample: skip if too close to last point (reduces points by ~60%)
    const last = currentStroke[currentStroke.length - 1];
    if (last && Math.abs(pos.x - last.x) < 0.005 && Math.abs(pos.y - last.y) < 0.005) return;
    setCurrentStroke((prev) => [...prev, pos]);
  };

  // Debounced sync ref
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingSyncRef = useRef<Stroke[] | null>(null);

  const syncStrokes = useCallback((strokes: Stroke[]) => {
    pendingSyncRef.current = strokes;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      if (pendingSyncRef.current) {
        await onMakeMove(session.id, { ...state, strokes: pendingSyncRef.current }, session.current_turn);
        pendingSyncRef.current = null;
      }
    }, 350); // debounce 350ms
  }, [state, session, onMakeMove]);

  useEffect(() => {
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, []);

  const handlePointerUp = useCallback(async () => {
    if (!isDrawing || currentStroke.length < 2) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }
    setIsDrawing(false);
    const newStroke: Stroke = { points: currentStroke, color: eraserMode ? "hsl(var(--card))" : penColor, width: eraserMode ? 20 : penWidth, isEraser: eraserMode };
    const newStrokes = [...localStrokes, newStroke];
    setLocalStrokes(newStrokes);
    setCurrentStroke([]);

    // Debounced sync to DB
    syncStrokes(newStrokes);
  }, [isDrawing, currentStroke, penColor, penWidth, localStrokes, syncStrokes]);

  const handleUndo = useCallback(async () => {
    if (localStrokes.length === 0) return;
    const newStrokes = localStrokes.slice(0, -1);
    setLocalStrokes(newStrokes);
    await onMakeMove(session.id, { ...state, strokes: newStrokes }, session.current_turn);
  }, [localStrokes, state, session, onMakeMove]);

  const handleClear = useCallback(async () => {
    setLocalStrokes([]);
    await onMakeMove(session.id, { ...state, strokes: [] }, session.current_turn);
  }, [state, session, onMakeMove]);

  const handleChooseWord = useCallback(async (word: string) => {
    const newState: QuickDrawState = { ...state, phase: "drawing", word: word.toLowerCase(), strokes: [] };
    setLocalStrokes([]);
    await onMakeMove(session.id, newState, state.drawer);
  }, [state, session, onMakeMove]);

  const handleGuess = useCallback(async () => {
    const clean = guess.trim().toLowerCase();
    if (!clean) return;
    setGuess("");

    // Exact match — instant accept
    if (clean === state.word.toLowerCase()) {
      await acceptCorrectGuess(clean);
      return;
    }

    // AI/fuzzy check for synonyms, partial, spelling mistakes
    try {
      const { data, error } = await supabase.functions.invoke("guess-check", {
        body: { guess: clean, answer: state.word },
      });
      if (!error && data?.match) {
        await acceptCorrectGuess(clean);
        return;
      }
    } catch (e) {
      console.error("Guess check error:", e);
    }

    // Wrong guess
    const newState: QuickDrawState = { ...state, guesses: [...state.guesses, clean] };
    await onMakeMove(session.id, newState, session.current_turn);
  }, [guess, state, userId, session, onMakeMove]);

  const acceptCorrectGuess = useCallback(async (clean: string) => {
    const newScores = { ...state.scores };
    newScores[userId] = (newScores[userId] ?? 0) + 1;
    newScores[state.drawer] = (newScores[state.drawer] ?? 0) + 1;
    const newState: QuickDrawState = {
      ...state,
      guessed: true,
      guesses: [...state.guesses, `✅ ${clean}`],
      scores: newScores,
    };
    await onMakeMove(session.id, newState, session.current_turn);
    setTimeout(() => advanceRound(newState), 2000);
  }, [state, userId, session, onMakeMove]);

  const handleTimeUp = useCallback(async () => {
    const newState: QuickDrawState = { ...state, phase: "result" };
    await onMakeMove(session.id, newState, session.current_turn);
    setTimeout(() => advanceRound(newState), 2500);
  }, [state, session, onMakeMove]);

  const advanceRound = useCallback(async (fromState: QuickDrawState) => {
    const nextRound = fromState.round + 1;
    if (nextRound > fromState.totalRounds) {
      // Game over
      const scores = fromState.scores;
      const myScore = scores[userId] ?? 0;
      const opScore = scores[opponentId] ?? 0;
      const winnerId = myScore > opScore ? userId : opScore > myScore ? opponentId : null;
      await onMakeMove(session.id, { ...fromState, round: nextRound, phase: "result" }, session.current_turn, winnerId, myScore === opScore);
      return;
    }
    // Swap drawer
    const nextDrawer = fromState.drawer === session.created_by ? session.opponent_id : session.created_by;
    const newState: QuickDrawState = {
      ...fromState,
      phase: "choosing",
      round: nextRound,
      drawer: nextDrawer,
      word: "",
      strokes: [],
      guesses: [],
      guessed: false,
    };
    setLocalStrokes([]);
    await onMakeMove(session.id, newState, nextDrawer);
  }, [userId, opponentId, session, onMakeMove]);

  const myScore = state.scores[userId] ?? 0;
  const opScore = state.scores[opponentId] ?? 0;

  // GAME OVER
  if (gameOver) {
    const winnerId = session.winner_id;
    return (
      <GameOverCelebration
        isWinner={winnerId === userId}
        isDraw={!winnerId}
        partnerName={partnerName}
        myScore={myScore}
        opponentScore={opScore}
        onExit={onBack}
        onRematch={() => onPlayAgain(opponentId)}
      />
    );
  }

  // CHOOSING PHASE
  if (state.phase === "choosing") {
    return (
      <div className="flex flex-col h-full bg-background" style={{ fontFamily: APPLE_FONT }}>
        <QuickDrawHeader title="Quick Draw" subtitle={`Round ${state.round}/${state.totalRounds} · You ${myScore} · ${partnerName ?? "P"} ${opScore}`} onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          {isDrawer ? (
            <>
              <div className="h-16 w-16 rounded-[20px] bg-primary/10 flex items-center justify-center">
                <Pencil className="h-8 w-8 text-primary" />
              </div>
              <p className="text-[17px] font-semibold text-foreground">Pick a word to draw</p>
              {loadingWords && wordOptions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">Dreaming up fun things…</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 w-full max-w-xs">
                  {wordOptions.map((w) => (
                    <motion.button
                      key={w}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleChooseWord(w)}
                      className="rounded-[18px] bg-card ring-1 ring-border/50 px-5 py-4 text-[17px] font-semibold text-foreground capitalize shadow-sm ease-spring"
                    >
                      {w}
                    </motion.button>
                  ))}
                  <button
                    onClick={() => { setWordOptions([]); }}
                    disabled={loadingWords}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-primary disabled:opacity-40 tappable"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingWords ? "animate-spin" : ""}`} /> New words
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-[20px] bg-muted flex items-center justify-center">
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-[15px] text-muted-foreground animate-pulse">
                {partnerName ?? "Partner"} is picking a word…
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // DRAWING / RESULT PHASE
  return (
    <div className="flex flex-col h-full bg-background" style={{ fontFamily: APPLE_FONT }}>
      <QuickDrawHeader
        title={isDrawer ? `Draw: "${state.word}"` : "Guess the drawing!"}
        subtitle={`Round ${state.round}/${state.totalRounds} · You ${myScore} · ${partnerName ?? "P"} ${opScore}`}
        onBack={onBack}
        right={
          state.phase === "drawing" && !state.guessed ? (
            <div className={`flex items-center gap-1 text-[13px] font-bold tabular-nums ${timer <= 10 ? "text-destructive" : "text-muted-foreground"}`}>
              <Clock className="h-4 w-4" /> {timer}s
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative mx-3 mt-3 rounded-[20px] overflow-hidden ring-1 ring-border/60 shadow-sm">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          {state.guessed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-background/80 flex items-center justify-center"
            >
              <p className="text-2xl font-bold text-primary">✅ Correct!</p>
            </motion.div>
          )}
          {state.phase === "result" && !state.guessed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2"
            >
              <p className="text-lg font-bold text-destructive">⏰ Time's up!</p>
              <p className="text-sm text-muted-foreground">The word was: <b className="text-foreground">{state.word}</b></p>
            </motion.div>
          )}
        </div>

        {/* Drawer tools */}
        {isDrawer && state.phase === "drawing" && !state.guessed && (
          <div className="flex items-center gap-2 px-3 py-3">
            {!eraserMode && (
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setPenColor(c); setEraserMode(false); }}
                    className={`h-7 w-7 rounded-full transition-all ease-spring ${penColor === c && !eraserMode ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : "ring-1 ring-border/50"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
            {!eraserMode && (
              <>
                <div className="h-5 w-px bg-border mx-1" />
                <div className="flex gap-1 p-1 rounded-full bg-muted/60">
                  {WIDTHS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setPenWidth(w)}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ease-spring ${penWidth === w ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
                    >
                      <span className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setEraserMode(!eraserMode)}
              title="Eraser"
              className={`h-9 w-9 rounded-full flex items-center justify-center tappable ${eraserMode ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground"}`}
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button onClick={handleUndo} className="h-9 w-9 rounded-full flex items-center justify-center bg-muted/60 text-muted-foreground tappable" title="Undo">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={handleClear} className="h-9 w-9 rounded-full flex items-center justify-center bg-destructive/10 text-destructive tappable" title="Clear">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Guesser input */}
        {isGuesser && state.phase === "drawing" && !state.guessed && (
          <div className="px-3 py-3 space-y-2">
            {state.guesses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {state.guesses.map((g, i) => (
                  <span key={i} className={`text-[12px] px-2.5 py-1 rounded-full ${g.startsWith("✅") ? "bg-primary/15 text-primary font-semibold" : "bg-muted text-muted-foreground line-through"}`}>
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                placeholder="Type your guess…"
                className="flex-1 rounded-full bg-muted/60 ring-1 ring-border/40 px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <button onClick={handleGuess} className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center tappable shadow-sm shadow-primary/20">
                <Send className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        )}

        {/* Drawer sees guesses */}
        {isDrawer && state.guesses.length > 0 && (
          <div className="px-3 py-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Guesses</p>
            <div className="flex flex-wrap gap-1">
              {state.guesses.map((g, i) => (
                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${g.startsWith("✅") ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif";

const QuickDrawHeader: React.FC<{ title: string; subtitle: string; onBack: () => void; right?: React.ReactNode }> = ({ title, subtitle, onBack, right }) => (
  <header className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
    <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
      <ArrowLeft className="h-5 w-5 text-foreground" />
    </motion.button>
    <div className="flex-1 min-w-0">
      <h2 className="text-[16px] font-semibold text-foreground truncate tracking-tight">{title}</h2>
      <p className="text-[12px] text-muted-foreground truncate">{subtitle}</p>
    </div>
    {right}
  </header>
);

export default QuickDraw;
