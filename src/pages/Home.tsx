import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { usePartnerAwayMessage } from "@/hooks/usePartnerAwayMessage";
import { checkNewYear, useWaiterAchievement } from "@/hooks/useSecretAchievements";
import { daysTogether, ANNIVERSARY_START } from "@/lib/anniversary";
import { formatToday, phaseGreeting, phaseWhisper, scenePhase } from "@/lib/sceneTime";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatLastSeen } from "@/lib/dateUtils";
import { LogOut, Loader2, ChevronRight, Bell, Heart, Compass, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/layout/BottomNav";
import HomeScene from "@/components/home/HomeScene";
import StreakCounter from "@/components/home/StreakCounter";
import OnThisDay from "@/components/home/OnThisDay";
import AiSummary from "@/components/home/AiSummary";
import DailyQuestion from "@/components/home/DailyQuestion";
import Tamagotchi from "@/components/home/Tamagotchi";
import ReminderWidget from "@/components/home/ReminderWidget";
import CalendarWidget from "@/components/home/CalendarWidget";
import ComplimentPopup from "@/components/home/ComplimentPopup";
import TwinGreeting from "@/components/twin/TwinGreeting";
import { useCompliments } from "@/hooks/useCompliments";
import DailyChecklistWidget from "@/components/home/DailyChecklistWidget";
import AnniversaryBanner from "@/components/home/AnniversaryBanner";
import { EXPLORE_LINKS } from "@/lib/exploreLinks";

/**
 * Home — the night scene (build-plan Phase 3).
 *
 * Layers, back to front:
 *   1. `HomeScene` — sky, moon, stars, mist (CSS only, reduced-motion aware)
 *   2. the content, scrolling over it on a `relative z-10` plane
 *   3. the bottom navigation, inheriting the scene's tokens
 *
 * The scene re-points the design tokens locally (see `.night-scene` in
 * index.css), so the widgets below keep their own code and simply appear in
 * midnight — soft panes instead of boxy cards.
 */

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
      <div className="night-scene flex h-dvh items-center justify-center">
        <HomeScene />
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
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

/** A group heading: small caps label with a hairline that runs to the edge. */
const SceneHeading: React.FC<{ icon: React.ElementType; children: React.ReactNode; accent?: string }> = ({
  icon: Icon,
  children,
  accent,
}) => (
  <div className="flex items-center gap-2 px-1">
    <Icon className="h-3 w-3" style={{ color: accent ?? "hsl(var(--rose-glow) / 0.9)" }} />
    <span className="scene-label">{children}</span>
    <span className="scene-hairline flex-1" />
  </div>
);

const HomeView: React.FC<{ userId: string; onSignOut: () => void }> = ({ userId, onSignOut }) => {
  const navigate = useNavigate();
  const partner = usePartner(userId);
  const currentUser = useCurrentUser(userId);
  const unreadCount = useUnreadCount(userId);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<string | null>(null);
  const partnerAwayMessage = usePartnerAwayMessage(partner?.user_id, partner?.is_online, partner?.last_seen);
  const { surpriseCompliment, dismissSurprise, checkSurprise } = useCompliments();

  useWaiterAchievement(userId, partner?.is_online);

  useEffect(() => {
    // Check surprise note after initial view renders
    const timer = setTimeout(() => {
      checkSurprise();
    }, 1200);
    return () => clearTimeout(timer);
  }, [checkSurprise]);

  useEffect(() => {
    // Defer so it never blocks initial render
    const t = setTimeout(() => checkNewYear(userId), 3000);
    return () => clearTimeout(t);
  }, [userId]);

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

  const now = new Date();
  const phase = scenePhase(now);
  const together = daysTogether();


  const online = Boolean(partner?.is_online && partner?.activity_state !== "offline");
  const away = partner?.activity_state === "away" || partner?.activity_state === "idle";

  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden">
      <HomeScene />

      {/* ── header: the date, the greeting, the two of you ── */}
      <motion.header
        variants={headerVariant}
        initial="hidden"
        animate="show"
        className="relative z-10 shrink-0 px-5 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="scene-label">{formatToday(now)}</p>
            <h1 className="mt-1 font-heading text-[26px] leading-tight text-[hsl(var(--moon-white))]">
              {phaseGreeting(phase)}
              <span className="text-[hsl(var(--rose-glow))]">, {currentUser?.name?.split(" ")[0] ?? "…"}</span>
            </h1>
            <p className="mt-1 text-[12px] text-[hsl(var(--mist))]">{phaseWhisper(phase, now.getHours())}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <motion.div whileTap={{ scale: 0.94 }} className="relative">
              <span
                className="pointer-events-none absolute -inset-1.5 rounded-full blur-md"
                style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.35), transparent 70%)" }}
              />
              <Avatar className="relative h-11 w-11 ring-1 ring-[hsl(var(--moon-white)/0.25)]">
                <AvatarImage src={currentUser?.profileurl ?? ""} />
                <AvatarFallback className="bg-[hsl(var(--night-800))] text-[hsl(var(--moon-white))] text-sm font-semibold">
                  {currentUser?.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <button
              onClick={onSignOut}
              aria-label="sign out"
              className="grid h-9 w-9 place-items-center rounded-full text-[hsl(var(--mist))] transition-colors hover:text-[hsl(var(--moon-white))]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── content: a quiet plane scrolling over the sky ── */}
      <div
        className="night-scene relative z-10 flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
      >
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {/* her twin's note — always labelled, always first */}
          <TwinGreeting />

          <motion.div variants={item}>
            <AnniversaryBanner />
          </motion.div>

          {/* ── the hero: her, and the way back to the conversation ── */}
          <motion.div variants={item}>
            <motion.button
              onClick={() => navigate("/chat")}
              whileTap={{ scale: 0.985 }}
              className="pane pane-glow group w-full p-5 text-left"
            >
              <div className="relative flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <span
                    className="pointer-events-none absolute -inset-2 rounded-full blur-lg"
                    style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.4), transparent 70%)" }}
                  />
                  <Avatar className="relative h-14 w-14 ring-1 ring-[hsl(var(--moon-white)/0.22)]">
                    <AvatarImage src={partner?.profileurl ?? ""} />
                    <AvatarFallback className="bg-[hsl(var(--night-800))] text-[hsl(var(--moon-white))] text-lg font-semibold">
                      {partner?.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {online && (
                    <motion.span
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ repeat: Infinity, duration: 2.4 }}
                      className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[hsl(var(--night-900))] ${
                        away ? "bg-[hsl(38_85%_62%)]" : "bg-[hsl(var(--online))]"
                      }`}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-heading text-[17px] text-[hsl(var(--moon-white))]">
                      {partner?.name ?? "…"}
                    </h3>
                    {lastMessageTime && (
                      <span className="shrink-0 text-[10px] text-[hsl(var(--mist)/0.8)]">
                        {formatLastSeen(lastMessageTime)}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-[12px]">
                    {partnerAwayMessage ? (
                      <span className="font-medium text-[hsl(28_85%_70%)]">{partnerAwayMessage}</span>
                    ) : online ? (
                      <span className={`font-medium ${away ? "text-[hsl(38_85%_68%)]" : "text-[hsl(var(--online))]"}`}>
                        {away ? "Away right now" : "Online now"}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--mist))]">Last seen {formatLastSeen(partner?.last_seen ?? null)}</span>
                    )}
                  </p>

                  {lastMessage && (
                    <p className="mt-1 truncate text-[12px] text-[hsl(var(--mist)/0.85)]">{lastMessage}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[hsl(var(--rose-glow))] px-2 text-[11px] font-bold text-[hsl(var(--night-900))]"
                      >
                        {unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <ChevronRight className="h-5 w-5 text-[hsl(var(--rose-glow)/0.7)] transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.button>
          </motion.div>

          {/* ── days together: a line of light, not a card ── */}
          <motion.div variants={item} className="flex items-center gap-3 px-2">
            <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,hsl(var(--rose-glow)/0.35))]" />
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-heading text-[30px] leading-none text-[hsl(var(--moon-white))]">
                {together.toLocaleString()}
              </span>
              <span className="scene-label">days together</span>
            </div>
            <span className="h-px flex-1 bg-[linear-gradient(90deg,hsl(var(--rose-glow)/0.35),transparent)]" />
          </motion.div>
          <motion.p variants={item} className="-mt-2 text-center text-[11px] text-[hsl(var(--mist)/0.75)]">
            since {ANNIVERSARY_START.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </motion.p>

          {/* ── today: the small rituals ── */}
          <motion.div variants={item}>
            <DailyChecklistWidget />
          </motion.div>
          <motion.div variants={item}>
            <DailyQuestion />
          </motion.div>

          {/* ── explore: constellations, not tiles ── */}
          <motion.div variants={item} className="space-y-3 pt-1">
            <SceneHeading icon={Compass}>Explore</SceneHeading>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
              {EXPLORE_LINKS.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className="group flex select-none flex-col items-center gap-1.5 focus:outline-none active:scale-90 transition-transform touch-manipulation"
                >
                  <span
                    className="relative grid h-12 w-12 place-items-center rounded-full transition-shadow"
                    style={{
                      background: `radial-gradient(circle at 32% 26%, hsl(${link.hue} 80% 72% / 0.26), hsl(${link.hue} 70% 60% / 0.05) 72%)`,
                      boxShadow: `inset 0 0 0 0.5px hsl(${link.hue} 70% 80% / 0.16)`,
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: `radial-gradient(circle, hsl(${link.hue} 80% 70% / 0.28), transparent 70%)`, filter: "blur(10px)" }}
                    />
                    <link.icon className="relative h-[20px] w-[20px]" style={{ color: `hsl(${link.hue} 85% 80%)` }} />
                  </span>
                  <span className="text-center text-[9.5px] font-medium leading-tight text-[hsl(var(--mist))]">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── the practical bits ── */}
          <motion.div variants={item} className="space-y-3 pt-1">
            <SceneHeading icon={Bell} accent="hsl(222 80% 76%)">Coming up</SceneHeading>
            <ReminderWidget />
            <CalendarWidget />
          </motion.div>

          {/* ── the bond ── */}
          <motion.div variants={item} className="space-y-3 pt-1">
            <SceneHeading icon={Heart}>Your bond</SceneHeading>
            <Tamagotchi />
            <StreakCounter />
          </motion.div>

          {/* ── discover ── */}
          <motion.div variants={item} className="space-y-3 pt-1">
            <SceneHeading icon={Sparkles} accent="hsl(var(--gold-ink))">Discover</SceneHeading>
            <AiSummary />
            <OnThisDay />
          </motion.div>

          <div className="h-2" />
        </motion.div>
      </div>

      <ComplimentPopup compliment={surpriseCompliment} onDismiss={dismissSurprise} />

      <div className="relative z-10">
        <BottomNav />
      </div>
    </div>
  );
};

export default Home;
