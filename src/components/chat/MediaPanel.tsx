import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";
import StickerPicker from "./StickerPicker";
import EmojiMixer from "../stickers/EmojiMixer";
import AiStickerStudio from "../stickers/AiStickerStudio";
import { notoAnimatedUrl } from "@/lib/notoSticker";
import { detectMood } from "@/lib/moodSuggest";
import { haptic } from "@/lib/haptics";

interface MediaPanelProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect: (stickerUrl: string) => void;
  onVideoSelect?: (videoUrl: string) => void;
  /** the user's current draft, used for the (local, instant) mood suggestion */
  draft?: string;
}

const TABS = ["Emoji", "Stickers", "Mix", "AI", "GIF"] as const;

const MediaPanel: React.FC<MediaPanelProps> = ({ onEmojiSelect, onGifSelect, onStickerSelect, onVideoSelect, draft }) => {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Emoji");

  // Mood suggestion chip — fully local + instant (no network, no 404).
  const suggest = useMemo(() => detectMood(draft ?? ""), [draft]);

  return (
    <div className="animate-slide-up">
      {/* Mood suggestion chip */}
      {suggest && (
        <div className="px-3 pb-1.5 flex items-center gap-2">
          <span className="text-[11px] text-primary font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Feeling {suggest.emotion}?
          </span>
          {suggest.emojis.map((e) => (
            <button
              key={e}
              onClick={() => {
                haptic.tap();
                onStickerSelect(notoAnimatedUrl(e));
              }}
              className="h-8 w-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-lg transition-transform hover:scale-110"
              title="Send as sticker"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Tab bar — segmented pill control */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
        <div className="flex gap-0.5 rounded-full bg-muted/60 p-0.5 mx-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1 ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "AI" && <Sparkles className="h-3 w-3" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "Emoji" && <EmojiPicker onSelect={onEmojiSelect} />}
      {activeTab === "Stickers" && <StickerPicker onSelect={onStickerSelect} />}
      {activeTab === "Mix" && <EmojiMixer onSend={onStickerSelect} />}
      {activeTab === "AI" && (
        <AiStickerStudio
          onSend={(url, kind) =>
            kind === "video" ? (onVideoSelect ?? onGifSelect)(url) : onStickerSelect(url)
          }
        />
      )}
      {activeTab === "GIF" && <GifPicker onSelect={onGifSelect} />}
    </div>
  );
};

export default MediaPanel;
