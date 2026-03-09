import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { useGameSessions } from "@/hooks/useGameSessions";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Gamepad2, Grid3X3, BookOpen, HelpCircle, Trophy, Swords, LayoutGrid, PenTool } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import GameInvite from "@/components/games/GameInvite";
import GameLobbyCard from "@/components/games/GameLobbyCard";
import ActiveGameCard from "@/components/games/ActiveGameCard";
import TicTacToe from "@/components/games/TicTacToe";
import WordChain from "@/components/games/WordChain";
import Hangman from "@/components/games/Hangman";
import Bingo from "@/components/games/Bingo";
import QuickDraw from "@/components/games/QuickDraw";
import type { GameSession } from "@/hooks/useGameSessions";
import { formatDistanceToNow } from "date-fns";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

const Games: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return <GamesView userId={user.id} />;
};

const GamesView: React.FC<{ userId: string }> = ({ userId }) => {
  const partner = usePartner(userId);
  const {
    sessions,
    loading,
    pendingInvites,
    outgoingInvites,
    activeGames,
    recentGames,
    createGame,
    acceptGame,
    declineGame,
    makeMove,
  } = useGameSessions(userId);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Always get fresh session from realtime data
  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;

  const handleChallenge = async (gameType = "tic_tac_toe") => {
    if (!partner?.user_id) return;
    await createGame(partner.user_id, gameType);
  };

  const handlePlayAgain = async (opponentId: string) => {
    setActiveSessionId(null);
    await createGame(opponentId, "tic_tac_toe");
  };

  // If playing a game, show game view
  if (activeSession) {
    const GameComponent = activeSession.game_type === "word_chain" ? WordChain : activeSession.game_type === "hangman" ? Hangman : activeSession.game_type === "bingo" ? Bingo : activeSession.game_type === "quick_draw" ? QuickDraw : TicTacToe;
    return (
      <div className="flex flex-col h-dvh bg-background">
        <GameComponent
          session={activeSession}
          userId={userId}
          partnerName={partner?.name ?? undefined}
          onMakeMove={makeMove}
          onBack={() => setActiveSessionId(null)}
          onPlayAgain={handlePlayAgain}
        />
        <BottomNav />
      </div>
    );
  }

  const availableGames = [
    {
      icon: Grid3X3,
      label: "Tic Tac Toe",
      description: "Classic 3×3 grid — first to three in a row wins!",
      color: "bg-primary/10 text-primary",
      onChallenge: () => handleChallenge("tic_tac_toe"),
    },
    {
      icon: BookOpen,
      label: "Word Chain",
      description: "Take turns saying words starting with the last letter",
      color: "bg-emerald-500/10 text-emerald-500",
      onChallenge: () => handleChallenge("word_chain"),
    },
    {
      icon: HelpCircle,
      label: "Hangman",
      description: "Pick a word and challenge your friend to guess it!",
      color: "bg-pink-500/10 text-pink-500",
      onChallenge: () => handleChallenge("hangman"),
    },
    {
      icon: LayoutGrid,
      label: "Bingo",
      description: "Fill your grid, call numbers, first to N lines wins!",
      color: "bg-amber-500/10 text-amber-500",
      onChallenge: () => handleChallenge("bingo"),
    },
    {
      icon: PenTool,
      label: "Quick Draw",
      description: "Draw a word and let your partner guess it!",
      color: "bg-cyan-500/10 text-cyan-500",
      onChallenge: () => handleChallenge("quick_draw"),
    },
  ];

  return (
    <div
      className="flex flex-col h-dvh"
      style={{ background: "linear-gradient(160deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.04) 50%, hsl(var(--accent) / 0.06) 100%)" }}
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-6 pb-4 shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground font-heading">Game Lobby</h1>
            <p className="text-xs text-muted-foreground">Challenge {partner?.name ?? "your partner"} to a game!</p>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-thin"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <motion.div variants={item} className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                  Incoming Challenges
                </h3>
                {pendingInvites.map((inv) => (
                  <GameInvite
                    key={inv.id}
                    invite={inv}
                    partnerName={partner?.name ?? undefined}
                    onAccept={() => {
                      acceptGame(inv.id);
                      setActiveSessionId(inv.id);
                    }}
                    onDecline={() => declineGame(inv.id)}
                  />
                ))}
              </motion.div>
            )}

            {/* Outgoing Invites */}
            {outgoingInvites.length > 0 && (
              <motion.div variants={item} className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                  Sent Challenges
                </h3>
                {outgoingInvites.map((inv) => (
                  <GameInvite key={inv.id} invite={inv} partnerName={partner?.name ?? undefined} isOutgoing />
                ))}
              </motion.div>
            )}

            {/* Active Games */}
            {activeGames.length > 0 && (
              <motion.div variants={item} className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Swords className="h-3 w-3" /> Active Games
                </h3>
                {activeGames.map((g) => (
                  <ActiveGameCard
                    key={g.id}
                    game={g}
                    partnerName={partner?.name ?? undefined}
                    isMyTurn={g.current_turn === userId}
                    onResume={() => setActiveSessionId(g.id)}
                  />
                ))}
              </motion.div>
            )}

            {/* Available Games */}
            <motion.div variants={item} className="space-y-2">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                Available Games
              </h3>
              <div className="space-y-2">
                {availableGames.map((g) => (
                  <GameLobbyCard
                    key={g.label}
                    icon={g.icon}
                    label={g.label}
                    description={g.description}
                    color={g.color}
                    onChallenge={g.onChallenge}
                    disabled={!partner?.user_id}
                  />
                ))}
              </div>
            </motion.div>

            {/* Recent Games */}
            {recentGames.length > 0 && (
              <motion.div variants={item} className="space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Trophy className="h-3 w-3" /> Recent Games
                </h3>
                <div className="space-y-2">
                  {recentGames.map((g) => {
                    const won = g.winner_id === userId;
                    const lost = g.winner_id && g.winner_id !== userId;
                    const draw = g.status === "completed" && !g.winner_id;
                    const declined = g.status === "declined";
                    return (
                      <div key={g.id} className="glass rounded-xl p-3 flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          won ? "bg-primary/10 text-primary" : lost ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                        }`}>
                          {won ? "W" : lost ? "L" : declined ? "—" : "D"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {declined ? "Declined" : won ? "You won!" : lost ? `${partner?.name ?? "Partner"} won` : "Draw"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(g.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            <div className="h-2" />
          </>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
};

export default Games;
