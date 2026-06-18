import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { checkMidnightGamer } from "@/hooks/useSecretAchievements";

export interface GameSession {
  id: string;
  game_type: string;
  created_by: string;
  opponent_id: string;
  status: string;
  winner_id: string | null;
  board_state: string[];
  current_turn: string;
  created_at: string;
  updated_at: string;
}

export function useGameSessions(userId: string) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .or(`created_by.eq.${userId},opponent_id.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching game sessions:", error);
    } else {
      setSessions((data ?? []).map((s: any) => ({ ...s, board_state: s.board_state })));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSessions();

    const channel = supabase
      .channel("game_sessions_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions" },
        () => fetchSessions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

  const createGame = useCallback(
    async (opponentId: string, gameType = "tic_tac_toe") => {
      const boardState =
        gameType === "tic_tac_toe"
          ? ["", "", "", "", "", "", "", "", ""]
          : gameType === "word_chain"
          ? { words: [], scores: {}, lastLetter: "" }
          : gameType === "hangman"
          ? { word: "", guessed: [], setter: "", phase: "setting" }
          : gameType === "bingo"
          ? { gridSize: 5, phase: "setup", boards: {}, calledNumbers: [], readyPlayers: [], linesToWin: 5 }
          : gameType === "quick_draw"
          ? { phase: "choosing", drawer: userId, word: "", strokes: [], guesses: [], guessed: false, round: 1, totalRounds: 6, scores: {} }
          : gameType === "story_battle"
          ? {
              story: [],
              phase: "writing",
              requiredWords: ["samosa", "bts", "autorickshaw", "biryani", "pani puri", "maggi", "chai", "jalebi", "shah rukh khan", "cricket", "spatula", "nebraska", "mosquito", "chutney", "aeroplane", "selfie", "reels", "momos"]
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
            }
          : gameType === "emoji_story"
          ? { story: "", answer: "", hint: "", category: "", guesses: [], solved: false }
          : gameType === "tap_duel" ||
            gameType === "math_sprint" ||
            gameType === "color_clash" ||
            gameType === "quiz_buzzer" ||
            gameType === "memory_race" ||
            gameType === "emoji_riddle" ||
            gameType === "emoji_reflex" ||
            gameType === "odd_one_out" ||
            gameType === "this_or_that" ||
            gameType === "number_ninja" ||
            gameType === "hot_cold" ||
            gameType === "true_false_blitz" ||
            gameType === "word_blurt" ||
            gameType === "wordle_duel" ||
            gameType === "caption_this" ||
            gameType === "wrong_answers_only" ||
            gameType === "sudoku_speedrun" ||
            gameType === "this_or_that_rapid" ||
            gameType === "memory_matrix" ||
            gameType === "alphabet_sprint"
          ? { live: true, scores: {}, finished: false }
          : [];

      const { data, error } = await supabase
        .from("game_sessions")
        .insert({
          game_type: gameType,
          created_by: userId,
          opponent_id: opponentId,
          status: "pending",
          board_state: boardState,
          current_turn: userId,
        } as any)
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: "Couldn't create game", variant: "destructive" });
        return null;
      }
      toast({ title: "Challenge sent! 🎮", description: "Waiting for your partner…" });
      return data;
    },
    [userId, toast]
  );

  const acceptGame = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase
        .from("game_sessions")
        .update({ status: "active", updated_at: new Date().toISOString() } as any)
        .eq("id", sessionId);
      if (error) toast({ title: "Error", description: "Couldn't accept game", variant: "destructive" });
    },
    [toast]
  );

  const declineGame = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase
        .from("game_sessions")
        .update({ status: "declined", updated_at: new Date().toISOString() } as any)
        .eq("id", sessionId);
      if (error) toast({ title: "Error", description: "Couldn't decline game", variant: "destructive" });
    },
    [toast]
  );

  const makeMove = useCallback(
    async (sessionId: string, boardState: string[], nextTurn: string, winnerId?: string | null, isDraw?: boolean) => {
      const update: any = {
        board_state: boardState,
        current_turn: nextTurn,
        updated_at: new Date().toISOString(),
      };
      if (winnerId) {
        update.status = "completed";
        update.winner_id = winnerId;
      } else if (isDraw) {
        update.status = "completed";
      }
      const { error } = await supabase
        .from("game_sessions")
        .update(update)
        .eq("id", sessionId);
      if (error) console.error("Move error:", error);
      // Secret achievement: Midnight Gamer
      checkMidnightGamer(userId);
    },
    []
  );

  const deleteGame = useCallback(
    async (sessionId: string) => {
      await supabase.from("game_sessions").delete().eq("id", sessionId);
    },
    []
  );

  const STALE_INVITE_MS = 60 * 60 * 1000; // 1 hour
  const STALE_ACTIVE_MS = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  const ageMs = (s: GameSession) => now - new Date(s.updated_at).getTime();

  // Expired invites simply drop out of the lobby (no DB write needed) so it
  // self-cleans instead of accumulating dead challenges.
  const pendingInvites = sessions.filter(
    (s) => s.status === "pending" && s.opponent_id === userId && ageMs(s) < STALE_INVITE_MS
  );
  const outgoingInvites = sessions.filter(
    (s) => s.status === "pending" && s.created_by === userId && ageMs(s) < STALE_INVITE_MS
  );

  const allActive = sessions.filter((s) => s.status === "active");
  // Fresh = recently touched; stale = abandoned mid-game (shown separately so
  // the user can swipe them away).
  const activeGames = allActive.filter((s) => ageMs(s) < STALE_ACTIVE_MS);
  const staleGames = allActive.filter((s) => ageMs(s) >= STALE_ACTIVE_MS);

  const recentGames = sessions.filter(
    (s) => s.status === "completed" || s.status === "declined"
  ).slice(0, 10);

  return {
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
    refetch: fetchSessions,
  };
}
