import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      setSessions(
        (data ?? []).map((s: any) => ({
          ...s,
          board_state: Array.isArray(s.board_state)
            ? s.board_state
            : JSON.parse(s.board_state),
        }))
      );
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
    },
    []
  );

  const deleteGame = useCallback(
    async (sessionId: string) => {
      await supabase.from("game_sessions").delete().eq("id", sessionId);
    },
    []
  );

  const pendingInvites = sessions.filter(
    (s) => s.status === "pending" && s.opponent_id === userId
  );
  const activeGames = sessions.filter((s) => s.status === "active");
  const recentGames = sessions.filter(
    (s) => s.status === "completed" || s.status === "declined"
  ).slice(0, 10);
  const outgoingInvites = sessions.filter(
    (s) => s.status === "pending" && s.created_by === userId
  );

  return {
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
    deleteGame,
    refetch: fetchSessions,
  };
}
