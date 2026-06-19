import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useMessages } from "@/hooks/useMessages";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTyping } from "@/hooks/useTyping";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSearch } from "@/hooks/useSearch";
import { useMarkSeen } from "@/hooks/useMarkSeen";
import { useAnimationQueue } from "@/hooks/useAnimationQueue";
import { useShakeDetection } from "@/hooks/useShakeDetection";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { useThemeEffects } from "@/hooks/useThemeEffects";
import { usePartnerAwayMessage } from "@/hooks/usePartnerAwayMessage";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import { useProposals } from "@/hooks/useProposals";
import { useAiMemory, fetchComposeHelp } from "@/hooks/useAiMemory";
import { useAiCompanion, type CompanionReaction } from "@/hooks/useAiCompanion";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import PinnedMessagesBar from "@/components/chat/PinnedMessagesBar";
import MessageInput from "@/components/chat/MessageInput";
import SearchBar from "@/components/chat/SearchBar";
import SearchResultModal from "@/components/chat/SearchResultModal";
import ConnectionBanner from "@/components/chat/ConnectionBanner";
import ProfilePanel from "@/components/chat/ProfilePanel";
import ImageLightbox from "@/components/chat/ImageLightbox";
import LetterComposer from "@/components/chat/LetterComposer";
import ProposalSheet from "@/components/chat/ProposalSheet";
import ProposalBanner from "@/components/chat/ProposalBanner";
import ProposalTimeUpOverlay from "@/components/chat/ProposalTimeUpOverlay";
import CompanionCard from "@/components/chat/CompanionCard";
import DecoyChat from "@/components/chat/DecoyChat";
import { useDecoyState } from "@/hooks/useDecoy";
import type { DecoySkin } from "@/lib/decoySkins";
import MessageEffects, { detectEffect, type EffectType } from "@/components/chat/MessageEffects";
import SecretOverlayHost, { type SecretOverlayState } from "@/components/secrets/SecretOverlayHost";
import { RpsPickerOverlay } from "@/components/secrets/RpsOverlay";
import { parseSecretCommand, detectRichTrigger, randomRpsThrow, rpsOutcome, encodeRps, type RpsThrow } from "@/lib/secretCommands";
import { COUPLE_FORTUNES, LOVE_QUOTES, MYSTERY_PRIZES, detectPlanetSequence, pickRandom } from "@/lib/secretContent";
import TouchReactionOverlay, { type TouchEmotion, TOUCH_EMOTIONS, type CustomEmotionConfig } from "@/components/chat/TouchReactionOverlay";
import ShakeLoveOverlay from "@/components/chat/ShakeLoveOverlay";
import SkyBackground from "@/components/chat/SkyBackground";
import ThemeAmbientLayer from "@/components/chat/ThemeAmbientLayer";
import ThemeSurprises from "@/components/chat/ThemeSurprises";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getThemeById } from "@/lib/chatThemes";
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
  const { role, loading: roleLoading } = useUserRole(user?.id);

  if (authLoading || roleLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/you/login" replace />;

  if (role === "demo") return <Navigate to="/you/dashboard" replace />;

  return <ChatView userId={user.id} role={role} canBanAction={true} />;
};

