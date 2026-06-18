import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession } from "@/hooks/useGameSessions";
import { checkMidnightGamer } from "@/hooks/useSecretAchievements";

/**
 * Shared real-time engine for "live duel" mini-games (Tap Duel, Math Sprint,
 * Color Clash, Quiz Buzzer, Memory Race…).
 *
 * Transport: Supabase broadcast channel `duel_${sessionId}` (same low-latency
 * mechanism GameChat already uses — no DB round-trip per round).
 *
 * Authority model: the challenger (session.created_by) is the HOST. The host
 * generates each round, resolves which player answered first, tallies the
 * score, and persists the final result through `onMakeMove`. Clients trust the
 * host's `result`/`over` broadcasts. `self: true` is enabled so the host walks
 * the exact same code path as clients.
 */

export type DuelPhase = "connecting" | "countdown" | "playing" | "reveal" | "gameover";

export type OnMakeMove = (
  sessionId: string,
  boardState: any,
  nextTurn: string,
  winnerId?: string | null,
  isDraw?: boolean
) => void | Promise<void>;

interface UseDuelMatchOpts<R> {
  session: GameSession;
  userId: string;
  totalRounds: number;
  /** Host-only. Returns a serializable payload describing round `n` (1-based). */
  makeRound: (round: number) => R;
  onMakeMove: OnMakeMove;
  /** Delay between a round being announced and it becoming playable (sync reveal). */
  countdownMs?: number;
  /** Auto-tie a round if nobody answers within this window. */
  roundTimeoutMs?: number;
  /** Pause on the result of each round before advancing. */
  revealMs?: number;
}

interface RoundMsg<R> {
  round: number;
  data: R;
  revealAt: number;
}
interface ClaimMsg {
  round: number;
  type: "correct" | "foul";
  by: string;
}
interface ResultMsg {
  round: number;
  winnerId: string | null;
}
interface OverMsg {
  scores: Record<string, number>;
  winnerId: string | null;
}

export interface DuelMatch<R> {
  phase: DuelPhase;
  round: number;
  totalRounds: number;
  roundData: R | null;
  /** ms timestamp (Date.now-based) when the current round becomes playable. */
  revealAt: number;
  myScore: number;
  oppScore: number;
  roundWinnerId: string | null;
  finalWinnerId: string | null;
  isDraw: boolean;
  isHost: boolean;
  peerReady: boolean;
  opponentId: string;
  /** Call when the local player produced a correct / fastest answer. */
  claimWin: () => void;
  /** Call when the local player fouled (e.g. tapped too early) — hands the round to the opponent. */
  claimFoul: () => void;
}

