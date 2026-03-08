import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import BookmarkDialog from "./BookmarkDialog";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import ScrollToBottom from "./ScrollToBottom";
import ImageLightbox from "./ImageLightbox";
import SkyBackground from "./SkyBackground";
import { isSameDay } from "@/lib/dateUtils";
import { Loader2 } from "lucide-react";
import { useReactions } from "@/hooks/useReactions";

import type { Tables } from "@/integrations/supabase/types";

interface MessageListProps {
  messages: Tables<"messages">[];
  currentUserId: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  partnerTyping: boolean;
  onReply: (message: Tables<"messages">) => void;
  wallpaper?: string | null;
  useSkyBackground?: boolean;
  typingText?: string;
  onPin?: (message: Tables<"messages">) => void;
  isMessagePinned?: (messageId: string) => boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, currentUserId, loading, loadingMore, hasMore, onLoadMore, partnerTyping, onReply, wallpaper, useSkyBackground, typingText, onPin, isMessagePinned,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);
  const prevLengthRef = useRef(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [bookmarkMsg, setBookmarkMsg] = useState<Tables<"messages"> | null>(null);

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const { reactions, toggleReaction } = useReactions(messageIds);

  // Build reply map
  const replyMap = useMemo(() => {
    const map: Record<string, Tables<"messages">> = {};
    messages.forEach((m) => { map[m.id] = m; });
    return map;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const scrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
    }
  }, []);

  useEffect(() => {
    if (messages.length > prevLengthRef.current && isAtBottomRef.current) {
      scrollToBottom();
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [loading, scrollToBottom, messages.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 100;
    setShowScrollBtn(distFromBottom > 300);
    if (el.scrollTop < 100 && hasMore && !loadingMore) {
      const prevHeight = el.scrollHeight;
      onLoadMore();
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const wallpaperStyle = useMemo((): React.CSSProperties => {
    if (!wallpaper || wallpaper === "none") return {};
    if (wallpaper.startsWith("http")) return { backgroundImage: `url(${wallpaper})`, backgroundSize: "cover", backgroundPosition: "center" };
    if (wallpaper.startsWith("linear-gradient")) return { background: wallpaper };
    return { backgroundColor: wallpaper };
  }, [wallpaper]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-chat-bg" style={useSkyBackground ? {} : wallpaperStyle}>
      {useSkyBackground && <SkyBackground />}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin"
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {messages.map((msg, i) => {
          const showDate = i === 0 || !isSameDay(messages[i - 1].created_at ?? "", msg.created_at ?? "");
          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateSeparator date={msg.created_at ?? ""} />}
              <div id={`msg-${msg.id}`} className="transition-all duration-300 rounded-xl group relative">
                <MessageBubble
                  message={msg}
                  isOwn={msg.user_id === currentUserId}
                  reactions={reactions[msg.id] ?? []}
                  replyToMessage={msg.reply_to_id ? replyMap[msg.reply_to_id] ?? null : null}
                  onReply={onReply}
                  onReact={(emoji) => toggleReaction(msg.id, currentUserId, emoji)}
                  onImageClick={(url) => { setLightboxSrc(url); setLightboxType("image"); }}
                  onVideoClick={(url) => { setLightboxSrc(url); setLightboxType("video"); }}
                  onScrollToMessage={scrollToMessage}
                  onBookmark={(msg) => setBookmarkMsg(msg)}
                />
              </div>
            </React.Fragment>
          );
        })}

        {partnerTyping && <TypingIndicator themeText={typingText} />}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && <ScrollToBottom onClick={() => scrollToBottom()} />}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} type={lightboxType} onClose={() => setLightboxSrc(null)} />}
      {bookmarkMsg && <BookmarkDialog message={bookmarkMsg} onClose={() => setBookmarkMsg(null)} />}
    </div>
  );
};

export default MessageList;
