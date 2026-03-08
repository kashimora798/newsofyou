import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Shuffle, Check, Hash, Trophy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const shuffle = (n: number): number[] => {
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
  // rows
  for (let r = 0; r < size; r++) {
    if (Array.from({ length: size }, (_, c) => board[r * size + c]).every((n) => marked.has(n))) lines++;
  }
  // cols
  for (let c = 0; c < size; c++) {
    if (Array.from({ length: size }, (_, r) => board[r * size + c]).every((n) => marked.has(n))) lines++;
  }
  // diag 1
  if (Array.from({ length: size }, (_, i) => board[i * size + i]).every((n) => marked.has(n))) lines++;
  // diag 2
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

  // Setup state
  const [localBoard, setLocalBoard] = useState<number[]>(() => state.boards[userId] ?? []);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [callNumber, setCallNumber] = useState("");

  useEffect(() => {
    if (state.boards[userId] && localBoard.length === 0) {
      setLocalBoard(state.boards[userId]);
    }
  }, [state.boards, userId]);

  const handleRandomFill = () => {
    setLocalBoard(shuffle(total));
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

  const handleCallNumber = useCallback(async () => {
    const num = parseInt(callNumber);
    if (isNaN(num) || num < 1 || num > total || state.calledNumbers.includes(num)) return;
    const newCalled = [...state.calledNumbers, num];

    // Check wins
    const myLines = countLines(state.boards[userId] ?? [], newCalled, size);
    const opLines = countLines(state.boards[opponentId] ?? [], newCalled, size);
    let winnerId: string | null = null;
    let phase: BingoState["phase"] = "playing";

    if (myLines >= state.linesToWin) { winnerId = userId; phase = "won"; }
    else if (opLines >= state.linesToWin) { winnerId = opponentId; phase = "won"; }

    const newState: BingoState = { ...state, calledNumbers: newCalled, phase };
    await onMakeMove(session.id, newState, opponentId, winnerId);
    setCallNumber("");
  }, [callNumber, state, userId, opponentId, size, total, session, onMakeMove]);

  const myLines = countLines(state.boards[userId] ?? [], state.calledNumbers, size);
  const opLines = countLines(state.boards[opponentId] ?? [], state.calledNumbers, size);
  const calledSet = new Set(state.calledNumbers);
  const iAmReady = state.readyPlayers.includes(userId);
  const won = state.phase === "won";
  const winnerId = session.winner_id;

  // SETUP PHASE
  if (state.phase === "setup") {
    const boardValid = localBoard.length === total && new Set(localBoard).size === total;
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">Bingo — Setup</h2>
            <p className="text-[10px] text-muted-foreground">{size}×{size} grid · Fill numbers 1–{total}</p>
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
            className="mx-auto w-fit grid gap-1"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: total }, (_, i) => {
              const val = localBoard[i];
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedCell(selectedCell === i ? null : i)}
                  className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                    selectedCell === i
                      ? "border-primary bg-primary/20 text-primary"
                      : val
                      ? "border-border bg-card text-foreground"
                      : "border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {val || ""}
                </motion.button>
              );
            })}
          </div>

          {/* Manual number input for selected cell */}
          {selectedCell !== null && (
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min={1}
                max={total}
                placeholder={`1–${total}`}
                className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm text-center"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = parseInt((e.target as HTMLInputElement).value);
                    if (v >= 1 && v <= total && !localBoard.includes(v)) {
                      const newBoard = [...localBoard];
                      while (newBoard.length <= selectedCell!) newBoard.push(0);
                      newBoard[selectedCell!] = v;
                      setLocalBoard(newBoard);
                      setSelectedCell(null);
                    }
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">Press Enter</span>
            </div>
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
              : isMyTurn ? "Your turn — call a number!" : `${partnerName ?? "Partner"}'s turn`}
          </p>
        </div>
        <div className="flex gap-3 text-xs font-bold">
          <span className="text-primary">You: {myLines}/{state.linesToWin}</span>
          <span className="text-muted-foreground">{partnerName ?? "P"}: {opLines}/{state.linesToWin}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Board */}
        <div
          className="mx-auto w-fit grid gap-1"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {myBoard.map((num, i) => {
            const marked = calledSet.has(num);
            return (
              <motion.div
                key={i}
                animate={marked ? { scale: [1, 1.15, 1] } : {}}
                className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                  marked
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                {num}
              </motion.div>
            );
          })}
        </div>

        {/* Call number input */}
        {!won && isMyTurn && (
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="number"
                min={1}
                max={total}
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCallNumber()}
                placeholder={`1–${total}`}
                className="w-24 rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <Button size="sm" onClick={handleCallNumber} disabled={!callNumber}>Call</Button>
          </div>
        )}

        {!won && !isMyTurn && (
          <p className="text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Waiting for {partnerName ?? "partner"}…
          </p>
        )}

        {/* Called numbers */}
        {state.calledNumbers.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Called Numbers</p>
            <div className="flex flex-wrap gap-1.5">
              {state.calledNumbers.map((n, i) => (
                <span key={i} className="h-7 w-7 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center text-muted-foreground">
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
