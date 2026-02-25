import React, { useState, useEffect } from "react";
import { TOUCH_EMOTIONS, type TouchEmotion } from "./TouchReactionOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CustomReaction } from "@/pages/CustomTouchReactions";

interface TouchReactionPickerProps {
  onSelect: (emotion: TouchEmotion) => void;
  onSelectCustom?: (reaction: CustomReaction) => void;
}

const CATEGORIES: { label: string; emotions: TouchEmotion[] }[] = [
  { label: "Love", emotions: ["hug", "love", "cuddle", "miss_you", "rose"] },
  { label: "Celebration", emotions: ["celebrate", "proud", "fire"] },
  { label: "Comfort", emotions: ["tears", "comfort", "goodnight", "good_morning"] },
  { label: "Fun", emotions: ["lol", "boo", "magic"] },
];

const TouchReactionPicker: React.FC<TouchReactionPickerProps> = ({ onSelect, onSelectCustom }) => {
  const { user } = useAuth();
  const [customReactions, setCustomReactions] = useState<CustomReaction[]>([]);

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

  return (
    <div className="bg-card border border-border rounded-2xl p-3 shadow-lg animate-scale-in max-h-[300px] overflow-y-auto scrollbar-thin">
      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="mb-2 last:mb-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{cat.label}</p>
          <div className="grid grid-cols-5 gap-1">
            {cat.emotions.map((key) => {
              const e = TOUCH_EMOTIONS[key];
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl hover:bg-muted/70 active:scale-95 transition-all"
                >
                  <span className="text-2xl">{e.emoji}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom reactions */}
      {customReactions.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Custom</p>
          <div className="grid grid-cols-5 gap-1">
            {customReactions.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectCustom?.(r)}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl hover:bg-muted/70 active:scale-95 transition-all"
              >
                {r.emoji?.startsWith("http") ? (
                  <img src={r.emoji} alt={r.label} className="h-7 w-7 object-contain" />
                ) : (
                  <span className="text-2xl">{r.emoji}</span>
                )}
                <span className="text-[9px] text-muted-foreground leading-tight truncate max-w-full">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TouchReactionPicker;
