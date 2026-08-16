import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { usePartnerAwayMessage } from "@/hooks/usePartnerAwayMessage";
import { checkNewYear, useWaiterAchievement } from "@/hooks/useSecretAchievements";
import { getThemeById } from "@/lib/chatThemes";
import { daysTogether } from "@/lib/anniversary";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatLastSeen } from "@/lib/dateUtils";
import { LogOut, Loader2, ChevronRight, Bookmark, Bell, CalendarDays, Heart, CheckSquare, Trophy, Gamepad2, BarChart3, Mail, Send, Sticker, Hand, Compass, Sparkles, TreePine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/layout/BottomNav";
import StreakCounter from "@/components/home/StreakCounter";
import OnThisDay from "@/components/home/OnThisDay";
import AiSummary from "@/components/home/AiSummary";
import DailyQuestion from "@/components/home/DailyQuestion";
import Tamagotchi from "@/components/home/Tamagotchi";

import ReminderWidget from "@/components/home/ReminderWidget";
import CalendarWidget from "@/components/home/CalendarWidget";
import ComplimentPopup from "@/components/home/ComplimentPopup";
import DailyChecklistWidget from "@/components/home/DailyChecklistWidget";
import AnniversaryBanner from "@/components/home/AnniversaryBanner";

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
  const navigate = useNavigate();

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/you/login", { replace: true });
  };

  return <HomeView userId={user.id} onSignOut={handleSignOut} />;
};

const HomeView: React.FC<{ userId: string; onSignOut: () => void }> = ({ userId, onSignOut }) => {
  const navigate = useNavigate();
  const partner = usePartner(userId);
  const currentUser = useCurrentUser(userId);
  const unreadCount = useUnreadCount(userId);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState("default");
  const partnerAwayMessage = usePartnerAwayMessage(partner?.user_id, partner?.is_online, partner?.last_seen);

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
      try {
        const { data } = await supabase
          .from("messages")
          .select("content, created_at, user_id, image_url, gif_url, sticker_url, file_name, video")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const preview = data.content
            || (data.image_url ? "📷 Photo" : "")
            || (data.video ? "📹 Video" : "")
            || ((data as any).gif_url ? "GIF" : "")
            || ((data as any).sticker_url ? "🎨 Sticker" : "")
            || ((data as any).file_name ? `📎 ${(data as any).file_name}` : "")
            || "Message";
          setLastMessage(preview);
          setLastMessageTime(data.created_at);
        }
      } catch {
        // Non-critical — silently ignore
      }
    };
    // Defer this non-critical fetch so home renders first
    const timer = setTimeout(fetchLast, 500);
    return () => clearTimeout(timer);
  }, [userId]);

  const themeConfig = getThemeById(chatTheme);

  const quickLinks = [
    { path: "/forest", icon: TreePine, label: "Our Tree", color: "text-green-500", bg: "bg-green-500/10" },
    { path: "/games", icon: Gamepad2, label: "Games", color: "text-orange-500", bg: "bg-orange-500/10" },
    { path: "/stats", icon: BarChart3, label: "Stats", color: "text-sky-500", bg: "bg-sky-500/10" },
    { path: "/bookmarks", icon: Bookmark, label: "Bookmarks", color: "text-amber-500", bg: "bg-amber-500/10" },
    { path: "/reminders", icon: Bell, label: "Reminders", color: "text-blue-500", bg: "bg-blue-500/10" },
    { path: "/calendar", icon: CalendarDays, label: "Calendar", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { path: "/compliments", icon: Heart, label: "Compliments", color: "text-pink-500", bg: "bg-pink-500/10" },
    { path: "/daily-checklist", icon: CheckSquare, label: "Checklist", color: "text-violet-500", bg: "bg-violet-500/10" },
    { path: "/achievements", icon: Trophy, label: "Achievements", color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { path: "/letter-collection", icon: Mail, label: "Letters", color: "text-rose-500", bg: "bg-rose-500/10" },
    { path: "/scheduled-messages", icon: Send, label: "Scheduled", color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { path: "/custom-stickers", icon: Sticker, label: "Stickers", color: "text-fuchsia-500", bg: "bg-fuchsia-500/10" },
    { path: "/custom-touch-reactions", icon: Hand, label: "Touch", color: "text-teal-500", bg: "bg-teal-500/10" },
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

      {/* Content — plain div so Framer transforms don't break touch scroll */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 scrollbar-thin"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
      >
        {/* Stagger wrapper — separate from scroll container so it doesn't own the overflow */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
        {/* Anniversary Wrapped (appears only near the anniversary) */}
        <motion.div variants={item}>
          <AnniversaryBanner />
        </motion.div>

        {/* Chat Card — the hero */}
        <motion.div variants={item}>
          <motion.button
            onClick={() => navigate("/chat")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full rounded-3xl p-5 transition-colors group overflow-hidden text-left"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--accent) / 0.18) 100%)",
              border: "1px solid hsl(var(--primary) / 0.15)",
              boxShadow: "0 8px 32px -12px hsl(var(--primary) / 0.25)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar className="h-14 w-14 ring-2 ring-primary/25 ring-offset-2 ring-offset-background">
                  <AvatarImage src={partner?.profileurl ?? ""} />
                  <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                    {partner?.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {partner?.is_online && (
                  <motion.span
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-online border-2 border-background"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground truncate">{partner?.name ?? "..."}</h3>
                  {lastMessageTime && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatLastSeen(lastMessageTime)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {partnerAwayMessage ? (
                    <span className="text-orange-400 font-medium">{partnerAwayMessage}</span>
                  ) : partner?.is_online ? (
                    <span className="text-online font-medium">Online now</span>
                  ) : (
                    `Last seen ${formatLastSeen(partner?.last_seen ?? null)}`
                  )}
                </p>
                {lastMessage && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-1">{lastMessage}</p>
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
                      className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-2 shadow-lg shadow-primary/30"
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
                <ChevronRight className="h-5 w-5 text-primary/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* Days together ribbon */}
        <motion.div variants={item}>
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-center gap-2.5"
            style={{ background: "linear-gradient(120deg, hsl(330 50% 60% / 0.12), hsl(var(--primary) / 0.12))" }}
          >
            <Heart className="h-4 w-4 text-pink-500 shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-black text-primary">{daysTogether().toLocaleString()}</span>
              <span className="text-muted-foreground"> days together 💞</span>
            </p>
          </div>
        </motion.div>

        {/* Daily Checklist */}
        <motion.div variants={item}>
          <DailyChecklistWidget />
        </motion.div>

        {/* Daily Question */}
        <motion.div variants={item}>
          <DailyQuestion />
        </motion.div>

        {/* Explore — every feature, beautifully surfaced */}
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Compass className="h-3 w-3" /> Explore
          </h3>
          <div className="grid grid-cols-4 gap-2.5">
            {quickLinks.map((link) => (
              <motion.button
                key={link.path}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(link.path)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={`h-12 w-12 rounded-2xl ${link.bg} flex items-center justify-center transition-shadow group-hover:shadow-lg group-hover:shadow-primary/10`}>
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <span className="text-[9.5px] font-semibold text-foreground/80 text-center leading-tight">{link.label}</span>
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
           <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5">
             <Heart className="h-3 w-3 text-pink-500" /> Your Bond
           </h3>
           <Tamagotchi />
           <StreakCounter />
        </motion.div>

        {/* Discover Section */}
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" /> Discover
          </h3>
          <AiSummary />
          <OnThisDay />
        </motion.div>

          <div className="h-2" />
        </motion.div>
      </div>

      <ComplimentPopup />
      <BottomNav />
    </div>
  );
};

export default Home;