export function useDuelMatch<R = unknown>(opts: UseDuelMatchOpts<R>): DuelMatch<R> {
  const {
    session,
    userId,
    totalRounds,
    makeRound,
    onMakeMove,
    countdownMs = 3000,
    roundTimeoutMs = 9000,
    revealMs = 1700,
  } = opts;

  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [phase, setPhase] = useState<DuelPhase>("connecting");
  const [round, setRound] = useState(0);
  const [roundData, setRoundData] = useState<R | null>(null);
  const [revealAt, setRevealAt] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({ [userId]: 0, [opponentId]: 0 });
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [finalWinnerId, setFinalWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [peerReady, setPeerReady] = useState(false);

  const channelRef = useRef<any>(null);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const claimedRoundRef = useRef<Record<number, boolean>>({}); // host: round already resolved
  const localClaimedRef = useRef<Record<number, boolean>>({}); // me: already claimed this round
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const addTimer = (t: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(t);
    return t;
  };
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // ---- Host: start a round -------------------------------------------------
  const startRound = useCallback(
    (n: number) => {
      const data = makeRound(n);
      const revealStamp = Date.now() + countdownMs;
      send("round", { round: n, data, revealAt: revealStamp } as RoundMsg<R>);
    },
    [makeRound, countdownMs, send]
  );

  // ---- Host: resolve & persist the whole match -----------------------------
  const finishMatch = useCallback(() => {
    const s = scoresRef.current;
    const mine = s[userId] ?? 0;
    const theirs = s[opponentId] ?? 0;
    const draw = mine === theirs;
    const winnerId = draw ? null : mine > theirs ? userId : opponentId;
    send("over", { scores: s, winnerId } as OverMsg);
    // Persist (host is authoritative). board_state carries final scores.
    onMakeMove(
      session.id,
      { live: true, scores: s, totalRounds, finished: true },
      userId,
      winnerId,
      draw
    );
    checkMidnightGamer(userId);
  }, [userId, opponentId, send, onMakeMove, session.id, totalRounds]);

  // ---- Subscribe -----------------------------------------------------------
  useEffect(() => {
    const channel = supabase.channel(`duel_${session.id}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "join" }, ({ payload }) => {
        if (payload.by !== userId) {
          setPeerReady(true);
          // Reply so a late-joining peer also learns we're here.
          send("join_ack", { by: userId });
        }
      })
      .on("broadcast", { event: "join_ack" }, ({ payload }) => {
        if (payload.by !== userId) setPeerReady(true);
      })
      .on("broadcast", { event: "round" }, ({ payload }) => {
        const m = payload as RoundMsg<R>;
        setRound(m.round);
        setRoundData(m.data);
        setRoundWinnerId(null);
        setRevealAt(m.revealAt);
        setPhase("countdown");
        const delay = Math.max(0, m.revealAt - Date.now());
        addTimer(setTimeout(() => {
          if (phaseRef.current !== "gameover") setPhase("playing");
        }, delay));
        // Host arms the no-answer timeout for this round.
        if (isHost) {
          addTimer(setTimeout(() => {
            if (!claimedRoundRef.current[m.round]) {
              claimedRoundRef.current[m.round] = true;
              send("result", { round: m.round, winnerId: null } as ResultMsg);
            }
          }, delay + roundTimeoutMs));
        }
      })
      .on("broadcast", { event: "claim" }, ({ payload }) => {
        if (!isHost) return; // only host resolves
        const m = payload as ClaimMsg;
        if (claimedRoundRef.current[m.round]) return; // already resolved
        claimedRoundRef.current[m.round] = true;
        const winnerId = m.type === "correct" ? m.by : m.by === userId ? opponentId : userId;
        send("result", { round: m.round, winnerId } as ResultMsg);
      })
      .on("broadcast", { event: "result" }, ({ payload }) => {
        const m = payload as ResultMsg;
        setRoundWinnerId(m.winnerId);
        setPhase("reveal");
        if (m.winnerId) {
          setScores((prev) => ({ ...prev, [m.winnerId!]: (prev[m.winnerId!] ?? 0) + 1 }));
        }
        // Host advances after the reveal pause.
        if (isHost) {
          addTimer(setTimeout(() => {
            if (m.round >= totalRounds) finishMatch();
            else startRound(m.round + 1);
          }, revealMs));
        }
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        const m = payload as OverMsg;
        setScores(m.scores);
        setFinalWinnerId(m.winnerId);
        setIsDraw(m.winnerId === null);
        setPhase("gameover");
        clearTimers();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") send("join", { by: userId });
      });

    channelRef.current = channel;
    return () => {
      clearTimers();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, userId]);

  // ---- Host kicks off round 1 once both players are present ----------------
  useEffect(() => {
    if (isHost && peerReady && phase === "connecting") {
      startRound(1);
    }
  }, [isHost, peerReady, phase, startRound]);

  // ---- Local claim helpers -------------------------------------------------
  const claimWin = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (localClaimedRef.current[round]) return;
    localClaimedRef.current[round] = true;
    send("claim", { round, type: "correct", by: userId } as ClaimMsg);
  }, [round, userId, send]);

  const claimFoul = useCallback(() => {
    if (localClaimedRef.current[round]) return;
    localClaimedRef.current[round] = true;
    send("claim", { round, type: "foul", by: userId } as ClaimMsg);
  }, [round, userId, send]);

  return {
    phase,
    round,
    totalRounds,
    roundData,
    revealAt,
    myScore: scores[userId] ?? 0,
    oppScore: scores[opponentId] ?? 0,
    roundWinnerId,
    finalWinnerId,
    isDraw,
    isHost,
    peerReady,
    opponentId,
    claimWin,
    claimFoul,
  };
}
