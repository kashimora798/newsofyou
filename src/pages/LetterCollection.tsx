import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Trash2, X } from "lucide-react";
import { formatMessageTime } from "@/lib/dateUtils";
import { toast } from "@/hooks/use-toast";
import openEnvelopeVideo from "@/assets/open_envelope.webm";

interface SavedLetter {
  messageId: string;
  content: string;
  savedAt: string;
  senderName: string;
}

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

type Phase = "list" | "playing_video" | "reading";

const LetterCollection: React.FC = () => {
  const navigate = useNavigate();
  const [letters, setLetters] = useState<SavedLetter[]>([]);
  const [selected, setSelected] = useState<SavedLetter | null>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("saved_letters") || "[]");
      setLetters(saved);
    } catch {
      setLetters([]);
    }
  }, []);

  const handleOpen = (letter: SavedLetter) => {
    setSelected(letter);
    setPhase("playing_video");
  };

  const handleVideoEnd = () => setPhase("reading");

  const handleClose = () => {
    setPhase("list");
    setSelected(null);
  };

  const handleDelete = (messageId: string) => {
    const updated = letters.filter((l) => l.messageId !== messageId);
    setLetters(updated);
    localStorage.setItem("saved_letters", JSON.stringify(updated));
    toast({ title: "Letter removed from collection" });
    if (selected?.messageId === messageId) handleClose();
  };

  const paper = PAPER_STYLES[0]; // Default parchment for saved letters

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">💌 Letter Collection</h1>
          <p className="text-xs text-muted-foreground">{letters.length} letter{letters.length !== 1 ? "s" : ""} saved</p>
        </div>
      </header>

      {/* Letter list */}
      <div className="flex-1 overflow-y-auto p-4">
        {letters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-6xl">💌</span>
            <h2 className="text-xl font-semibold text-foreground">No letters yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              When you receive a letter, tap "Keep it Safe" to save it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {letters.map((letter) => (
              <button
                key={letter.messageId}
                onClick={() => handleOpen(letter)}
                className="group relative w-full text-left rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
                      From {letter.senderName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Saved {new Date(letter.savedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {letter.content}
                    </p>
                  </div>
                  <span className="text-2xl shrink-0">💌</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(letter.messageId); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video overlay */}
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

      {/* Letter reader */}
      {phase === "reading" && selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", animation: "letter-overlay-in 0.3s ease-out" }}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ animation: "letter-paper-unfold 0.5s ease-out" }}
          >
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors"
            >
              <X className="h-5 w-5" style={{ color: paper.text }} />
            </button>

            <div
              className="flex-1 overflow-y-auto p-8 pt-12 relative"
              style={{
                background: paper.bg,
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: paper.text,
              }}
            >
              <div
                className="text-base whitespace-pre-wrap leading-[2rem]"
                style={{
                  backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(0,0,0,0.05) 31px, rgba(0,0,0,0.05) 32px)",
                  lineHeight: "2rem",
                  animation: "letter-fade-in 0.8s ease-out 0.2s both",
                }}
              >
                {selected.content}
              </div>

              <div
                className="mt-6 pt-4 border-t flex items-center justify-between text-xs opacity-60"
                style={{ borderColor: `${paper.text}22`, animation: "letter-fade-in 1s ease-out 0.5s both" }}
              >
                <span>💌 From {selected.senderName}</span>
                <span>Saved {new Date(selected.savedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div
              className="flex items-center gap-3 px-6 py-4"
              style={{ background: paper.bg, borderTop: `1px solid ${paper.text}15` }}
            >
              <button
                onClick={handleClose}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80 active:scale-[0.97]"
                style={{ background: `${paper.text}12`, color: paper.text }}
              >
                Close
              </button>
              <button
                onClick={() => handleDelete(selected.messageId)}
                className="px-4 py-3 rounded-xl text-sm transition-all hover:opacity-80 active:scale-[0.97] text-destructive"
                style={{ background: `${paper.text}08` }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LetterCollection;
