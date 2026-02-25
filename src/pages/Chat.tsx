import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTyping } from "@/hooks/useTyping";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSearch } from "@/hooks/useSearch";
import { useMarkSeen } from "@/hooks/useMarkSeen";
import { useAnimationQueue } from "@/hooks/useAnimationQueue";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import SearchBar from "@/components/chat/SearchBar";
import ConnectionBanner from "@/components/chat/ConnectionBanner";
import ProfilePanel from "@/components/chat/ProfilePanel";
import LetterComposer from "@/components/chat/LetterComposer";
import MessageEffects, { detectEffect, type EffectType } from "@/components/chat/MessageEffects";
import TouchReactionOverlay, { type TouchEmotion, TOUCH_EMOTIONS, type CustomEmotionConfig } from "@/components/chat/TouchReactionOverlay";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const DYNAMIC_WALLPAPERS: Record<string, string> = {
  morning: "linear-gradient(135deg, #FFE4B5, #FFD4A0, #FFDAB9)",
  afternoon: "linear-gradient(135deg, #87CEEB, #ADD8E6, #B0E0E6)",
  evening: "linear-gradient(135deg, #FF8C69, #FF7F7F, #DDA0DD)",
  night: "linear-gradient(135deg, #191970, #2C2C54, #1a1a2e)",
};

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

const Chat: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <ChatView userId={user.id} />;
};

