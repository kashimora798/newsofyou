import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Send, Sparkles, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { aiAsk } from "@/lib/aiGame";
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

interface QuestionDef {
  text: string;
  actualAnswer: string;
}

const QUESTIONS: QuestionDef[] = [
  { text: "Why does the school bell ring?", actualAnswer: "To mark the end of a class period" },
  { text: "What is the capital of France?", actualAnswer: "Paris" },
  { text: "Why do we have to do homework?", actualAnswer: "To practice and reinforce what was learned in class" },
  { text: "Why do leaves turn yellow in autumn?", actualAnswer: "Because chlorophyll breaks down as daylight decreases" },
  { text: "What is the function of the mitochondria in a cell?", actualAnswer: "To generate chemical energy (ATP) for the cell" },
  { text: "Why do humans need sleep?", actualAnswer: "For brain reorganization, body repair, and energy conservation" },
  { text: "Why is the ocean water salty?", actualAnswer: "From dissolved minerals washed down by rivers and underwater volcanic vents" },
  { text: "Why do we study algebra in school?", actualAnswer: "To build logical reasoning, abstraction, and problem-solving skills" }
];

const TOTAL_ROUNDS = 3;

const WrongAnswersOnly: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "playing" | "judging" | "gameover">("connecting");
  const [round, setRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDef | null>(null);

  // Answering states
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Sync state
  const [answers, setAnswers] = useState<Record<string, string>>({}); // userId: wrong answer
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [aiCritique, setAiCritique] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  
  // Game scores (tally of rounds won)
  const [scores, setScores] = useState<Record<string, number>>({ [userId]: 0, [opponentId]: 0 });

  const channelRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const handleStartPlay = () => {
    setPhase("playing");
    send("play_click", {});
  };

  const handleAnswerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== "playing" || !typedAnswer.trim()) return;

    setIsAnswerSubmitted(true);
    const nextAnswers = { ...answers, [userId]: typedAnswer.trim() };
    setAnswers(nextAnswers);
    send("submit_answer", { text: typedAnswer.trim(), by: userId });

    const bothSubmitted = [userId, opponentId].every(id => nextAnswers[id] !== undefined);
    if (bothSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("judging");
      if (isHost) {
        judgeAnswers(nextAnswers);
      }
    }
  };

  // Host acts as the coordinator to call AI
  const judgeAnswers = async (allAnswers: Record<string, string>) => {
    setAiLoading(true);
    send("ai_loading", {});

    const hostAns = allAnswers[session.created_by];
    const guestAns = allAnswers[session.opponent_id];
    const hostName = "Host";
    const guestName = "Guest";

    const prompt = `You are a sassy Indian teenager AI judge. We are playing 'Wrong Answers Only'.
Serious Question: "${currentQuestion?.text}"
Actual Answer: "${currentQuestion?.actualAnswer}"
Host's Wrong Answer: "${hostAns}"
Guest's Wrong Answer: "${guestAns}"

Review both wrong answers in Hinglish slang (using words like yaar, bro, next level, board exams, canteen, maggi, epic fail). Give a brief funny critique (max 2 sentences) comparing them.
State clearly at the very end who won by writing exactly:
"WINNER: HOST" if Host wrote the funnier wrong answer.
"WINNER: GUEST" if Guest wrote the funnier wrong answer.
"WINNER: DRAW" if they are equally funny.
Do not write any vulgar or inappropriate content. Wholesome comedy only.`;

    const aiResponse = await aiAsk(prompt, { temperature: 0.85 });
    setAiLoading(false);

    let critique = aiResponse || "Both answers were equally bad, yaar. Draw! 💀";
    let winnerId: string | null = null;
    let isDraw = false;

    if (critique.includes("WINNER: HOST")) {
      winnerId = session.created_by;
    } else if (critique.includes("WINNER: GUEST")) {
      winnerId = session.opponent_id;
    } else {
      isDraw = true;
    }

    // Clean up winner string from public display
    critique = critique
      .replace(/WINNER:\s*HOST/gi, "")
      .replace(/WINNER:\s*GUEST/gi, "")
      .replace(/WINNER:\s*DRAW/gi, "")
      .trim();

    send("judge_result", { winnerId, isDraw, critique });
    applyJudgeResult(winnerId, isDraw, critique);
  };

  const applyJudgeResult = (winnerId: string | null, isDraw: boolean, critique: string) => {
    setAiLoading(false);
    setAiCritique(critique);
    setRoundWinnerId(winnerId);

    if (winnerId) {
      setScores(prev => ({ ...prev, [winnerId]: (prev[winnerId] || 0) + 1 }));
    }

    // Advance round after review
    setTimeout(() => {
      if (round < TOTAL_ROUNDS) {
        setRound(prev => prev + 1);
        setAnswers({});
        setTypedAnswer("");
        setIsAnswerSubmitted(false);
        setRoundWinnerId(null);
        setAiCritique("");
        setPhase("playing");
        if (isHost) {
          const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
          setCurrentQuestion(q);
          send("next_round", { round: round + 1, question: q });
        }
      } else {
        // Game over
        if (isHost) {
          const hostScore = scores[session.created_by] + (winnerId === session.created_by ? 1 : 0);
          const guestScore = scores[session.opponent_id] + (winnerId === session.opponent_id ? 1 : 0);
          
          let finalWinnerId: string | null = null;
          let draw = false;

          if (hostScore > guestScore) finalWinnerId = session.created_by;
          else if (guestScore > hostScore) finalWinnerId = session.opponent_id;
          else draw = true;

          const finalScores = { [session.created_by]: hostScore, [session.opponent_id]: guestScore };
          send("over", { winnerId: finalWinnerId, isDraw: draw, scores: finalScores });
          onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, finalWinnerId, draw);
        }
      }
    }, 6000);
  };

  // Timer countdown
  useEffect(() => {
    if (phase === "playing") {
      setTimeLeft(30);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (!isAnswerSubmitted) {
              setTypedAnswer("late submission 💀");
              setIsAnswerSubmitted(true);
              const next = { ...answers, [userId]: "late submission 💀" };
              setAnswers(next);
              send("submit_answer", { text: "late submission 💀", by: userId });
            }
            setPhase("judging");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isAnswerSubmitted, answers, send, userId]);

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`wrong_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
          setCurrentQuestion(q);
          setPhase("instructions");
          send("start_game", { question: q });
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
          setCurrentQuestion(q);
          setPhase("instructions");
          send("start_game", { question: q });
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setCurrentQuestion(payload.question);
        setPhase("instructions");
      })
      .on("broadcast", { event: "play_click" }, () => {
        setPhase("playing");
      })
      .on("broadcast", { event: "submit_answer" }, ({ payload }) => {
        setAnswers(prev => {
          const next = { ...prev, [payload.by]: payload.text };
          const bothSubmitted = [userId, opponentId].every(id => next[id] !== undefined);
          if (bothSubmitted && isHost) {
            judgeAnswers(next);
          }
          return next;
        });
      })
      .on("broadcast", { event: "ai_loading" }, () => {
        setAiLoading(true);
        setPhase("judging");
      })
      .on("broadcast", { event: "judge_result" }, ({ payload }) => {
        applyJudgeResult(payload.winnerId, payload.isDraw, payload.critique);
      })
      .on("broadcast", { event: "next_round" }, ({ payload }) => {
        setRound(payload.round);
        setCurrentQuestion(payload.question);
        setAnswers({});
        setTypedAnswer("");
        setIsAnswerSubmitted(false);
        setRoundWinnerId(null);
        setAiCritique("");
        setPhase("playing");
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
  }, [session.id, isHost, phase, round, currentQuestion, answers, scores, opponentId, userId, send]);

  // Handle local state choices
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("instructions");
    }
  }, [peerReady, phase]);

  const finalWinnerId = scores[userId] === scores[opponentId] ? null : scores[userId] > scores[opponentId] ? userId : opponentId;
  const isFinalWinner = scores[userId] > scores[opponentId];
  const isFinalDraw = scores[userId] === scores[opponentId];

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Wrong Answers Only ❌</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            Round {round} of {TOTAL_ROUNDS} · vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase === "playing" && (
          <div className="text-[13px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full tabular-nums">
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Main container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Keep this screen open to start the wrong answer challenge!
            </p>
          </div>
        )}

        {phase === "instructions" && currentQuestion && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                A serious school or general question appears. Both of you get **30 seconds** to write the **funniest/worst wrong answer**. Sassy K-pop AI will judge who wins!
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-5 w-full text-center shadow-sm">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">SAMPLE QUESTION</span>
              <h3 className="text-lg font-bold text-foreground">"{currentQuestion.text}"</h3>
              <p className="text-xs text-muted-foreground mt-2">Think of the most creative, hilariously wrong answer!</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Playing
            </button>
          </div>
        )}

        {phase === "playing" && currentQuestion && (
          <div className="w-full max-w-[340px] flex flex-col gap-4">
            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 text-center shadow-sm">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">QUESTION</span>
              <h3 className="text-lg font-black text-primary leading-snug">"{currentQuestion.text}"</h3>
            </div>

            {isAnswerSubmitted ? (
              <div className="bg-card ring-1 ring-border/50 rounded-2xl p-5 text-center shadow-xs flex flex-col items-center py-8">
                <p className="text-sm font-bold text-foreground">Answer Locked In! 🔒</p>
                <p className="text-xs text-muted-foreground mt-2 max-w-[240px] italic">
                  "{typedAnswer}"
                </p>
                <p className="text-[11px] text-primary mt-5 font-semibold animate-pulse">
                  Waiting for {partnerName ?? "partner"} to submit...
                </p>
              </div>
            ) : (
              <form onSubmit={handleAnswerSubmit} className="w-full flex gap-2 mt-2">
                <input
                  autoFocus
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Type funny wrong answer..."
                  className="flex-1 py-3.5 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
                />
                <button
                  type="submit"
                  disabled={!typedAnswer.trim()}
                  className="h-[48px] w-[48px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            )}
          </div>
        )}

        {phase === "judging" && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 w-full text-center shadow-xs flex flex-col items-center py-8">
              {aiLoading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <h3 className="text-base font-bold text-foreground">Chulbul AI is judging... ⚖️</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Evaluating who has the worst/funniest brain today.
                  </p>
                </>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-[11px] text-primary uppercase font-black tracking-widest leading-none mb-2">AI Verdict</h3>
                  <p className="text-xs text-foreground italic leading-relaxed px-2">
                    "{aiCritique}"
                  </p>
                  
                  <div className="mt-5 border-t border-dashed w-full pt-4 text-center">
                    <p className="text-xs text-muted-foreground font-bold">
                      Round Winner:{" "}
                      <strong className="text-primary font-black">
                        {roundWinnerId === null
                          ? "It's a Draw! 🤝"
                          : roundWinnerId === userId
                          ? "YOU! 🎉"
                          : `${partnerName ?? "Partner"}! 👊`}
                      </strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={isFinalWinner}
            isDraw={isFinalDraw}
            partnerName={partnerName}
            myScore={scores[userId] ?? 0}
            opponentScore={scores[opponentId] ?? 0}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
            scoreLabel="Rounds Won"
          />
        )}
      </div>
    </div>
  );
};

export default WrongAnswersOnly;
