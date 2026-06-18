import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession } from "@/hooks/useGameSessions";
import { checkMidnightGamer } from "@/hooks/useSecretAchievements";

/**
 * Shared real-time engine for "simultaneous reveal" mini-games — both players
 * answer each round SECRETLY, then both answers reveal at once and a per-round
 * result is computed on each side. Powers compatibility / secret-pick games:
 * This or That, Number Ninja, Mood Match, Secret Assumptions, Would You Rather…
 *
 * Sibling of `useDuelMatch` (which is first-to-claim/speed). Same transport: a
 * Supabase broadcast channel with `self: true`. The challenger (created_by) is
 * the HOST: it generates each round and advances the match. Answers are
 * symmetric — each client broadcasts its own and resolves the round locally
 * from its own perspective, so `resolveRound` is always called with the caller's
 * own answer as `mine`.
 */

export type SimulPhase = "connecting" | "answering" | "reveal" | "gameover";

export type OnMakeMove = (
  sessionId: string,
  boardState: any,
  nextTurn: string,
  winnerId?: string | null,
  isDraw?: boolean
) => void | Promise<void>;

export interface RoundResult {
  /** points the local player earned this round */
  meScore: number;
  /** points the opponent earned this round */
  oppScore: number;
  /** free-form extras the game can read on reveal (e.g. { match: true }) */
  [k: string]: any;
}

export interface SimulHistoryItem<R, A> {
  round: number;
  data: R;
  mine: A | null;
  theirs: A | null;
  res: RoundResult;
}

interface UseSimulMatchOpts<R, A> {
  session: GameSession;
  userId: string;
  totalRounds: number;
  /** Host-only. Returns a serializable payload for round `n` (1-based). */
  makeRound: (round: number) => R;
  /** Compute the round result from the local player's perspective. Must be symmetric. */
  resolveRound: (data: R, mine: A | null, theirs: A | null) => RoundResult;
  onMakeMove: OnMakeMove;
  /** How long to linger on the reveal before advancing. */
  revealMs?: number;
  /** Auto-resolve a round if a player never answers. */
  answerTimeoutMs?: number;
  /** Decide the final winner from totals. Default: higher score wins, tie = draw. */
  decideWinner?: (myTotal: number, oppTotal: number, userId: string, opponentId: string) => string | null;
}

export interface SimulMatch<R, A> {
  phase: SimulPhase;
  round: number;
  totalRounds: number;
  roundData: R | null;
  myAnswer: A | null;
  oppAnswer: A | null;
  answered: boolean;
  bothAnswered: boolean;
  roundResult: RoundResult | null;
  myScore: number;
  oppScore: number;
  history: SimulHistoryItem<R, A>[];
  finalWinnerId: string | null;
  isDraw: boolean;
  isHost: boolean;
  peerReady: boolean;
  opponentId: string;
  /** Submit the local player's secret answer for the current round. */
  submit: (value: A) => void;
}

