import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TOUCH_EMOTIONS, type TouchEmotion } from "./TouchReactionOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CustomReaction } from "@/pages/CustomTouchReactions";

interface TouchReactionPickerProps {
  onSelect: (emotion: TouchEmotion) => void;
  onSelectCustom?: (reaction: CustomReaction) => void;
}

const CATEGORIES: { key: string; label: string; icon: string; emotions: TouchEmotion[] }[] = [
  { key: "love",    label: "Love",    icon: "❤️", emotions: ["hug", "love", "cuddle", "miss_you", "rose", "kiss"] },
  { key: "energy",  label: "Energy",  icon: "⚡", emotions: ["celebrate", "proud", "fire", "high_five", "cheer"] },
  { key: "comfort", label: "Comfort", icon: "💙", emotions: ["tears", "comfort", "goodnight", "good_morning"] },
  { key: "playful", label: "Playful", icon: "😜", emotions: ["lol", "boo", "magic", "poke"] },
  { key: "vibes",   label: "Vibes",   icon: "✨", emotions: ["blush", "sleepy", "butterfly"] },
];

const TouchReactionPicker: React.FC<TouchReactionPickerProps> = ({ onSelect, onSelectCustom }) => {
  const { user } = useAuth();
  const [customReactions, setCustomReactions] = useState<CustomReaction[]>([]);
  const [activeTab, setActiveTab] = useState("love");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("custom_touch_reactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setCustomReactions((data as any) ?? []);
    };
    fetch();
  }, [user]);

  const activeCat = CATEGORIES.find((c) => c.key === activeTab);
  const showCustom = activeTab === "custom";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="border border-border/50 rounded-2xl shadow-xl overflow-hidden"
      style={{
        background: "hsl(var(--card) / 0.85)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Category tabs — horizontal scroll */}
      <div className="flex gap-1 p-2 pb-1 overflow-x-auto scrollbar-none border-b border-border/30">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200
              ${activeTab === cat.key
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted/60"
              }`}
          >
            <span className="text-sm">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
        {customReactions.length > 0 && (
          <button
            onClick={() => setActiveTab("custom")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200
              ${activeTab === "custom"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted/60"
              }`}
          >
            <span className="text-sm">🎨</span>
            Custom
          </button>
        )}
      </div>

      {/* Reaction grid */}
      <div className="p-2 max-h-[220px] overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-4 gap-1"
          >
            {!showCustom && activeCat?.emotions.map((key, i) => {
              const e = TOUCH_EMOTIONS[key];
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  onClick={() => onSelect(key)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl
                    hover:bg-muted/70 active:scale-90 transition-all duration-150
                    group relative"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-150">{e.emoji}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight font-medium">{e.label}</span>
                  {/* Hover tooltip with verb */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md
                    bg-foreground text-background text-[9px] font-medium whitespace-nowrap
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none
                    shadow-lg">
                    {e.verb}
                  </div>
                </motion.button>
              );
            })}

            {showCustom && customReactions.map((r, i) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => onSelectCustom?.(r)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl
                  hover:bg-muted/70 active:scale-90 transition-all duration-150"
              >
                {r.emoji?.startsWith("http") ? (
                  <img src={r.emoji} alt={r.label} className="h-8 w-8 object-contain" />
                ) : (
                  <span className="text-3xl">{r.emoji}</span>
                )}
                <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-full font-medium">{r.label}</span>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TouchReactionPicker;
