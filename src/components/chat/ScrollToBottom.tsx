import React from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface ScrollToBottomProps {
  onClick: () => void;
  unreadCount?: number;
}

const ScrollToBottom: React.FC<ScrollToBottomProps> = ({ onClick, unreadCount }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.8, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.8, y: 10 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="absolute bottom-20 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full glass shadow-lg hover:bg-muted/60 transition-colors"
  >
    {unreadCount && unreadCount > 0 && (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-2 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1"
      >
        {unreadCount}
      </motion.span>
    )}
    <ChevronDown className="h-5 w-5 text-muted-foreground" />
  </motion.button>
);

export default ScrollToBottom;
