import React, { useState } from "react";
import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import { formatMessageTime } from "@/lib/dateUtils";
import type { Tables } from "@/integrations/supabase/types";

interface PinnedMessagesBarProps {
  pinnedMessages: Array<{
    id: string;
    message_id: string;
    pinned_by: string;
    message?: Tables<"messages"> | null;
  }>;
  onScrollToMessage: (id: string) => void;
  onUnpin: (messageId: string) => void;
  currentUserId: string;
}

const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({
  pinnedMessages, onScrollToMessage, onUnpin, currentUserId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (pinnedMessages.length === 0) return null;

  const current = pinnedMessages[currentIndex];
  if (!current?.message) return null;

  const cycleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border-b border-border px-3 py-2 shrink-0">
      <div className="flex items-center gap-2">
        <Pin className="h-3.5 w-3.5 text-primary shrink-0 rotate-45" />
        
        <button
          onClick={() => {
            onScrollToMessage(current.message_id);
            if (pinnedMessages.length > 1) cycleNext();
          }}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-[10px] text-primary font-semibold">
            Pinned Message {pinnedMessages.length > 1 ? `${currentIndex + 1}/${pinnedMessages.length}` : ""}
          </p>
          <p className="text-xs text-foreground truncate">
            {current.message?.content || "📎 Attachment"}
          </p>
        </button>

        {expanded && pinnedMessages.length > 1 && (
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="p-0.5 rounded hover:bg-muted">
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            </button>
            <button onClick={() => setCurrentIndex(Math.min(pinnedMessages.length - 1, currentIndex + 1))} className="p-0.5 rounded hover:bg-muted">
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {current.pinned_by === currentUserId && (
          <button
            onClick={() => onUnpin(current.message_id)}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            title="Unpin"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PinnedMessagesBar;
