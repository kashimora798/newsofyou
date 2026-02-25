import React, { useState } from "react";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";
import StickerPicker from "./StickerPicker";

interface MediaPanelProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect: (stickerUrl: string) => void;
}

const TABS = ["Emoji", "GIF", "Stickers"] as const;

const MediaPanel: React.FC<MediaPanelProps> = ({ onEmojiSelect, onGifSelect, onStickerSelect }) => {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Emoji");

  return (
    <div className="animate-slide-up">
      {/* Tab bar */}
      <div className="flex gap-0.5 px-3 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-card text-foreground border border-b-0 border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "Emoji" && <EmojiPicker onSelect={onEmojiSelect} />}
      {activeTab === "GIF" && <GifPicker onSelect={onGifSelect} />}
      {activeTab === "Stickers" && <StickerPicker onSelect={onStickerSelect} />}
    </div>
  );
};

export default MediaPanel;
