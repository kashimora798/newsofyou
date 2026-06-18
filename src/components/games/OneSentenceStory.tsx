import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Sparkles, HelpCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { aiAsk } from "@/lib/aiGame";
import type { GameSession } from "@/hooks/useGameSessions";

interface Props {
  session: GameSession;
  userId: string;
  partnerName?: string;
  onMakeMove: (sessionId: string, boardState: any, nextTurn: string, winnerId?: string | null, isDraw?: boolean) => void;
  onBack: () => void;
  onPlayAgain: (opponentId: string) => void;
}

interface StoryState {
  story: string[];
  phase: "writing" | "completed";
  requiredWords: string[];
  aiRecap?: string | null;
}

const DEFAULT_REQUIRED_WORDS = ["samosa", "bts", "autorickshaw"];

const OneSentenceStory: React.FC<Props> = ({ session, userId, partnerName, onMakeMove, onBack, onPlayAgain }) => {
  const [game, setGame] = useState(session);
  const [state, setState] = useState<StoryState>(() => {
    const raw = session.board_state as any;
    return {
      story: raw?.story ?? [],
      phase: raw?.phase ?? "writing",
      requiredWords: raw?.requiredWords ?? DEFAULT_REQUIRED_WORDS,
      aiRecap: raw?.aiRecap ?? null,
    };
  });
  const [inputText, setInputText] = useState("");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const opponentId = game.created_by === userId ? game.opponent_id : game.created_by;
  const isMyTurn = game.current_turn === userId && state.phase === "writing";
  const storyLength = state.story.length;

  // Check if a required word applies for the current sentence (0-indexed turns)
  // Turn 3 (index 2) -> word 1
  // Turn 6 (index 5) -> word 2
  // Turn 9 (index 8) -> word 3
  const getRequiredWordForIndex = (index: number): string | null => {
    if (index === 2) return state.requiredWords[0] || "samosa";
    if (index === 5) return state.requiredWords[1] || "bts";
    if (index === 8) return state.requiredWords[2] || "autorickshaw";
    return null;
  };

  const currentRequiredWord = getRequiredWordForIndex(storyLength);

  // Realtime subscription for DB updates
  useEffect(() => {
    const channel = supabase
      .channel(`game_story_${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const d = payload.new as any;
          setGame((prev) => ({ ...prev, ...d, board_state: d.board_state }));
          const raw = d.board_state as any;
          setState({
            story: raw?.story ?? [],
            phase: raw?.phase ?? "writing",
            requiredWords: raw?.requiredWords ?? DEFAULT_REQUIRED_WORDS,
            aiRecap: raw?.aiRecap ?? null,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isMyTurn || !inputText.trim()) return;

    const sentence = inputText.trim();

    // Word validation
    if (currentRequiredWord) {
      const cleanWord = currentRequiredWord.toLowerCase();
      const cleanSentence = sentence.toLowerCase();
      
      // Match word boundaries or substring if it contains spaces
      const includesWord = cleanSentence.includes(cleanWord);
      if (!includesWord) {
        setAlertMsg(`You must include the word "${currentRequiredWord}" in your sentence!`);
        setTimeout(() => setAlertMsg(null), 3000);
        return;
      }
    }

    const nextStory = [...state.story, sentence];
    const isCompleted = nextStory.length >= 9;
    
    let nextPhase: "writing" | "completed" = isCompleted ? "completed" : "writing";
    let recap: string | null = null;

    if (isCompleted) {
      setAiLoading(true);
      const completeStoryText = nextStory.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const prompt = `You are a funny, witty Indian teenager AI. Read this complete story written line-by-line by two teens:
"${completeStoryText}"
Give a very short, hilariously sarcastic review/summary (max 3 sentences) in Hinglish/Indian English slang. Focus on the chaotic inclusion of words like ${state.requiredWords.join(", ")}. Avoid vulgarity. Keep it clean and wholesomely funny.`;

      // Call AI edge function
      const aiResponse = await aiAsk(prompt, { temperature: 0.8 });
      recap = aiResponse || "This story was an absolute rollercoaster! From random words to wild plots, Shakespeare is shaking in his grave. 🎭✨";
      setAiLoading(false);
    }

    const nextBoardState: StoryState = {
      story: nextStory,
      phase: nextPhase,
      requiredWords: state.requiredWords,
      aiRecap: recap
    };

    setState(nextBoardState);
    setInputText("");
    
    // Trigger onMakeMove to update DB
    // Turn alternate: creator to opponent, opponent to creator. If completed, doesn't matter who turn is next.
    onMakeMove(
      session.id,
      nextBoardState,
      opponentId,
      isCompleted ? userId : null, // creator gets crown/win indicator or just finishes
      isCompleted // Draw since there are no losers in a story battle
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
          <h2 className="text-[16px] font-bold text-foreground truncate tracking-tight">Story Battle 📖</h2>
          <p className="text-[12px] text-muted-foreground truncate">
            {state.phase === "completed" ? "Story Completed!" : `Sentence ${storyLength + 1} of 9 · vs ${partnerName ?? "Partner"}`}
          </p>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center">
        {state.story.length === 0 && state.phase === "writing" && (
          <div className="w-full max-w-[340px] bg-primary/5 ring-1 ring-primary/10 rounded-2xl p-4 flex gap-2.5 items-start mb-4">
            <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-foreground leading-normal">
              <p className="font-bold mb-0.5 text-primary text-[13px]">How to Play</p>
              Write a story line-by-line, taking turns. Every **3rd turn** (turns 3, 6, and 9) has a **required word** that MUST be included in the sentence! No winner or loser — just chaotic fun.
            </div>
          </div>
        )}

        {/* Story Display Board */}
        <div className="w-full max-w-[340px] flex-1 bg-card ring-1 ring-border/50 rounded-3xl p-5 shadow-xs flex flex-col justify-between overflow-hidden min-h-[300px]">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {state.story.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground text-xs gap-2">
                <span className="text-3xl">✍️</span>
                <p>Start the story with one creative sentence!</p>
              </div>
            ) : (
              state.story.map((line, i) => {
                const isMyLine = (i % 2 === 0 && game.created_by === userId) || (i % 2 !== 0 && game.created_by !== userId);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMyLine ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[9px] text-muted-foreground uppercase font-bold px-1 mb-0.5">
                      {isMyLine ? "You" : partnerName ?? "Partner"}
                    </span>
                    <p className={`text-xs px-3.5 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      isMyLine ? "bg-primary text-primary-foreground bubble-shadow-own" : "bg-muted text-foreground"
                    }`}>
                      {line}
                    </p>
                  </motion.div>
                );
              })
            )}

            {/* AI Loading state */}
            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium py-3 justify-center border-t border-dashed mt-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating funny AI story review...
              </div>
            )}

            {/* AI Recap display */}
            {state.phase === "completed" && state.aiRecap && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 border-t border-dashed pt-5 flex flex-col gap-2 bg-primary/5 rounded-2xl p-4 ring-1 ring-primary/10"
              >
                <span className="text-[10px] text-primary uppercase font-black tracking-wider flex items-center gap-1.5 leading-none">
                  <Sparkles className="h-3.5 w-3.5" /> AI Story Review
                </span>
                <p className="text-xs text-foreground italic leading-relaxed">
                  "{state.aiRecap}"
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input area */}
        {state.phase === "writing" && (
          <div className="w-full max-w-[340px] mt-4 shrink-0">
            {isMyTurn ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 w-full">
                {currentRequiredWord && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl px-3.5 py-2 text-[11px] font-bold flex items-center gap-1.5">
                    💡 Required word: <strong className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider">{currentRequiredWord}</strong>
                  </div>
                )}
                {alertMsg && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-3.5 py-2 text-[11px] font-bold">
                    ⚠️ {alertMsg}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Write the next sentence..."
                    className="flex-1 py-3 px-4 rounded-xl bg-card border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/45 font-semibold text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="h-[46px] w-[46px] bg-primary text-primary-foreground flex items-center justify-center rounded-xl disabled:opacity-50 transition-all shrink-0 shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 bg-muted/30 rounded-2xl border border-dashed text-xs text-muted-foreground">
                Waiting for {partnerName ?? "partner"} to write their turn... ✍️
              </div>
            )}
          </div>
        )}

        {state.phase === "completed" && (
          <div className="w-full max-w-[340px] mt-4 shrink-0 flex gap-2">
            <button
              onClick={onBack}
              className="flex-1 py-3.5 bg-muted/80 text-foreground font-semibold rounded-2xl hover:bg-muted transition-all text-xs"
            >
              Back to Lobby
            </button>
            <button
              onClick={() => onPlayAgain(opponentId)}
              className="flex-1 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl hover:opacity-95 transition-all text-xs shadow-sm"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OneSentenceStory;