const ChatView: React.FC<{ userId: string; role: "partner" | "demo" | "admin"; canBanAction: boolean }> = ({ userId, role, canBanAction }) => {
  const navigate = useNavigate();
  const partner = usePartner(userId);
  const currentUser = useCurrentUser(userId);
  const partnerAwayMessage = usePartnerAwayMessage(partner?.user_id, partner?.is_online, partner?.last_seen);
  const { messages, loading, loadingMore, hasMore, loadMore, sendMessage } = useMessages(userId);
  const { partnerTyping, handleTyping, setTyping } = useTyping(userId, currentUser?.name ?? undefined);
  const [replyTo, setReplyTo] = useState<Tables<"messages"> | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchResultMsg, setSearchResultMsg] = useState<Tables<"messages"> | null>(null);
  const [searchLightbox, setSearchLightbox] = useState<{ src: string; type: "image" | "video" } | null>(null);
  const { results, searching, query, search, clear } = useSearch();
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [dynamicWallpaper, setDynamicWallpaper] = useState(false);
  const [messageEffects, setMessageEffects] = useState(true);
  const [touchOverlay, setTouchOverlay] = useState<{ emotion: TouchEmotion; senderName: string } | null>(null);
  const [secretEvent, setSecretEvent] = useState<SecretOverlayState | null>(null);
  const [rpsPicking, setRpsPicking] = useState(false);
  const lastSecretEventId = useRef<string | null>(null);
  const [showLetterComposer, setShowLetterComposer] = useState(false);
  const [showProposalSheet, setShowProposalSheet] = useState(false);
  const [timeUpPact, setTimeUpPact] = useState<string | null>(null);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [chatTheme, setChatTheme] = useState("default");
  const lastTouchReactionId = useRef<string | null>(null);

  useOnlineStatus(userId);
  useMarkSeen(userId, messages);
  const { current: pendingAnim, dismiss: dismissPendingAnim } = useAnimationQueue(userId);
  const [queuedKeywordEffect, setQueuedKeywordEffect] = useState<EffectType>(null);
  const { shakeDetected, reset: resetShake } = useShakeDetection();
  const { pinnedMessages, pinMessage, unpinMessage, isMessagePinned } = usePinnedMessages();
  const { propose, accept, decline, complete, incomingPending, active: activePact } = useProposals(partner?.user_id);
  const { remember } = useAiMemory();
  const { reactToMessage } = useAiCompanion();
  const [companion, setCompanion] = useState<{ loading: boolean; result: CompanionReaction | null } | null>(null);
  const { active: decoyActive, activate: activateDecoy, deactivate: deactivateDecoy } = useDecoyState();
  const [decoySkin, setDecoySkin] = useState<DecoySkin>("chatgpt");
  const [decoyEnabled, setDecoyEnabled] = useState(false);
  const [decoyUnlockHash, setDecoyUnlockHash] = useState<string | null>(null);
  const messageListRef = useRef<{ scrollToMessage: (id: string) => void } | null>(null);

  const themeConfig = getThemeById(chatTheme);
  const themeEffects = useThemeEffects(chatTheme);
  const animationsEnabled = useAnimationsEnabled();

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
    } else if (pendingAnim.animation_type === "secret_event") {
      const data = pendingAnim.animation_data;
      setSecretEvent({
        type: data.type as SecretOverlayState["type"],
        result: data.result != null ? String(data.result) : undefined,
        matched: !!data.matched,
        isMine: !!data.isMine,
        prize: data.prize,
        senderName: pendingAnim.sender_name ?? "Partner",
      });
      dismissPendingAnim();
    }
  }, [pendingAnim, dismissPendingAnim]);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from("chat_user_settings")
        .select("wallpaper_url, dynamic_wallpaper, message_effects, chat_theme, decoy_skin, decoy_enabled, decoy_unlock_hash")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setWallpaper((data as any).wallpaper_url ?? "none");
        setDynamicWallpaper((data as any).dynamic_wallpaper ?? false);
        setMessageEffects((data as any).message_effects ?? true);
        setChatTheme((data as any).chat_theme ?? "default");
        setDecoySkin(((data as any).decoy_skin as DecoySkin) ?? "chatgpt");
        setDecoyEnabled((data as any).decoy_enabled ?? false);
        setDecoyUnlockHash((data as any).decoy_unlock_hash ?? null);
      }
    };
    loadSettings();
  }, [userId]);

  const effectiveWallpaper = useMemo(() => {
    if (wallpaper === "sky") return null;
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

  // Most recent lucky number the partner sent (for the /lucky match bonus).
  const partnerLastLucky = (): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if ((m as any).message_type === "lucky" && m.user_id !== userId) return m.content;
    }
    return null;
  };

  // Play a rock-paper-scissors round against fate, then sync the result.
  const playRpsRound = async (mine: RpsThrow) => {
    setRpsPicking(false);
    const opp = randomRpsThrow();
    const outcome = rpsOutcome(mine, opp);
    const encoded = encodeRps(mine, opp, outcome);
    const error = await sendMessage(encoded, currentUser?.name ?? "Unknown", { message_type: "rps" } as any);
    if (!error) {
      setSecretEvent({ type: "rps", result: encoded, isMine: true, senderName: "You" });
      if (partner && !partner.is_online) {
        await supabase.from("pending_animations").insert({
          target_user_id: partner.user_id,
          animation_type: "secret_event",
          animation_data: { type: "rps", result: encoded, isMine: false },
          sender_name: currentUser?.name ?? "Partner",
        } as any);
      }
    }
  };

  // Easter egg: unlock + switch to the galaxy theme, and persist it.
  const unlockGalaxyTheme = useCallback(async () => {
    setChatTheme("galaxy");
    toast({ title: "🌌 Galaxy theme unlocked!", description: "You named the planets in order." });
    try {
      await supabase
        .from("chat_user_settings")
        .update({ chat_theme: "galaxy" } as any)
        .eq("user_id", userId);
    } catch { /* non-critical */ }
  }, [userId]);

  // Fortune cookie — tapping the header 3× cracks one open.
  const handleHeaderSecretTap = useCallback(() => {
    setSecretEvent({ type: "fortune", result: pickRandom(COUPLE_FORTUNES), senderName: "You" });
  }, []);

  const handleSend = async (content: string, extras?: any) => {
    // /garden — open the Secret Garden (navigation command, nothing sent).
    if (!extras?.message_type && /^\s*\/garden\s*$/i.test(content)) {
      navigate("/garden");
      return null;
    }

    // Secret commands (/flip, /dice, /8ball, /lucky, /rps, "surprise me",
    // "i'm bored"): the result is computed here so both screens render the same
    // outcome. Stored in `content` with a special message_type, then synced via
    // the normal realtime message flow.
    const cmd = !extras?.message_type ? parseSecretCommand(content) : null;
    if (cmd) {
      await setTyping(false);

      // Rock-paper-scissors opens a throw picker first; nothing is sent yet.
      if (cmd.interactive && cmd.message_type === "rps") {
        setRpsPicking(true);
        return null;
      }

      const error = await sendMessage(cmd.result, currentUser?.name ?? "Unknown", { message_type: cmd.message_type });
      if (!error) {
        let overlay: SecretOverlayState;
        if (cmd.message_type === "surprise") {
          // The chosen effect key lives in the result; render that overlay.
          overlay = { type: cmd.result as SecretOverlayState["type"], senderName: "You", isMine: true };
        } else if (cmd.message_type === "lucky") {
          const matched = partnerLastLucky() === cmd.result;
          overlay = { type: "lucky", result: cmd.result, matched, senderName: "You", isMine: true };
        } else {
          overlay = { type: cmd.message_type as SecretOverlayState["type"], result: cmd.result, senderName: "You", isMine: true };
        }
        setSecretEvent(overlay);
        if (partner && !partner.is_online) {
          await supabase.from("pending_animations").insert({
            target_user_id: partner.user_id,
            animation_type: "secret_event",
            animation_data: { type: overlay.type, result: overlay.result, matched: overlay.matched },
            sender_name: currentUser?.name ?? "Partner",
          } as any);
        }
      }
      return error;
    }

    await setTyping(false);
    const error = await sendMessage(content, currentUser?.name ?? "Unknown", extras);

    // Rich text triggers (sorry → mending heart, i'm angry → fire, are you there
    // → heartbeat, same → mirror): sent as a normal message but also fire a
    // full-screen overlay on both screens.
    const rich = !extras?.message_type && content ? detectRichTrigger(content) : null;
    if (!error && rich) {
      setSecretEvent({ type: rich, senderName: "You" });
    }

    // Easter egg: naming all 8 planets in order unlocks the galaxy theme.
    if (!error && !extras?.message_type && content && detectPlanetSequence(content)) {
      unlockGalaxyTheme();
    }

    // Mystery prize on every 50th message in the conversation. Tied to the real
    // total count so it's deterministic; the prize index derives from the
    // milestone so both partners would see the same prize.
    if (!error) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true });
      if (count && count % 50 === 0) {
        const prizeDef = MYSTERY_PRIZES[(count / 50 - 1) % MYSTERY_PRIZES.length];
        const prize = { ...prizeDef, milestone: count };
        setSecretEvent({ type: "mysteryprize", prize, senderName: "You" });
        if (partner) {
          await supabase.from("pending_animations").insert({
            target_user_id: partner.user_id,
            animation_type: "secret_event",
            animation_data: { type: "mysteryprize", prize },
            sender_name: currentUser?.name ?? "Partner",
          } as any);
        }
      }
    }

    if (!error && partner && !partner.is_online) {
      const msgType = extras?.message_type;
      if (msgType === "touch_reaction") {
        await supabase.from("pending_animations").insert({
          target_user_id: partner.user_id,
          animation_type: "touch_reaction",
          animation_data: { emotion: content },
          sender_name: currentUser?.name ?? "Partner",
        } as any);
      } else if (rich) {
        await supabase.from("pending_animations").insert({
          target_user_id: partner.user_id,
          animation_type: "secret_event",
          animation_data: { type: rich },
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

  // Highlight matched message IDs for the message list
  const scrollToMessage = useCallback((messageId: string) => {
    // Close search
    setShowSearch(false);
    clear();
    // Scroll to the message
    const tryScroll = () => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        document.querySelectorAll(".search-highlight-active").forEach((e) => {
          e.classList.remove("ring-2", "ring-primary/40", "bg-primary/10", "search-highlight-active");
        });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary/40", "bg-primary/10", "search-highlight-active");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary/40", "bg-primary/10", "search-highlight-active");
        }, 3000);
        return true;
      }
      return false;
    };
    if (!tryScroll()) {
      setTimeout(tryScroll, 300);
    }
  }, [clear]);

  const initializedTouchRef = useRef(false);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!initializedTouchRef.current) {
      initializedTouchRef.current = true;
      lastTouchReactionId.current = messages[messages.length - 1].id;
      lastSecretEventId.current = messages[messages.length - 1].id;
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
    // Secret events from the partner — play the same animation on this screen.
    const lastType = (last as any).message_type;
    const senderName = last.username ?? "Partner";
    if (
      last.user_id !== userId &&
      last.id !== lastSecretEventId.current
    ) {
      if (lastType === "coinflip" || lastType === "diceroll" || lastType === "eightball") {
        // Result-bearing commands: render the exact outcome the sender computed.
        lastSecretEventId.current = last.id;
        setSecretEvent({
          type: lastType,
          result: last.content ?? (lastType === "coinflip" ? "heads" : "1"),
          senderName,
        });
      } else if (lastType === "lucky") {
        lastSecretEventId.current = last.id;
        // Did the partner's number match my most recent lucky number?
        let myLast: string | null = null;
        for (let i = messages.length - 2; i >= 0; i--) {
          const m = messages[i];
          if ((m as any).message_type === "lucky" && m.user_id === userId) { myLast = m.content; break; }
        }
        setSecretEvent({ type: "lucky", result: last.content ?? "1", matched: myLast != null && myLast === last.content, senderName });
      } else if (lastType === "rps") {
        lastSecretEventId.current = last.id;
        setSecretEvent({ type: "rps", result: last.content ?? "", isMine: false, senderName });
      } else if (lastType === "surprise") {
        lastSecretEventId.current = last.id;
        setSecretEvent({ type: (last.content ?? "mirror") as SecretOverlayState["type"], senderName });
      } else if (lastType === "bored") {
        lastSecretEventId.current = last.id;
        setSecretEvent({ type: "bored", result: last.content ?? "tic_tac_toe", isMine: false, senderName });
      } else if ((!lastType || lastType === "text") && last.content) {
        // Plain text from the partner may carry a rich trigger (sorry, angry…).
        const rich = detectRichTrigger(last.content);
        if (rich) {
          lastSecretEventId.current = last.id;
          setSecretEvent({ type: rich, senderName });
        }
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

  const handleBanAction = useCallback(async () => {
    const isAdmin = role === "admin";
    const targetUserId = isAdmin ? partner?.user_id : userId;
    if (!targetUserId) {
      toast({ title: "Unable to ban user", description: "Partner not available.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.rpc("ban_user_for_five_minutes", {
      target_user_id: targetUserId,
      ban_reason: isAdmin ? "Temporary moderation action" : "Temporary self-hide action",
    });

    if (error) {
      toast({ title: "Ban failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: isAdmin ? "User banned" : "You are hidden",
      description: "Access blocked for 5 minutes.",
    });
  }, [partner?.user_id, role, userId]);

  const handleTeachAi = useCallback(async (msg: Tables<"messages">) => {
    if (!msg.content) return;
    // A message authored by the partner is a fact about the partner; otherwise about me.
    const subjectId = msg.user_id && msg.user_id !== userId ? msg.user_id : userId;
    const { error } = await remember(msg.content, subjectId ?? userId);
    toast(
      error
        ? { title: "Couldn't save", description: error.message, variant: "destructive" }
        : { title: "Saved to memory 🧠", description: "The assistant will remember this." },
    );
  }, [remember, userId]);

  const handleAskCompanion = useCallback(async (msg: Tables<"messages">) => {
    if (!msg.content) return;
    setCompanion({ loading: true, result: null });
    const result = await reactToMessage(msg.content);
    setCompanion({ loading: false, result });
  }, [reactToMessage]);

  const handleComposeHelp = useCallback(async (draft: string) => {
    const { suggestion, error } = await fetchComposeHelp(draft, partner?.user_id);
    if (error) {
      toast({ title: "Compose help unavailable", description: error.message, variant: "destructive" });
      return null;
    }
    return suggestion;
  }, [partner?.user_id]);

  // Decoy / panic mode: replace the entire chat with a disguised AI app.
  // Real messages are never rendered while this is active.
  if (decoyActive) {
    return (
      <DecoyChat
        skin={decoySkin}
        unlockHash={decoyUnlockHash}
        onUnlock={deactivateDecoy}
      />
    );
  }

  return (
    <div className={`flex h-dvh ${themeConfig.cssClass}`} style={{ background: themeConfig.cssClass ? 'hsl(var(--chat-bg))' : undefined }}>
      {/* Theme ambient effects */}
      {animationsEnabled && (
        <>
          <ThemeAmbientLayer ambient={themeEffects.ambient} />
          <ThemeSurprises surprise={themeEffects.surprises} interval={themeEffects.surpriseInterval} />
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0 relative">
        {immersiveMode && wallpaper === "sky" && (
          <div className="absolute inset-0 z-0">
            <SkyBackground
              userId={userId}
              partnerUserId={partner?.user_id}
              currentUserName={currentUser?.name ?? ""}
              onHeartCloudCaught={() => {
                toast({ title: "💕 You caught a heart cloud!" });
              }}
            />
          </div>
        )}
        <div className="relative z-10">
          <ChatHeader
            partner={partner}
            partnerTyping={partnerTyping}
            partnerAwayMessage={partnerAwayMessage}
            onSearchToggle={() => {
              if (showSearch) {
                clear();
                document.querySelectorAll(".search-highlight-active").forEach((e) => {
                  e.classList.remove("ring-2", "ring-primary/40", "bg-primary/10", "search-highlight-active");
                });
              }
              setShowSearch(!showSearch);
            }}
            onProfileToggle={() => setShowProfile(!showProfile)}
            onSecretTap={handleHeaderSecretTap}
            immersiveMode={immersiveMode}
            onImmersiveToggle={() => setImmersiveMode(!immersiveMode)}
            showImmersiveButton={wallpaper === "sky"}
            themeEffects={themeEffects}
            canBanPartner={canBanAction}
            onBanPartner={handleBanAction}
            banButtonTitle={role === "admin" ? "Ban partner for 5 minutes" : "Hide this account for 5 minutes"}
            showDecoyButton={true}
            onDecoy={activateDecoy}
          />
        </div>
        {!immersiveMode && (
          <>
            <ConnectionBanner />
            <PinnedMessagesBar
              pinnedMessages={pinnedMessages}
              currentUserId={userId}
              onScrollToMessage={(id) => {
                const el = document.getElementById(`msg-${id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-primary/50");
                  setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
                }
              }}
              onUnpin={(messageId) => unpinMessage(messageId, userId)}
            />
            <ProposalBanner
              incomingPending={incomingPending}
              active={activePact}
              onAccept={accept}
              onDecline={decline}
              onComplete={complete}
              onExpire={(id) => {
                const ended = activePact?.id === id ? activePact : null;
                setTimeUpPact(ended?.title ?? "pact");
              }}
            />
            {showSearch && (
              <SearchBar
                query={query}
                onSearch={search}
                onClose={() => {
                  setShowSearch(false);
                  clear();
                }}
                results={results}
                searching={searching}
                onResultClick={(msg) => setSearchResultMsg(msg)}
              />
            )}
            <MessageList
              messages={messages}
              currentUserId={userId}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              partnerTyping={partnerTyping}
              onReply={setReplyTo}
              wallpaper={effectiveWallpaper}
              useSkyBackground={wallpaper === "sky"}
              typingText={themeEffects.typingText}
              onPin={async (msg) => {
                if (isMessagePinned(msg.id)) {
                  await unpinMessage(msg.id, userId);
                } else {
                  await pinMessage(msg.id, userId);
                }
              }}
              isMessagePinned={isMessagePinned}
              onTeachAi={handleTeachAi}
              onAskCompanion={handleAskCompanion}
              onEmptyDoubleTap={() => setSecretEvent({ type: "scratch", result: pickRandom(LOVE_QUOTES), senderName: "You" })}
            />
            <MessageInput
              onSend={handleSend}
              onTyping={handleTyping}
              userId={userId}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onOpenLetter={() => setShowLetterComposer(true)}
              onOpenProposal={() => setShowProposalSheet(true)}
              onComposeHelp={handleComposeHelp}
              placeholder={themeEffects.inputPlaceholder}
              secretPlaceholder={themeEffects.secretPlaceholder}
              sendLabel={themeEffects.sendLabel}
            />
          </>
        )}
      </div>

      {showProfile && (
        <ProfilePanel partner={partner} onClose={() => setShowProfile(false)} />
      )}

      {searchResultMsg && (
        <SearchResultModal
          message={searchResultMsg}
          isOwn={searchResultMsg.user_id === userId}
          partnerName={partner?.name}
          partnerAvatar={partner?.profileurl}
          currentUserName={currentUser?.name}
          currentUserAvatar={currentUser?.profileurl}
          onClose={() => setSearchResultMsg(null)}
          onJumpToMessage={(id) => {
            setSearchResultMsg(null);
            scrollToMessage(id);
          }}
          onOpenMedia={(src, type) => setSearchLightbox({ src, type })}
        />
      )}

      {searchLightbox && (
        <ImageLightbox
          src={searchLightbox.src}
          type={searchLightbox.type}
          onClose={() => setSearchLightbox(null)}
        />
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

      <SecretOverlayHost overlay={secretEvent} onDismiss={() => setSecretEvent(null)} />

      {rpsPicking && (
        <RpsPickerOverlay onPick={playRpsRound} onCancel={() => setRpsPicking(false)} />
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

      {shakeDetected && (
        <ShakeLoveOverlay
          partnerName={partner?.name ?? "Love"}
          onDismiss={resetShake}
        />
      )}

      <ProposalSheet
        open={showProposalSheet}
        onClose={() => setShowProposalSheet(false)}
        onPropose={async (type, title, payload) => {
          const res = await propose(type, title, payload);
          if (res.error) {
            toast({ title: "Couldn't send pact", description: res.error.message, variant: "destructive" });
          } else {
            toast({ title: "Pact proposed 🤝", description: "Waiting for your partner to accept." });
          }
          return res;
        }}
      />

      {timeUpPact && (
        <ProposalTimeUpOverlay title={timeUpPact} onDismiss={() => setTimeUpPact(null)} />
      )}

      {companion && (
        <CompanionCard
          loading={companion.loading}
          result={companion.result}
          onClose={() => setCompanion(null)}
        />
      )}
    </div>
  );
};

export default Chat;
