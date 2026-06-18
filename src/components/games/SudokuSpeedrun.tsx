import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Star, Grid } from "lucide-react";
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

type Difficulty = "easy" | "medium" | "evil" | "impossible";

interface PuzzleDef {
  solution: number[];
  grid: string[]; // empty represented by ""
}

// 3 Solved 4x4 Grids
const SOLUTIONS = [
  [1, 2, 3, 4, 3, 4, 1, 2, 2, 3, 4, 1, 4, 1, 2, 3],
  [4, 3, 2, 1, 2, 1, 4, 3, 3, 4, 1, 2, 1, 2, 3, 4],
  [2, 1, 4, 3, 4, 3, 2, 1, 1, 2, 3, 4, 3, 4, 1, 2]
];

// Generate puzzle by masking a solution
function generatePuzzle(diff: Difficulty): PuzzleDef {
  const solIndex = Math.floor(Math.random() * SOLUTIONS.length);
  const solution = SOLUTIONS[solIndex];
  const grid = solution.map(v => String(v));

  // Determine how many indices to hide based on difficulty
  let hideCount = 8; // Easy
  if (diff === "medium") hideCount = 10;
  else if (diff === "evil") hideCount = 12;
  else if (diff === "impossible") hideCount = 13;

  // Shuffle indices 0 to 15
  const indices = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
  const hiddenIndices = indices.slice(0, hideCount);

  hiddenIndices.forEach(idx => {
    grid[idx] = "";
  });

  return { solution, grid };
}

