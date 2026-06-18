import React from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

/**
 * emoji-mart picker with NATIVE rendering — uses the device's own colour-emoji
 * font, so there are no remote sprite-sheet downloads (the "apple" set was
 * loading hundreds of CDN images → "#" placeholders + lag). Native is instant
 * and smooth, with emoji-mart's search / categories / recents / skin tones.
 */
const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  return (
    <div className="emoji-mart-wrap w-full flex justify-center">
      <Picker
        data={data}
        onEmojiSelect={(e: any) => onSelect(e.native)}
        set="native"
        theme="auto"
        previewPosition="none"
        skinTonePosition="search"
        navPosition="top"
        perLine={8}
        maxFrequentRows={2}
        emojiButtonSize={34}
        emojiSize={24}
      />
    </div>
  );
};

export default EmojiPicker;
