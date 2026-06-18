import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Trophy,
  Grid,
  Hash,
  Timer,
  PenTool,
  XCircle,
  Image,
  Sparkles,
  Flame,
  Heart,
  Hourglass,
  Brain,
  Moon,
  BookOpen,
  Users,
  Target,
  Thermometer,
  HelpCircle,
  CheckSquare,
  X,
  Lock,
  HeartHandshake,
  Binary
} from "lucide-react";
import type { GameSession } from "@/hooks/useGameSessions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  sessions: GameSession[];
  partnerName?: string;
}

interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: React.ComponentType<any>;
  color: string; // Tailwind tint class e.g., 'text-amber-500'
  bgColor: string; // Tailwind bg class e.g., 'bg-amber-500/10'
  check: (userSessions: GameSession[], uid: string) => { unlocked: boolean; progress: string };
}

// ----------------------------------------------------
// 20 BADGES CONFIGURATION & DYNAMIC LOGIC CHECK
// ----------------------------------------------------
const BADGES: BadgeDef[] = [
  {
    id: "first_blood",
    name: "First Blood",
    desc: "Play and finish 1 game in the lobby.",
    icon: Zap,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    check: (sessions) => {
      const count = sessions.length;
      return { unlocked: count >= 1, progress: `${count}/1` };
    }
  },
  {
    id: "victory_lane",
    name: "Victory Lane",
    desc: "Win any game in the lobby.",
    icon: Trophy,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    check: (sessions, uid) => {
      const wins = sessions.filter(s => s.winner_id === uid).length;
      return { unlocked: wins >= 1, progress: `${wins}/1` };
    }
  },
  {
    id: "diagonal_dominator",
    name: "Diagonal Dominator",
    desc: "Win a game of Tic-Tac-Toe with a diagonal line.",
    icon: Grid,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    check: (sessions, uid) => {
      const diagonalLines = [
        [0, 4, 8],
        [2, 4, 6]
      ];
      const tttGames = sessions.filter(s => s.game_type === "tic_tac_toe" && s.winner_id === uid);
      let unlocked = false;

      for (const game of tttGames) {
        const board = Array.isArray(game.board_state)
          ? game.board_state
          : typeof game.board_state === "string"
          ? JSON.parse(game.board_state)
          : [];

        const myMark = game.created_by === uid ? "X" : "O";
        const hasDiag = diagonalLines.some(line => line.every(idx => board[idx] === myMark));
        if (hasDiag) {
          unlocked = true;
          break;
        }
      }

      return { unlocked, progress: unlocked ? "1/1" : "0/1" };
    }
  },
  {
    id: "sudoku_speedrunner",
    name: "Sudoku Speedrunner",
    desc: "Win a Sudoku Speedrun with a perfect grid (16 cells correct).",
    icon: Hash,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    check: (sessions, uid) => {
      const perfectWins = sessions.filter(s => 
        s.game_type === "sudoku_speedrun" && 
        s.winner_id === uid && 
        s.board_state?.scores?.[uid] === 16
      ).length;
      return { unlocked: perfectWins >= 1, progress: `${perfectWins}/1` };
    }
  },
  {
    id: "fastest_gun",
    name: "Fastest Gun",
    desc: "Win a Tap Duel game with at least 4 rounds won (Score: 4+).",
    icon: Timer,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    check: (sessions, uid) => {
      const match = sessions.some(s => 
        s.game_type === "tap_duel" && 
        s.winner_id === uid && 
        s.board_state?.scores?.[uid] >= 4
      );
      return { unlocked: match, progress: match ? "1/1" : "0/1" };
    }
  },
  {
    id: "chain_reactor",
    name: "Chain Reactor",
    desc: "Play a Word Chain game that reaches at least 10 words.",
    icon: PenTool,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    check: (sessions) => {
      const maxChain = sessions
        .filter(s => s.game_type === "word_chain")
        .reduce((max, s) => {
          const words = s.board_state?.words || [];
          return words.length > max ? words.length : max;
        }, 0);

      return { unlocked: maxChain >= 10, progress: `${maxChain}/10` };
    }
  },
  {
    id: "perfect_guess",
    name: "Perfect Guess",
    desc: "Win Hangman without making a single wrong guess.",
    icon: XCircle,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    check: (sessions, uid) => {
      const hangmanWins = sessions.filter(s => s.game_type === "hangman" && s.winner_id === uid);
      let perfectWin = false;

      for (const game of hangmanWins) {
        const board = game.board_state;
        if (board && board.word && Array.isArray(board.guessed)) {
          const isGuesser = board.setter !== uid;
          if (isGuesser) {
            // Count wrong guesses
            const wrongCount = board.guessed.filter((gChar: string) => 
              !board.word.toLowerCase().includes(gChar.toLowerCase())
            ).length;
            if (wrongCount === 0) {
              perfectWin = true;
              break;
            }
          }
        }
      }

      return { unlocked: perfectWin, progress: perfectWin ? "1/1" : "0/1" };
    }
  },
  {
    id: "wordle_wizard",
    name: "Wordle Wizard",
    desc: "Solve a Wordle Duel in 3 or fewer attempts.",
    icon: HelpCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    check: (sessions, uid) => {
      const solvedInThree = sessions.some(s => 
        s.game_type === "wordle_duel" && 
        s.board_state?.scores?.[uid] > 0 && 
        s.board_state?.scores?.[uid] <= 3
      );
      return { unlocked: solvedInThree, progress: solvedInThree ? "1/1" : "0/1" };
    }
  },
  {
    id: "bullseye_ninja",
    name: "Bullseye Ninja",
    desc: "Pick the exact Magic Number in any round of Number Ninja.",
    icon: Target,
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    check: (sessions) => {
      const hitBullseye = sessions.some(s => {
        if (s.game_type !== "number_ninja") return false;
        const history = s.board_state?.history || [];
        return history.some((round: any) => round.mine !== null && round.mine === round.data);
      });
      return { unlocked: hitBullseye, progress: hitBullseye ? "1/1" : "0/1" };
    }
  },
  {
    id: "telepathy_duo",
    name: "Telepathy Duo",
    desc: "Solve a Co-op Emoji Story in the very first attempt.",
    icon: Users,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    check: (sessions) => {
      const firstTryWin = sessions.some(s => 
        s.game_type === "emoji_story" && 
        s.board_state?.solved === true && 
        s.board_state?.guesses?.length === 1
      );
      return { unlocked: firstTryWin, progress: firstTryWin ? "1/1" : "0/1" };
    }
  },
  {
    id: "compatibility_core",
    name: "Compatibility Core",
    desc: "Reach a compatibility score of 80% or higher (12+ matches) in Rapid Fire.",
    icon: Heart,
    color: "text-rose-600",
    bgColor: "bg-rose-600/10",
    check: (sessions) => {
      const maxMatches = sessions
        .filter(s => s.game_type === "this_or_that_rapid")
        .reduce((max, s) => {
          const matches = s.board_state?.scores?.matches || 0;
          return matches > max ? matches : max;
        }, 0);

      return { unlocked: maxMatches >= 12, progress: `${maxMatches}/12` };
    }
  },
  {
    id: "persistent_player",
    name: "Persistent Player",
    desc: "Complete 10 games total in the lobby.",
    icon: Hourglass,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    check: (sessions) => {
      const count = sessions.length;
      return { unlocked: count >= 10, progress: `${count}/10` };
    }
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    desc: "Reach a 3-game win streak across any completed games.",
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    check: (sessions, uid) => {
      // Sort chronologically
      const sorted = [...sessions].sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      let maxStreak = 0;
      let currentStreak = 0;

      for (const s of sorted) {
        if (s.winner_id === uid) {
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }

      return { unlocked: maxStreak >= 3, progress: `${maxStreak}/3` };
    }
  },
  {
    id: "memory_wizard",
    name: "Memory Wizard",
    desc: "Win Memory Matrix by solving all 5 levels perfectly (Score: 100).",
    icon: Brain,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
    check: (sessions, uid) => {
      const maxLvl = sessions.some(s => 
        s.game_type === "memory_matrix" && 
        s.winner_id === uid && 
        s.board_state?.scores?.[uid] === 100
      );
      return { unlocked: maxLvl, progress: maxLvl ? "1/1" : "0/1" };
    }
  },
  {
    id: "midnight_gamer",
    name: "Midnight Gamer",
    desc: "Complete a game between 12 AM and 4 AM local time.",
    icon: Moon,
    color: "text-amber-300",
    bgColor: "bg-amber-300/10",
    check: (sessions) => {
      const hasMidnight = sessions.some(s => {
        const hour = new Date(s.updated_at).getHours();
        return hour >= 0 && hour < 4;
      });
      return { unlocked: hasMidnight, progress: hasMidnight ? "1/1" : "0/1" };
    }
  },
  {
    id: "story_teller",
    name: "Story Teller",
    desc: "Complete a Story Battle game that is at least 9 sentences long.",
    icon: BookOpen,
    color: "text-amber-700",
    bgColor: "bg-amber-700/10",
    check: (sessions) => {
      const maxLen = sessions
        .filter(s => s.game_type === "story_battle")
        .reduce((max, s) => {
          const sentences = s.board_state?.story || [];
          return sentences.length > max ? sentences.length : max;
        }, 0);

      return { unlocked: maxLen >= 9, progress: `${maxLen}/9` };
    }
  },
  {
    id: "coop_champ",
    name: "Co-op Champ",
    desc: "Complete 3 cooperative games of Emoji Story.",
    icon: HeartHandshake,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    check: (sessions) => {
      const count = sessions.filter(s => s.game_type === "emoji_story").length;
      return { unlocked: count >= 3, progress: `${count}/3` };
    }
  },
  {
    id: "number_master",
    name: "Number Master",
    desc: "Win 3 games of Number Ninja.",
    icon: Binary,
    color: "text-lime-500",
    bgColor: "bg-lime-500/10",
    check: (sessions, uid) => {
      const wins = sessions.filter(s => s.game_type === "number_ninja" && s.winner_id === uid).length;
      return { unlocked: wins >= 3, progress: `${wins}/3` };
    }
  },
  {
    id: "hot_cold_master",
    name: "Hot & Cold Master",
    desc: "Win 3 games of Hot or Cold.",
    icon: Thermometer,
    color: "text-orange-600",
    bgColor: "bg-orange-600/10",
    check: (sessions, uid) => {
      const wins = sessions.filter(s => s.game_type === "hot_cold" && s.winner_id === uid).length;
      return { unlocked: wins >= 3, progress: `${wins}/3` };
    }
  },
  {
    id: "true_false_legend",
    name: "True/False Legend",
    desc: "Win 3 games of True or False Blitz.",
    icon: CheckSquare,
    color: "text-cyan-600",
    bgColor: "bg-cyan-600/10",
    check: (sessions, uid) => {
      const wins = sessions.filter(s => s.game_type === "true_false_blitz" && s.winner_id === uid).length;
      return { unlocked: wins >= 3, progress: `${wins}/3` };
    }
  }
];

// Helper to format type names beautifully
const GAME_LABELS: Record<string, string> = {
  tic_tac_toe: "Tic Tac Toe",
  word_chain: "Word Chain",
  hangman: "Hangman",
  bingo: "Bingo",
  quick_draw: "Quick Draw",
  tap_duel: "Tap Duel",
  math_sprint: "Math Sprint",
  color_clash: "Color Clash",
  quiz_buzzer: "Quiz Buzzer",
  memory_race: "Memory Race",
  emoji_riddle: "Emoji Riddle",
  emoji_reflex: "Emoji Reflex",
  odd_one_out: "Odd One Out",
  this_or_that: "This or That",
  number_ninja: "Number Ninja",
  hot_cold: "Hot or Cold",
  true_false_blitz: "True or False Blitz",
  word_blurt: "Word Blurt",
  wordle_duel: "Wordle Duel",
  story_battle: "Story Battle",
  caption_this: "Caption This",
  emoji_story: "Emoji Story",
  wrong_answers_only: "Wrong Answers Only",
  sudoku_speedrun: "Sudoku Speedrun",
  this_or_that_rapid: "Rapid Fire Compatibility",
  memory_matrix: "Memory Matrix",
  alphabet_sprint: "Alphabet Sprint"
};

const GameProfileSheet: React.FC<Props> = ({ isOpen, onClose, userId, sessions, partnerName }) => {
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "scorecards">("overview");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  // Filter out completed sessions involving the user
  const completedSessions = useMemo(() => {
    return sessions.filter(s => s.status === "completed" && (s.created_by === userId || s.opponent_id === userId));
  }, [sessions, userId]);

  // Wins, losses, draws
  const stats = useMemo(() => {
    const total = completedSessions.length;
    const wins = completedSessions.filter(s => s.winner_id === userId).length;
    const losses = completedSessions.filter(s => s.winner_id !== null && s.winner_id !== userId).length;
    const draws = completedSessions.filter(s => s.winner_id === null).length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Current Win Streak calculation
    let currentStreak = 0;
    const sorted = [...completedSessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    for (const s of sorted) {
      if (s.winner_id === userId) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { total, wins, losses, draws, winRate, currentStreak };
  }, [completedSessions, userId]);

  // Evaluate badges list dynamically
  const badgeStats = useMemo(() => {
    let unlockedCount = 0;
    const evaluated = BADGES.map(b => {
      const { unlocked, progress } = b.check(completedSessions, userId);
      if (unlocked) unlockedCount++;
      return { ...b, unlocked, progress };
    });

    return { evaluated, unlockedCount };
  }, [completedSessions, userId]);

  // Points Calculation
  const totalPoints = useMemo(() => {
    // completed = 10 pts, wins = 50 pts, draws = 20 pts, badge = 100 pts
    return (stats.total * 10) + (stats.wins * 50) + (stats.draws * 20) + (badgeStats.unlockedCount * 100);
  }, [stats, badgeStats]);

  // Grouped Scorecards calculation
  const scorecards = useMemo(() => {
    const record: Record<string, { wins: number; draws: number; losses: number }> = {};
    
    // Initialize all games in registry
    Object.keys(GAME_LABELS).forEach(type => {
      record[type] = { wins: 0, draws: 0, losses: 0 };
    });

    completedSessions.forEach(s => {
      if (!record[s.game_type]) {
        record[s.game_type] = { wins: 0, draws: 0, losses: 0 };
      }
      if (s.winner_id === userId) {
        record[s.game_type].wins++;
      } else if (s.winner_id === null) {
        record[s.game_type].draws++;
      } else {
        record[s.game_type].losses++;
      }
    });

    return Object.entries(record)
      .map(([type, counts]) => ({
        type,
        name: GAME_LABELS[type] || type,
        totalPlayed: counts.wins + counts.draws + counts.losses,
        ...counts
      }))
      .filter(item => item.totalPlayed > 0)
      .sort((a, b) => b.totalPlayed - a.totalPlayed);
  }, [completedSessions, userId]);

  const selectedBadge = useMemo(() => {
    if (!selectedBadgeId) return null;
    return badgeStats.evaluated.find(b => b.id === selectedBadgeId) || null;
  }, [selectedBadgeId, badgeStats]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Frosted glass overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-border/60 rounded-t-[28px] flex flex-col shadow-2xl overflow-hidden"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif"
            }}
          >
            {/* Grabber bar for bottom-sheet */}
            <div className="w-full flex justify-center py-3.5 shrink-0 cursor-pointer" onClick={onClose}>
              <div className="w-9 h-1 rounded-full bg-zinc-300/80 dark:bg-zinc-700/60" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Game Profile</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">Stats &amp; Unlocks with {partnerName || "Partner"}</p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-muted dark:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* iOS Segmented Control Tab Switcher */}
            <div className="px-5 pb-4 shrink-0">
              <div className="relative flex p-0.5 bg-muted/60 dark:bg-zinc-800/40 rounded-[10px] select-none">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "badges", label: "Badges" },
                  { id: "scorecards", label: "Scorecards" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setSelectedBadgeId(null);
                    }}
                    className="relative flex-1 py-1.5 text-[13px] font-semibold text-center rounded-[8px] focus:outline-none transition-colors duration-200"
                    style={{
                      color: activeTab === tab.id ? "var(--foreground)" : "var(--muted-foreground)"
                    }}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="active-profile-tab"
                        className="absolute inset-0 bg-background dark:bg-zinc-800 rounded-[8px] shadow-sm"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Body Contents */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 scrollbar-overlay">
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Points Big Display Card */}
                  <div className="relative overflow-hidden rounded-[20px] bg-card border border-border/50 p-6 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Trophy className="h-32 w-32" />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Total Points</p>
                    <h3 className="text-4xl font-black tracking-tight text-foreground mt-1.5">
                      {totalPoints.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">PTS</span>
                    </h3>
                    <div className="w-full h-px bg-border/40 my-4" />
                    <div className="grid grid-cols-2 gap-4 w-full text-center">
                      <div>
                        <p className="text-2xl font-extrabold text-foreground">{stats.total}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Games Played</p>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-primary">{badgeStats.unlockedCount}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Badges Earned</p>
                      </div>
                    </div>
                  </div>

                  {/* 2x2 Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card border border-border/50 rounded-[18px] p-4 flex flex-col">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Wins &amp; Draws</span>
                      <span className="text-2xl font-black mt-2 text-foreground">
                        {stats.wins} <span className="text-xs font-medium text-muted-foreground">/ {stats.draws}D</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">{stats.losses} matches lost</span>
                    </div>

                    <div className="bg-card border border-border/50 rounded-[18px] p-4 flex flex-col">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Win Rate</span>
                      <span className="text-2xl font-black mt-2 text-emerald-500">{stats.winRate}%</span>
                      <span className="text-[10px] text-muted-foreground mt-1">Based on completed games</span>
                    </div>

                    <div className="bg-card border border-border/50 rounded-[18px] p-4 flex flex-col">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current Streak</span>
                      <span className="text-2xl font-black mt-2 text-orange-500 flex items-center gap-1.5">
                        <Flame className="h-5 w-5 fill-orange-500/20 text-orange-500" />
                        {stats.currentStreak}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">Wins in a row</span>
                    </div>

                    <div className="bg-card border border-border/50 rounded-[18px] p-4 flex flex-col">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Progression</span>
                      <span className="text-2xl font-black mt-2 text-foreground">
                        {badgeStats.unlockedCount} <span className="text-xs font-medium text-muted-foreground">/ 20</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">Badges unlocked</span>
                    </div>
                  </div>

                  {/* Recent Achievements */}
                  <div className="space-y-2.5">
                    <h4 className="text-[13px] font-bold text-muted-foreground px-1">Recent Badges</h4>
                    <div className="bg-card border border-border/50 rounded-[20px] p-4 flex gap-4 overflow-x-auto select-none">
                      {badgeStats.evaluated.filter(b => b.unlocked).slice(-3).map(b => (
                        <div key={b.id} className="flex flex-col items-center shrink-0 w-20 text-center">
                          <div className={`h-12 w-12 rounded-2xl ${b.bgColor} ${b.color} flex items-center justify-center shadow-inner mb-2`}>
                            <b.icon className="h-6 w-6" />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground truncate w-full">{b.name}</span>
                        </div>
                      ))}
                      {badgeStats.unlockedCount === 0 && (
                        <div className="w-full text-center py-3 text-xs text-muted-foreground">
                          No badges unlocked yet. Challenge your partner to earn achievements! 🎮
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "badges" && (
                <div className="space-y-6">
                  {/* Badges Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3.5">
                    {badgeStats.evaluated.map(b => {
                      const isSelected = selectedBadgeId === b.id;
                      return (
                        <motion.button
                          key={b.id}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setSelectedBadgeId(isSelected ? null : b.id)}
                          className={`relative aspect-square rounded-[18px] flex flex-col items-center justify-center p-2.5 border transition-all ${
                            isSelected
                              ? "bg-primary/5 border-primary/50 shadow-md ring-2 ring-primary/20"
                              : b.unlocked
                              ? "bg-card border-border/50 hover:bg-muted/30"
                              : "bg-muted/10 border-border/30 grayscale opacity-60"
                          }`}
                        >
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${b.unlocked ? `${b.bgColor} ${b.color}` : "bg-muted text-muted-foreground"}`}>
                            {b.unlocked ? <b.icon className="h-5.5 w-5.5" /> : <Lock className="h-4.5 w-4.5" />}
                          </div>
                          <span className="text-[10px] font-semibold mt-2 text-foreground truncate w-full text-center">{b.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Badge Detail Panel */}
                  <AnimatePresence mode="wait">
                    {selectedBadge && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ type: "spring", damping: 24, stiffness: 220 }}
                        className="bg-card border border-border/60 rounded-[20px] p-5 space-y-4 shadow-sm"
                      >
                        <div className="flex gap-4 items-start">
                          <div className={`h-14 w-14 rounded-2xl ${selectedBadge.unlocked ? `${selectedBadge.bgColor} ${selectedBadge.color}` : "bg-muted text-muted-foreground"} flex items-center justify-center shrink-0`}>
                            {selectedBadge.unlocked ? <selectedBadge.icon className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[16px] font-bold text-foreground truncate">{selectedBadge.name}</h4>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${selectedBadge.unlocked ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"}`}>
                                {selectedBadge.unlocked ? "Unlocked" : "Locked"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{selectedBadge.desc}</p>
                          </div>
                        </div>
                        
                        <div className="bg-muted/40 dark:bg-zinc-800/40 rounded-xl p-3 flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">Your Challenge Progress:</span>
                          <span className={`font-bold ${selectedBadge.unlocked ? "text-primary" : "text-foreground"}`}>
                            {selectedBadge.progress}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {activeTab === "scorecards" && (
                <div className="space-y-4">
                  {scorecards.length > 0 ? (
                    <div className="bg-card border border-border/50 rounded-[22px] overflow-hidden divide-y divide-border/30 shadow-sm">
                      {scorecards.map(sc => (
                        <div key={sc.type} className="px-4 py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8.5 w-8.5 rounded-[10px] bg-primary/10 flex items-center justify-center text-primary">
                              <Trophy className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[14px] font-semibold text-foreground">{sc.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Played: {sc.totalPlayed}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-[13px] font-bold text-foreground">
                              <span className="text-primary">{sc.wins}W</span>
                              <span className="text-muted-foreground px-1">·</span>
                              <span className="text-muted-foreground">{sc.draws}D</span>
                              <span className="text-muted-foreground px-1">·</span>
                              <span className="text-destructive">{sc.losses}L</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {sc.totalPlayed > 0 ? Math.round((sc.wins / sc.totalPlayed) * 100) : 0}% win rate
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 px-6 bg-card border border-border/50 rounded-[22px]">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3.5 text-muted-foreground">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <h4 className="text-[15px] font-semibold text-foreground">No Games Played Yet</h4>
                      <p className="text-xs text-muted-foreground mt-2 max-w-[240px] mx-auto leading-relaxed">
                        Complete challenges with your partner to populate your scorecard! 🎮
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GameProfileSheet;
