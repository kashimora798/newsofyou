import React from "react";
import { X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface ReplyPreviewProps {
  message: Tables<"messages">;
  onCancel: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border-t border-border animate-fade-in">
      <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary">{message.username ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {message.content || (message.image_url ? "📷 Photo" : message.video ? "🎥 Video" : "Message")}
        </p>
      </div>
      <button onClick={onCancel} className="p-1 rounded-full hover:bg-muted transition-colors shrink-0">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default ReplyPreview;
