import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Trophy, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession } from "@/hooks/useGameSessions";

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: string[]): { winner: string; line: number[] } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

function isDraw(board: string[]): boolean {
  return board.every((c) => c !== "") && !checkWinner(board);
}

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, board: string[], nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

const XMark: React.FC<{ winLine?: boolean }> = ({ winLine }) => (
  <motion.svg
    initial={{ scale: 0, rotate: -90 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    viewBox="0 0 50 50"
    className={`w-10 h-10 ${winLine ? "text-primary" : "text-primary/80"}`}
  >
    <motion.line
      x1="10" y1="10" x2="40" y2="40"
      stroke="currentColor" strokeWidth="5" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.3 }}
    />
    <motion.line
      x1="40" y1="10" x2="10" y2="40"
      stroke="currentColor" strokeWidth="5" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    />
  </motion.svg>
);

const OMark: React.FC<{ winLine?: boolean }> = ({ winLine }) => (
  <motion.svg
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    viewBox="0 0 50 50"
    className={`w-10 h-10 ${winLine ? "text-accent-foreground" : "text-muted-foreground"}`}
  >
    <motion.circle
      cx="25" cy="25" r="15"
      fill="none" stroke="currentColor" strokeWidth="5"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.4 }}
    />
  </motion.svg>
);

const TicTacToe: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const [game, setGame] = useState<GameSession>(session);
  const board = game.board_state;
  const myMark = game.created_by === userId ? "X" : "O";
  const isMyTurn = game.current_turn === userId;
  const result = checkWinner(board);
  const draw = isDraw(board);
  const gameOver = game.status === "completed" || !!result || draw;
  const winLine = result?.line ?? [];

  // Realtime subscription for this specific game
  useEffect(() => {
    const channel = supabase
      .channel(`game_${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const d = payload.new as any;
          setGame({
            ...d,
            board_state: Array.isArray(d.board_state) ? d.board_state : JSON.parse(d.board_state),
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  const handleCellClick = useCallback((index: number) => {
    if (!isMyTurn || board[index] || gameOver) return;
    const newBoard = [...board];
    newBoard[index] = myMark;

    const opponentId = game.created_by === userId ? game.opponent_id : game.created_by;
    const win = checkWinner(newBoard);
    const d = isDraw(newBoard);

    onMakeMove(
      game.id,
      newBoard,
      opponentId,
      win ? userId : null,
      d
    );

    setGame((prev) => ({ ...prev, board_state: newBoard, current_turn: opponentId }));
  }, [isMyTurn, board, gameOver, myMark, game, userId, onMakeMove]);

  const didWin = result && ((result.winner === "X" && game.created_by === userId) || (result.winner === "O" && game.opponent_id === userId));
  const opponentId = game.created_by === userId ? game.opponent_id : game.created_by;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 shrink-0">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack} className="p-2 rounded-full glass-subtle">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">Tic Tac Toe</h2>
          <p className="text-[10px] text-muted-foreground">
            You are <span className="font-bold text-primary">{myMark}</span> · vs {partnerName ?? "Partner"}
          </p>
        </div>
      </div>

      {/* Turn / Status */}
      <div className="px-4 pb-4">
        <motion.div
          key={gameOver ? "over" : game.current_turn}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass rounded-xl p-3 text-center text-sm font-semibold ${
            gameOver
              ? didWin
                ? "bg-primary/10 text-primary"
                : draw
                ? "bg-muted text-muted-foreground"
                : "bg-destructive/10 text-destructive"
              : isMyTurn
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {gameOver
            ? didWin
              ? "🎉 You won!"
              : draw
              ? "🤝 It's a draw!"
              : `${partnerName ?? "Partner"} won!`
            : isMyTurn
            ? "Your turn!"
            : `Waiting for ${partnerName ?? "partner"}…`}
        </motion.div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] aspect-square">
          {board.map((cell, i) => {
            const isWinCell = winLine.includes(i);
            return (
              <motion.button
                key={i}
                whileTap={!cell && isMyTurn && !gameOver ? { scale: 0.9 } : {}}
                onClick={() => handleCellClick(i)}
                className={`glass rounded-xl flex items-center justify-center aspect-square transition-colors ${
                  isWinCell
                    ? "ring-2 ring-primary bg-primary/10"
                    : !cell && isMyTurn && !gameOver
                    ? "hover:bg-muted/50 cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <AnimatePresence>
                  {cell === "X" && <XMark winLine={isWinCell} />}
                  {cell === "O" && <OMark winLine={isWinCell} />}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Game Over Actions */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-6 flex gap-3"
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

export default TicTacToe;
