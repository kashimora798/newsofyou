import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Heart, Star } from "lucide-react";
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

interface QuestionDef {
  a: string;
  b: string;
}

const QUESTIONS: QuestionDef[] = [
  { a: "Boards: Study at night 🌙", b: "Study early morning 🌅" },
  { a: "Chai tapri ☕", b: "Fancy cafe 🍰" },
  { a: "Maggi: Cheese 🧀", b: "Spicy Masala 🌶️" },
  { a: "Auto rickshaw 🛺", b: "Walking 🚶" },
  { a: "Class: Front bench 🧍", b: "Back bench 🫣" },
  { a: "Crush: Text first 💬", b: "Wait for text ⏳" },
  { a: "Instagram: Feed post 📸", b: "Stories only 🤳" },
  { a: "Study: Group study 📚", b: "Solo cramming 🧠" },
  { a: "Vada Pav 🍔", b: "Samosa 🥟" },
  { a: "Homework: Copy it 📝", b: "Do it yourself 🧠" },
  { a: "IPL: Support Dhoni 💛", b: "Support Kohli ❤️" },
  { a: "Earphones: Wired 🔌", b: "Wireless/Buds 🎧" },
  { a: "Weather: Rainy rain 🌧️", b: "Winter cold ❄️" },
  { a: "Series: Binge watch 🍿", b: "One ep per day 📺" },
  { a: "BTS: Dynamite 🕺", b: "Spring Day 🌸" },
  { a: "School uniform: Formal 👔", b: "Sports kit day 👟" },
  { a: "Post-Exam: Sleep all day 😴", b: "Meet besties at mall 🛍️" },
  { a: "Snack: Spicy Momos 🥟", b: "Gol Gappe/Puchka 🤤" },
  { a: "Gaming: BGMI/PUBG 🎮", b: "Free Fire 🔥" },
  { a: "Bollywood Vibe: Romantic 💖", b: "Action/Thriller 💥" },
  { a: "Music: Arijit Singh 🎤", b: "AP Dhillon / Shubh 🎸" },
  { a: "Revision: Topper's notes 📝", b: "1-shot YouTube video 🎥" },
  { a: "School Canteen: Cold Drink 🥤", b: "Hot Chai / Coffee ☕" },
  { a: "Memes: Share in DM 📲", b: "Tag in comments 💬" },
  { a: "Homework: Done at 1 AM 🕒", b: "Copied in morning bus 🚌" },
  { a: "Tuition Class: Fun talks 🗣️", b: "Serious study 📚" },
  { a: "Exam fear: Maths 📊", b: "Physics ⚡" },
  { a: "Socials: WhatsApp chats 💬", b: "Snapchat streaks ⚡" },
  { a: "Birthday Treat: Pizza party 🍕", b: "Biryani feast 🥘" },
  { a: "Free Lecture: Play sports ⚽", b: "Gossip inside class 🗣️" },
  { a: "Snack: Kurkure 🌶️", b: "Lays Chips 🥔" },
  { a: "BTS bias: Vocal line 🎤", b: "Rap line 🎧" },
  { a: "Shopping: Local street market 🛍️", b: "Mall outlets 🏬" },
  { a: "Travel: Metro train 🚇", b: "Local Bus 🚌" },
  { a: "Vacation: Hill station 🏔️", b: "Sunny Beach 🏖️" }
];

const TOTAL_ROUNDS = 15;
const ANSWER_TIME_MS = 2200;
const REVEAL_TIME_MS = 1200;

