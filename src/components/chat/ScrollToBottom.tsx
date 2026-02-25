import React from "react";
import { ChevronDown } from "lucide-react";

interface ScrollToBottomProps {
  onClick: () => void;
  unreadCount?: number;
}

const ScrollToBottom: React.FC<ScrollToBottomProps> = ({ onClick, unreadCount }) => (
  <button
    onClick={onClick}
    className="absolute bottom-20 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg border border-border hover:bg-muted transition-all animate-fade-in"
  >
    {unreadCount && unreadCount > 0 && (
      <span className="absolute -top-2 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
        {unreadCount}
      </span>
    )}
    <ChevronDown className="h-5 w-5 text-muted-foreground" />
  </button>
);

export default ScrollToBottom;
