import React from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";

interface TypingIndicatorProps {
  themeText?: string;
  isRecording?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ themeText, isRecording }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="flex justify-start"
  >
    <div className="bg-bubble-partner rounded-2xl rounded-bl-sm px-4 py-2.5 bubble-shadow-partner">
      {isRecording ? (
        <div className="flex items-center gap-2 text-rose-500 font-medium text-xs">
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <Mic className="h-3.5 w-3.5 text-rose-500" />
          </motion.div>
          <span className="text-xs text-foreground/80 font-medium">recording audio...</span>
          <div className="flex gap-0.5 items-center h-3">
            {[0.4, 0.9, 0.6, 1, 0.5].map((h, i) => (
              <motion.span
                key={i}
                className="w-1 bg-rose-500 rounded-full"
                animate={{ scaleY: [0.3, h, 0.3] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                style={{ height: "100%" }}
              />
            ))}
          </div>
        </div>
      ) : themeText && themeText !== "typing..." ? (
        <p className="text-xs text-muted-foreground font-medium theme-typing-text">{themeText}</p>
      ) : (
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[7px] w-[7px] rounded-full bg-muted-foreground/50"
              style={{ animation: `typing-dot 1.4s infinite ${i * 0.2}s` }}
            />
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

export default TypingIndicator;
