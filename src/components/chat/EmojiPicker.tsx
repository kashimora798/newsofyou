import React, { useState, useMemo } from "react";
import { EMOJI_DATA, EMOJI_CATEGORIES } from "@/lib/emojiData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Smileys: "😀",
  People: "👋",
  Animals: "🐶",
  Food: "🍕",
  Activities: "⚽",
  Travel: "✈️",
  Objects: "📱",
  Symbols: "❤️",
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Smileys");
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recent-emojis") ?? "[]");
    } catch { return []; }
  });

  const filtered = useMemo(() => {
    if (search.trim()) {
      return EMOJI_DATA.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return EMOJI_DATA.filter((e) => e.category === activeCategory);
  }, [search, activeCategory]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    const updated = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 20);
    setRecent(updated);
    localStorage.setItem("recent-emojis", JSON.stringify(updated));
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search emojis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/50 border-0"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex px-1 gap-0.5 border-b border-border">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 py-1.5 text-center text-sm transition-colors rounded-t-md ${
                activeCategory === cat ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              {CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Recent */}
      {!search && recent.length > 0 && activeCategory === "Smileys" && (
        <div className="px-2 pt-2">
          <p className="text-[10px] text-muted-foreground mb-1">Recent</p>
          <div className="flex flex-wrap gap-0.5">
            {recent.map((emoji, i) => (
              <button
                key={`r-${i}`}
                onClick={() => handleSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji grid */}
      <div className="h-48 overflow-y-auto scrollbar-thin p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {filtered.map((item) => (
            <button
              key={item.emoji + item.name}
              onClick={() => handleSelect(item.emoji)}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-transform hover:scale-110"
              title={item.name}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