const ThisOrThatRapid: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "playing" | "reveal" | "gameover">("connecting");
  const [round, setRound] = useState(1);

  // Session questions state
  const [sessionQuestions, setSessionQuestions] = useState<QuestionDef[]>(QUESTIONS.slice(0, 15));

  // Answering states
  const [myChoice, setMyChoice] = useState<"a" | "b" | null>(null);
  const [oppChoice, setOppChoice] = useState<"a" | "b" | null>(null);
  
  // Results tally
  const [matches, setMatches] = useState<number>(0);
  const [history, setHistory] = useState<{ qIndex: number; mine: string | null; theirs: string | null; matched: boolean }[]>([]);

  // Timers
  const [msRemaining, setMsRemaining] = useState(ANSWER_TIME_MS);

  const channelRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ round, phase, myChoice, oppChoice, matches, history, sessionQuestions });

  // Sync state refs to read inside closures
  stateRef.current = { round, phase, myChoice, oppChoice, matches, history, sessionQuestions };

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const handleChoose = (opt: "a" | "b") => {
    if (phase !== "playing" || myChoice !== null) return;
    setMyChoice(opt);
    send("submit_choice", { round, choice: opt, by: userId });

    const currentOppChoice = stateRef.current.oppChoice;
    if (currentOppChoice !== null) {
      triggerReveal(opt, currentOppChoice);
    }
  };

  const triggerReveal = (mine: "a" | "b" | null, theirs: "a" | "b" | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("reveal");
    
    const matched = mine !== null && mine === theirs;
    if (matched) {
      setMatches(prev => prev + 1);
    }

    const currentQ = stateRef.current.sessionQuestions[(round - 1) % stateRef.current.sessionQuestions.length];
    const item = {
      qIndex: round - 1,
      mine: mine ? currentQ[mine] : null,
      theirs: theirs ? currentQ[theirs] : null,
      matched
    };
    setHistory(prev => [...prev, item]);

    // Host schedules the next slide
    if (isHost) {
      setTimeout(() => {
        if (stateRef.current.round < TOTAL_ROUNDS) {
          const nextRound = stateRef.current.round + 1;
          setRound(nextRound);
          setMyChoice(null);
          setOppChoice(null);
          setPhase("playing");
          setMsRemaining(ANSWER_TIME_MS);
          send("next_round", { round: nextRound });
        } else {
          // Game finished
          const finalMatches = stateRef.current.matches + (matched ? 1 : 0);
          send("over", { matchesCount: finalMatches, history: [...stateRef.current.history, item] });
          handleGameFinished(finalMatches);
        }
      }, REVEAL_TIME_MS);
    }
  };

  const handleGameFinished = (finalMatches: number) => {
    onMakeMove(session.id, { live: true, finished: true, scores: { matches: finalMatches } }, userId, null, true);
  };

  // Timer loop
  useEffect(() => {
    if (phase === "playing") {
      setMsRemaining(ANSWER_TIME_MS);
      timerRef.current = setInterval(() => {
        setMsRemaining((prev) => {
          if (prev <= 100) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Time up! Auto-reveal
            triggerReveal(stateRef.current.myChoice, stateRef.current.oppChoice);
            return 0;
          }
          return prev - 100;
        });
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`thisthat_rapid_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          setPhase("instructions");
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          setPhase("instructions");
        }
      })
      .on("broadcast", { event: "play_click" }, ({ payload }) => {
        if (payload?.questions) {
          setSessionQuestions(payload.questions);
        }
        setPhase("playing");
      })
      .on("broadcast", { event: "submit_choice" }, ({ payload }) => {
        if (payload.round === stateRef.current.round) {
          setOppChoice(payload.choice);
          if (stateRef.current.myChoice !== null) {
            triggerReveal(stateRef.current.myChoice, payload.choice);
          }
        }
      })
      .on("broadcast", { event: "next_round" }, ({ payload }) => {
        setRound(payload.round);
        setMyChoice(null);
        setOppChoice(null);
        setPhase("playing");
        setMsRemaining(ANSWER_TIME_MS);
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setMatches(payload.matchesCount);
        setHistory(payload.history);
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
  }, [session.id, isHost, phase, send]);

  // Handle local choices
  useEffect(() => {
    if (peerReady && phase === "connecting") {
      setPhase("instructions");
    }
  }, [peerReady, phase]);

  const handleStartPlay = () => {
    const shuffled = [...QUESTIONS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, TOTAL_ROUNDS);
    setSessionQuestions(selected);
    setPhase("playing");
    send("play_click", { questions: selected });
  };

  const currentQuestion = sessionQuestions[(round - 1) % sessionQuestions.length];

  const renderSummary = () => {
    const pct = Math.round((matches / TOTAL_ROUNDS) * 100);
    const label =
      pct >= 85 ? "Soulmates! 💞" :
      pct >= 65 ? "Super in sync! ✨" :
      pct >= 45 ? "Best Friends! 🤝" :
      "Opposites attract! 🧲";

    return (
      <div className="flex flex-col items-center text-center p-3">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Heart className="h-7 w-7 text-primary fill-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Compatibility Result</h3>
        <p className="text-5xl font-black text-primary leading-none mt-2 tabular-nums">{pct}%</p>
        <p className="text-base font-bold text-foreground mt-2">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Matched on {matches} of {TOTAL_ROUNDS} choices</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Rapid Fire 🎯</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            Round {round} of {TOTAL_ROUNDS} · vs {partnerName ?? "Partner"}
          </p>
        </div>
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
              Keep this screen open to start the rapid fire!
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
                Answer **15 rapid-fire** either/or choices. You get **2 seconds** per question. Both answer simultaneously. Let's see how compatible you are!
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-5 w-full text-center shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 mx-auto">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Indian Teen Edition</h3>
              <p className="text-xs text-muted-foreground mt-0.5">School canteens, board exams, crush banters, and snacks!</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Rapid Fire
            </button>
          </div>
        )}

        {phase === "playing" && currentQuestion && (
          <div className="w-full max-w-[340px] flex flex-col items-stretch gap-4">
            {/* Timer gauge */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "100%" }}
                animate={{ width: `${(msRemaining / ANSWER_TIME_MS) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            <p className="text-xs font-semibold text-muted-foreground text-center">Tap one quickly!</p>

            <div className="flex flex-col gap-3">
              {(["a", "b"] as const).map((opt) => {
                const chosen = myChoice === opt;
                return (
                  <motion.button
                    key={opt}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleChoose(opt)}
                    disabled={myChoice !== null}
                    className={`rounded-2xl py-6 text-xl font-bold border transition-all ease-spring ${
                      chosen
                        ? "bg-primary border-primary text-primary-foreground shadow-sm scale-[1.02]"
                        : myChoice !== null
                        ? "bg-muted text-muted-foreground opacity-60 cursor-default"
                        : "bg-card border-border/50 text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {currentQuestion[opt]}
                  </motion.button>
                );
              })}
            </div>

            {myChoice !== null && (
              <p className="text-center text-xs text-primary font-semibold animate-pulse mt-2">
                Locked in! Waiting for partner...
              </p>
            )}
          </div>
        )}

        {phase === "reveal" && currentQuestion && (
          <div className="w-full max-w-[340px] flex flex-col items-stretch gap-4">
            <div className="text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">ROUND REVEAL</span>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <div className={`rounded-2xl p-5 text-center border ${
                myChoice !== null && myChoice === oppChoice
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-card border-border/50"
              }`}>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">You Picked</p>
                <p className="text-lg font-bold text-foreground mt-1.5">{myChoice ? currentQuestion[myChoice] : "—"}</p>
              </div>

              <div className={`rounded-2xl p-5 text-center border ${
                oppChoice !== null && myChoice === oppChoice
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-card border-border/50"
              }`}>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">{partnerName ?? "Partner"}</p>
                <p className="text-lg font-bold text-foreground mt-1.5">{oppChoice ? currentQuestion[oppChoice] : "—"}</p>
              </div>
            </div>

            <div className="text-center mt-2">
              <span className={`text-2xl font-black ${myChoice === oppChoice ? "text-emerald-500" : "text-muted-foreground"}`}>
                {myChoice === oppChoice ? "✨ Match!" : "↔️ Opposites!"}
              </span>
            </div>
          </div>
        )}

        {phase === "gameover" && (
          <div className="w-full max-w-[340px] flex flex-col items-center">
            {renderSummary()}
            <div className="flex gap-2.5 mt-6 w-full">
              <button onClick={onBack} className="flex-1 py-3.5 rounded-2xl bg-muted/80 text-foreground text-xs font-semibold hover:bg-muted transition-all">
                Back
              </button>
              <button onClick={() => onPlayAgain(opponentId)} className="flex-1 py-3.5 rounded-2xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-all shadow-sm">
                Play again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThisOrThatRapid;
