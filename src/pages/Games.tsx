import React, { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { useGameSessions } from "@/hooks/useGameSessions";
import { motion } from "framer-motion";
import { Loader2, Gamepad2, Trophy, Swords, Zap } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import GameInvite from "@/components/games/GameInvite";
import GameChat from "@/components/games/GameChat";
import ActiveGameCard from "@/components/games/ActiveGameCard";
import { gamesByCategory, type GameDef } from "@/lib/gameCatalog";
import TicTacToe from "@/components/games/TicTacToe";
import WordChain from "@/components/games/WordChain";
import Hangman from "@/components/games/Hangman";
import Bingo from "@/components/games/Bingo";
import QuickDraw from "@/components/games/QuickDraw";
import TapDuel from "@/components/games/TapDuel";
import MathSprint from "@/components/games/MathSprint";
import ColorClash from "@/components/games/ColorClash";
import QuizBuzzer from "@/components/games/QuizBuzzer";
import MemoryRace from "@/components/games/MemoryRace";
import EmojiRiddle from "@/components/games/EmojiRiddle";
import EmojiReflex from "@/components/games/EmojiReflex";
import OddOneOut from "@/components/games/OddOneOut";
import ThisOrThat from "@/components/games/ThisOrThat";
import NumberNinja from "@/components/games/NumberNinja";
import HotOrCold from "@/components/games/HotOrCold";
import TrueFalseBlitz from "@/components/games/TrueFalseBlitz";
import WordBlurt from "@/components/games/WordBlurt";
import WordleDuel from "@/components/games/WordleDuel";
import OneSentenceStory from "@/components/games/OneSentenceStory";
import CaptionThis from "@/components/games/CaptionThis";
import EmojiStory from "@/components/games/EmojiStory";
import WrongAnswersOnly from "@/components/games/WrongAnswersOnly";
import SudokuSpeedrun from "@/components/games/SudokuSpeedrun";
import ThisOrThatRapid from "@/components/games/ThisOrThatRapid";
import MemoryMatrix from "@/components/games/MemoryMatrix";
import AlphabetSprint from "@/components/games/AlphabetSprint";
import GameProfileSheet from "@/components/games/GameProfileSheet";
import BoredLauncherOverlay from "@/components/secrets/BoredLauncherOverlay";
import { GameActionsContext } from "@/contexts/GameActionsContext";

import { formatDistanceToNow } from "date-fns";

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
    staleGames,
    recentGames,
    createGame,
    acceptGame,
    declineGame,
    makeMove,
    deleteGame,
  } = useGameSessions(userId);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [boredSpinning, setBoredSpinning] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle deep-links and auto-launching from Chat
  useEffect(() => {
    const playId = searchParams.get("play");
    if (playId) {
      setActiveSessionId(playId);
      searchParams.delete("play");
      setSearchParams(searchParams, { replace: true });
      return;
    }

    const challenge = searchParams.get("boredChallenge");
    if (challenge && partner?.user_id && !activeSessionId) {
      // We are the sender. Create the game in the background.
      createGame(partner.user_id, challenge);
      searchParams.delete("boredChallenge");
      setSearchParams(searchParams, { replace: true });
      return;
    }

    const expectInvite = searchParams.get("expectBoredInvite");
    if (expectInvite) {
      searchParams.delete("expectBoredInvite");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, partner?.user_id, activeSessionId, createGame, pendingInvites, acceptGame]);

  // Always get fresh session from realtime data
  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;

  const handleChallenge = async (gameType = "tic_tac_toe") => {
    if (!partner?.user_id) return;
    await createGame(partner.user_id, gameType);
  };

  const handlePlayAgain = async (opponentId: string) => {
    const gameType = activeSession?.game_type ?? "tic_tac_toe";
    setActiveSessionId(null);
    await createGame(opponentId, gameType);
  };

  const handleDifferentGame = () => {
    setActiveSessionId(null);
    const quickGames = gamesByCategory("quick");
    const pick = quickGames[Math.floor(Math.random() * quickGames.length)];
    setBoredSpinning(pick.type);
  };

  // If playing a game, show game view
  if (activeSession) {
    let GameComponent = TicTacToe;
    switch (activeSession.game_type) {
      case "word_chain": GameComponent = WordChain; break;
      case "hangman": GameComponent = Hangman; break;
      case "bingo": GameComponent = Bingo; break;
      case "quick_draw": GameComponent = QuickDraw; break;
      case "tap_duel": GameComponent = TapDuel; break;
      case "math_sprint": GameComponent = MathSprint; break;
      case "color_clash": GameComponent = ColorClash; break;
      case "quiz_buzzer": GameComponent = QuizBuzzer; break;
      case "memory_race": GameComponent = MemoryRace; break;
      case "emoji_riddle": GameComponent = EmojiRiddle; break;
      case "emoji_reflex": GameComponent = EmojiReflex; break;
      case "odd_one_out": GameComponent = OddOneOut; break;
      case "this_or_that": GameComponent = ThisOrThat; break;
      case "number_ninja": GameComponent = NumberNinja; break;
      case "hot_cold": GameComponent = HotOrCold; break;
      case "true_false_blitz": GameComponent = TrueFalseBlitz; break;
      case "word_blurt": GameComponent = WordBlurt; break;
      case "wordle_duel": GameComponent = WordleDuel; break;
      case "story_battle": GameComponent = OneSentenceStory; break;
      case "caption_this": GameComponent = CaptionThis; break;
      case "emoji_story": GameComponent = EmojiStory; break;
      case "wrong_answers_only": GameComponent = WrongAnswersOnly; break;
      case "sudoku_speedrun": GameComponent = SudokuSpeedrun; break;
      case "this_or_that_rapid": GameComponent = ThisOrThatRapid; break;
      case "memory_matrix": GameComponent = MemoryMatrix; break;
      case "alphabet_sprint": GameComponent = AlphabetSprint; break;
      default: GameComponent = TicTacToe;
    }
    return (
      <div className="flex flex-col h-dvh bg-background relative">
        <GameActionsContext.Provider value={{ onDifferentGame: handleDifferentGame }}>
          <GameComponent
            session={activeSession}
            userId={userId}
            partnerName={partner?.name ?? undefined}
            onMakeMove={makeMove}
            onBack={() => setActiveSessionId(null)}
            onPlayAgain={handlePlayAgain}
          />
        </GameActionsContext.Provider>
        <GameChat sessionId={activeSession.id} userId={userId} partnerName={partner?.name} />
        <BottomNav />
      </div>
    );
  }

  const quickGames = gamesByCategory("quick");
  const classicGames = gamesByCategory("classic");
  const noPartner = !partner?.user_id;

  return (
    <div className="flex h-dvh flex-col bg-background pb-16 relative">
      {boredSpinning && (
        <BoredLauncherOverlay 
          gameType={boredSpinning} 
          isMine={true} 
          onDismiss={() => setBoredSpinning(null)} 
        />
      )}
      
      {/* Material header */}
      <header className="glass-chat-header px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-primary/10 flex items-center justify-center">
              <Gamepad2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-foreground leading-none">Games</h1>
              <p className="text-[13px] text-muted-foreground mt-1">
                {noPartner ? "Connect with your partner to play" : `Challenge ${partner?.name} to a game`}
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setProfileOpen(true)}
            className="h-10 w-10 rounded-[14px] bg-muted/60 dark:bg-zinc-800/60 border border-border/40 flex items-center justify-center text-foreground hover:text-primary active:scale-95 transition-transform"
          >
            <Trophy className="h-5 w-5" />
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-6 scrollbar-overlay">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Incoming challenges */}
            {pendingInvites.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Incoming Challenges</SectionLabel>
                {pendingInvites.map((inv) => (
                  <GameInvite
                    key={inv.id}
                    invite={inv}
                    partnerName={partner?.name ?? undefined}
                    onAccept={() => { acceptGame(inv.id); setActiveSessionId(inv.id); }}
                    onDecline={() => declineGame(inv.id)}
                  />
                ))}
              </section>
            )}

            {/* Sent challenges */}
            {outgoingInvites.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Sent Challenges</SectionLabel>
                {outgoingInvites.map((inv) => (
                  <GameInvite key={inv.id} invite={inv} partnerName={partner?.name ?? undefined} isOutgoing />
                ))}
              </section>
            )}

            {/* Active games */}
            {activeGames.length > 0 && (
              <section className="space-y-2">
                <SectionLabel><Swords className="h-3.5 w-3.5" /> Continue Playing</SectionLabel>
                {activeGames.map((g) => (
                  <ActiveGameCard
                    key={g.id}
                    game={g}
                    partnerName={partner?.name ?? undefined}
                    isMyTurn={g.current_turn === userId}
                    onResume={() => setActiveSessionId(g.id)}
                    onDelete={() => deleteGame(g.id)}
                  />
                ))}
              </section>
            )}

            {/* Abandoned (stale) games */}
            {staleGames.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Abandoned</SectionLabel>
                {staleGames.map((g) => (
                  <ActiveGameCard
                    key={g.id}
                    game={g}
                    partnerName={partner?.name ?? undefined}
                    isMyTurn={g.current_turn === userId}
                    isStale
                    onResume={() => setActiveSessionId(g.id)}
                    onDelete={() => deleteGame(g.id)}
                  />
                ))}
              </section>
            )}

            {/* 30-Second games */}
            <section className="space-y-2.5">
              <SectionLabel><Zap className="h-3.5 w-3.5" /> 30-Second Games</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {quickGames.map((g) => (
                  <GameTile key={g.type} def={g} disabled={noPartner} onPlay={() => handleChallenge(g.type)} />
                ))}
              </div>
            </section>

            {/* Classic games */}
            <section className="space-y-2.5">
              <SectionLabel>♟️ Classic &amp; Turn-Based</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {classicGames.map((g) => (
                  <GameTile key={g.type} def={g} disabled={noPartner} onPlay={() => handleChallenge(g.type)} />
                ))}
              </div>
            </section>

            {/* Recent games */}
            {recentGames.length > 0 && (
              <section className="space-y-2">
                <SectionLabel><Trophy className="h-3.5 w-3.5" /> Recent Games</SectionLabel>
                <div className="rounded-[18px] bg-card ring-1 ring-border/50 overflow-hidden divide-y divide-border/50">
                  {recentGames.map((g) => {
                    const won = g.winner_id === userId;
                    const lost = g.winner_id && g.winner_id !== userId;
                    const declined = g.status === "declined";
                    return (
                      <div key={g.id} className="px-4 py-3 flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-[10px] flex items-center justify-center text-[12px] font-bold ${
                          won ? "bg-primary/10 text-primary" : lost ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                        }`}>
                          {won ? "W" : lost ? "L" : declined ? "—" : "D"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground truncate">
                            {declined ? "Challenge declined" : won ? "You won!" : lost ? `${partner?.name ?? "Partner"} won` : "Draw"}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            {formatDistanceToNow(new Date(g.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {noPartner && (
              <div className="text-center px-8 py-6">
                <p className="text-[13px] text-muted-foreground">
                  Games are played with your partner. Once you're connected, pick any game above to send a challenge.
                </p>
              </div>
            )}

            <div className="h-2" />
          </>
        )}
      </div>

      <BottomNav />

      <GameProfileSheet
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={userId}
        sessions={sessions}
        partnerName={partner?.name ?? undefined}
      />
    </div>
  );
};

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif";

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[13px] font-semibold text-muted-foreground px-1 flex items-center gap-1.5">
    {children}
  </h3>
);

const GameTile: React.FC<{ def: GameDef; disabled?: boolean; onPlay: () => void }> = ({ def, disabled, onPlay }) => {
  const badge = def.live
    ? null
    : def.avgSeconds >= 60
    ? `~${Math.round(def.avgSeconds / 60)}m`
    : `~${def.avgSeconds}s`;
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      onClick={onPlay}
      className="relative text-left rounded-[20px] bg-card ring-1 ring-border/50 p-4 disabled:opacity-50 transition-transform ease-spring"
    >
      <div className="h-11 w-11 rounded-[14px] bg-primary/10 text-primary flex items-center justify-center mb-3">
        <def.icon className="h-[22px] w-[22px]" />
      </div>
      <p className="text-[15px] font-semibold text-foreground leading-tight">{def.label}</p>
      <p className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-2">{def.blurb}</p>
      {def.live ? (
        <span className="absolute top-3.5 right-3.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
          <Zap className="h-3 w-3" /> Live
        </span>
      ) : (
        <span className="absolute top-3.5 right-3.5 text-[10px] font-medium text-muted-foreground">{badge}</span>
      )}
    </motion.button>
  );
};

export default Games;
