import React, { useState, useRef, useCallback } from "react";
import { Check, CheckCheck, Copy, Star, Reply, Info, SmilePlus, Music, Bookmark, Pin } from "lucide-react";
import { formatMessageTime, formatFullDate } from "@/lib/dateUtils";
import { formatMessageContent } from "@/lib/formatMessage";
import FileBubble from "./FileBubble";
import LinkPreview from "./LinkPreview";
import EmojiPicker from "./EmojiPicker";
import ReactionParticles from "./ReactionParticles";
import SecretMessage from "./SecretMessage";
import LetterBubble from "./LetterBubble";
import { TOUCH_EMOTIONS, type TouchEmotion } from "./TouchReactionOverlay";
import { QUICK_REACTIONS } from "@/lib/emojiData";
import type { Tables } from "@/integrations/supabase/types";

interface MessageBubbleProps {
  message: Tables<"messages">;
  isOwn: boolean;
  reactions?: Tables<"message_reactions">[];
  replyToMessage?: Tables<"messages"> | null;
  onReply?: (message: Tables<"messages">) => void;
  onReact?: (emoji: string) => void;
  onImageClick?: (url: string) => void;
  onVideoClick?: (url: string) => void;
  onScrollToMessage?: (id: string) => void;
  onBookmark?: (message: Tables<"messages">) => void;
  onPin?: (message: Tables<"messages">) => void;
  isPinned?: boolean;
}

