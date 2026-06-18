import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Send, Trophy, Sparkles } from "lucide-react";
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

interface CategoryDef {
  title: string;
  blurb: string;
  validWords: string[]; // local dictionary for instant validation
}

const CATEGORIES: CategoryDef[] = [
  {
    title: "Indian Street Foods 🍢",
    blurb: "Name street food items popular in India",
    validWords: ["pani puri", "golgappa", "samosa", "kachori", "bhel puri", "pav bhaji", "vada pav", "dabeli", "momos", "chaat", "aloo tikki", "jalebi", "chole bhature", "misal pav", "poha", "kulfi", "dhokla", "rolls", "fritters", "pakora"]
  },
  {
    title: "BTS Songs 💜",
    blurb: "Name songs released by BTS",
    validWords: ["dynamite", "butter", "permission to dance", "boy with luv", "dna", "fake love", "spring day", "idol", "mic drop", "run bts", "yet to come", "blood sweat and tears", "life goes on", "fire", "dope", "black swan", "save me", "not today", "on", "stay gold", "home"]
  },
  {
    title: "Bollywood Movies 🎬",
    blurb: "Name famous Bollywood films",
    validWords: ["3 idiots", "ddlj", "sholay", "kabir singh", "pathaan", "jawan", "dangal", "kal ho naa ho", "yeh jawaani hai deewani", "krrish", "dhoom", "tiger zinda hai", "chaddi", "raaz", "pk", "lagaan", "dilwale", "jannat", "barfi", "chennai express", "zindagi na milegi dobara"]
  },
  {
    title: "Things that are BLUE 💙",
    blurb: "Name anything that is naturally or commonly blue",
    validWords: ["ocean", "sky", "blueberry", "sapphire", "smurf", "jeans", "ink", "avatar", "neptune", "blue whale", "blueberries", "denim", "peacock", "blue bird", "water", "glacier"]
  },
  {
    title: "Marvel Superheroes 🦸‍♂️",
    blurb: "Name characters from Marvel universe",
    validWords: ["iron man", "spider-man", "thor", "hulk", "captain america", "black widow", "hawkeye", "doctor strange", "black panther", "wolverine", "deadpool", "star-lord", "ant-man", "loki", "spiderman", "ironman", "scarlet witch", "vision", "captain marvel"]
  },
  {
    title: "Social Media Apps 📱",
    blurb: "Name social media platforms or chat apps",
    validWords: ["instagram", "snapchat", "whatsapp", "tiktok", "facebook", "twitter", "youtube", "reddit", "threads", "discord", "telegram", "pinterest", "insta", "snap", "yt", "fb"]
  },
  {
    title: "Fast Food Brands 🍔",
    blurb: "Name famous global and Indian fast food chains",
    validWords: ["mcdonalds", "burger king", "kfc", "dominos", "pizza hut", "subway", "starbucks", "taco bell", "dunkin", "wendys", "haldirams", "mcdonald's", "domino's", "haldiram", "chaayos", "wow momo"]
  }
];

