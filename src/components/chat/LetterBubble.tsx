import React, { useState, useRef } from "react";
import { Check, CheckCheck, X, Heart, Bookmark } from "lucide-react";
import { formatMessageTime } from "@/lib/dateUtils";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import openEnvelopeVideo from "@/assets/open_envelope.webm";

const PAPER_STYLES = [
  { label: "Parchment", bg: "linear-gradient(to bottom, #f5f0e8, #ede4d3)", text: "hsl(30,20%,20%)" },
  { label: "Rose", bg: "linear-gradient(to bottom, #fce4ec, #f8bbd0)", text: "hsl(340,30%,25%)" },
  { label: "Midnight", bg: "linear-gradient(to bottom, #1a1a2e, #16213e)", text: "hsl(0,0%,90%)" },
  { label: "Ocean", bg: "linear-gradient(to bottom, #e0f7fa, #b2ebf2)", text: "hsl(187,30%,20%)" },
  { label: "Lavender", bg: "linear-gradient(to bottom, #e8d5f5, #d1b3e8)", text: "hsl(275,25%,22%)" },
  { label: "Sunset", bg: "linear-gradient(to bottom, #fde1c8, #f5a0a0)", text: "hsl(15,30%,22%)" },
  { label: "Forest", bg: "linear-gradient(to bottom, #c8e6c9, #81c784)", text: "hsl(125,25%,18%)" },
  { label: "Starlight", bg: "linear-gradient(to bottom, #1a1a3e, #2d2d5e)", text: "hsl(240,20%,88%)" },
];

const FONTS = [
  { family: "Georgia, 'Times New Roman', serif" },
  { family: "'Palatino Linotype', 'Book Antiqua', serif" },
  { family: "system-ui, sans-serif" },
];

type Phase = "sealed" | "playing_video" | "reading";

interface LetterBubbleProps {
  message: Tables<"messages">;
  isOwn: boolean;
}

