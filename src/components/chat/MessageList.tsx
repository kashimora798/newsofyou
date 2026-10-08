import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import BookmarkDialog from "./BookmarkDialog";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import ScrollToBottom from "./ScrollToBottom";
import ImageLightbox from "./ImageLightbox";
import SkyBackground from "./SkyBackground";
import MessageListSkeleton from "./MessageListSkeleton";
import { formatMessageTime, isSameDay } from "@/lib/dateUtils";
import { Check, CheckCheck } from "lucide-react";
import { groupImageAlbums } from "@/lib/chatMedia";
import { useChatAttachments } from "@/hooks/useChatAttachments";
import MediaGrid from "./MediaGrid";
import type { Tables } from "@/integrations/supabase/types";
import { Loader2, Sparkles, X } from "lucide-react";
import { useReactions } from "@/hooks/useReactions";


/** A note the twin wrote in his place while he was away (never a real message). */
export interface TwinNote {
  id: number;
  text: string;
  mood?: string | null;
  created_at?: string | null;
}

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
  /** Standing AI notes from the twin, shown after the real conversation. */
  twinNotes?: TwinNote[];
  /** e.g. "Kratagya's AI" — the note is never presented as a message from him. */
  twinLabel?: string;
  onTwinNoteDismiss?: (id: number) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, currentUserId, loading, loadingMore, hasMore, onLoadMore, partnerTyping, partnerRecording, onReply, wallpaper, useSkyBackground, typingText, onPin, isMessagePinned, onTeachAi, onAskCompanion, onEmptyDoubleTap, twinNotes, twinLabel, onTwinNoteDismiss,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);
  const prevLengthRef = useRef(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "video">("image");
  const [lightboxAlbum, setLightboxAlbum] = useState<string[] | null>(null);
  const [bookmarkMsg, setBookmarkMsg] = useState<Tables<"messages"> | null>(null);

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const { reactions, toggleReaction } = useReactions(messageIds);

  // Photos sent together are drawn as one cluster, like any messaging app does.
  // `messages` itself is untouched — this is purely how the thread is rendered.
  const items = useMemo(() => groupImageAlbums(messages), [messages]);

  // Width/height/page counts for the visible media, in one round trip.
  const attachmentUrls = useMemo(
    () => messages.map((m) => m.image_url ?? (m as { file_url?: string | null }).file_url ?? null),
    [messages],
  );
  const { forUrl: attachmentFor } = useChatAttachments(attachmentUrls);

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

        {items.map((item, i) => {
          const first = item.kind === "album" ? item.messages[0] : item.message;
          const last = item.kind === "album" ? item.messages[item.messages.length - 1] : item.message;
          const prevItem = i > 0 ? items[i - 1] : null;
          const prevLast = prevItem ? (prevItem.kind === "album" ? prevItem.messages[prevItem.messages.length - 1] : prevItem.message) : null;
          const showDate = i === 0 || !isSameDay(prevLast?.created_at ?? "", first.created_at ?? "");
          const grouped = !showDate && !!prevLast && prevLast.user_id === first.user_id;

          if (item.kind === "album") {
            const isOwn = first.user_id === currentUserId;
            const albumUrls = item.messages.map((m) => m.image_url!).filter(Boolean);
            return (
              <React.Fragment key={item.key}>
                {showDate && <DateSeparator date={first.created_at ?? ""} />}
                <div id={`msg-${first.id}`} className={`group relative flex flex-col ${isOwn ? "items-end" : "items-start"} ${grouped ? "mt-1" : "mt-3"}`}>
                  <MediaGrid
                    messages={item.messages}
                    detailsFor={attachmentFor}
                    isOwn={isOwn}
                    onOpen={(url) => {
                      setLightboxAlbum(albumUrls);
                      setLightboxSrc(url);
                      setLightboxType("image");
                    }}
                  />
                  {/* time + ticks sit under the cluster, as they do when a photo
                      has no caption */}
                  <div className={`mt-1 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] opacity-50">{formatMessageTime(last.created_at ?? "")}</span>
                    {isOwn && (
                      <span className="inline-flex">
                        {last.seen ? (
                          <CheckCheck className="h-3.5 w-3.5 text-seen" />
                        ) : last.delivered ? (
                          <CheckCheck className="h-3.5 w-3.5 opacity-40" />
                        ) : (
                          <Check className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          }

          const msg = item.message;
          return (
            <React.Fragment key={item.key}>
              {showDate && <DateSeparator date={msg.created_at ?? ""} />}
              <div
                id={`msg-${msg.id}`}
                className={`group relative ${grouped ? "mt-1" : "mt-3"}`}
              >
                <MessageBubble
                  message={msg}
                  isOwn={msg.user_id === currentUserId}
                  reactions={reactions[msg.id] ?? []}
                  replyToMessage={msg.reply_to_id ? replyMap[msg.reply_to_id] ?? null : null}
                  onReply={onReply}
                  onReact={(emoji) => toggleReaction(msg.id, currentUserId, emoji)}
                  onImageClick={(url) => { setLightboxAlbum(null); setLightboxSrc(url); setLightboxType("image"); }}
                  onVideoClick={(url) => { setLightboxAlbum(null); setLightboxSrc(url); setLightboxType("video"); }}
                  onScrollToMessage={scrollToMessage}
                  onBookmark={(msg) => setBookmarkMsg(msg)}
                  onPin={onPin}
                  isPinned={isMessagePinned?.(msg.id) ?? false}
                  onTeachAi={onTeachAi}
                  onAskCompanion={onAskCompanion}
                  attachmentFor={attachmentFor}
                />
              </div>
            </React.Fragment>
          );
        })}

        {/* The twin answered while he was away. Labelled as AI, always. */}
        {twinNotes?.map((note) => (
          <div key={`twin-note-${note.id}`} className="mt-3 flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-3 w-3 text-primary" />
            </span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {twinLabel ?? "his AI"} · he was away
              </p>
              <div className="rounded-2xl rounded-tl-md border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-[14px] leading-relaxed">
                {note.text}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">written by his AI, not by him</span>
                {onTwinNoteDismiss && (
                  <button
                    type="button"
                    onClick={() => onTwinNoteDismiss(note.id)}
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {(partnerRecording || partnerTyping) && (
          <TypingIndicator themeText={typingText} isRecording={partnerRecording} />
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && <ScrollToBottom onClick={() => scrollToBottom()} />}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          type={lightboxType}
          siblings={lightboxType === "image" ? lightboxAlbum ?? undefined : undefined}
          onClose={() => {
            setLightboxSrc(null);
            setLightboxAlbum(null);
          }}
        />
      )}
      {bookmarkMsg && <BookmarkDialog message={bookmarkMsg} onClose={() => setBookmarkMsg(null)} />}
    </div>
  );
};

export default MessageList;