export function useSimulMatch<R = unknown, A = unknown>(opts: UseSimulMatchOpts<R, A>): SimulMatch<R, A> {
  const {
    session,
    userId,
    totalRounds,
    makeRound,
    resolveRound,
    onMakeMove,
    revealMs = 2200,
    answerTimeoutMs = 20000,
    decideWinner,
  } = opts;

  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [phase, setPhase] = useState<SimulPhase>("connecting");
  const [round, setRound] = useState(0);
  const [roundData, setRoundData] = useState<R | null>(null);
  const [myAnswer, setMyAnswer] = useState<A | null>(null);
  const [oppAnswer, setOppAnswer] = useState<A | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<{ me: number; opp: number }>({ me: 0, opp: 0 });
  const [history, setHistory] = useState<SimulHistoryItem<R, A>[]>([]);
  const [finalWinnerId, setFinalWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [peerReady, setPeerReady] = useState(false);

  const channelRef = useRef<any>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  // answers[round] = { me?, opp? } ; resolved[round] = true
  const answersRef = useRef<Record<number, { me?: A; opp?: A }>>({});
  const resolvedRef = useRef<Record<number, boolean>>({});
  const dataRef = useRef<Record<number, R>>({});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = (t: ReturnType<typeof setTimeout>) => { timersRef.current.push(t); return t; };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // ---- Host: start a round -------------------------------------------------
  const startRound = useCallback((n: number) => {
    const data = makeRound(n);
    send("round", { round: n, data });
  }, [makeRound, send]);

  // ---- Resolve a round locally once both answers are in (or timed out) -----
  const tryResolve = useCallback((n: number, force = false) => {
    if (resolvedRef.current[n]) return;
    const a = answersRef.current[n] ?? {};
    const haveBoth = a.me !== undefined && a.opp !== undefined;
    if (!haveBoth && !force) return;
    resolvedRef.current[n] = true;

    const data = dataRef.current[n];
    const mine = (a.me ?? null) as A | null;
    const theirs = (a.opp ?? null) as A | null;
    const res = resolveRound(data, mine, theirs);

    setOppAnswer(theirs);
    setRoundResult(res);
    setScores((prev) => {
      const next = { me: prev.me + res.meScore, opp: prev.opp + res.oppScore };
      scoresRef.current = next;
      return next;
    });
    setHistory((prev) => [...prev, { round: n, data, mine, theirs, res }]);
    setPhase("reveal");

    // Host advances after the reveal pause.
    if (isHost) {
      addTimer(setTimeout(() => {
        if (n >= totalRounds) finishMatch();
        else startRound(n + 1);
      }, revealMs));
    }
  }, [resolveRound, isHost, totalRounds, revealMs, startRound]);

  // ---- Host: finish & persist ----------------------------------------------
  const finishMatch = useCallback(() => {
    const s = scoresRef.current;
    const winnerId = decideWinner
      ? decideWinner(s.me, s.opp, userId, opponentId)
      : s.me === s.opp ? null : s.me > s.opp ? userId : opponentId;
    const draw = winnerId === null;
    send("over", { winnerId });
    onMakeMove(session.id, { live: true, simul: true, finished: true, scores: s, history }, userId, winnerId, draw);
    checkMidnightGamer(userId);
  }, [decideWinner, userId, opponentId, send, onMakeMove, session.id, history]);

  // ---- Subscribe -----------------------------------------------------------
  useEffect(() => {
    const channel = supabase.channel(`simul_${session.id}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "join" }, ({ payload }) => {
        if (payload.by !== userId) { setPeerReady(true); send("join_ack", { by: userId }); }
      })
      .on("broadcast", { event: "join_ack" }, ({ payload }) => {
        if (payload.by !== userId) setPeerReady(true);
      })
      .on("broadcast", { event: "round" }, ({ payload }) => {
        const { round: n, data } = payload as { round: number; data: R };
        dataRef.current[n] = data;
        setRound(n);
        setRoundData(data);
        setMyAnswer(null);
        setOppAnswer(null);
        setRoundResult(null);
        setPhase("answering");
        // Host arms the no-answer timeout.
        if (isHost) {
          addTimer(setTimeout(() => {
            if (!resolvedRef.current[n]) { send("timeout", { round: n }); }
          }, answerTimeoutMs));
        }
      })
      .on("broadcast", { event: "answer" }, ({ payload }) => {
        const { round: n, by, value } = payload as { round: number; by: string; value: A };
        const slot = answersRef.current[n] ?? (answersRef.current[n] = {});
        if (by === userId) slot.me = value; else slot.opp = value;
        tryResolve(n);
      })
      .on("broadcast", { event: "timeout" }, ({ payload }) => {
        const { round: n } = payload as { round: number };
        tryResolve(n, true);
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        const { winnerId } = payload as { winnerId: string | null };
        setFinalWinnerId(winnerId);
        setIsDraw(winnerId === null);
        setPhase("gameover");
        clearTimers();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") send("join", { by: userId });
      });

    channelRef.current = channel;
    return () => { clearTimers(); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, userId]);

  // ---- Host kicks off round 1 once both present ----------------------------
  useEffect(() => {
    if (isHost && peerReady && phase === "connecting") startRound(1);
  }, [isHost, peerReady, phase, startRound]);

  const submit = useCallback((value: A) => {
    if (phaseRef.current !== "answering") return;
    const slot = answersRef.current[round] ?? (answersRef.current[round] = {});
    if (slot.me !== undefined) return; // already answered
    setMyAnswer(value);
    send("answer", { round, by: userId, value });
  }, [round, userId, send]);

  return {
    phase,
    round,
    totalRounds,
    roundData,
    myAnswer,
    oppAnswer,
    answered: myAnswer !== null,
    bothAnswered: roundResult !== null,
    roundResult,
    myScore: scores.me,
    oppScore: scores.opp,
    history,
    finalWinnerId,
    isDraw,
    isHost,
    peerReady,
    opponentId,
    submit,
  };
}
