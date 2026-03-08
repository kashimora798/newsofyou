import React from "react";
import { motion } from "framer-motion";

interface TypingIndicatorProps {
  themeText?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ themeText }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="flex justify-start"
  >
    <div className="bg-bubble-partner rounded-2xl rounded-bl-sm px-4 py-3 bubble-shadow-partner">
      {themeText && themeText !== "typing..." ? (
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
