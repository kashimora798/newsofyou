import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Eraser, Undo2, Trophy, Clock, Send, Eye, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  const [guess, setGuess] = useState("");
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [wordOptions, setWordOptions] = useState<string[]>([]);

  // Sync remote strokes
  useEffect(() => {
    if (isGuesser) setLocalStrokes(state.strokes);
  }, [state.strokes, isGuesser]);

  // Generate word options for choosing phase
  useEffect(() => {
    if (state.phase === "choosing" && isDrawer && wordOptions.length === 0) {
      const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
      setWordOptions(shuffled.slice(0, 3));
    }
  }, [state.phase, isDrawer]);

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
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
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
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
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
    const newStroke: Stroke = { points: currentStroke, color: penColor, width: penWidth };
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

    if (clean === state.word.toLowerCase()) {
      // Correct!
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
      // Auto advance after delay
      setTimeout(() => advanceRound(newState), 2000);
    } else {
      const newState: QuickDrawState = { ...state, guesses: [...state.guesses, clean] };
      await onMakeMove(session.id, newState, session.current_turn);
    }
  }, [guess, state, userId, session, onMakeMove]);

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
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <h2 className="text-sm font-bold text-foreground">Quick Draw — Game Over</h2>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <Trophy className="h-12 w-12 text-primary" />
          <p className="text-xl font-bold text-foreground">
            {winnerId === userId ? "You won! 🎉" : winnerId ? `${partnerName ?? "Partner"} won!` : "It's a draw!"}
          </p>
          <div className="flex gap-6 text-sm">
            <span className="text-primary font-bold">You: {myScore}</span>
            <span className="text-muted-foreground font-bold">{partnerName ?? "P"}: {opScore}</span>
          </div>
          <Button onClick={() => onPlayAgain(opponentId)}>Play Again</Button>
        </div>
      </div>
    );
  }

  // CHOOSING PHASE
  if (state.phase === "choosing") {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">Quick Draw</h2>
            <p className="text-[10px] text-muted-foreground">Round {state.round}/{state.totalRounds} · You: {myScore} · {partnerName ?? "P"}: {opScore}</p>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          {isDrawer ? (
            <>
              <Pencil className="h-10 w-10 text-primary" />
              <p className="text-sm font-semibold text-foreground">Pick a word to draw!</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {wordOptions.map((w) => (
                  <Button key={w} variant="outline" onClick={() => handleChooseWord(w)} className="capitalize text-sm">
                    {w}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Eye className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground animate-pulse">
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
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">
            {isDrawer ? `Draw: "${state.word}"` : "Guess the drawing!"}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            Rd {state.round}/{state.totalRounds} · You: {myScore} · {partnerName ?? "P"}: {opScore}
          </p>
        </div>
        {state.phase === "drawing" && !state.guessed && (
          <div className={`flex items-center gap-1 text-xs font-bold ${timer <= 10 ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="h-3.5 w-3.5" /> {timer}s
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative mx-2 mt-2 rounded-xl overflow-hidden border border-border">
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
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${penColor === c ? "border-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setPenWidth(w)}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${penWidth === w ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Button size="icon" variant="ghost" onClick={handleUndo} className="h-7 w-7"><Undo2 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={handleClear} className="h-7 w-7"><Eraser className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        {/* Guesser input */}
        {isGuesser && state.phase === "drawing" && !state.guessed && (
          <div className="px-3 py-2 border-t border-border/40 space-y-2">
            {state.guesses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {state.guesses.map((g, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${g.startsWith("✅") ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground line-through"}`}>
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                placeholder="Type your guess…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
              <Button size="icon" onClick={handleGuess}><Send className="h-4 w-4" /></Button>
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

export default QuickDraw;
