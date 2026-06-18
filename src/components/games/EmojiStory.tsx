import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Send, Star, AlertCircle, Bot } from "lucide-react";
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

interface EmojiPuzzle {
  emojis: string;
  category: string;
  hint: string;
  answers: string[];
}

const AI_PUZZLES: EmojiPuzzle[] = [
  {
    emojis: "🧔🎓🏢",
    category: "Bollywood Movie 🎬",
    hint: "Three engineering students and 'All is Well'",
    answers: ["3 idiots", "three idiots", "3 idiot"]
  },
  {
    emojis: "🚂🏃‍♀️💼",
    category: "Bollywood Movie 🎬",
    hint: "Simran running to catch Raj's hand on a train",
    answers: ["ddlj", "dilwale dulhania le jayenge", "dilwale dulhania"]
  },
  {
    emojis: "🛺🛣️🏙️",
    category: "Indian Teen Life 🛺",
    hint: "Meter down in Mumbai, negotiating fare in Delhi",
    answers: ["auto", "autorickshaw", "auto rickshaw", "rickshaw"]
  },
  {
    emojis: "🏏🏆🔥",
    category: "Sport 🏏",
    hint: "Dhoni's helicopter shot or Kohli's cover drive under floodlights",
    answers: ["ipl", "cricket", "indian premier league", "t20"]
  },
  {
    emojis: "🍜🧀🌶️",
    category: "Indian Canteen Food 🍜",
    hint: "Late-night hostel survival kit, 2-minute magic",
    answers: ["maggi", "cheese maggi", "masala maggi", "maggie"]
  },
  {
    emojis: "☕🥛🌿",
    category: "Indian Fuel ☕",
    hint: "Cardamom & Ginger tapri favorite",
    answers: ["chai", "masala chai", "tea", "cutting chai"]
  },
  {
    emojis: "👦👧🎒🏫",
    category: "School Life 🎒",
    hint: "Sharing lunch boxes on the back bench",
    answers: ["school friends", "friends", "backbenchers", "best friends", "dost"]
  }
];