const LetterBubble: React.FC<LetterBubbleProps> = ({ message, isOwn }) => {
  const [phase, setPhase] = useState<Phase>("sealed");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Extract styling metadata from message extras
  const extras = (message as any).emoji as any;
  const paperIdx = extras?.letter_paper ?? 0;
  const fontIdx = extras?.letter_font ?? 0;
  const inkColor = extras?.letter_ink ?? null;
  const decorations = extras?.letter_decorations ?? false;

  const paper = PAPER_STYLES[paperIdx] ?? PAPER_STYLES[0];
  const font = FONTS[fontIdx] ?? FONTS[0];
  const textColor = inkColor || paper.text;

  const handleOpen = () => {
    setPhase("playing_video");
  };

  const handleVideoEnd = () => {
    setPhase("reading");
  };

  const handleClose = () => {
    setPhase("sealed");
  };

  const handleKeepSafe = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("saved_letters") || "[]");
      const already = saved.some((s: any) => s.messageId === message.id);
      if (already) {
        toast({ title: "💌 Already saved!", description: "This letter is already in your collection." });
        return;
      }
      saved.push({
        messageId: message.id,
        content: message.content,
        savedAt: new Date().toISOString(),
        senderName: message.username ?? "Unknown",
      });
      localStorage.setItem("saved_letters", JSON.stringify(saved));
      toast({ title: "💕 Letter kept safe!", description: "Saved to your letter collection." });
    } catch {
      toast({ title: "Could not save letter", variant: "destructive" });
    }
  };

  // Corner flourish decorations
  const Flourish = () => (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-3 left-3 text-2xl opacity-20" style={{ color: textColor }}>❧</div>
      <div className="absolute top-3 right-3 text-2xl opacity-20 scale-x-[-1]" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-3 left-3 text-2xl opacity-20 rotate-180" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-3 right-3 text-2xl opacity-20 rotate-180 scale-x-[-1]" style={{ color: textColor }}>❧</div>
    </div>
  );

  return (
    <>
      {/* Phase 1: Sealed Envelope in chat */}
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}>
        <button
          onClick={handleOpen}
          className="relative group cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          <div
            className="w-52 h-32 rounded-xl relative overflow-hidden shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(25,60%,85%), hsl(30,50%,75%))",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-14 origin-bottom transition-transform duration-500 group-hover:-translate-y-1"
              style={{
                background: "linear-gradient(180deg, hsl(25,55%,78%), hsl(25,60%,85%))",
                clipPath: "polygon(0 0, 50% 100%, 100% 0)",
              }}
            />
            <div
              className="absolute top-6 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-md z-10"
              style={{ background: "radial-gradient(circle, hsl(0,65%,45%), hsl(0,65%,35%))" }}
            >
              💌
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <p className="text-[10px] font-medium" style={{ color: "hsl(30,30%,35%)" }}>
                Tap to open letter
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.created_at ?? "")}</span>
            {isOwn && (
              <span className="inline-flex">
                {message.seen ? <CheckCheck className="h-3.5 w-3.5 text-seen" /> : message.delivered ? <CheckCheck className="h-3.5 w-3.5 opacity-50" /> : <Check className="h-3.5 w-3.5 opacity-50" />}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Phase 2: Full-screen video overlay */}
      {phase === "playing_video" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          style={{ animation: "letter-overlay-in 0.4s ease-out" }}
        >
          <video
            ref={videoRef}
            src={openEnvelopeVideo}
            autoPlay
            playsInline
            muted
            onEnded={handleVideoEnd}
            className="w-[75vw] h-[75vh] object-contain rounded-2xl"
          />
          <button
            onClick={() => setPhase("reading")}
            className="absolute bottom-8 text-white/50 text-xs animate-pulse"
          >
            Tap to skip
          </button>
        </div>
      )}

      {/* Phase 3: Full-screen letter reader */}
      {phase === "reading" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.85)",
            animation: "letter-overlay-in 0.3s ease-out",
          }}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ animation: "letter-paper-unfold 0.5s ease-out" }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors"
            >
              <X className="h-5 w-5" style={{ color: textColor }} />
            </button>

            {/* Letter content */}
            <div
              className="flex-1 overflow-y-auto p-8 pt-12 relative"
              style={{
                background: paper.bg,
                fontFamily: font.family,
                color: textColor,
                backgroundImage: `${paper.bg}, url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23000' fill-opacity='0.03'/%3E%3C/svg%3E")`,
              }}
            >
              {decorations && <Flourish />}

              <div
                className="text-base whitespace-pre-wrap leading-[2rem]"
                style={{
                  backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(0,0,0,0.05) 31px, rgba(0,0,0,0.05) 32px)",
                  lineHeight: "2rem",
                  animation: "letter-fade-in 0.8s ease-out 0.2s both",
                }}
              >
                {message.content}
              </div>

              {/* Timestamp & sender */}
              <div
                className="mt-6 pt-4 border-t flex items-center justify-between text-xs opacity-60"
                style={{ borderColor: `${textColor}22`, animation: "letter-fade-in 1s ease-out 0.5s both" }}
              >
                <span>💌 From {message.username ?? "Unknown"}</span>
                <span>{formatMessageTime(message.created_at ?? "")}</span>
              </div>
            </div>

            {/* Bottom actions */}
            <div
              className="flex items-center gap-3 px-6 py-4"
              style={{
                background: paper.bg,
                borderTop: `1px solid ${textColor}15`,
                animation: "letter-fade-in 0.8s ease-out 0.6s both",
              }}
            >
              <button
                onClick={handleKeepSafe}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80 active:scale-[0.97]"
                style={{
                  background: `${textColor}12`,
                  color: textColor,
                }}
              >
                <Heart className="h-4 w-4" />
                Keep it Safe 💕
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-3 rounded-xl text-sm transition-all hover:opacity-80 active:scale-[0.97]"
                style={{
                  background: `${textColor}08`,
                  color: textColor,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LetterBubble;
