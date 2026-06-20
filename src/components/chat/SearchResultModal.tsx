import React from "react";
import { X, FileText, Download, CornerDownRight, Play } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatFullDate } from "@/lib/dateUtils";
import { formatMessageContent } from "@/lib/formatMessage";
import LinkPreview from "./LinkPreview";
import type { Tables } from "@/integrations/supabase/types";

interface SearchResultModalProps {
  message: Tables<"messages">;
  isOwn: boolean;
  partnerName?: string | null;
  partnerAvatar?: string | null;
  currentUserName?: string | null;
  currentUserAvatar?: string | null;
  onClose: () => void;
  onJumpToMessage: (id: string) => void;
  onOpenMedia: (src: string, type: "image" | "video") => void;
}

const SearchResultModal: React.FC<SearchResultModalProps> = ({
  message, isOwn, partnerName, partnerAvatar, currentUserName, currentUserAvatar,
  onClose, onJumpToMessage, onOpenMedia,
}) => {
  const m = message as any;
  const name = isOwn ? (currentUserName ?? "You") : (message.username ?? partnerName ?? "Partner");
  const avatar = isOwn ? currentUserAvatar : partnerAvatar;
  const hasLink = message.link_preview_active && (message.link_title || message.link_description);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif" }}
    >
      {/* Dimmed + blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-apple-backdrop"
        onClick={onClose}
      />

      {/* Sheet (mobile) / modal (desktop) */}
      <div
        className="relative w-full sm:max-w-md max-h-[85vh] flex flex-col bg-card rounded-t-[28px] sm:rounded-[24px] overflow-hidden ring-1 ring-border/50 shadow-[0_12px_40px_rgba(0,0,0,0.18)] animate-apple-sheet sm:animate-apple-modal"
      >
        {/* Grabber (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-9 rounded-full bg-foreground/15" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-3 pb-3 border-b border-border/50">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar ?? ""} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate leading-tight">{name}</p>
            <p className="text-[12px] text-muted-foreground truncate">
              {formatFullDate(message.created_at ?? "")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/70 hover:bg-muted text-muted-foreground tappable"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Body — the complete message */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-3">
          {/* GIF */}
          {(m.gif_url || m.message_type === "gif") && m.gif_url && (
            <img src={m.gif_url} alt="GIF" className="rounded-2xl w-full max-h-[50vh] object-contain bg-muted/30" />
          )}

          {/* Sticker */}
          {(m.sticker_url || m.message_type === "sticker") && m.sticker_url && (
            <img src={m.sticker_url} alt="sticker" className="w-40 h-auto mx-auto" />
          )}

          {/* Image */}
          {message.image_url && (
            <button
              onClick={() => onOpenMedia(message.image_url!, "image")}
              className="block w-full tappable"
            >
              <img
                src={message.image_url}
                alt="shared"
                className="rounded-2xl w-full max-h-[50vh] object-contain bg-muted/30"
              />
            </button>
          )}

          {/* Video */}
          {message.video && message.vidUrl && (
            <button
              onClick={() => onOpenMedia(message.vidUrl!, "video")}
              className="relative block w-full rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-black/10 group/vid"
            >
              <video 
                src={message.vidUrl} 
                className="rounded-2xl w-full max-h-[50vh] object-contain bg-black block" 
                preload="metadata" 
                playsInline 
                muted 
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover/vid:bg-black/40">
                <div className="h-12 w-12 rounded-full bg-white/90 shadow-md flex items-center justify-center text-black hover:scale-105 transition-transform">
                  <Play className="h-6 w-6 fill-current ml-0.5" />
                </div>
              </div>
            </button>
          )}

          {/* File */}
          {m.file_url && m.message_type !== "audio" && (
            <a
              href={m.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 ring-1 ring-border/40 tappable"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.file_name ?? "File"}</p>
                <p className="text-[12px] text-muted-foreground">Tap to open</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          )}

          {/* Audio */}
          {m.message_type === "audio" && m.file_url && (
            <audio controls className="w-full" preload="metadata">
              <source src={m.file_url} type={m.file_type ?? "audio/mpeg"} />
            </audio>
          )}

          {/* Full text — no truncation */}
          {message.content && (
            <div className="text-[16px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {formatMessageContent(message.content)}
            </div>
          )}

          {/* Link preview */}
          {hasLink && (
            <LinkPreview
              title={message.link_title}
              description={message.link_description}
              image={message.link_image}
              url={message.link_target_url}
            />
          )}

          {!message.content && !message.image_url && !m.gif_url && !m.sticker_url && !m.file_url && !message.vidUrl && (
            <p className="text-sm text-muted-foreground italic">No text content</p>
          )}
        </div>

        {/* Footer action */}
        <div className="px-5 py-3 border-t border-border/50 safe-area-bottom">
          <button
            onClick={() => onJumpToMessage(message.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold tappable"
          >
            <CornerDownRight className="h-[18px] w-[18px]" />
            Jump to message
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchResultModal;