const SWIPE_THRESHOLD = 60;

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, isOwn, reactions = [], replyToMessage, onReply, onReact, onImageClick, onVideoClick, onScrollToMessage, onBookmark,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showMsgInfo, setShowMsgInfo] = useState(false);
  const [reactionAnimation, setReactionAnimation] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isSwiping = useRef(false);
  const hapticTriggered = useRef(false);

  const msgType = (message as any).message_type ?? "text";
  const hasImage = !!message.image_url;
  const hasVideo = message.video && message.vidUrl;
  const hasFile = !!(message as any).file_url;
  const hasGif = !!(message as any).gif_url;
  const hasSticker = !!(message as any).sticker_url;
  const hasLinkPreview = message.link_preview_active && message.link_title;

  const handleReact = useCallback((emoji: string) => {
    setReactionAnimation(emoji);
    setTimeout(() => setReactionAnimation(null), 600);
    onReact?.(emoji);
    setShowReactions(false);
    setShowFullEmojiPicker(false);
  }, [onReact]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isSwiping.current = false;
    hapticTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!isSwiping.current) setShowReactions(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = e.touches[0].clientX - touchStartPos.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    const absDx = Math.abs(dx);

    // If vertical movement is dominant, cancel everything
    if (dy > 30) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setSwipeX(0);
      isSwiping.current = false;
      return;
    }

    // Detect swipe intent: horizontal > 15px and greater than vertical
    if (absDx > 15 && absDx > dy) {
      isSwiping.current = true;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      // Own messages swipe left (negative), partner messages swipe right (positive)
      const swipeDir = isOwn ? Math.min(0, dx) : Math.max(0, dx);
      const clamped = isOwn
        ? Math.max(swipeDir, -100)
        : Math.min(swipeDir, 100);

      setSwipeX(clamped);

      // Haptic feedback at threshold
      if (Math.abs(clamped) >= SWIPE_THRESHOLD && !hapticTriggered.current) {
        hapticTriggered.current = true;
        if (navigator.vibrate) navigator.vibrate(20);
      }
    } else if (absDx > 10 || dy > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }
  }, [isOwn]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (isSwiping.current && Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      onReply?.(message);
    }

    isSwiping.current = false;
    setSwipeX(0);
  }, [swipeX, message, onReply]);

  // Double click/tap for message info
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setShowMsgInfo(!showMsgInfo);
      setShowReactions(false);
    }
    lastTap.current = now;
  }, [showMsgInfo]);

  const handleCopy = () => {
    if (message.content) navigator.clipboard.writeText(message.content);
    setShowMsgInfo(false);
  };

  // Group reactions by emoji
  const reactionGroups = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const replyIconScale = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);
  const showReplyIcon = Math.abs(swipeX) > 10;

  // Touch reaction — special card
  if (msgType === "touch_reaction") {
    const emotionKey = (message.content ?? "hug") as TouchEmotion;
    const emotionConfig = TOUCH_EMOTIONS[emotionKey] ?? TOUCH_EMOTIONS.hug;
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}>
        <div
          className="rounded-2xl px-5 py-3 shadow-md text-center max-w-[200px]"
          style={{ background: emotionConfig.color.replace(/[\d.]+\)$/, "0.15)") }}
        >
          <div className="text-4xl mb-1">{emotionConfig.emoji}</div>
          <p className="text-xs font-semibold text-foreground">
            {isOwn ? "You" : message.username} sent a {emotionConfig.label}
          </p>
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.created_at ?? "")}</span>
            {isOwn && (
              <span className="inline-flex">
                {message.seen ? <CheckCheck className="h-3.5 w-3.5 text-seen" /> : message.delivered ? <CheckCheck className="h-3.5 w-3.5 opacity-50" /> : <Check className="h-3.5 w-3.5 opacity-50" />}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Letter — special envelope bubble
  if (msgType === "letter") {
    return <LetterBubble message={message} isOwn={isOwn} />;
  }

  // Sticker — no bubble bg
  if (hasSticker || msgType === "sticker") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-[160px] relative">
          <img src={(message as any).sticker_url} alt="sticker" className="w-full h-auto" loading="lazy" />
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.created_at ?? "")}</span>
          </div>
          {showReactions && (
            <QuickReactionBar isOwn={isOwn} onReact={handleReact} onMore={() => { setShowFullEmojiPicker(true); setShowReactions(false); }} onClose={() => setShowReactions(false)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleDoubleTap}
    >
      {/* Reaction particle effects */}
      {reactionAnimation && (
        <ReactionParticles emoji={reactionAnimation} isOwn={isOwn} />
      )}

      {/* Swipe reply icon */}
      {showReplyIcon && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? "right-2" : "left-2"} z-10 transition-opacity`}
          style={{
            opacity: replyIconScale,
            transform: `translateY(-50%) scale(${replyIconScale})`,
          }}
        >
          <div className={`h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center ${replyIconScale >= 1 ? "bg-primary/40" : ""}`}>
            <Reply className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}

      <div
        className="relative max-w-[80%] md:max-w-[65%]"
        style={{
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX === 0 ? "transform 0.25s ease-out" : "none",
        }}
      >
        {/* Quick reaction bar (long press on mobile, hover on desktop) */}
        {showReactions && (
          <QuickReactionBar isOwn={isOwn} onReact={handleReact} onMore={() => { setShowFullEmojiPicker(true); setShowReactions(false); }} onClose={() => setShowReactions(false)} />
        )}

        {/* Full emoji picker for reactions */}
        {showFullEmojiPicker && (
          <div className={`absolute ${isOwn ? "right-0" : "left-0"} -top-[320px] z-30 w-72`}>
            <div className="relative">
              <button onClick={() => setShowFullEmojiPicker(false)} className="absolute -top-2 -right-2 z-40 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">✕</button>
              <EmojiPicker onSelect={handleReact} />
            </div>
          </div>
        )}

        {/* Message info popup (double tap) */}
        {showMsgInfo && (
          <div className={`absolute ${isOwn ? "right-0" : "left-0"} -top-2 -translate-y-full z-30 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[180px] animate-scale-in`}>
            {onReply && (
              <button onClick={() => { onReply(message); setShowMsgInfo(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors">
                <Reply className="h-3.5 w-3.5 text-muted-foreground" /> Reply
              </button>
            )}
            <button onClick={() => { setShowReactions(true); setShowMsgInfo(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors">
              <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" /> React
            </button>
            {message.content && (
              <button onClick={handleCopy} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Copy
              </button>
            )}
            {onBookmark && (
              <button onClick={() => { onBookmark(message); setShowMsgInfo(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted transition-colors">
                <Bookmark className="h-3.5 w-3.5 text-muted-foreground" /> Remember This
              </button>
            )}
            <div className="border-t border-border my-1" />
            <div className="px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
              <p>Sent: {formatFullDate(message.created_at ?? "")}</p>
              {isOwn && message.delivered_at && <p>Delivered: {formatFullDate(message.delivered_at)}</p>}
              {isOwn && message.seen_at && <p>Seen: {formatFullDate(message.seen_at)}</p>}
              <p>From: {message.username}</p>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm ${
            isOwn
              ? "bg-bubble-own text-bubble-own-foreground rounded-br-md"
              : "bg-bubble-partner text-bubble-partner-foreground rounded-bl-md"
          }`}
          onMouseEnter={() => { /* desktop hover shows reaction */ }}
        >
          {/* Reply reference */}
          {message.reply_to_id && (
            <div
              onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(message.reply_to_id!); }}
              className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border-l-2 border-primary text-xs cursor-pointer hover:bg-muted/80 transition-colors"
            >
              <p className="font-semibold text-primary text-[10px]">{replyToMessage?.username ?? "..."}</p>
              <p className="text-muted-foreground truncate">{replyToMessage?.content || "📎 Attachment"}</p>
            </div>
          )}

          {/* GIF */}
          {(hasGif || msgType === "gif") && (
            <img src={(message as any).gif_url} alt="GIF" className="rounded-xl mb-1.5 max-h-56 w-auto object-cover" loading="lazy" />
          )}

          {/* Image */}
          {hasImage && (
            <img
              src={message.image_url!}
              alt="shared"
              className="rounded-xl mb-1.5 max-h-64 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              onClick={(e) => { e.stopPropagation(); onImageClick?.(message.image_url!); }}
            />
          )}

          {/* Video */}
          {hasVideo && (
            <div
              className="rounded-xl mb-1.5 max-h-64 w-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onVideoClick?.(message.vidUrl!); }}
            >
              <video src={message.vidUrl!} className="w-full max-h-64 object-cover" preload="metadata" />
            </div>
          )}

          {/* Audio */}
          {msgType === "audio" && (message as any).file_url && (
            <div className="mb-1.5">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40">
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Music className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{(message as any).file_name ?? "Audio"}</p>
                  <audio controls className="w-full h-8 mt-1" preload="metadata">
                    <source src={(message as any).file_url} type={(message as any).file_type ?? "audio/mpeg"} />
                  </audio>
                </div>
              </div>
            </div>
          )}

          {/* File */}
          {hasFile && msgType !== "audio" && (
            <div className="mb-1.5">
              <FileBubble
                fileUrl={(message as any).file_url}
                fileName={(message as any).file_name ?? "file"}
                fileType={(message as any).file_type ?? "application/octet-stream"}
                fileSize={(message as any).file_size ?? 0}
              />
            </div>
          )}

          {/* Content — secret or normal */}
          {message.content && msgType === "secret" ? (
            <SecretMessage
              messageId={message.id}
              content={message.content}
              revealed={(message as any).revealed ?? false}
              isOwn={isOwn}
            />
          ) : message.content ? (
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {formatMessageContent(message.content)}
            </div>
          ) : null}

          {/* Link Preview */}
          {hasLinkPreview && (
            <LinkPreview title={message.link_title} description={message.link_description} image={message.link_image} url={message.link_target_url} />
          )}

          {/* Reactions with animation */}
          {Object.keys(reactionGroups).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(reactionGroups).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted/60 hover:bg-muted text-xs transition-all active:scale-110"
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-muted-foreground">{count}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Time + Status */}
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] opacity-60">{formatMessageTime(message.created_at ?? "")}</span>
            {isOwn && (
              <span className="inline-flex">
                {message.seen ? (
                  <CheckCheck className="h-3.5 w-3.5 text-seen" />
                ) : message.delivered ? (
                  <CheckCheck className="h-3.5 w-3.5 opacity-50" />
                ) : (
                  <Check className="h-3.5 w-3.5 opacity-50" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Desktop hover: small reply button */}
        <div className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? "-left-8" : "-right-8"} opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex`}>
          <button
            onClick={(e) => { e.stopPropagation(); onReply?.(message); }}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <Reply className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Quick reaction bar component
const QuickReactionBar: React.FC<{
  isOwn: boolean;
  onReact: (emoji: string) => void;
  onMore: () => void;
  onClose: () => void;
}> = ({ isOwn, onReact, onMore, onClose }) => (
  <div
    className={`absolute ${isOwn ? "right-0" : "left-0"} -top-10 flex gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg z-20 animate-scale-in`}
    onClick={(e) => e.stopPropagation()}
  >
    {QUICK_REACTIONS.map((emoji) => (
      <button
        key={emoji}
        onClick={() => onReact(emoji)}
        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-lg transition-transform hover:scale-125 active:scale-150"
      >
        {emoji}
      </button>
    ))}
    <button onClick={onMore} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-sm">
      <SmilePlus className="h-4 w-4 text-muted-foreground" />
    </button>
  </div>
);

export default MessageBubble;
