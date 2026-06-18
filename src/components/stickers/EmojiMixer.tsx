import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Star, X, Sparkles, Loader2 } from "lucide-react";
import { fetchMixUrl, MIXABLE_BASES } from "@/lib/emojiKitchen";
import { haptic } from "@/lib/haptics";

interface SavedMix {
  a: string;
  b: string;
  tag: string;
  url: string;
}

interface EmojiMixerProps {
  onSend: (stickerUrl: string) => void;
}

const STORE_KEY = "saved-emoji-mixes";

function loadSaved(): SavedMix[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const EMOJI_MOOD: Record<string, string> = {
  "😍": "love", "😘": "kiss", "🥰": "adore", "❤️": "love", "💔": "heartbreak",
  "😂": "laugh", "🤣": "laugh", "😭": "cry", "😢": "tear", "🥺": "plead",
  "😎": "cool", "🔥": "fire", "💯": "hundred", "✨": "sparkle", "🎉": "party",
  "🥳": "celebrate", "😈": "mischief", "🤔": "think", "👍": "yes", "💀": "dead",
  "😄": "happy", "😊": "smile", "🌸": "bloom", "🌚": "moon",
};
function suggestTag(a: string, b: string): string {
  return `${EMOJI_MOOD[a] ?? "mix"}+${EMOJI_MOOD[b] ?? "mix"}`;
}

const EmojiMixer: React.FC<EmojiMixerProps> = ({ onSend }) => {
  // Full base set — emoji-mart-style rendering means no tofu to filter out.
  const bases = useMemo(() => MIXABLE_BASES, []);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState<SavedMix[]>(loadSaved);
  const reqId = useRef(0);

  const tag = a && b ? suggestTag(a, b) : "";
  const alreadySaved = saved.some((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a));

  // Resolve the mashup whenever both slots are filled.
  useEffect(() => {
    if (!a || !b) {
      setMixUrl(null);
      setNotFound(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setNotFound(false);
    setMixUrl(null);
    fetchMixUrl(a, b).then((url) => {
      if (id !== reqId.current) return; // stale
      setLoading(false);
      if (url) setMixUrl(url);
      else setNotFound(true);
    });
  }, [a, b]);

  const persist = (next: SavedMix[]) => {
    setSaved(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const saveMix = () => {
    if (!a || !b || !mixUrl || alreadySaved) return;
    haptic.success();
    persist([{ a, b, tag, url: mixUrl }, ...saved].slice(0, 40));
  };

  const removeSaved = (m: SavedMix) => persist(saved.filter((s) => !(s.a === m.a && s.b === m.b)));

  const send = (url: string) => {
    haptic.tap();
    onSend(url);
  };

  return (
    <div className="w-full bg-card rounded-xl overflow-hidden">
      {/* Workbench */}
      <div className="p-3">
        <div className="flex items-center justify-center gap-2.5">
          <Slot emoji={a} onClear={() => { setA(null); setB(null); }} />
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slot emoji={b} onClear={() => setB(null)} disabled={!a} />
          <span className="text-muted-foreground text-sm">=</span>
          <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <Loader2 key="l" className="h-5 w-5 animate-spin text-primary" />
              ) : mixUrl ? (
                <motion.img
                  key={mixUrl}
                  src={mixUrl}
                  alt={tag}
                  initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="h-14 w-14 object-contain"
                />
              ) : notFound ? (
                <span key="nf" className="text-[9px] text-muted-foreground text-center px-1">no mix 🤷</span>
              ) : (
                <Sparkles key="s" className="h-5 w-5 text-muted-foreground/40" />
              )}
            </AnimatePresence>
          </div>
        </div>

        {mixUrl && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{tag}</span>
            <button
              onClick={saveMix}
              disabled={alreadySaved}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors ${alreadySaved ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25"}`}
            >
              <Star className={`h-3 w-3 ${alreadySaved ? "fill-current" : ""}`} /> {alreadySaved ? "Saved" : "Save"}
            </button>
            <button onClick={() => send(mixUrl)} className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full bg-primary text-primary-foreground hover:opacity-90">
              <Send className="h-3 w-3" /> Send
            </button>
          </motion.div>
        )}
        {notFound && a && b && (
          <p className="text-center text-[10px] text-muted-foreground mt-2">No mashup for these two — try a different pair ✨</p>
        )}
      </div>

      {/* Saved mixes */}
      {saved.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground mb-1.5">Saved mixes</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {saved.map((m) => (
              <div key={`${m.a}${m.b}`} className="relative shrink-0 group">
                <button onClick={() => send(m.url)} className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center hover:bg-muted transition-transform hover:scale-105" title={m.tag}>
                  <img src={m.url} alt={m.tag} className="h-10 w-10 object-contain" loading="lazy" onError={(e) => { (e.currentTarget.closest(".group") as HTMLElement).style.display = "none"; }} />
                </button>
                <button onClick={() => removeSaved(m)} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[8px] hidden group-hover:flex">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emoji selector */}
      <div className="border-t border-border/50 p-2">
        <p className="text-[10px] text-muted-foreground mb-1 px-1">{!a ? "Pick the first emoji" : `Pick one to mix with ${a}`}</p>
        <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto scrollbar-thin emoji-font">
          {bases.map((e) => (
            <button
              key={e}
              onClick={() => { haptic.tap(); if (!a) setA(e); else setB(e); }}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-transform hover:scale-110"
            >
              {e}
            </button>
          ))}
        </div>
        {a && (
          <button onClick={() => { setA(null); setB(null); }} className="mt-1.5 text-[10px] text-primary px-1">← Start over</button>
        )}
      </div>
    </div>
  );
};

const Slot: React.FC<{ emoji: string | null; onClear: () => void; disabled?: boolean }> = ({ emoji, onClear, disabled }) => (
  <button
    onClick={emoji ? onClear : undefined}
    disabled={disabled}
    className={`h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-colors ${disabled ? "bg-muted/20 opacity-40" : "bg-muted/40 hover:bg-muted/60"}`}
  >
    {emoji ?? <span className="text-muted-foreground/40 text-xl">?</span>}
  </button>
);

export default EmojiMixer;
