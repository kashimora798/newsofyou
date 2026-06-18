import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, HelpCircle, Send, Heart, Star } from "lucide-react";
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

interface ImageDef {
  url: string;
  desc: string;
}

const IMAGES: ImageDef[] = [
  {
    url: "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=600&auto=format&fit=crop&q=80",
    desc: "A shocked monkey looking at a camera with its hand on its head"
  },
  {
    url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80",
    desc: "A cute dog wearing hipster glasses typing on a retro laptop"
  },
  {
    url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80",
    desc: "A cat looking extremely surprised with big round eyes"
  },
  {
    url: "https://images.unsplash.com/photo-1507082218616-be5e7c30e568?w=600&auto=format&fit=crop&q=80",
    desc: "A squirrel holding a tiny pinecone as if it's a microphone"
  },
  {
    url: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600&auto=format&fit=crop&q=80",
    desc: "A lazy panda rolling down a grassy hill"
  }
];

const CaptionThis: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const isHost = session.created_by === userId;
  const opponentId = session.created_by === userId ? session.opponent_id : session.created_by;

  const [peerReady, setPeerReady] = useState(false);
  const [phase, setPhase] = useState<"connecting" | "instructions" | "writing" | "voting" | "gameover">("connecting");
  
  // Game states
  const [currentImg, setCurrentImg] = useState<ImageDef | null>(null);
  const [myCaption, setMyCaption] = useState("");
  const [typedCaption, setTypedCaption] = useState("");
  const [isCaptionSubmitted, setIsCaptionSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Synced caption entries
  const [captions, setCaptions] = useState<Record<string, { text: string; authorName: string }>>({}); // userId: caption
  const [votes, setVotes] = useState<Record<string, string>>({}); // voterUserId: votedCaptionUserId
  const [myVote, setMyVote] = useState<string | null>(null);

  const channelRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = useCallback((event: string, payload: any) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // Fetch AI caption as a competitor!
  const fetchAiCaption = async (imageDesc: string) => {
    const prompt = `You are a funny Indian teenager. Write a 1-sentence caption in Hinglish slang (using words like yaar, bro, scene, boards, syllabus, chill, vibes) for a funny image of: "${imageDesc}". Do not write anything vulgar or inappropriate. Keep it wholesome and extremely funny. Max 12 words. Do not put quotes.`;
    const aiText = await aiAsk(prompt, { temperature: 0.8 });
    const formatted = aiText ? aiText.replace(/['"]/g, "").trim() : "Me trying to understand physics syllabus 2 mins before exam 💀";
    
    // Add AI caption to the pool
    setCaptions(prev => {
      const next = { ...prev, "ai": { text: formatted, authorName: "Chulbul AI 🤖" } };
      send("sync_captions", { captions: next });
      return next;
    });
  };

  const handleCaptionSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== "writing" || !typedCaption.trim()) return;

    setMyCaption(typedCaption.trim());
    setIsCaptionSubmitted(true);

    const nextCaptions = {
      ...captions,
      [userId]: { text: typedCaption.trim(), authorName: "You" }
    };
    setCaptions(nextCaptions);
    send("submit_caption", { text: typedCaption.trim(), by: userId });

    // Check if both players have submitted
    const playerIds = [userId, opponentId];
    const bothSubmitted = playerIds.every(id => nextCaptions[id] !== undefined);
    
    if (bothSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("voting");
      send("go_to_voting", { captions: nextCaptions });
    }
  };

  const handleVoteSubmit = (votedAuthorId: string) => {
    if (phase !== "voting" || myVote !== null) return;
    setMyVote(votedAuthorId);
    
    const nextVotes = { ...votes, [userId]: votedAuthorId };
    setVotes(nextVotes);
    send("submit_vote", { vote: votedAuthorId, by: userId });

    // Check if both players have voted
    const bothVoted = [userId, opponentId].every(id => nextVotes[id] !== undefined);
    if (bothVoted) {
      handleRoundCompletion(nextVotes);
    }
  };

  const handleRoundCompletion = (finalVotes: Record<string, string>) => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isHost) {
      setTimeout(() => {
        // Tally votes
        const tallies: Record<string, number> = { [userId]: 0, [opponentId]: 0, "ai": 0 };
        Object.values(finalVotes).forEach(votedId => {
          if (tallies[votedId] !== undefined) {
            tallies[votedId] += 10; // 10 points per vote
          }
        });

        const winnerId = tallies[userId] === tallies[opponentId] ? null : tallies[userId] > tallies[opponentId] ? userId : opponentId;
        const isDraw = tallies[userId] === tallies[opponentId];
        
        send("over", { winnerId, isDraw, scores: tallies });
        onMakeMove(session.id, { live: true, finished: true, scores: tallies }, userId, winnerId, isDraw);
      }, 500);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (phase === "writing") {
      setTimeLeft(30);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            // Auto-submit empty if not submitted
            if (!isCaptionSubmitted) {
              setMyCaption("Late submission 💀");
              setIsCaptionSubmitted(true);
              const next = { ...captions, [userId]: { text: "Late submission 💀", authorName: "You" } };
              setCaptions(next);
              send("submit_caption", { text: "Late submission 💀", by: userId });
            }
            setPhase("voting");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isCaptionSubmitted, captions, send, userId]);

  // Realtime Broadcast Channel
  useEffect(() => {
    const channel = supabase.channel(`caption_${session.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "join" }, () => {
        setPeerReady(true);
        send("join_ack", {});
        if (isHost && phase === "connecting") {
          const img = IMAGES[Math.floor(Math.random() * IMAGES.length)];
          setCurrentImg(img);
          setPhase("instructions");
          send("start_game", { img });
          fetchAiCaption(img.desc);
        }
      })
      .on("broadcast", { event: "join_ack" }, () => {
        setPeerReady(true);
        if (isHost && phase === "connecting") {
          const img = IMAGES[Math.floor(Math.random() * IMAGES.length)];
          setCurrentImg(img);
          setPhase("instructions");
          send("start_game", { img });
          fetchAiCaption(img.desc);
        }
      })
      .on("broadcast", { event: "start_game" }, ({ payload }) => {
        setCurrentImg(payload.img);
        setPhase("instructions");
      })
      .on("broadcast", { event: "play_click" }, () => {
        setPhase("writing");
      })
      .on("broadcast", { event: "submit_caption" }, ({ payload }) => {
        setCaptions(prev => ({ ...prev, [payload.by]: { text: payload.text, authorName: partnerName ?? "Partner" } }));
      })
      .on("broadcast", { event: "sync_captions" }, ({ payload }) => {
        setCaptions(payload.captions);
      })
      .on("broadcast", { event: "go_to_voting" }, ({ payload }) => {
        setCaptions(payload.captions);
        setPhase("voting");
      })
      .on("broadcast", { event: "submit_vote" }, ({ payload }) => {
        setVotes(prev => {
          const next = { ...prev, [payload.by]: payload.vote };
          const bothVoted = [userId, opponentId].every(id => next[id] !== undefined);
          if (bothVoted) {
            handleRoundCompletion(next);
          }
          return next;
        });
      })
      .on("broadcast", { event: "over" }, ({ payload }) => {
        setCaptions(prev => ({
          ...prev,
          [userId]: { text: prev[userId]?.text ?? "Late submission 💀", authorName: "You" },
          [opponentId]: { text: prev[opponentId]?.text ?? "Late submission 💀", authorName: partnerName ?? "Partner" }
        }));
        setPhase("gameover");
        setCaptions(c => {
          const next = { ...c };
          next[userId] = { text: next[userId]?.text ?? "", authorName: "You" };
          return next;
        });
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
  }, [session.id, isHost, phase, partnerName, userId, opponentId, captions, send]);

  const handleStartPlay = () => {
    setPhase("writing");
    send("play_click", {});
  };

  const isWinner = (votes[userId] || 0) > (votes[opponentId] || 0);
  const isDraw = (votes[userId] || 0) === (votes[opponentId] || 0);

  return (
    <div className="flex flex-col h-full bg-background relative" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      {/* Header */}
      <div className="glass-chat-header flex items-center gap-3 px-4 py-3 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Caption This! 🖼️</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            vs {partnerName ?? "Partner"}
          </p>
        </div>
        {phase === "writing" && (
          <div className="text-[13px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full tabular-nums">
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col items-center justify-center">
        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {peerReady ? "Starting…" : `Waiting for ${partnerName ?? "partner"}…`}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px]">
              Keep this screen open to start the caption contest!
            </p>
          </div>
        )}

        {phase === "instructions" && currentImg && (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-4">
            {/* Guide banner */}
            <div className="w-full bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-3.5 flex gap-2.5 items-start">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-normal">
                <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
                A funny stock photo appears. Both of you get **30 seconds** to type a funny caption. Chulbul AI will also enter a caption! Then, vote on whose caption is the best.
              </div>
            </div>

            <div className="bg-card ring-1 ring-border/50 rounded-3xl p-5 w-full flex flex-col items-center shadow-sm">
              <div className="h-44 w-full rounded-2xl overflow-hidden bg-muted flex items-center justify-center mb-3">
                <img src={currentImg.url} alt="Stock Preview" className="h-full w-full object-cover" />
              </div>
              <h3 className="text-base font-bold text-foreground">Caption Challenge</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Let's see who is the meme king/queen</p>
            </div>

            <button
              onClick={handleStartPlay}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              Start Writing
            </button>
          </div>
        )}

        {phase === "writing" && currentImg && (
          <div className="w-full max-w-[340px] flex flex-col items-stretch gap-4">
            <div className="h-48 w-full rounded-3xl overflow-hidden bg-muted shadow-sm ring-1 ring-border/40">
              <img src={currentImg.url} alt="Stock Meme" className="h-full w-full object-cover" />
            </div>

            {isCaptionSubmitted ? (
              <div className="bg-card ring-1 ring-border/50 rounded-2xl p-5 text-center shadow-xs flex flex-col items-center py-8">
                <p className="text-sm font-bold text-foreground">Caption submitted! 🔒</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px] leading-relaxed">
                  "{typedCaption}"
                </p>
                <p className="text-[11px] text-primary mt-4 font-semibold animate-pulse">
                  Waiting for {partnerName ?? "partner"} to finish...
                </p>
              </div>
            ) : (
              <form onSubmit={handleCaptionSubmit} className="w-full flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={typedCaption}
                  onChange={(e) => setTypedCaption(e.target.value)}
                  placeholder="Type a funny caption..."
                  className="flex-1 py-3.5 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
                />
                <button
                  type="submit"
                  disabled={!typedCaption.trim()}
                  className="h-[48px] w-[48px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </form>
            )}
          </div>
        )}

        {phase === "voting" && currentImg && (
          <div className="w-full max-w-[340px] flex flex-col gap-4">
            <div className="h-32 w-full rounded-2xl overflow-hidden bg-muted shadow-xs">
              <img src={currentImg.url} alt="Stock Meme" className="h-full w-full object-cover" />
            </div>

            <div className="text-center">
              <h3 className="text-sm font-bold text-foreground">Vote for the funniest caption!</h3>
              <p className="text-xs text-muted-foreground">You cannot vote for your own caption</p>
            </div>

            <div className="flex flex-col gap-2.5">
              {Object.entries(captions).map(([authorId, data]) => {
                const isMine = authorId === userId;
                const votedForThis = myVote === authorId;
                
                return (
                  <button
                    key={authorId}
                    disabled={isMine || myVote !== null}
                    onClick={() => handleVoteSubmit(authorId)}
                    className={`text-left rounded-2xl p-4 transition-all ease-spring flex items-center justify-between border ${
                      votedForThis
                        ? "bg-primary/10 border-primary/20 ring-1 ring-primary/20"
                        : isMine
                        ? "bg-muted/30 border-border opacity-70 cursor-default"
                        : "bg-card border-border/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs text-muted-foreground font-bold mb-1">
                        {isMine ? "Your Caption" : data.authorName}
                      </p>
                      <p className="text-xs text-foreground font-semibold leading-relaxed">
                        "{data.text}"
                      </p>
                    </div>
                    {!isMine && myVote === null && (
                      <Heart className="h-4.5 w-4.5 text-muted-foreground hover:text-primary transition-colors shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {myVote !== null && (
              <p className="text-center text-xs text-primary font-semibold animate-pulse mt-1">
                Waiting for partner's vote...
              </p>
            )}
          </div>
        )}

        {phase === "gameover" && (
          <div className="w-full max-w-[340px] flex flex-col items-center">
            {/* Find who got how many points */}
            <GameOverCelebration
              isWinner={isWinner}
              isDraw={isDraw}
              partnerName={partnerName}
              myScore={Object.values(votes).filter(v => v === userId).length * 10}
              opponentScore={Object.values(votes).filter(v => v === opponentId).length * 10}
              onExit={onBack}
              onRematch={() => onPlayAgain(opponentId)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptionThis;
