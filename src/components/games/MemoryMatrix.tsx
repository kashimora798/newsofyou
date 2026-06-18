import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const TOTAL_LEVELS = 5;
const FLASH_DURATION_MS = 2500;

interface LevelPattern {
  level: number;
  cells: number[]; // indices 0 to 15
}

// Generate patterns for all 5 levels (host generates)
function generatePatterns(): LevelPattern[] {
  return Array.from({ length: TOTAL_LEVELS }, (_, i) => {
    const level = i + 1;
    const tileCount = level + 2; // Level 1 has 3 tiles, Level 5 has 7 tiles
    const indices = Array.from({ length: 16 }, (_, k) => k);
    // Select unique random indices
    const selected = indices.sort(() => Math.random() - 0.5).slice(0, tileCount);
    return { level, cells: selected };
  });
}

const MemoryMatrix: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "flashing" | "playing" | "gameover">("connecting");
  const [level, setLevel] = useState(1);
  const [patterns, setPatterns] = useState<LevelPattern[]>([]);

  // Answering states
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [flashCells, setFlashCells] = useState<number[]>([]);
  const [isGridError, setIsGridError] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Sync state
  const [oppLevel, setOppLevel] = useState(1);
  const [oppSolved, setOppSolved] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const channelRef = useRef<any>(null);
  const stateRef = useRef({ level, phase, patterns, selectedCells, oppLevel, oppSolved, startTime });

  stateRef.current = { level, phase, patterns, selectedCells, oppLevel, oppSolved, startTime };

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const startLevel = (lvlNum: number, patternList = patterns) => {
    const pat = patternList.find(p => p.level === lvlNum);
    if (!pat) return;

    setSelectedCells([]);
    setFlashCells(pat.cells);
    setPhase("flashing");
    
    // Flash pattern for 2.5 seconds
    setTimeout(() => {
      setFlashCells([]);
      setPhase("playing");
      setStartTime(Date.now());
    }, FLASH_DURATION_MS);
  };

  const handleCellClick = (idx: number) => {
    if (phase !== "playing" || isGridError) return;

    const currentPat = patterns.find(p => p.level === level);
    if (!currentPat) return;

    const isCorrect = currentPat.cells.includes(idx);
    
    if (isCorrect) {
      if (selectedCells.includes(idx)) return; // already selected

      const nextSelected = [...selectedCells, idx];
      setSelectedCells(nextSelected);

      // Check if all correct cells are selected
      const isLevelSolved = currentPat.cells.every(c => nextSelected.includes(c));
      if (isLevelSolved) {
        handleLevelCompleted();
      }
    } else {
      // Mistake! Flash red and clear inputs
      setIsGridError(true);
      setTimeout(() => {
        setIsGridError(false);
        setSelectedCells([]);
      }, 800);
    }
  };

  const handleLevelCompleted = () => {
    const now = Date.now();
    const duration = now - (startTime ?? now);

    send("progress", {
      level,
      solved: true,
      by: userId,
      durationMs: duration
    });

    if (level < TOTAL_LEVELS) {
      setLevel(prev => prev + 1);
      startLevel(level + 1);
    } else {
      // Completed level 5!
      if (selectedModeIsAIWinnerCalculations(true, duration)) {
        // I won or game is calculated
      }
    }
  };

  const selectedModeIsAIWinnerCalculations = (meDone: boolean, durationMs: number): boolean => {
    if (isHost) {
      const oppDone = stateRef.current.oppSolved;
      
      if (meDone && oppDone) {
        // Both done, check speed
        const myTime = durationMs;
        // Since we don't have opp exact time, we can decide draw or host wins, or just compare levels.
        // For simplicity: whoever finished Level 5 first wins!
        const winnerId = stateRef.current.oppLevel === TOTAL_LEVELS ? opponentId : userId;
        handleGameFinished(winnerId);
        return true;
      } else if (meDone) {
        // Guest is still playing, wait or host wins immediately if guest took too long
        // Let's declare host winner if guest isn't at lvl 5
        if (stateRef.current.oppLevel < TOTAL_LEVELS) {
          handleGameFinished(userId);
          return true;
        }
      }
    } else {
      // Guest notifies host
      send("solved_win", { by: userId, durationMs });
    }
    return false;
  };

  const handleGameFinished = (winnerId: string | null) => {
    const finalScores = {
      [userId]: level === TOTAL_LEVELS ? 100 : level * 20,
      [opponentId]: oppLevel === TOTAL_LEVELS ? 100 : oppLevel * 20
    };
    send("over", { winnerId, scores: finalScores });
    onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, winnerId === null);
  };

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`memory_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          const pats = generatePatterns();
          setPatterns(pats);
          setPhase("instructions");
          send("start_game", { patterns: pats });
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const pats = generatePatterns();
          setPatterns(pats);
          setPhase("instructions");
          send("start_game", { patterns: pats });
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setPatterns(payload.patterns);
        setPhase("instructions");
      })
      .on("broadcast", { event: "play_click" }, () => {
        setPhase("flashing");
        startLevel(1, stateRef.current.patterns);
      })
      .on("broadcast", { event: "progress" }, ({ payload }) => {
        if (payload.by === opponentId) {
          setOppLevel(payload.level);
          if (payload.level === TOTAL_LEVELS && payload.solved) {
            setOppSolved(true);
            if (isHost) {
              const myDone = stateRef.current.level === TOTAL_LEVELS && stateRef.current.selectedCells.length >= (TOTAL_LEVELS + 2);
              const winnerId = myDone ? userId : opponentId;
              handleGameFinished(winnerId);
            }
          }
        }
      })
      .on("broadcast", { event: "solved_win" }, ({ payload }) => {
        if (isHost) {
          handleGameFinished(payload.by);
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
  }, [session.id, isHost, phase, level, patterns, opponentId, userId, send]);

  // Handle local choices
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("instructions");
    }
  }, [peerReady, phase]);

  const handleStartPlay = () => {
    setPhase("flashing");
    startLevel(1, patterns);
    send("play_click", {});
  };

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
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Memory Matrix 🟦</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase !== "connecting" && phase !== "gameover" && (
          <div className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Level {level}/5
          </div>
        )}
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
              Keep this screen open to start the memory matrix challenge!
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
                A grid of tiles will flash blue for **2.5 seconds**. Recreate the pattern from memory. Tiles count increases per level. First to finish Level 5 wins!
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-5 w-full text-center shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 mx-auto">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Visual Memory test</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Focus, remember the shapes, and act fast.</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Game
            </button>
          </div>
        )}

        {(phase === "flashing" || phase === "playing") && (
          <div className="w-full max-w-[320px] flex-1 flex flex-col justify-between py-3">
            <div className="text-center mb-3">
              <h3 className="text-sm font-bold text-foreground">
                {phase === "flashing" ? "👀 Remember the pattern!" : "👉 Tap the correct tiles!"}
              </h3>
              <p className="text-[11px] text-muted-foreground">Level {level} tiles: {level + 2}</p>
            </div>

            {/* 4x4 Grid */}
            <div className={`grid grid-cols-4 gap-2 w-[240px] mx-auto bg-muted/20 border border-border/40 rounded-2xl p-2.5 transition-colors ${
              isGridError ? "bg-destructive/10 ring-2 ring-destructive/20" : ""
            }`}>
              {Array.from({ length: 16 }).map((_, idx) => {
                const isFlashing = flashCells.includes(idx);
                const isSelected = selectedCells.includes(idx);
                
                let tileColor = "bg-card border-border/40 hover:bg-muted/10";
                if (isFlashing) {
                  tileColor = "bg-primary border-primary shadow-sm";
                } else if (isSelected) {
                  tileColor = "bg-emerald-500 border-emerald-500 text-white shadow-xs";
                } else if (isGridError && selectedCells.includes(idx)) {
                  tileColor = "bg-destructive border-destructive text-white";
                }

                return (
                  <button
                    key={idx}
                    disabled={phase !== "playing" || isGridError}
                    onClick={() => handleCellClick(idx)}
                    className={`aspect-square w-full rounded-xl border transition-all ${tileColor}`}
                  />
                );
              })}
            </div>

            {/* Live Progress tracker */}
            <div className="mt-4 bg-muted/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-muted-foreground truncate">
                {partnerName ?? "Partner"} Level:
              </span>
              <strong className="text-foreground text-sm font-black tabular-nums">
                Level {oppLevel}/5
              </strong>
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
            scoreLabel="Progress score"
          />
        )}
      </div>
    </div>
  );
};

export default MemoryMatrix;