const SudokuSpeedrun: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "difficulty" | "playing" | "gameover">("connecting");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // Game states
  const [puzzle, setPuzzle] = useState<PuzzleDef | null>(null);
  const [playerGrid, setPlayerGrid] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  // Sync state
  const [oppCorrectCount, setOppCorrectCount] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});

  const channelRef = useRef<any>(null);

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    setPhase("playing");
    send("select_diff", { diff });

    if (isHost) {
      const p = generatePuzzle(diff);
      setPuzzle(p);
      setPlayerGrid([...p.grid]);
      send("set_puzzle", { puzzle: p });
    }
  };

  const handleCellClick = (idx: number) => {
    // Cannot edit pre-filled clues
    if (!puzzle || puzzle.grid[idx] !== "") return;
    setSelectedCell(idx);
  };

  const handleNumberInput = (num: number | string) => {
    if (selectedCell === null || !puzzle) return;
    
    const nextGrid = [...playerGrid];
    nextGrid[selectedCell] = num === "CLEAR" ? "" : String(num);
    setPlayerGrid(nextGrid);

    // Calculate correct cells count
    let correctCount = 0;
    for (let i = 0; i < 16; i++) {
      if (nextGrid[i] !== "" && Number(nextGrid[i]) === puzzle.solution[i]) {
        correctCount++;
      }
    }

    send("correct_count", { by: userId, count: correctCount });

    // Check if fully solved correctly
    const solved = correctCount === 16;
    if (solved) {
      if (isHost) {
        handleGameFinished(userId, { [userId]: 16, [opponentId]: oppCorrectCount });
      } else {
        send("solved_win", { by: userId });
      }
    }
  };

  const handleGameFinished = (winnerId: string | null, finalScores: Record<string, number>) => {
    send("over", { winnerId, scores: finalScores });
    onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, winnerId === null);
  };

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`sudoku_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          setPhase("difficulty");
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          setPhase("difficulty");
        }
      })
      .on("broadcast", { event: "select_diff" }, ({ payload }) => {
        setDifficulty(payload.diff);
        setPhase("playing");
      })
      .on("broadcast", { event: "set_puzzle" }, ({ payload }) => {
        setPuzzle(payload.puzzle);
        setPlayerGrid([...payload.puzzle.grid]);
      })
      .on("broadcast", { event: "correct_count" }, ({ payload }) => {
        if (payload.by === opponentId) {
          setOppCorrectCount(payload.count);
        }
      })
      .on("broadcast", { event: "solved_win" }, ({ payload }) => {
        if (isHost) {
          // Verify
          const oppCorrect = payload.by === opponentId ? 16 : oppCorrectCount;
          const myCorrect = playerGrid.filter((v, i) => v !== "" && Number(v) === puzzle?.solution[i]).length;
          
          handleGameFinished(payload.by, { [userId]: myCorrect, [opponentId]: oppCorrect });
        }
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setScores(payload.scores);
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
  }, [session.id, isHost, phase, opponentId, userId, playerGrid, puzzle, oppCorrectCount, send]);

  // Host starts setting on connection
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("difficulty");
    }
  }, [peerReady, phase]);

  const isWinner = scores[userId] > scores[opponentId];
  const isDraw = scores[userId] === scores[opponentId];

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Sudoku Speedrun 🔢</h2>
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
              Keep this screen open to start the Sudoku race!
            </p>
          </div>
        )}

        {phase === "difficulty" && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                Solve a mini 4x4 Sudoku grid (numbers 1 to 4). First to fill all cells correctly wins. Watch your partner's progress in real-time!
              </div>
            </div>

            {isHost ? (
              <div className="flex flex-col gap-2.5 w-full mt-2">
                <p className="text-sm font-bold text-foreground text-center mb-1">Choose Difficulty</p>
                {(["easy", "medium", "evil", "impossible"] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => handleSelectDifficulty(diff)}
                    className="w-full py-3.5 bg-card ring-1 ring-border/50 rounded-2xl text-sm font-bold capitalize hover:bg-muted/30 shadow-xs transition-all text-foreground"
                  >
                    {diff}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">Waiting for host...</p>
                <p className="text-xs text-muted-foreground mt-1">Host is choosing the difficulty level</p>
              </div>
            )}
          </div>
        )}

        {phase === "playing" && puzzle && (
          <div className="w-full max-w-[320px] flex-1 flex flex-col justify-between py-2">
            <div>
              <div className="text-center mb-3">
                <h3 className="text-sm font-bold text-foreground capitalize">{difficulty} Sudoku</h3>
                <p className="text-[11px] text-muted-foreground">Each row, col, and 2x2 grid must have 1-4</p>
              </div>

              {/* 4x4 Grid */}
              <div className="grid grid-cols-4 gap-1 w-[220px] mx-auto border-2 border-foreground rounded-2xl p-1 bg-card overflow-hidden">
                {playerGrid.map((val, idx) => {
                  const isClue = puzzle.grid[idx] !== "";
                  const isSelected = selectedCell === idx;
                  
                  // Highlight 2x2 boundaries
                  const isColBoundary = idx % 4 === 1;
                  const isRowBoundary = idx >= 4 && idx <= 7;

                  let borderClasses = "";
                  if (isColBoundary) borderClasses += " border-r-2 border-r-muted-foreground/35";
                  if (idx % 4 === 3) borderClasses += ""; // rightmost
                  if (idx >= 4 && idx <= 7) borderClasses += " border-b-2 border-b-muted-foreground/35";

                  return (
                    <button
                      key={idx}
                      onClick={() => handleCellClick(idx)}
                      className={`aspect-square w-full font-black text-xl flex items-center justify-center transition-colors relative ${
                        isClue 
                          ? "bg-muted/50 text-muted-foreground cursor-default" 
                          : isSelected 
                          ? "bg-primary/20 text-primary" 
                          : "bg-card text-foreground"
                      } ${borderClasses}`}
                      style={{ borderStyle: "solid" }}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="my-3 bg-muted/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-muted-foreground truncate pr-2">
                {partnerName ?? "Partner"} Correct:
              </span>
              <strong className="text-foreground text-sm font-black tabular-nums">
                {oppCorrectCount}/16
              </strong>
            </div>

            {/* Input keyboard */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="grid grid-cols-4 gap-1.5 w-full">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    disabled={selectedCell === null}
                    onClick={() => handleNumberInput(num)}
                    className="h-11 bg-muted/70 hover:bg-muted text-foreground font-black rounded-xl text-base flex items-center justify-center disabled:opacity-40 transition-colors"
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button
                disabled={selectedCell === null}
                onClick={() => handleNumberInput("CLEAR")}
                className="w-full py-2.5 bg-destructive/10 border border-destructive/20 text-destructive font-bold rounded-xl text-xs flex items-center justify-center disabled:opacity-45 transition-colors"
              >
                Clear Cell
              </button>
            </div>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={isWinner}
            isDraw={isDraw}
            partnerName={partnerName}
            myScore={scores[userId] ?? 0}
            opponentScore={scores[opponentId] ?? 0}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
            scoreLabel="Correct Tiles Found"
          />
        )}
      </div>
    </div>
  );
};

export default SudokuSpeedrun;