const ChatView: React.FC<{ userId: string }> = ({ userId }) => {
  const partner = usePartner(userId);
  const currentUser = useCurrentUser(userId);
  const { messages, loading, loadingMore, hasMore, loadMore, sendMessage } = useMessages(userId);
  const { partnerTyping, handleTyping, setTyping } = useTyping(userId, currentUser?.name ?? undefined);
  const [replyTo, setReplyTo] = useState<Tables<"messages"> | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { results, searching, query, search, clear } = useSearch();
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [dynamicWallpaper, setDynamicWallpaper] = useState(false);
  const [messageEffects, setMessageEffects] = useState(true);
  const [touchOverlay, setTouchOverlay] = useState<{ emotion: TouchEmotion; senderName: string } | null>(null);
  const [showLetterComposer, setShowLetterComposer] = useState(false);
  const lastTouchReactionId = useRef<string | null>(null);

  useOnlineStatus(userId);
  useMarkSeen(userId, messages);
  const { current: pendingAnim, dismiss: dismissPendingAnim } = useAnimationQueue(userId);
  const [queuedKeywordEffect, setQueuedKeywordEffect] = useState<EffectType>(null);

  // Play pending animations from queue
  useEffect(() => {
    if (!pendingAnim) return;
    if (pendingAnim.animation_type === "touch_reaction") {
      const data = pendingAnim.animation_data;
      const emotionKey = data.emotion as TouchEmotion;
      if (TOUCH_EMOTIONS[emotionKey]) {
        setTouchOverlay({ emotion: emotionKey, senderName: pendingAnim.sender_name ?? "Partner" });
      }
      dismissPendingAnim();
    } else if (pendingAnim.animation_type === "keyword_effect") {
      const data = pendingAnim.animation_data;
      setQueuedKeywordEffect(data.effect as EffectType);
      setTimeout(() => {
        setQueuedKeywordEffect(null);
        dismissPendingAnim();
      }, 4500);
    }
  }, [pendingAnim, dismissPendingAnim]);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from("chat_user_settings")
        .select("wallpaper_url, dynamic_wallpaper, message_effects")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setWallpaper((data as any).wallpaper_url ?? "none");
        setDynamicWallpaper((data as any).dynamic_wallpaper ?? false);
        setMessageEffects((data as any).message_effects ?? true);
      }
    };
    loadSettings();
  }, [userId]);

  const effectiveWallpaper = useMemo(() => {
    if (wallpaper === "sky") return null; // Sky background component handles this
    if (dynamicWallpaper) return DYNAMIC_WALLPAPERS[getTimeOfDay()];
    return wallpaper === "none" ? null : wallpaper;
  }, [wallpaper, dynamicWallpaper]);

  // Easter egg checks
  useEffect(() => {
    const checkEasterEggs = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h === 11 && m === 11) {
        toast({ title: "✨ Make a wish! It's 11:11 ✨" });
      }
      if (h === 3 && m === 33) {
        toast({ title: "🦉 Night owls! It's 3:33 AM!" });
      }
    };
    const interval = setInterval(checkEasterEggs, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (content: string, extras?: any) => {
    await setTyping(false);
    const error = await sendMessage(content, currentUser?.name ?? "Unknown", extras);

    // Queue animation for offline partner
    if (!error && partner && !partner.is_online) {
      const msgType = extras?.message_type;
      if (msgType === "touch_reaction") {
        await supabase.from("pending_animations").insert({
          target_user_id: partner.user_id,
          animation_type: "touch_reaction",
          animation_data: { emotion: content },
          sender_name: currentUser?.name ?? "Partner",
        } as any);
      } else if (content) {
        const detected = detectEffect(content);
        if (detected) {
          await supabase.from("pending_animations").insert({
            target_user_id: partner.user_id,
            animation_type: "keyword_effect",
            animation_data: { effect: detected, content },
            sender_name: currentUser?.name ?? "Partner",
          } as any);
        }
      }
    }

    return error;
  };

  const displayMessages = useMemo(() => {
    if (query && results.length > 0) return results.reverse();
    return messages;
  }, [messages, results, query]);

  // Initialize lastTouchReactionId to the last message on first load so we don't replay old reactions
  const initializedTouchRef = useRef(false);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!initializedTouchRef.current) {
      // On first load, just record the last message id — don't trigger overlay
      initializedTouchRef.current = true;
      lastTouchReactionId.current = messages[messages.length - 1].id;
      return;
    }
    const last = messages[messages.length - 1];
    if (
      (last as any).message_type === "touch_reaction" &&
      last.user_id !== userId &&
      last.id !== lastTouchReactionId.current
    ) {
      lastTouchReactionId.current = last.id;
      const emotion = (last.content ?? "hug") as TouchEmotion;
      if (TOUCH_EMOTIONS[emotion]) {
        setTouchOverlay({ emotion, senderName: last.username ?? "Partner" });
      }
    }
  }, [messages, userId]);

  const handleReactBack = useCallback(async (emotion: TouchEmotion) => {
    setTouchOverlay(null);
    await handleSend(emotion, { message_type: "touch_reaction" });
  }, [handleSend]);

  const lastMessageContent = useMemo(() => {
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    if (last.user_id === userId) return null;
    return last.content ?? null;
  }, [messages, userId]);

  return (
    <div className="flex h-dvh bg-background">
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          partner={partner}
          partnerTyping={partnerTyping}
          onSearchToggle={() => { setShowSearch(!showSearch); if (showSearch) clear(); }}
          onProfileToggle={() => setShowProfile(!showProfile)}
        />
        <ConnectionBanner />
        {showSearch && (
          <SearchBar
            query={query}
            onSearch={search}
            onClose={() => { setShowSearch(false); clear(); }}
            resultCount={results.length}
          />
        )}
        <MessageList
          messages={displayMessages}
          currentUserId={userId}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          partnerTyping={partnerTyping}
          onReply={setReplyTo}
          wallpaper={effectiveWallpaper}
          useSkyBackground={wallpaper === "sky"}
        />
        <MessageInput
          onSend={handleSend}
          onTyping={handleTyping}
          userId={userId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onOpenLetter={() => setShowLetterComposer(true)}
        />
      </div>

      {showProfile && (
        <ProfilePanel partner={partner} onClose={() => setShowProfile(false)} />
      )}

      <MessageEffects lastMessage={lastMessageContent} enabled={messageEffects} externalEffect={queuedKeywordEffect} />

      {touchOverlay && (
        <TouchReactionOverlay
          emotion={touchOverlay.emotion}
          senderName={touchOverlay.senderName}
          onDismiss={() => setTouchOverlay(null)}
          onReactBack={handleReactBack}
        />
      )}

      {showLetterComposer && (
        <LetterComposer
          partnerName={partner?.name ?? "Love"}
          senderName={currentUser?.name ?? "Me"}
          onSend={async (content, meta) => {
            const error = await handleSend(content, { message_type: "letter", emoji: meta });
            if (error) {
              console.error("Letter send error:", error);
              toast({ title: "Failed to send letter", description: error.message, variant: "destructive" });
            } else {
              setShowLetterComposer(false);
            }
          }}
          onClose={() => setShowLetterComposer(false)}
        />
      )}
    </div>
  );
};

export default Chat;
