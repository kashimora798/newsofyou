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
import { groupMessages, type ChatItem } from "@/lib/album";

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

const EMPTY: Tables<"message_reactions">[] = [];

interface RowHandlers {
  onReply: (m: Tables<"messages">) => void;
  onReact: (messageId: string, emoji: string) => void;
  onImage: (url: string) => void;
  onVideo: (url: string) => void;
  onScrollTo: (id: string) => void;
  onBookmark: (m: Tables<"messages">) => void;
  onPin?: (m: Tables<"messages">) => void;
  onTeachAi?: (m: Tables<"messages">) => void;
  onAskCompanion?: (m: Tables<"messages">) => void;
}

interface RowProps {
  item: ChatItem;
  grouped: boolean;
  showDate: boolean;
  isOwn: boolean;
  fontSize: string;
  customFontSize?: string;
  isHandwriting: boolean;
  reactions: Tables<"message_reactions">[];
  replyTo: Tables<"messages"> | null;
  pinned: boolean;
  /** stable ref — handlers are read at call time, so the row never re-renders just because a callback identity changed */
  h: React.MutableRefObject<RowHandlers>;
  hasPin: boolean;
  hasTeach: boolean;
  hasAsk: boolean;
}

function sameItem(a: ChatItem, b: ChatItem): boolean {
  if (a.kind === "single" && b.kind === "single") return a.message === b.message;
  if (a.kind === "album" && b.kind === "album") {
    return a.messages.length === b.messages.length && a.messages.every((m, i) => m === b.messages[i]);
  }
  return false;
}

function rowPropsEqual(a: RowProps, b: RowProps): boolean {
  return (
    sameItem(a.item, b.item) &&
    a.grouped === b.grouped &&
    a.showDate === b.showDate &&
    a.isOwn === b.isOwn &&
    a.fontSize === b.fontSize &&
    a.customFontSize === b.customFontSize &&
    a.isHandwriting === b.isHandwriting &&
    a.reactions === b.reactions &&
    a.replyTo === b.replyTo &&
    a.pinned === b.pinned &&
    a.hasPin === b.hasPin &&
    a.hasTeach === b.hasTeach &&
    a.hasAsk === b.hasAsk
  );
}

/**
 * One chat row. Memoised: typing indicators, new messages elsewhere, scroll
 * state etc. no longer re-render every bubble in the conversation.
 */
