import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PresenceStatus from "./PresenceStatus";
import { Search, ArrowLeft, LogOut, Eye, EyeOff } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { ThemeEffectsConfig } from "@/hooks/useThemeEffects";

interface ChatHeaderProps {
  partner: Tables<"user_status"> | null;
  partnerTyping: boolean;
  onSearchToggle?: () => void;
  onProfileToggle?: () => void;
  immersiveMode?: boolean;
  onImmersiveToggle?: () => void;
  showImmersiveButton?: boolean;
  themeEffects?: ThemeEffectsConfig;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ partner, partnerTyping, onSearchToggle, onProfileToggle, immersiveMode, onImmersiveToggle, showImmersiveButton, themeEffects }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const displayName = partner?.name ?? "Loading...";
  const themedName = themeEffects ? themeEffects.headerTitle(displayName) : displayName;

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0 relative overflow-hidden">
      {/* Theme decoration overlays */}
      {themeEffects?.headerDecoration === "classified" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none">
          <span className="text-[60px] font-bold tracking-[12px] text-red-500 rotate-[-15deg]" style={{ fontFamily: "monospace" }}>
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

      <button onClick={() => navigate("/home")} className="p-1.5 rounded-full hover:bg-muted transition-colors relative z-10">
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>
      <div className="relative cursor-pointer z-10" onClick={onProfileToggle}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={partner?.profileurl ?? ""} alt={partner?.name ?? "Partner"} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {partner?.name?.charAt(0) ?? "?"}
          </AvatarFallback>
        </Avatar>
        {partner?.is_online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-online border-2 border-card" />
        )}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer z-10" onClick={onProfileToggle}>
        {themeEffects?.headerDecoration === "marquee" ? (
          <div className="overflow-hidden">
            <h2 className="text-sm font-semibold text-foreground whitespace-nowrap theme-marquee">
              {themedName}
            </h2>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-foreground truncate">
            {themedName}
          </h2>
        )}
        {themeEffects?.headerSubtitle && !partnerTyping ? (
          <p className="text-[10px] text-muted-foreground truncate">{themeEffects.headerSubtitle}</p>
        ) : (
          <PresenceStatus partner={partner} partnerTyping={partnerTyping} />
        )}
      </div>

      {/* Visitor counter for GeoCities */}
      {themeEffects?.themeId === "geocities" && (
        <div className="text-[9px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border font-bold z-10" style={{ fontFamily: "'Comic Neue', cursive" }}>
          Visitors: {Math.floor(Math.random() * 9000 + 1000)}
        </div>
      )}

      {showImmersiveButton && (
        <button onClick={onImmersiveToggle} className="p-2 rounded-full hover:bg-muted transition-colors z-10" title="Toggle immersive sky">
          {immersiveMode ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}
      <button onClick={onSearchToggle} className="p-2 rounded-full hover:bg-muted transition-colors z-10">
        <Search className="h-5 w-5 text-muted-foreground" />
      </button>
      <button onClick={signOut} className="p-2 rounded-full hover:bg-muted transition-colors z-10" title="Logout">
        <LogOut className="h-5 w-5 text-muted-foreground" />
      </button>
    </header>
  );
};

export default ChatHeader;
