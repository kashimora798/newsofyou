import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { checkNewYear, useWaiterAchievement } from "@/hooks/useSecretAchievements";
import { getThemeById } from "@/lib/chatThemes";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatLastSeen } from "@/lib/dateUtils";
import { LogOut, Loader2 } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import StreakCounter from "@/components/home/StreakCounter";
import OnThisDay from "@/components/home/OnThisDay";
import AiSummary from "@/components/home/AiSummary";
import DailyQuestion from "@/components/home/DailyQuestion";
import Tamagotchi from "@/components/home/Tamagotchi";
import AchievementWidget from "@/components/home/AchievementWidget";
import SoulmateClock from "@/components/home/SoulmateClock";
import TodoWidget from "@/components/home/TodoWidget";
import ReminderWidget from "@/components/home/ReminderWidget";
import CalendarWidget from "@/components/home/CalendarWidget";
import ComplimentPopup from "@/components/home/ComplimentPopup";
import DailyChecklistWidget from "@/components/home/DailyChecklistWidget";

const Home: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <HomeView userId={user.id} onSignOut={signOut} />;
};

const HomeView: React.FC<{ userId: string; onSignOut: () => void }> = ({ userId, onSignOut }) => {
  const navigate = useNavigate();
  const partner = usePartner(userId);
  const currentUser = useCurrentUser(userId);
  const unreadCount = useUnreadCount(userId);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState("default");

  useOnlineStatus(userId);
  useWaiterAchievement(userId, partner?.is_online);

  // Load chat theme
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_user_settings")
        .select("chat_theme")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setChatTheme((data as any).chat_theme ?? "default");
    };
    load();
  }, [userId]);
  useWaiterAchievement(userId, partner?.is_online);

  // Check NYE achievement on load
  useEffect(() => { checkNewYear(userId); }, [userId]);

  useEffect(() => {
    const fetchLast = async () => {
      const { data } = await supabase
        .from("messages")
        .select("content, created_at, user_id, image_url, gif_url, sticker_url, file_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const preview = data.content
          || (data.image_url ? "📷 Photo" : "")
          || ((data as any).gif_url ? "GIF" : "")
          || ((data as any).sticker_url ? "🎨 Sticker" : "")
          || ((data as any).file_name ? `📎 ${(data as any).file_name}` : "")
          || "Message";
        setLastMessage(preview);
        setLastMessageTime(data.created_at);
      }
    };
    fetchLast();
  }, [userId]);

  const themeConfig = getThemeById(chatTheme);

  return (
    <div className={`flex flex-col h-dvh bg-background ${themeConfig.cssClass}`}>
      {/* Header */}
      <header className="px-5 pt-6 pb-4 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground font-heading">ChatRoom</h1>
          <button onClick={onSignOut} className="p-2 rounded-full hover:bg-muted transition-colors">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {/* Current user info */}
        <div className="flex items-center gap-3 mt-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={currentUser?.profileurl ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {currentUser?.name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{currentUser?.name ?? "..."}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.bio ?? "Hey there!"}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Chat card */}
        <button
          onClick={() => navigate("/chat")}
          className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="relative">
            <Avatar className="h-14 w-14">
              <AvatarImage src={partner?.profileurl ?? ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {partner?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            {partner?.is_online && (
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-online border-2 border-card" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground truncate">{partner?.name ?? "..."}</h3>
              {lastMessageTime && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatLastSeen(lastMessageTime)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {partner?.is_online ? "Online" : `Last seen ${formatLastSeen(partner?.last_seen ?? null)}`}
            </p>
            {lastMessage && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMessage}</p>
            )}
          </div>
          {unreadCount > 0 && (
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-1.5 shrink-0">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Daily Checklist */}
        <DailyChecklistWidget />

        {/* To-Do Lists */}
        <TodoWidget />

        {/* Reminders */}
        <ReminderWidget />

        {/* Calendar Countdown */}
        <CalendarWidget />
        <DailyQuestion />

        {/* Relationship Tamagotchi */}
        <Tamagotchi />

        {/* Achievements */}
        <AchievementWidget />

        {/* AI Chat Summary */}
        <AiSummary />

        {/* Soulmate Clock */}
        <SoulmateClock userId={userId} partnerOnline={partner?.is_online} partnerName={partner?.name ?? undefined} />

        {/* Streak Counter */}
        <StreakCounter />

        {/* On This Day */}
        <OnThisDay />

        {/* Quick Links */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Links</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { path: "/bookmarks", emoji: "📌", label: "Bookmarks" },
              { path: "/reminders", emoji: "🔔", label: "Reminders" },
              { path: "/calendar", emoji: "📅", label: "Calendar" },
              { path: "/compliments", emoji: "💌", label: "Compliments" },
            ].map((link) => (
              <button key={link.path} onClick={() => navigate(link.path)} className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors text-left">
                <span className="text-lg">{link.emoji}</span>
                <span className="text-xs font-medium text-foreground">{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-xl">
              <p className="text-2xl font-bold text-primary">{unreadCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Unread Messages</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-xl">
              <p className="text-2xl font-bold text-foreground">
                {partner?.is_online ? "🟢" : "⚫"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {partner?.name} is {partner?.is_online ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ComplimentPopup />
      <BottomNav />
    </div>
  );
};

export default Home;