const MessageRow = React.memo(
  function MessageRow({ item, grouped, showDate, isOwn, fontSize, customFontSize, isHandwriting, reactions, replyTo, pinned, h, hasPin, hasTeach, hasAsk }: RowProps) {
    const msg = item.kind === "album" ? item.last : item.message;
    const stable = useMemo(
      () => ({
        onReply: (m: Tables<"messages">) => h.current.onReply(m),
        onReact: (emoji: string) => h.current.onReact(msg.id, emoji),
        onImage: (u: string) => h.current.onImage(u),
        onVideo: (u: string) => h.current.onVideo(u),
        onScrollTo: (id: string) => h.current.onScrollTo(id),
        onBookmark: (m: Tables<"messages">) => h.current.onBookmark(m),
        onPin: (m: Tables<"messages">) => h.current.onPin?.(m),
        onTeachAi: (m: Tables<"messages">) => h.current.onTeachAi?.(m),
        onAskCompanion: (m: Tables<"messages">) => h.current.onAskCompanion?.(m),
      }),
      [h, msg.id]
    );
    return (
      <>
        {showDate && <DateSeparator date={msg.created_at ?? ""} />}
        <div
          id={`msg-${msg.id}`}
          className={`group relative chat-row ${grouped ? "mt-[3px]" : "mt-3"}`}
        >
          <MessageBubble
            message={msg}
            album={item.kind === "album" && item.messages.length > 1 ? item.messages : undefined}
            isOwn={isOwn}
            fontSize={fontSize}
            customFontSize={customFontSize}
            isHandwriting={isHandwriting}
            reactions={reactions}
            replyToMessage={replyTo}
            onReply={stable.onReply}
            onReact={stable.onReact}
            onImageClick={stable.onImage}
            onVideoClick={stable.onVideo}
            onScrollToMessage={stable.onScrollTo}
            onBookmark={stable.onBookmark}
            onPin={hasPin ? stable.onPin : undefined}
            isPinned={pinned}
            onTeachAi={hasTeach ? stable.onTeachAi : undefined}
            onAskCompanion={hasAsk ? stable.onAskCompanion : undefined}
          />
        </div>
      </>
    );
  },
  rowPropsEqual
);

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

  const messageIds = useMemo(() => messages.filter((m) => !m.id.startsWith("tmp_")).map((m) => m.id), [messages]);
  const items = useMemo(() => groupMessages(messages), [messages]);
  // Every photo in the loaded chat, in order — the lightbox swipes through these.
  const galleryImages = useMemo(
    () => messages.filter((m) => m.message_type === "image" && m.image_url && !m.id.startsWith("tmp_")).map((m) => m.image_url as string),
    [messages]
  );
  const { reactions, toggleReaction } = useReactions(messageIds);

  const replyMap = useMemo(() => {
    const map: Record<string, Tables<"messages">> = {};
    messages.forEach((m) => { map[m.id] = m; });
    return map;
  }, [messages]);

  const handlersRef = useRef<RowHandlers>({} as RowHandlers);
  handlersRef.current = {
    onReply,
    onReact: (messageId, emoji) => toggleReaction(messageId, currentUserId, emoji),
    onImage: (url) => { setLightboxSrc(url); setLightboxType("image"); },
    onVideo: (url) => { setLightboxSrc(url); setLightboxType("video"); },
    onScrollTo: (id) => scrollToMessageRef.current(id),
    onBookmark: (m) => setBookmarkMsg(m),
    onPin,
    onTeachAi,
    onAskCompanion,
  };
  const scrollToMessageRef = useRef<(id: string) => void>(() => {});

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

  scrollToMessageRef.current = scrollToMessage;

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

        {items.map((item, i) => {
          const msg = item.kind === "album" ? item.last : item.message;
          const first = item.kind === "album" ? item.messages[0] : item.message;
          const prevItem = i > 0 ? items[i - 1] : null;
          const prev = prevItem ? (prevItem.kind === "album" ? prevItem.last : prevItem.message) : null;
          const showDate = i === 0 || !isSameDay(prev?.created_at ?? "", first.created_at ?? "");
          // Group consecutive messages from the same sender (tighter spacing),
          // unless a date separator breaks the run.
          const grouped = !showDate && !!prev && prev.user_id === first.user_id;
          return (
            <MessageRow
              key={item.key}
              item={item}
              grouped={grouped}
              showDate={showDate}
              isOwn={msg.user_id === currentUserId}
              fontSize={fontSize}
              customFontSize={customFontSize}
              // If handwriting setting is turned off, every message reverts to the default font.
              isHandwriting={Boolean(currentHandwritingFont)}
              reactions={reactions[msg.id] ?? EMPTY}
              replyTo={msg.reply_to_id ? replyMap[msg.reply_to_id] ?? null : null}
              pinned={isMessagePinned?.(msg.id) ?? false}
              h={handlersRef}
              hasPin={!!onPin}
              hasTeach={!!onTeachAi}
              hasAsk={!!onAskCompanion}
            />
          );
        })}

        {(partnerRecording || partnerTyping) && (
          <TypingIndicator themeText={typingText} isRecording={partnerRecording} />
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && <ScrollToBottom onClick={() => scrollToBottom()} />}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} type={lightboxType} images={galleryImages} onClose={() => setLightboxSrc(null)} />}
      {bookmarkMsg && <BookmarkDialog message={bookmarkMsg} onClose={() => setBookmarkMsg(null)} />}
    </div>
  );
};

export default MessageList;