const EmojiStory: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [mode, setMode] = useState<"choice" | "playing">("choice");
  const [selectedMode, setSelectedMode] = useState<"ai" | "partner" | null>(null);

  // Phase inside the game: connecting -> choice -> setting (for partner mode) -> guessing -> reveal -> gameover
  const [gamePhase, setGamePhase] = useState<"connecting" | "choice" | "setting" | "guessing" | "reveal" | "gameover">("connecting");
  const [activePuzzle, setActivePuzzle] = useState<EmojiPuzzle | null>(null);

  // Answering states (for Partner Mode)
  const [typedAnswer, setTypedAnswer] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [myGuesses, setMyGuesses] = useState<string[]>([]);
  const [mySolved, setMySolved] = useState(false);
  const [oppGuesses, setOppGuesses] = useState<string[]>([]);
  const [oppSolved, setOppSolved] = useState(false);

  // Cooperative AI Mode States
  const [coopGuesses, setCoopGuesses] = useState<string[]>([]);
  const [coopAttemptsLeft, setCoopAttemptsLeft] = useState(3);
  const [coopSolved, setCoopSolved] = useState(false);
  const [coopScores, setCoopScores] = useState<number>(0);
  const [aiGeneratingPuzzle, setAiGeneratingPuzzle] = useState(false);
  const [aiCheckingGuess, setAiCheckingGuess] = useState(false);

  // Setter mode inputs (for player setter in Partner Mode)
  const [setterEmojis, setSetterEmojis] = useState("");
  const [setterAnswer, setSetterAnswer] = useState("");
  const [setterCategory, setSetterCategory] = useState("");
  const [setterHint, setSetterHint] = useState("");

  const channelRef = useRef<any>(null);

  // Determine current setter/guesser in Partner Mode
  const [round, setRound] = useState(1);
  const isMyTurnToSet = selectedMode === "partner" && ((round === 1 && isHost) || (round === 2 && !isHost));

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const fetchAIPuzzle = async (): Promise<EmojiPuzzle | null> => {
    const prompt = `Generate a single emoji story puzzle for a game played by Indian teenagers (17-18 years old).
The puzzle must represent a popular Indian topic (e.g., a Bollywood movie, popular snack/food, cricket player/IPL, school life, or K-Pop/BTS well known to Indian teens).
Format the response as a valid JSON object with EXACTLY these fields:
{
  "emojis": "emojis representing the topic",
  "category": "category name (e.g., Bollywood Movie, Indian Food, School Life, Sport)",
  "hint": "a hint that explicitly notes the Indian context of the puzzle",
  "answers": ["correct answer 1 in lowercase", "alternative correct answer 2 in lowercase"]
}
Do not include any other text, markdown blocks, or styling. Only JSON. Wholesome and clean only.`;

    try {
      const text = await aiAsk(prompt, { temperature: 0.8, maxTokens: 250 });
      if (!text) return null;
      
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.emojis && parsed.category && parsed.hint && Array.isArray(parsed.answers)) {
        return {
          emojis: String(parsed.emojis).trim(),
          category: String(parsed.category).trim(),
          hint: String(parsed.hint).trim(),
          answers: parsed.answers.map((a: any) => String(a).toLowerCase().trim())
        };
      }
    } catch (e) {
      console.error("Failed to generate AI puzzle:", e);
    }
    return null;
  };

  const handleSelectMode = async (modeType: "ai" | "partner") => {
    setSelectedMode(modeType);
    setMode("playing");
    send("select_mode", { mode: modeType });

    if (modeType === "ai") {
      setGamePhase("guessing");
      if (isHost) {
        setAiGeneratingPuzzle(true);
        send("ai_generating_puzzle", {});
        const puzzle = await fetchAIPuzzle();
        const finalPuzzle = puzzle || AI_PUZZLES[Math.floor(Math.random() * AI_PUZZLES.length)];
        setActivePuzzle(finalPuzzle);
        setAiGeneratingPuzzle(false);
        send("set_ai_puzzle", { puzzle: finalPuzzle });
      }
    } else {
      setGamePhase("setting");
    }
  };

  const handlePartnerSetStory = () => {
    if (!setterEmojis.trim() || !setterAnswer.trim()) return;
    
    const puzzle: EmojiPuzzle = {
      emojis: setterEmojis.trim(),
      category: setterCategory.trim() || "Secret Story 🤫",
      hint: setterHint.trim() || "Look at the emojis carefully!",
      answers: [setterAnswer.trim().toLowerCase()]
    };

    setActivePuzzle(puzzle);
    setGamePhase("guessing");
    send("partner_story_set", { puzzle });
  };

  const checkSemanticAnswer = async (guess: string, correctAnswers: string[]): Promise<boolean> => {
    const cleanGuess = guess.toLowerCase().trim();
    if (correctAnswers.includes(cleanGuess)) return true;

    // Local normalization check
    const cleanString = (s: string) => {
      return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    };
    const normalizedGuess = cleanString(guess);
    const isLocalMatch = correctAnswers.some(ans => cleanString(ans) === normalizedGuess);
    if (isLocalMatch) return true;

    // Use AI for smart check (DDLJ vs Dilwale Dulhania Le Jayenge)
    const prompt = `Is the guesser's text "${guess}" a correct semantic match for the target answer "${correctAnswers[0]}"? (For example, abbreviations like DDLJ are correct for Dilwale Dulhania Le Jayenge). Respond with only "YES" or "NO".`;
    const aiResponse = await aiAsk(prompt, { temperature: 0.1 });
    return aiResponse?.trim().toUpperCase() === "YES";
  };

  const applyCoopGuessResult = (guess: string, by: string, correct: boolean, newAttemptsLeft: number) => {
    setAiCheckingGuess(false);
    setCoopGuesses(prev => [...prev, guess]);
    setCoopAttemptsLeft(newAttemptsLeft);

    if (correct) {
      setCoopSolved(true);
      setCoopScores(prev => prev + 1);
      setGamePhase("reveal");
      if (isHost) {
        setTimeout(() => {
          advanceCoopRound();
        }, 4000);
      }
    } else if (newAttemptsLeft <= 0) {
      setGamePhase("reveal");
      if (isHost) {
        setTimeout(() => {
          advanceCoopRound();
        }, 4000);
      }
    }
  };

  const advanceCoopRound = async () => {
    if (round < 3) {
      const nextRound = round + 1;
      setRound(nextRound);
      setCoopGuesses([]);
      setCoopAttemptsLeft(3);
      setCoopSolved(false);
      setAiGeneratingPuzzle(true);
      send("ai_generating_puzzle", {});

      const puzzle = await fetchAIPuzzle();
      const finalPuzzle = puzzle || AI_PUZZLES[Math.floor(Math.random() * AI_PUZZLES.length)];

      setActivePuzzle(finalPuzzle);
      setAiGeneratingPuzzle(false);
      send("next_coop_round", { round: nextRound, puzzle: finalPuzzle });
      setGamePhase("guessing");
    } else {
      const totalCoopScore = coopScores;
      const isWinner = totalCoopScore > 0;
      send("over", { winnerId: null, isDraw: !isWinner, scores: { coopScore: totalCoopScore } });
      onMakeMove(session.id, { live: true, finished: true, coopScore: totalCoopScore }, userId, null, !isWinner);
    }
  };

  const handleGuessSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePuzzle) return;

    if (selectedMode === "ai") {
      if (gamePhase !== "guessing" || coopAttemptsLeft <= 0 || coopSolved || !typedAnswer.trim() || aiCheckingGuess) return;

      const guess = typedAnswer.trim();
      setTypedAnswer("");
      setAiCheckingGuess(true);

      if (isHost) {
        const isCorrect = await checkSemanticAnswer(guess, activePuzzle.answers);
        const nextAttempts = coopAttemptsLeft - 1;
        send("coop_guess_result", { guess, by: userId, correct: isCorrect, newAttemptsLeft: nextAttempts });
        applyCoopGuessResult(guess, userId, isCorrect, nextAttempts);
      } else {
        send("submit_coop_guess", { guess, by: userId });
      }
    } else {
      if (gamePhase !== "guessing" || attemptsLeft <= 0 || mySolved || !typedAnswer.trim()) return;

      const guess = typedAnswer.trim();
      setTypedAnswer("");
      const nextGuesses = [...myGuesses, guess];
      setMyGuesses(nextGuesses);
      setAttemptsLeft(prev => prev - 1);

      const isCorrect = await checkSemanticAnswer(guess, activePuzzle.answers);
      
      if (isCorrect) {
        setMySolved(true);
        send("submit_guess", { by: userId, correct: true, guess, attemptsUsed: nextGuesses.length });
        setGamePhase("reveal");
        setTimeout(() => {
          if (isHost) {
            advancePartnerRound();
          }
        }, 3000);
      } else {
        send("submit_guess", { by: userId, correct: false, guess, attemptsUsed: nextGuesses.length });
        const noAttemptsLeft = nextGuesses.length >= 3;
        if (noAttemptsLeft) {
          setGamePhase("reveal");
          setTimeout(() => {
            if (isHost) {
              advancePartnerRound();
            }
          }, 3000);
        }
      }
    }
  };

  const advancePartnerRound = () => {
    if (round === 1) {
      setRound(2);
      setActivePuzzle(null);
      setMyGuesses([]);
      setOppGuesses([]);
      setMySolved(false);
      setOppSolved(false);
      setAttemptsLeft(3);
      setGamePhase("setting");
      send("next_round", {});
    } else {
      const hostGuesses = isHost ? myGuesses.length : oppGuesses.length;
      const guestGuesses = isHost ? oppGuesses.length : myGuesses.length;
      
      const hostSolved = isHost ? mySolved : oppSolved;
      const guestSolved = isHost ? oppSolved : mySolved;

      const hostScore = hostSolved ? hostGuesses : 99;
      const guestScore = guestSolved ? guestGuesses : 99;

      let winnerId: string | null = null;
      let draw = false;

      if (hostScore < guestScore) {
        winnerId = session.created_by;
      } else if (guestScore < hostScore) {
        winnerId = session.opponent_id;
      } else {
        draw = true;
      }

      const scores = { [session.created_by]: hostScore, [session.opponent_id]: guestScore };
      send("over", { winnerId, isDraw: draw, scores });
      onMakeMove(session.id, { live: true, finished: true, scores }, userId, winnerId, draw);
    }
  };

  const [roundScores, setRoundScores] = useState<Record<string, number>>({});

  const isWinner = selectedMode === "ai"
    ? coopScores > 0
    : roundScores[userId] !== undefined && roundScores[opponentId] !== undefined
    ? roundScores[userId] < roundScores[opponentId]
    : false;
  const isDraw = selectedMode === "ai"
    ? false
    : roundScores[userId] !== undefined && roundScores[opponentId] !== undefined
    ? roundScores[userId] === roundScores[opponentId]
    : false;

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`emojistory_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && gamePhase === "connecting") {
          setGamePhase("choice");
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && gamePhase === "connecting") {
          setGamePhase("choice");
        }
      })
      .on("broadcast", { event: "select_mode" }, ({ payload }) => {
        setSelectedMode(payload.mode);
        setMode("playing");
        setGamePhase(payload.mode === "ai" ? "guessing" : "setting");
      })
      .on("broadcast", { event: "ai_generating_puzzle" }, () => {
        setAiGeneratingPuzzle(true);
      })
      .on("broadcast", { event: "set_ai_puzzle" }, ({ payload }) => {
        setActivePuzzle(payload.puzzle);
        setAiGeneratingPuzzle(false);
        setGamePhase("guessing");
      })
      .on("broadcast", { event: "partner_story_set" }, ({ payload }) => {
        setActivePuzzle(payload.puzzle);
        setGamePhase("guessing");
      })
      .on("broadcast", { event: "submit_coop_guess" }, async ({ payload }) => {
        if (isHost) {
          const isCorrect = await checkSemanticAnswer(payload.guess, activePuzzle!.answers);
          const nextAttempts = coopAttemptsLeft - 1;
          send("coop_guess_result", {
            guess: payload.guess,
            by: payload.by,
            correct: isCorrect,
            newAttemptsLeft: nextAttempts
          });
          applyCoopGuessResult(payload.guess, payload.by, isCorrect, nextAttempts);
        }
      })
      .on("broadcast", { event: "coop_guess_result" }, ({ payload }) => {
        applyCoopGuessResult(payload.guess, payload.by, payload.correct, payload.newAttemptsLeft);
      })
      .on("broadcast", { event: "next_coop_round" }, ({ payload }) => {
        setRound(payload.round);
        setCoopGuesses([]);
        setCoopAttemptsLeft(3);
        setCoopSolved(false);
        setActivePuzzle(payload.puzzle);
        setAiGeneratingPuzzle(false);
        setGamePhase("guessing");
      })
      .on("broadcast", { event: "submit_guess" }, ({ payload }) => {
        setOppGuesses(prev => [...prev, payload.guess]);
        if (payload.correct) {
          setOppSolved(true);
          setGamePhase("reveal");
          setTimeout(() => {
            if (isHost) advancePartnerRound();
          }, 3000);
        } else {
          const opponentDone = payload.attemptsUsed >= 3;
          if (opponentDone) {
            setGamePhase("reveal");
            setTimeout(() => {
              if (isHost) advancePartnerRound();
            }, 3000);
          }
        }
      })
      .on("broadcast", { event: "next_round" }, () => {
        setRound(2);
        setActivePuzzle(null);
        setMyGuesses([]);
        setOppGuesses([]);
        setMySolved(false);
        setOppSolved(false);
        setAttemptsLeft(3);
        setGamePhase("setting");
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        if (payload.scores?.coopScore !== undefined) {
          setCoopScores(payload.scores.coopScore);
        } else {
          setRoundScores(payload.scores);
        }
        setGamePhase("gameover");
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
  }, [session.id, isHost, gamePhase, selectedMode, coopAttemptsLeft, coopSolved, coopScores, activePuzzle, attemptsLeft, myGuesses, oppGuesses, userId, opponentId, send]);

  useEffect(() => {
    if (peerReady && gamePhase === "connecting") {
      setGamePhase("choice");
    }
  }, [peerReady, gamePhase]);

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Emoji Story 😂</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            {selectedMode === "ai" ? `Co-op vs AI 🤖 · Round ${round} of 3` : `Round ${round} of 2 · vs ${partnerName ?? "Partner"}`}
          </p>
        </div>
      </div>

      {/* Main container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col items-center justify-center">
        {aiGeneratingPuzzle ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">AI is setting the emoji story...</p>
            <p className="text-xs text-muted-foreground">Generating wholesome Indian pop-culture puzzles 🎬</p>
          </div>
        ) : (
          <>
            {gamePhase === "connecting" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-[220px]">
                  Keep this screen open to start the emoji challenge!
                </p>
              </div>
            )}

            {gamePhase === "choice" && (
              <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
                <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start">
                  <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground leading-normal">
                    <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                    Choose **Co-op vs AI** to solve Indian emoji puzzles together, or **Classic Duel** where you take turns setting emojis for your partner to guess.
                  </div>
                </div>

                {isHost ? (
                  <div className="flex flex-col gap-3 w-full mt-2">
                    <button
                      onClick={() => handleSelectMode("ai")}
                      className="w-full py-5 bg-card ring-1 ring-border/50 rounded-2xl flex flex-col items-center gap-1.5 hover:bg-muted/30 shadow-sm transition-all"
                    >
                      <Bot className="h-8 w-8 text-primary" />
                      <span className="text-sm font-bold text-foreground">Co-op vs AI 🤖</span>
                      <span className="text-[10px] text-muted-foreground">Solve AI-generated Indian emoji stories together</span>
                    </button>

                    <button
                      onClick={() => handleSelectMode("partner")}
                      className="w-full py-5 bg-card ring-1 ring-border/50 rounded-2xl flex flex-col items-center gap-1.5 hover:bg-muted/30 shadow-sm transition-all"
                    >
                      <span className="text-2xl">⚔️</span>
                      <span className="text-sm font-bold text-foreground">Classic Partner Duel</span>
                      <span className="text-[10px] text-muted-foreground">Take turns setting and guessing emoji stories</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">Waiting for host...</p>
                    <p className="text-xs text-muted-foreground mt-1">Host is choosing the game mode</p>
                  </div>
                )}
              </div>
            )}

            {gamePhase === "setting" && selectedMode === "partner" && (
              <div className="w-full max-w-[340px] flex flex-col gap-4">
                {isMyTurnToSet ? (
                  <div className="flex flex-col gap-4">
                    <div className="text-center mb-1">
                      <h3 className="text-base font-bold text-foreground">Create your Emoji Story!</h3>
                      <p className="text-xs text-muted-foreground">Use emojis to describe a movie, slang, or situation</p>
                    </div>

                    <div className="bg-card ring-1 ring-border/50 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">EMOJIS (e.g. 🧔🎓🏢)</label>
                        <input
                          type="text"
                          value={setterEmojis}
                          onChange={(e) => setSetterEmojis(e.target.value)}
                          placeholder="Enter only emojis..."
                          className="py-2.5 px-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary/45 font-bold text-center text-2xl"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">CORRECT ANSWER</label>
                        <input
                          type="text"
                          value={setterAnswer}
                          onChange={(e) => setSetterAnswer(e.target.value)}
                          placeholder="e.g. 3 Idiots"
                          className="py-2 px-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary/45 text-xs font-semibold text-center"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">CATEGORY (OPTIONAL)</label>
                        <input
                          type="text"
                          value={setterCategory}
                          onChange={(e) => setSetterCategory(e.target.value)}
                          placeholder="e.g. Bollywood Movie"
                          className="py-2 px-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary/45 text-xs font-semibold text-center"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold">HINT (OPTIONAL)</label>
                        <input
                          type="text"
                          value={setterHint}
                          onChange={(e) => setSetterHint(e.target.value)}
                          placeholder="e.g. Hostel engineers"
                          className="py-2 px-3 rounded-xl bg-muted/50 border border-border focus:outline-none focus:ring-1 focus:ring-primary/45 text-xs font-semibold text-center"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handlePartnerSetStory}
                      disabled={!setterEmojis.trim() || !setterAnswer.trim()}
                      className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 disabled:opacity-50 transition-all text-sm"
                    >
                      Send Emoji Puzzle
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-4 py-8">
                    <span className="text-4xl">✍️</span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Partner is setting the story...</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {partnerName ?? "Partner"} is compiling an emoji story for you to translate.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {gamePhase === "guessing" && activePuzzle && (
              <div className="w-full max-w-[340px] flex flex-col gap-4">
                <div className="bg-card ring-1 ring-border/50 rounded-3xl p-6 text-center shadow-xs flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{activePuzzle.category}</span>
                  <span className="text-6xl leading-none select-none my-4 block">{activePuzzle.emojis}</span>
                  <span className="text-xs bg-primary/5 text-primary border border-primary/10 rounded-xl px-4 py-1.5 font-semibold mt-1 max-w-[280px]">
                    💡 Hint: {activePuzzle.hint}
                  </span>
                </div>

                {selectedMode === "ai" ? (
                  <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                    <div className="flex justify-between items-center text-xs border-b border-border/50 pb-2">
                      <span className="text-muted-foreground font-semibold">Team Attempts Left</span>
                      <div className="flex gap-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-2.5 w-2.5 rounded-full ${
                              i < coopAttemptsLeft
                                ? "bg-primary"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="text-xs max-h-[100px] overflow-y-auto flex flex-col gap-1.5">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Team Guesses</p>
                      {coopGuesses.length === 0 ? (
                        <p className="text-muted-foreground italic text-[11px]">No guesses yet. Discuss and type!</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {coopGuesses.map((g, idx) => (
                            <span key={idx} className="bg-muted px-2.5 py-1 rounded-md text-foreground font-semibold">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 my-1">
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 px-3 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">You</span>
                      <span className="font-bold text-foreground">{mySolved ? "🎉 Solved!" : `Guesses: ${myGuesses.length}/3`}</span>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-2 px-3 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground truncate">{partnerName ?? "Partner"}</span>
                      <span className="font-bold text-foreground">{oppSolved ? "🎉 Solved!" : `Guesses: ${oppGuesses.length}/3`}</span>
                    </div>
                  </div>
                )}

                {/* Answer Guess Box */}
                {selectedMode === "ai" ? (
                  (!coopSolved && coopAttemptsLeft > 0) ? (
                    <form onSubmit={handleGuessSubmit} className="w-full flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        disabled={aiCheckingGuess}
                        value={typedAnswer}
                        onChange={(e) => setTypedAnswer(e.target.value)}
                        placeholder={aiCheckingGuess ? "AI is checking..." : "Type your guess..."}
                        className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={!typedAnswer.trim() || aiCheckingGuess}
                        className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
                      >
                        {aiCheckingGuess ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center shadow-xs flex flex-col items-center py-6">
                      <p className="text-sm font-bold text-foreground">
                        {coopSolved ? "🎉 Correct! Team Solved it!" : "Attempts finished! 🔒"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-2 animate-pulse">
                        Loading next round...
                      </p>
                    </div>
                  )
                ) : (
                  (!isMyTurnToSet && !mySolved && attemptsLeft > 0) ? (
                    <form onSubmit={handleGuessSubmit} className="w-full flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={typedAnswer}
                        onChange={(e) => setTypedAnswer(e.target.value)}
                        placeholder={`Type your guess (${attemptsLeft} left)...`}
                        className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!typedAnswer.trim()}
                        className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center shadow-xs flex flex-col items-center py-6">
                      <p className="text-sm font-bold text-foreground">
                        {mySolved ? "🎉 Correct! You solved it!" : "Attempts finished! 🔒"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-2 animate-pulse">
                        Waiting for round review...
                      </p>
                    </div>
                  )
                )}

                {/* Guess history list */}
                {selectedMode !== "ai" && myGuesses.length > 0 && (
                  <div className="bg-card ring-1 ring-border/50 rounded-2xl p-3 text-xs max-h-[90px] overflow-y-auto">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Your Guesses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myGuesses.map((g, i) => (
                        <span key={i} className="bg-muted px-2 py-0.5 rounded-md text-foreground font-semibold">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {gamePhase === "reveal" && activePuzzle && (
              <div className="flex flex-col items-center text-center gap-4 max-w-[340px]">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-4xl">
                  ✨
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Reveal!</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    The actual answer was: <strong className="text-primary font-bold">{activePuzzle.answers[0].toUpperCase()}</strong>
                  </p>

                  {selectedMode === "ai" ? (
                    <div className="mt-4 bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Round Outcome</p>
                      <p className="text-sm font-bold text-foreground mt-1">
                        {coopSolved ? "✅ Successfully Solved" : "❌ Attempt Failed"}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3 w-full">
                      <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Your Status</p>
                        <p className="text-sm font-bold text-foreground mt-1">{mySolved ? "✅ Solved" : "❌ Failed"}</p>
                      </div>
                      <div className="bg-card ring-1 ring-border/50 rounded-2xl p-4 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{partnerName ?? "Partner"}</p>
                        <p className="text-sm font-bold text-foreground mt-1">{oppSolved ? "✅ Solved" : "❌ Failed"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {gamePhase === "gameover" && (
              <GameOverCelebration
                isWinner={isWinner}
                isDraw={isDraw}
                partnerName={partnerName}
                myScore={selectedMode === "ai" ? coopScores : (roundScores[userId] === 99 ? 0 : 10)}
                opponentScore={selectedMode === "ai" ? coopScores : (roundScores[opponentId] === 99 ? 0 : 10)}
                onExit={onBack}
                onRematch={() => onPlayAgain(opponentId)}
                customMessage={selectedMode === "ai" ? `You solved ${coopScores}/3 emoji stories together! Teamwork makes the dream work! 🚀` : undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EmojiStory;
