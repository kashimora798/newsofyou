import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Shuffle, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import GameOverCelebration from "./GameOverCelebration";
import type { GameSession } from "@/hooks/useGameSessions";

interface BingoState {
  gridSize: number;
  phase: "setup" | "playing" | "won";
  boards: Record<string, number[]>;
  calledNumbers: number[];
  readyPlayers: string[];
  linesToWin: number;
}

interface BingoProps {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, boardState: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => Promise<void>;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => Promise<void>;
}

const defaultState = (size = 5): BingoState => ({
  gridSize: size,
  phase: "setup",
  boards: {},
  calledNumbers: [],
  readyPlayers: [],
  linesToWin: size,
});

const shuffleNumbers = (n: number): number[] => {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const countLines = (board: number[], called: number[], size: number): number => {
  const marked = new Set(board.filter((n) => called.includes(n)));
  let lines = 0;
  for (let r = 0; r < size; r++) {
    if (Array.from({ length: size }, (_, c) => board[r * size + c]).every((n) => marked.has(n))) lines++;
  }
  for (let c = 0; c < size; c++) {
    if (Array.from({ length: size }, (_, r) => board[r * size + c]).every((n) => marked.has(n))) lines++;
  }
  if (Array.from({ length: size }, (_, i) => board[i * size + i]).every((n) => marked.has(n))) lines++;
  if (Array.from({ length: size }, (_, i) => board[i * size + (size - 1 - i)]).every((n) => marked.has(n))) lines++;
  return lines;
};

const Bingo: React.FC<BingoProps> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;
  const raw = session.board_state as any;
  const state: BingoState = useMemo(() => ({
    ...defaultState(),
    ...raw,
    calledNumbers: Array.isArray(raw?.calledNumbers) ? raw.calledNumbers : [],
    readyPlayers: Array.isArray(raw?.readyPlayers) ? raw.readyPlayers : [],
    boards: raw?.boards ?? {},
  }), [raw]);

  const size = state.gridSize || 5;
  const total = size * size;
  const isMyTurn = session.current_turn === userId;

  const [localBoard, setLocalBoard] = useState<number[]>(() => state.boards[userId] ?? []);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  useEffect(() => {
    if (state.boards[userId] && localBoard.length === 0) {
      setLocalBoard(state.boards[userId]);
    }
  }, [state.boards, userId]);

  const handleRandomFill = () => setLocalBoard(shuffleNumbers(total));

  const handlePlaceNumber = (num: number) => {
    if (selectedCell === null) return;
    if (localBoard.includes(num)) return; // already placed
    const newBoard = [...localBoard];
    while (newBoard.length <= selectedCell) newBoard.push(0);
    newBoard[selectedCell] = num;
    setLocalBoard(newBoard);
    // Auto-advance to next empty cell
    const nextEmpty = newBoard.findIndex((v, i) => i > selectedCell && (!v || v === 0));
    setSelectedCell(nextEmpty >= 0 ? nextEmpty : null);
  };

  const handleReady = useCallback(async () => {
    if (localBoard.length !== total || new Set(localBoard).size !== total) return;
    const newBoards = { ...state.boards, [userId]: localBoard };
    const newReady = [...state.readyPlayers.filter((id) => id !== userId), userId];
    const bothReady = newReady.length >= 2 && newBoards[opponentId]?.length === total;
    const newState: BingoState = {
      ...state,
      boards: newBoards,
      readyPlayers: newReady,
      phase: bothReady ? "playing" : "setup",
    };
    await onMakeMove(session.id, newState, bothReady ? session.created_by : session.current_turn);
  }, [localBoard, state, userId, opponentId, total, session, onMakeMove]);

  // During play: tap a number on your board to "call" it
  const handleCallNumber = useCallback(async (num: number) => {
    if (!isMyTurn || state.calledNumbers.includes(num)) return;
    const newCalled = [...state.calledNumbers, num];

    const myLines = countLines(state.boards[userId] ?? [], newCalled, size);
    const opLines = countLines(state.boards[opponentId] ?? [], newCalled, size);
    let winnerId: string | null = null;
    let phase: BingoState["phase"] = "playing";

    if (myLines >= state.linesToWin) { winnerId = userId; phase = "won"; }
    else if (opLines >= state.linesToWin) { winnerId = opponentId; phase = "won"; }

    const newState: BingoState = { ...state, calledNumbers: newCalled, phase };
    await onMakeMove(session.id, newState, opponentId, winnerId);
  }, [state, userId, opponentId, size, isMyTurn, session, onMakeMove]);

  const myLines = countLines(state.boards[userId] ?? [], state.calledNumbers, size);
  const opLines = countLines(state.boards[opponentId] ?? [], state.calledNumbers, size);
  const calledSet = new Set(state.calledNumbers);
  const iAmReady = state.readyPlayers.includes(userId);
  const won = state.phase === "won";
  const winnerId = session.winner_id;
  const usedNumbers = new Set(localBoard.filter(Boolean));

  // Compute cell size based on grid
  const cellClass = size <= 4 ? "h-14 w-14 text-lg" : size <= 5 ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  const playCellClass = size <= 4 ? "h-16 w-16 text-xl" : size <= 5 ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";

  // SETUP PHASE
  if (state.phase === "setup") {
    const boardValid = localBoard.length === total && new Set(localBoard).size === total && !localBoard.includes(0);
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">Bingo — Setup</h2>
            <p className="text-[10px] text-muted-foreground">{size}×{size} grid · Tap a cell, then pick a number</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={handleRandomFill} className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Random Fill
            </Button>
          </div>

          {/* Grid */}
          <div
            className="mx-auto w-fit grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: total }, (_, i) => {
              const val = localBoard[i];
              const isSelected = selectedCell === i;
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedCell(isSelected ? null : i)}
                  className={`${cellClass} rounded-xl font-bold border-2 transition-all flex items-center justify-center ${
                    isSelected
                      ? "border-primary bg-primary/20 text-primary shadow-md"
                      : val
                      ? "border-border bg-card text-foreground"
                      : "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  {val || ""}
                </motion.button>
              );
            })}
          </div>

          {/* Number picker grid */}
          {selectedCell !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <p className="text-xs text-center text-muted-foreground font-medium">Pick a number for cell {selectedCell + 1}</p>
              <div className="grid grid-cols-5 gap-1.5 max-w-xs mx-auto">
                {Array.from({ length: total }, (_, i) => i + 1).map((num) => {
                  const used = usedNumbers.has(num);
                  return (
                    <button
                      key={num}
                      disabled={used}
                      onClick={() => handlePlaceNumber(num)}
                      className={`h-10 rounded-lg text-sm font-bold transition-all ${
                        used
                          ? "bg-muted/40 text-muted-foreground/30 cursor-not-allowed"
                          : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-90"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={handleReady}
              disabled={!boardValid || iAmReady}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" /> {iAmReady ? "Waiting for partner…" : "I'm Ready!"}
            </Button>
            {iAmReady && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Waiting for {partnerName ?? "partner"} to prepare their board…
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PLAYING / WON PHASE
  const myBoard = state.boards[userId] ?? [];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">Bingo {size}×{size}</h2>
          <p className="text-[10px] text-muted-foreground">
            {won
              ? winnerId === userId ? "🎉 You won!" : `${partnerName ?? "Partner"} won`
              : isMyTurn ? "Your turn — tap a number to call it!" : `${partnerName ?? "Partner"}'s turn`}
          </p>
        </div>
        <div className="flex gap-3 text-xs font-bold">
          <span className="text-primary">You: {myLines}/{state.linesToWin}</span>
          <span className="text-muted-foreground">{partnerName ?? "P"}: {opLines}/{state.linesToWin}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Board — tap to call numbers */}
        <div
          className="mx-auto w-fit grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {myBoard.map((num, i) => {
            const marked = calledSet.has(num);
            const canCall = isMyTurn && !won && !marked;
            return (
              <motion.button
                key={i}
                disabled={!canCall && !marked}
                onClick={() => canCall && handleCallNumber(num)}
                animate={marked ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={`${playCellClass} rounded-xl font-bold flex items-center justify-center transition-all relative ${
                  marked
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : canCall
                    ? "bg-card border-2 border-primary/40 text-foreground active:scale-90 cursor-pointer"
                    : "bg-card border-2 border-border text-foreground"
                }`}
              >
                <span className={marked ? "line-through decoration-2" : ""}>{num}</span>
                {marked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-2xl opacity-30">✕</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {!won && !isMyTurn && (
          <p className="text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Waiting for {partnerName ?? "partner"} to call a number…
          </p>
        )}

        {isMyTurn && !won && (
          <p className="text-center text-xs text-primary font-medium">
            Tap any uncrossed number on your board to call it!
          </p>
        )}

        {/* Called numbers history */}
        {state.calledNumbers.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Called Numbers</p>
            <div className="flex flex-wrap gap-1.5">
              {state.calledNumbers.map((n, i) => (
                <span key={i} className="h-8 w-8 rounded-full bg-primary/15 text-xs font-bold flex items-center justify-center text-primary">
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Win state */}
        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-3 py-4"
            >
              <Trophy className="h-10 w-10 mx-auto text-primary" />
              <p className="text-lg font-bold text-foreground">
                {winnerId === userId ? "BINGO! You won! 🎉" : `${partnerName ?? "Partner"} got BINGO!`}
              </p>
              <Button onClick={() => onPlayAgain(opponentId)}>Play Again</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Bingo;
