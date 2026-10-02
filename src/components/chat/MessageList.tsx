import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import BookmarkDialog from "./BookmarkDialog";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import ScrollToBottom from "./ScrollToBottom";
import ImageLightbox from "./ImageLightbox";
import SkyBackground from "./SkyBackground";
import MessageListSkeleton from "./MessageListSkeleton";
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
  partnerRecording?: boolean;
  onReply: (message: Tables<"messages">) => void;
  wallpaper?: string | null;
  useSkyBackground?: boolean;
  typingText?: string;
  onPin?: (message: Tables<"messages">) => void;
  isMessagePinned?: (messageId: string) => boolean;
  onTeachAi?: (message: Tables<"messages">) => void;
  onAskCompanion?: (message: Tables<"messages">) => void;
  onEmptyDoubleTap?: () => void;
  fontSize?: string;
  customFontSize?: string;
  currentHandwritingFont?: boolean;
  partnerHandwritingFont?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, currentUserId, loading, loadingMore, hasMore, onLoadMore, partnerTyping, partnerRecording, onReply, wallpaper, useSkyBackground, typingText, onPin, isMessagePinned, onTeachAi, onAskCompanion, onEmptyDoubleTap,
  fontSize = "medium", customFontSize, currentHandwritingFont = false, partnerHandwritingFont = false,
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

  const isInitialLoad = useRef(true);
  const loadMoreLock = useRef(false);

  useEffect(() => {
    if (messages.length > prevLengthRef.current && isAtBottomRef.current && !loadMoreLock.current) {
      scrollToBottom();
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoad.current) {
      isInitialLoad.current = false;
      scrollToBottom(false);
    }
  }, [loading, scrollToBottom, messages.length]);

  // When new older messages load, restore scroll position
  useEffect(() => {
    if (loadMoreLock.current && containerRef.current) {
      const el = containerRef.current;
      const newHeight = el.scrollHeight;
      const prevHeight = prevScrollHeightRef.current;
      el.scrollTop = newHeight - prevHeight;
      loadMoreLock.current = false;
    }
  }, [messages.length]);

  const prevScrollHeightRef = useRef(0);

  // Double-tap on empty chat background → secret scratch card.
  const lastBgTap = useRef(0);
  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (!onEmptyDoubleTap) return;
    // Only react to taps on the scroll container / padding wrapper itself —
    // never on a message bubble or interactive child.
    const target = e.target as HTMLElement;
    if (target.closest("[id^='msg-']")) return;
    const now = Date.now();
    if (now - lastBgTap.current < 300) {
      lastBgTap.current = 0;
      onEmptyDoubleTap();
    } else {
      lastBgTap.current = now;
    }
  }, [onEmptyDoubleTap]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 100;
    setShowScrollBtn(distFromBottom > 300);
    if (el.scrollTop < 80 && hasMore && !loadingMore && !loadMoreLock.current) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMoreLock.current = true;
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const wallpaperStyle = useMemo((): React.CSSProperties => {
    if (!wallpaper || wallpaper === "none") return {};
    if (wallpaper.startsWith("http")) return { backgroundImage: `url(${wallpaper})`, backgroundSize: "cover", backgroundPosition: "center" };
    if (wallpaper.startsWith("linear-gradient")) return { background: wallpaper };
    return { backgroundColor: wallpaper };
  }, [wallpaper]);

  if (loading) {
    return <MessageListSkeleton />;
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-chat-bg" style={useSkyBackground ? {} : wallpaperStyle}>
      {useSkyBackground && <SkyBackground />}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleBgClick}
        className="h-full overflow-y-auto px-3 py-3 scrollbar-overlay"
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const showDate = i === 0 || !isSameDay(prev?.created_at ?? "", msg.created_at ?? "");
          // Group consecutive messages from the same sender (tighter spacing),
          // unless a date separator breaks the run.
          const grouped = !showDate && !!prev && prev.user_id === msg.user_id;
          const isOwn = msg.user_id === currentUserId;
          const isHandwriting =
            (msg as any).use_handwriting_font !== null && (msg as any).use_handwriting_font !== undefined
              ? !!(msg as any).use_handwriting_font
              : isOwn
                ? !!currentHandwritingFont
                : !!partnerHandwritingFont;

          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateSeparator date={msg.created_at ?? ""} />}
              <div
                id={`msg-${msg.id}`}
                className={`group relative ${grouped ? "mt-1" : "mt-3"}`}
              >
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  fontSize={fontSize}
                  customFontSize={customFontSize}
                  isHandwriting={isHandwriting}
                  reactions={reactions[msg.id] ?? []}
                  replyToMessage={msg.reply_to_id ? replyMap[msg.reply_to_id] ?? null : null}
                  onReply={onReply}
                  onReact={(emoji) => toggleReaction(msg.id, currentUserId, emoji)}
                  onImageClick={(url) => { setLightboxSrc(url); setLightboxType("image"); }}
                  onVideoClick={(url) => { setLightboxSrc(url); setLightboxType("video"); }}
                  onScrollToMessage={scrollToMessage}
                  onBookmark={(msg) => setBookmarkMsg(msg)}
                  onPin={onPin}
                  isPinned={isMessagePinned?.(msg.id) ?? false}
                  onTeachAi={onTeachAi}
                  onAskCompanion={onAskCompanion}
                />
              </div>
            </React.Fragment>
          );
        })}

        {(partnerRecording || partnerTyping) && (
          <TypingIndicator themeText={typingText} isRecording={partnerRecording} />
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && <ScrollToBottom onClick={() => scrollToBottom()} />}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} type={lightboxType} onClose={() => setLightboxSrc(null)} />}
      {bookmarkMsg && <BookmarkDialog message={bookmarkMsg} onClose={() => setBookmarkMsg(null)} />}
    </div>
  );
};

export default MessageList;
