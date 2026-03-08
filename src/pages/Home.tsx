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
import { LogOut, Loader2, ChevronRight, Bookmark, Bell, CalendarDays, Heart, CheckSquare, Trophy, Gamepad2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/layout/BottomNav";
import StreakCounter from "@/components/home/StreakCounter";
import OnThisDay from "@/components/home/OnThisDay";
import AiSummary from "@/components/home/AiSummary";
import DailyQuestion from "@/components/home/DailyQuestion";
import Tamagotchi from "@/components/home/Tamagotchi";
import SoulmateClock from "@/components/home/SoulmateClock";
import ReminderWidget from "@/components/home/ReminderWidget";
import CalendarWidget from "@/components/home/CalendarWidget";
import ComplimentPopup from "@/components/home/ComplimentPopup";
import DailyChecklistWidget from "@/components/home/DailyChecklistWidget";

// Stagger animation variants
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const headerVariant = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200, damping: 20 } },
};

const Home: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-primary" />
        </motion.div>
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

  const quickLinks = [
    { path: "/bookmarks", icon: Bookmark, label: "Bookmarks", color: "text-amber-500" },
    { path: "/reminders", icon: Bell, label: "Reminders", color: "text-blue-500" },
    { path: "/calendar", icon: CalendarDays, label: "Calendar", color: "text-emerald-500" },
    { path: "/compliments", icon: Heart, label: "Compliments", color: "text-pink-500" },
    { path: "/daily-checklist", icon: CheckSquare, label: "Checklist", color: "text-violet-500" },
    { path: "/achievements", icon: Trophy, label: "Achievements", color: "text-yellow-500" },
  ];

  return (
    <div
      className={`flex flex-col h-dvh ${themeConfig.cssClass}`}
      style={{ background: "linear-gradient(160deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.04) 50%, hsl(var(--accent) / 0.06) 100%)" }}
    >
      {/* Header */}
      <motion.header
        variants={headerVariant}
        initial="hidden"
        animate="show"
        className="px-5 pt-6 pb-4 shrink-0"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Welcome back</p>
            <h1 className="text-xl font-bold text-foreground font-heading">{currentUser?.name ?? "..."}</h1>
          </div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Avatar className="h-10 w-10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarImage src={currentUser?.profileurl ?? ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {currentUser?.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onSignOut}
              className="p-2 rounded-full glass-subtle hover:bg-muted/60 transition-colors"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 scrollbar-thin"
      >
        {/* Chat Card */}
        <motion.div variants={item}>
          <motion.button
            onClick={() => navigate("/chat")}
            whileHover={{ y: -2, boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.15)" }}
            whileTap={{ scale: 0.98 }}
            className="w-full glass rounded-2xl p-4 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarImage src={partner?.profileurl ?? ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                    {partner?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {partner?.is_online && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-online border-2 border-background"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground truncate">{partner?.name ?? "..."}</h3>
                  {lastMessageTime && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatLastSeen(lastMessageTime)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {partner?.is_online ? (
                    <span className="text-online font-medium">Online now</span>
                  ) : (
                    `Last seen ${formatLastSeen(partner?.last_seen ?? null)}`
                  )}
                </p>
                {lastMessage && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{lastMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5"
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <motion.div whileHover={{ y: -2 }} className="glass rounded-2xl p-3 text-center">
            <motion.p
              key={unreadCount}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-primary"
            >
              {unreadCount}
            </motion.p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Unread</p>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="glass rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <motion.span
                animate={partner?.is_online ? { scale: [1, 1.3, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`h-2 w-2 rounded-full ${partner?.is_online ? "bg-online" : "bg-muted-foreground/30"}`}
              />
              <p className="text-xs font-semibold text-foreground truncate">
                {partner?.name?.split(" ")[0] ?? "Partner"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">
              {partner?.is_online ? "Online" : "Offline"}
            </p>
          </motion.div>
        </motion.div>

        {/* Daily Checklist */}
        <motion.div variants={item}>
          <DailyChecklistWidget />
        </motion.div>

        {/* Daily Question */}
        <motion.div variants={item}>
          <DailyQuestion />
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Quick Access</h3>
          <div className="grid grid-cols-3 gap-2">
            {quickLinks.map((link, i) => (
              <motion.button
                key={link.path}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate(link.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl glass-subtle hover:bg-muted/40 transition-colors"
              >
                <link.icon className={`h-5 w-5 ${link.color}`} />
                <span className="text-[10px] font-semibold text-foreground">{link.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Reminders & Calendar */}
        <motion.div variants={item}>
          <ReminderWidget />
        </motion.div>
        <motion.div variants={item}>
          <CalendarWidget />
        </motion.div>

        {/* Relationship Section */}
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Your Bond</h3>
          <Tamagotchi />
          <SoulmateClock userId={userId} partnerOnline={partner?.is_online} partnerName={partner?.name ?? undefined} />
          <StreakCounter />
        </motion.div>

        {/* Discover Section */}
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Discover</h3>
          <AiSummary />
          <OnThisDay />
        </motion.div>

        <div className="h-2" />
      </motion.div>

      <ComplimentPopup />
      <BottomNav />
    </div>
  );
};

export default Home;
