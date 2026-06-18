import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PresenceStatus from "./PresenceStatus";
import { Search, ArrowLeft, LogOut, Eye, EyeOff, ShieldBan, VenetianMask } from "lucide-react";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";
import type { ThemeEffectsConfig } from "@/hooks/useThemeEffects";

interface ChatHeaderProps {
  partner: Tables<"user_status"> | null;
  partnerTyping: boolean;
  onSearchToggle?: () => void;
  onProfileToggle?: () => void;
  onSecretTap?: () => void;
  immersiveMode?: boolean;
  onImmersiveToggle?: () => void;
  showImmersiveButton?: boolean;
  themeEffects?: ThemeEffectsConfig;
  canBanPartner?: boolean;
  onBanPartner?: () => void;
  banButtonTitle?: string;
  partnerAwayMessage?: string | null;
  showDecoyButton?: boolean;
  onDecoy?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ partner, partnerTyping, onSearchToggle, onProfileToggle, onSecretTap, immersiveMode, onImmersiveToggle, showImmersiveButton, themeEffects, canBanPartner, onBanPartner, banButtonTitle, partnerAwayMessage, showDecoyButton, onDecoy }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // Tap the name area 3× quickly → crack a fortune cookie (Phase 2 easter egg).
  // A single settled tap still opens the profile; only a rapid triple-tap fires
  // the secret, so the two gestures don't fight.
  const tapCount = React.useRef(0);
  const tapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      onSecretTap?.();
      return;
    }
    tapTimer.current = setTimeout(() => {
      if (tapCount.current === 1) onProfileToggle?.();
      tapCount.current = 0;
    }, 320);
  };

  const handleLogout = async () => {
    await signOut();
    window.location.replace("/you/login");
  };

  const displayName = partner?.name ?? "Loading...";
  const themedName = themeEffects ? themeEffects.headerTitle(displayName) : displayName;

  return (
    <header className="glass-chat-header flex items-center gap-3 px-4 py-2.5 shrink-0 relative overflow-hidden">
      {/* Theme decoration overlays */}
      {themeEffects?.headerDecoration === "classified" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none">
          <span className="text-[60px] font-bold tracking-[12px] text-destructive rotate-[-15deg]" style={{ fontFamily: "monospace" }}>
            CLASSIFIED
          </span>
        </div>
      )}
      {themeEffects?.headerDecoration === "glitch" && (
        <div className="absolute inset-0 pointer-events-none theme-header-glitch" />
      )}
      {themeEffects?.headerDecoration === "hearts" && (
        <div className="absolute right-12 top-1 pointer-events-none opacity-20 text-2xl select-none animate-pulse">
          💕
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate("/home")}
        className="p-1.5 rounded-full hover:bg-muted/60 transition-colors relative z-10"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </motion.button>

      <motion.div
        className="relative cursor-pointer z-10"
        onClick={handleTitleTap}
        whileTap={{ scale: 0.95 }}
      >
        <Avatar className="h-10 w-10 ring-2 ring-primary/10 ring-offset-1 ring-offset-background">
          <AvatarImage src={partner?.profileurl ?? ""} alt={partner?.name ?? "Partner"} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {partner?.name?.charAt(0) ?? "?"}
          </AvatarFallback>
        </Avatar>
        {partner?.is_online && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-online border-[2.5px] border-card"
          />
        )}
      </motion.div>

      <div className="flex-1 min-w-0 cursor-pointer z-10" onClick={handleTitleTap}>
        {themeEffects?.headerDecoration === "marquee" ? (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-foreground whitespace-nowrap theme-marquee">
              {themedName}
            </h2>
          </div>
        ) : (
          <h2 className="text-[16px] font-semibold text-foreground truncate tracking-tight">{themedName}</h2>
        )}
        {themeEffects?.headerSubtitle && !partnerTyping && !partnerAwayMessage ? (
          <p className="text-[10px] text-muted-foreground truncate">{themeEffects.headerSubtitle}</p>
        ) : (
          <PresenceStatus partner={partner} partnerTyping={partnerTyping} partnerAwayMessage={partnerAwayMessage} />
        )}
      </div>

      {/* Visitor counter for GeoCities */}
      {themeEffects?.themeId === "geocities" && (
        <div className="text-[9px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border font-bold z-10" style={{ fontFamily: "'Comic Neue', cursive" }}>
          Visitors: {Math.floor(Math.random() * 9000 + 1000)}
        </div>
      )}

      {showDecoyButton && (
        <HeaderBtn onClick={onDecoy} title="Quick hide">
          <VenetianMask className="h-[18px] w-[18px] text-muted-foreground" />
        </HeaderBtn>
      )}
      {canBanPartner && (
        <HeaderBtn onClick={onBanPartner} title={banButtonTitle ?? "Ban user for 5 minutes"}>
          <ShieldBan className="h-[18px] w-[18px] text-rose-500" />
        </HeaderBtn>
      )}
      {showImmersiveButton && (
        <HeaderBtn onClick={onImmersiveToggle}>
          {immersiveMode ? <EyeOff className="h-[18px] w-[18px] text-muted-foreground" /> : <Eye className="h-[18px] w-[18px] text-muted-foreground" />}
        </HeaderBtn>
      )}
      <HeaderBtn onClick={onSearchToggle}>
        <Search className="h-[18px] w-[18px] text-muted-foreground" />
      </HeaderBtn>
      <HeaderBtn onClick={handleLogout} title="Logout">
        <LogOut className="h-[18px] w-[18px] text-muted-foreground" />
      </HeaderBtn>
    </header>
  );
};

const HeaderBtn: React.FC<{ onClick?: () => void; title?: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <motion.button
    whileTap={{ scale: 0.88 }}
    onClick={onClick}
    title={title}
    className="p-2 rounded-xl hover:bg-muted/60 transition-colors z-10"
  >
    {children}
  </motion.button>
);

export default ChatHeader;
