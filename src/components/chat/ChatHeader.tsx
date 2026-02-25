import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PresenceStatus from "./PresenceStatus";
import { Search, ArrowLeft, LogOut } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface ChatHeaderProps {
  partner: Tables<"user_status"> | null;
  partnerTyping: boolean;
  onSearchToggle?: () => void;
  onProfileToggle?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ partner, partnerTyping, onSearchToggle, onProfileToggle }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
      <button onClick={() => navigate("/home")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>
      <div className="relative cursor-pointer" onClick={onProfileToggle}>
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

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onProfileToggle}>
        <h2 className="text-sm font-semibold text-foreground truncate">{partner?.name ?? "Loading..."}</h2>
        <PresenceStatus partner={partner} partnerTyping={partnerTyping} />
      </div>

      <button onClick={onSearchToggle} className="p-2 rounded-full hover:bg-muted transition-colors">
        <Search className="h-5 w-5 text-muted-foreground" />
      </button>
      <button onClick={signOut} className="p-2 rounded-full hover:bg-muted transition-colors" title="Logout">
        <LogOut className="h-5 w-5 text-muted-foreground" />
      </button>
    </header>
  );
};

export default ChatHeader;