const WordBlurt: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "playing" | "gameover">("connecting");
  
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [typedWord, setTypedWord] = useState("");
  const [enteredWords, setEnteredWords] = useState<Record<string, string>>({}); // word: userId
  const [timeLeft, setTimeLeft] = useState(20);
  const [localScore, setLocalScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // Check if a word is valid locally
  const validateWordLocally = (word: string): boolean => {
    if (!category) return false;
    const clean = word.toLowerCase().trim();
    if (clean.length < 2) return false;
    
    // First check local dictionary
    if (category.validWords.includes(clean)) return true;
    
    // Fall open: if the word is not in our dictionary but consists of letters, accept it
    // This makes sure players aren't frustrated by omissions
    return /^[a-zA-Z0-9\s'-]+$/.test(clean);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== "playing" || !typedWord.trim() || !category) return;

    const word = typedWord.trim().toLowerCase();
    
    if (enteredWords[word]) {
      setFeedback("Already used! ❌");
      setTimeout(() => setFeedback(null), 1000);
      setTypedWord("");
      return;
    }

    const isValid = validateWordLocally(word);
    if (isValid) {
      setTypedWord("");
      setFeedback("Valid! +10 pts 🎉");
      setTimeout(() => setFeedback(null), 1000);
      
      // Update locally
      setEnteredWords((prev) => ({ ...prev, [word]: userId }));
      setLocalScore((prev) => prev + 10);
      
      // Broadcast word addition
      send("add_word", { word, by: userId });
    } else {
      setFeedback("Not matching! ❌");
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (isHost) {
      setTimeout(() => {
        const finalScores = { [userId]: localScore, [opponentId]: oppScore };
        let winnerId: string | null = null;
        let isDraw = false;
        
        if (localScore > oppScore) winnerId = userId;
        else if (oppScore > localScore) winnerId = opponentId;
        else isDraw = true;
        
        send("over", { winnerId, isDraw, scores: finalScores });
        onMakeMove(session.id, { live: true, finished: true, scores: finalScores }, userId, winnerId, isDraw);
      }, 500);
    }
  }, [isHost, localScore, oppScore, opponentId, userId, send, onMakeMove, session.id]);

  // Handle timer
  useEffect(() => {
    if (phase === "playing") {
      setTimeLeft(20);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, finishGame]);

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`wordblurt_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        // Host picks category
        if (isHost && phase === "connecting") {
          const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
          setCategory(cat);
          setPhase("instructions");
          send("start_game", { category: cat });
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
          setCategory(cat);
          setPhase("instructions");
          send("start_game", { category: cat });
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setCategory(payload.category);
        setPhase("instructions");
      })
      .on("broadcast", { event: "add_word" }, ({ payload }) => {
        const { word, by } = payload;
        setEnteredWords((prev) => ({ ...prev, [word]: by }));
        if (by === opponentId) {
          setOppScore((prev) => prev + 10);
        }
      })
      .on("broadcast", { event: "play_click" }, () => {
        setPhase("playing");
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setLocalScore(payload.scores[userId] ?? 0);
        setOppScore(payload.scores[opponentId] ?? 0);
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
  }, [session.id, isHost, phase, opponentId, userId, send]);

  const handleStartPlay = () => {
    setPhase("playing");
    send("play_click", {});
  };

  const isWinner = localScore > oppScore;
  const isDraw = localScore === oppScore;

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Word Blurt 💬</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase === "playing" && (
          <div className="text-[14px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full tabular-nums">
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Keep this screen open to start the blurt challenge!
            </p>
          </div>
        )}

        {phase === "instructions" && category && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-5">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                A category will appear. Both of you get **20 seconds** to type as many answers as you can. No repeating words! Highest score wins.
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 w-full text-center shadow-sm">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">CATEGORY</span>
              <h3 className="text-2xl font-black text-primary leading-tight">{category.title}</h3>
              <p className="text-xs text-muted-foreground mt-2">{category.blurb}</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Typing!
            </button>
          </div>
        )}

        {phase === "playing" && category && (
          <div className="w-full max-w-[340px] flex-1 flex flex-col justify-between py-2">
            {/* Category header */}
            <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center shadow-xs">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">{category.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Type as many words as you can!</p>
            </div>

            {/* Score row */}
            <div className="grid grid-cols-2 gap-3 my-3">
              <div className="bg-primary/5 ring-1 ring-primary/15 rounded-xl py-2 px-3 flex justify-between items-center text-xs">
                <span className="text-muted-foreground">You</span>
                <strong className="text-primary text-base font-black tabular-nums">{localScore}</strong>
              </div>
              <div className="bg-muted/40 rounded-xl py-2 px-3 flex justify-between items-center text-xs">
                <span className="text-muted-foreground truncate">{partnerName ?? "Partner"}</span>
                <strong className="text-foreground text-base font-black tabular-nums">{oppScore}</strong>
              </div>
            </div>

            {/* Word list */}
            <div className="flex-1 min-h-[140px] bg-card ring-1 ring-border/50 rounded-2xl p-3 shadow-inner overflow-y-auto flex flex-wrap gap-1.5 content-start">
              {Object.keys(enteredWords).length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  Blurt words here!
                </div>
              ) : (
                Object.entries(enteredWords).map(([word, user]) => {
                  const isMine = user === userId;
                  return (
                    <motion.span
                      key={word}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        isMine
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-muted border-border text-foreground"
                      }`}
                    >
                      {word}
                    </motion.span>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="w-full flex gap-2 mt-3 relative">
              {feedback && (
                <div className="absolute -top-7 left-3 text-[10px] font-bold text-primary animate-pulse bg-background px-2 py-0.5 rounded-full border">
                  {feedback}
                </div>
              )}
              <input
                autoFocus
                type="text"
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                placeholder="Type word..."
                className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
              />
              <button
                type="submit"
                disabled={!typedWord.trim()}
                className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {phase === "gameover" && (
          <GameOverCelebration
            isWinner={isWinner}
            isDraw={isDraw}
            partnerName={partnerName}
            myScore={localScore}
            opponentScore={oppScore}
            onExit={onBack}
            onRematch={() => onPlayAgain(opponentId)}
          />
        )}
      </div>
    </div>
  );
};

export default WordBlurt;
