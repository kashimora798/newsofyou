import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Trash2, X, Loader2 } from "lucide-react";
import { formatMessageTime } from "@/lib/dateUtils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import openEnvelopeVideo from "@/assets/open_envelope.webm";

export interface SavedLetter {
  messageId: string;
  content: string;
  savedAt: string;
  senderName: string;
  paperIdx?: number;
  fontIdx?: number;
  inkColor?: string | null;
  decorations?: boolean;
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

const FONTS = [
  { family: "Georgia, 'Times New Roman', serif" },
  { family: "'Palatino Linotype', 'Book Antiqua', serif" },
  { family: "system-ui, sans-serif" },
  { family: "'MyHandwriting', 'Comic Neue', cursive, sans-serif" },
];

type Phase = "list" | "playing_video" | "reading";

const LetterCollection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const partner = usePartner(user?.id);
  const [letters, setLetters] = useState<SavedLetter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("saved_letters") || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SavedLetter | null>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load all letters sent by anyone whose uid is different from the current user
  useEffect(() => {
    if (!user) return;

    const fetchLetters = async () => {
      setLoading(true);
      try {
        const deletedIds: string[] = JSON.parse(localStorage.getItem("deleted_letter_ids") || "[]");
        const deletedSet = new Set(deletedIds);

        // Fetch all messages where message_type is 'letter' and sent by someone else
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("message_type", "letter")
          .neq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const dbLetters: SavedLetter[] = data
            .filter((m) => !deletedSet.has(m.id))
            .map((m) => {
              const extras = (m as any).emoji as any;
              return {
                messageId: m.id,
                content: m.content || "",
                savedAt: m.created_at,
                senderName: m.username || partner?.name || "Partner",
                paperIdx: extras?.letter_paper ?? 0,
                fontIdx: extras?.letter_font ?? 0,
                inkColor: extras?.letter_ink ?? null,
                decorations: extras?.letter_decorations ?? false,
              };
            });

          // Merge with any cached/local letters that aren't deleted
          const localSaved: SavedLetter[] = JSON.parse(localStorage.getItem("saved_letters") || "[]");
          const seen = new Set<string>();
          const merged: SavedLetter[] = [];

          for (const l of dbLetters) {
            if (!seen.has(l.messageId)) {
              seen.add(l.messageId);
              merged.push(l);
            }
          }

          for (const l of localSaved) {
            if (!seen.has(l.messageId) && !deletedSet.has(l.messageId)) {
              seen.add(l.messageId);
              merged.push(l);
            }
          }

          setLetters(merged);
          localStorage.setItem("saved_letters", JSON.stringify(merged));
        }
      } catch (err) {
        console.error("Error loading letters:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLetters();

    // Realtime subscription for incoming letters
    const channel = supabase
      .channel(`received-letters-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.message_type === "letter" && newMsg.user_id !== user.id) {
            const deletedIds: string[] = JSON.parse(localStorage.getItem("deleted_letter_ids") || "[]");
            if (deletedIds.includes(newMsg.id)) return;

            const extras = newMsg.emoji as any;
            const newLetter: SavedLetter = {
              messageId: newMsg.id,
              content: newMsg.content || "",
              savedAt: newMsg.created_at,
              senderName: newMsg.username || partner?.name || "Partner",
              paperIdx: extras?.letter_paper ?? 0,
              fontIdx: extras?.letter_font ?? 0,
              inkColor: extras?.letter_ink ?? null,
              decorations: extras?.letter_decorations ?? false,
            };

            setLetters((prev) => {
              if (prev.some((l) => l.messageId === newLetter.messageId)) return prev;
              const updated = [newLetter, ...prev];
              localStorage.setItem("saved_letters", JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partner?.name]);

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
    try {
      const deletedIds = JSON.parse(localStorage.getItem("deleted_letter_ids") || "[]");
      if (!deletedIds.includes(messageId)) {
        deletedIds.push(messageId);
        localStorage.setItem("deleted_letter_ids", JSON.stringify(deletedIds));
      }
    } catch {}

    const updated = letters.filter((l) => l.messageId !== messageId);
    setLetters(updated);
    localStorage.setItem("saved_letters", JSON.stringify(updated));
    toast({ title: "Letter removed from collection" });
    if (selected?.messageId === messageId) handleClose();
  };

  const paper = PAPER_STYLES[selected?.paperIdx ?? 0] ?? PAPER_STYLES[0];
  const font = FONTS[selected?.fontIdx ?? 0] ?? FONTS[0];
  const textColor = selected?.inkColor || paper.text;
  const isHandwriting = selected?.fontIdx === 3;

  // Corner flourish decorations matching LetterBubble
  const Flourish = () => (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-3 left-3 text-2xl opacity-20" style={{ color: textColor }}>❧</div>
      <div className="absolute top-3 right-3 text-2xl opacity-20 scale-x-[-1]" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-3 left-3 text-2xl opacity-20 rotate-180" style={{ color: textColor }}>❧</div>
      <div className="absolute bottom-3 right-3 text-2xl opacity-20 rotate-180 scale-x-[-1]" style={{ color: textColor }}>❧</div>
    </div>
  );

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">💌 Letter Collection</h1>
          <p className="text-xs text-muted-foreground">{letters.length} letter{letters.length !== 1 ? "s" : ""} received</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      {/* Letter list */}
      <div className="flex-1 overflow-y-auto p-4">
        {letters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-6xl">💌</span>
            <h2 className="text-xl font-semibold text-foreground">No letters yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              When someone sends you a letter, it will automatically appear here with paper styling and envelope animations.
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
                      Received {new Date(letter.savedAt).toLocaleDateString()}
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
                  title="Remove from collection"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video overlay (Sealed envelope opening animation) */}
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

      {/* Letter reader modal (Exact same animation, feel, flourishes and fonts) */}
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
              <X className="h-5 w-5" style={{ color: textColor }} />
            </button>

            <div
              className={`flex-1 overflow-y-auto p-8 pt-12 relative ${isHandwriting ? "font-handwriting" : ""}`}
              style={{
                background: paper.bg,
                fontFamily: font.family,
                color: textColor,
                backgroundImage: `${paper.bg}, url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23000' fill-opacity='0.03'/%3E%3C/svg%3E")`,
              }}
            >
              {selected.decorations && <Flourish />}

              <div
                className={`text-base whitespace-pre-wrap leading-[2rem] ${isHandwriting ? "font-handwriting" : ""}`}
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
                style={{ borderColor: `${textColor}22`, animation: "letter-fade-in 1s ease-out 0.5s both" }}
              >
                <span>💌 From {selected.senderName}</span>
                <span>{new Date(selected.savedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div
              className="flex items-center gap-3 px-6 py-4"
              style={{ background: paper.bg, borderTop: `1px solid ${textColor}15` }}
            >
              <button
                onClick={handleClose}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80 active:scale-[0.97]"
                style={{ background: `${textColor}12`, color: textColor }}
              >
                Close
              </button>
              <button
                onClick={() => handleDelete(selected.messageId)}
                className="px-4 py-3 rounded-xl text-sm transition-all hover:opacity-80 active:scale-[0.97] text-destructive"
                style={{ background: `${textColor}08` }}
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
