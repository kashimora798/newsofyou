import React, { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import AchievementCelebration from "@/components/achievements/AchievementCelebration";
import { getAchievementState, getUnlockedAchievements, setUnlockedAchievements } from "@/hooks/useSecretAchievements";

type Tier = "bronze" | "silver" | "gold" | "platinum";
type Category = "Beginnings" | "Time" | "Streaks" | "Messages" | "Love" | "Media" | "Milestones" | "Special" | "Features" | "Nostalgia" | "Secret" | "Ultimate";

interface Achievement {
  id: string;
  name: string;
  icon: string;
  tier: Tier;
  category: Category;
  lockedText: string;
  unlockedText: string;
  isSecret?: boolean;
  unlocked: boolean;
  progress?: string;
  progressValue?: number;
  progressMax?: number;
}

const TIER_STYLES: Record<Tier, { border: string; bg: string; shimmer?: boolean; holographic?: boolean }> = {
  bronze: { border: "border-[#cd7f32]/40", bg: "bg-gradient-to-br from-[#cd7f32]/10 to-[#8b4513]/5" },
  silver: { border: "border-[#c0c0c0]/40", bg: "bg-gradient-to-br from-[#c0c0c0]/10 to-[#808080]/5", shimmer: true },
  gold: { border: "border-[#ffd700]/40", bg: "bg-gradient-to-br from-[#ffd700]/10 to-[#daa520]/5", shimmer: true },
  platinum: { border: "border-[#b0b0ff]/40", bg: "bg-gradient-to-br from-[#e0e0ff]/10 to-[#ff80ff]/5", holographic: true },
};

const TIER_BADGE_GRADIENT: Record<Tier, string> = {
  bronze: "linear-gradient(135deg, #cd7f32, #8b4513)",
  silver: "linear-gradient(135deg, #c0c0c0, #808080)",
  gold: "linear-gradient(135deg, #ffd700, #daa520)",
  platinum: "linear-gradient(135deg, #e0e0ff, #b0b0ff, #ff80ff, #80ffff)",
};

const CATEGORY_ORDER: Category[] = ["Beginnings", "Time", "Streaks", "Messages", "Love", "Media", "Milestones", "Features", "Nostalgia", "Special", "Secret", "Ultimate"];

const Achievements: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AchievementsView userId={user.id} />;
};

const AchievementsView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<Achievement | null>(null);
  const [celebrationQueue, setCelebrationQueue] = useState<Achievement[]>([]);

  const showNextCelebration = useCallback(() => {
    setCelebrationQueue(prev => {
      if (prev.length === 0) { setCelebration(null); return []; }
      const [next, ...rest] = prev;
      setCelebration(next);
      return rest;
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const [statsRes, advRes, achStatsRes] = await Promise.all([
        supabase.rpc("get_chat_stats" as any),
        supabase.rpc("get_advanced_stats" as any),
        supabase.rpc("get_achievement_stats" as any),
      ]);

      const s = (statsRes.data as any) ?? {};
      const adv = (advRes.data as any) ?? {};
      const ach = (achStatsRes.data as any) ?? {};

      const total = s.total ?? 0;
      const photos = adv.photos_count ?? 0;
      const nightOwl3am = ach.night_owl_3am_count ?? 0;
      const earlyBird = ach.early_bird_count ?? 0;
      const kw = adv.keyword_counts ?? {};
      const maxWordSingle = ach.max_word_count_single_msg ?? 0;
      const totalWords = ach.total_word_count ?? 0;
      const maxMsgInHour = ach.max_messages_in_hour ?? 0;
      const letterCount = ach.letter_count ?? 0;
      const sorryCount = ach.sorry_count ?? 0;
      const fastReply = ach.fast_reply_count ?? 0;
      const hoursCovered = Array.isArray(ach.hours_covered) ? ach.hours_covered : [];
      const voiceNotes = ach.voice_note_count ?? 0;
      const musicLinks = ach.music_link_count ?? 0;

      // Streak from cached/smart calculator
      const streakData = await (await import("@/hooks/useStreakState")).getStreakData(userId);
      const currentStreak = streakData.currentStreak;

      // Days together
      let daysTogether = 0;
      if (s.first_message?.created_at) {
        daysTogether = Math.floor((Date.now() - new Date(s.first_message.created_at).getTime()) / 86400000);
      }

      // Fetch achievement state from server (cross-device synced)
      const achState = await getAchievementState(userId);
      const hasJinx = achState?.event_jinx ?? false;
      const has1111 = achState?.event_1111 ?? false;
      const hasNewYear = achState?.event_newyear ?? false;
      const hasTimeCapsule = achState?.event_timecapsule ?? false;
      const hasTimeTraveler = achState?.event_timetraveler ?? false;
      const hasWaiter = achState?.event_waiter ?? false;

      const p = (val: number, max: number) => ({ progress: `${Math.min(val, max)}/${max}`, progressValue: Math.min(val, max), progressMax: max });

      const list: Achievement[] = [
        { id: "first", name: "The First Word", icon: "🌱", tier: "bronze", category: "Beginnings", lockedText: "Every great story has a first word", unlockedText: "And so it began... Your very first message started something beautiful. 🌱", unlocked: total >= 1 },
        { id: "nightowl", name: "Night Owl", icon: "🌙", tier: "bronze", category: "Time", lockedText: "Some conversations are too good to sleep through", unlockedText: "3 AM and still talking? Sleep is for people who have less interesting people to talk to 🌙✨", unlocked: nightOwl3am >= 1, ...p(nightOwl3am, 1) },
        { id: "earlybird", name: "Early Bird", icon: "🌅", tier: "bronze", category: "Time", lockedText: "Rise before the world wakes up", unlockedText: "You sent a message before 6 AM? Either you're an early riser or you never went to sleep 😄🌅", unlocked: earlyBird >= 1, ...p(earlyBird, 1) },
        { id: "spark", name: "Spark", icon: "🔥", tier: "bronze", category: "Streaks", lockedText: "Keep the conversation alive", unlockedText: "7 days in a row! Your streak is just getting started. Don't let it die! 🔥", unlocked: currentStreak >= 7, ...p(currentStreak, 7) },
        { id: "onfire", name: "On Fire", icon: "🔥🔥", tier: "silver", category: "Streaks", lockedText: "30 days. No skipping. No excuses.", unlockedText: "A whole month of talking every single day. Some people can't keep a plant alive this long. You two? Thriving. 🔥🔥", unlocked: currentStreak >= 30, ...p(currentStreak, 30) },
        { id: "unstoppable", name: "Unstoppable", icon: "🌋", tier: "gold", category: "Streaks", lockedText: "100 days straight. Legendary.", unlockedText: "ONE HUNDRED DAYS. Not a single one missed. Scientists call this dedication. We call it something stronger. 🌋❤️", unlocked: currentStreak >= 100, ...p(currentStreak, 100) },
        { id: "infinite", name: "Infinite", icon: "♾️", tier: "platinum", category: "Streaks", lockedText: "365 days. A full revolution of the Earth.", unlockedText: "365 days without missing a single one. The Earth completed a full journey around the sun. And you two completed it together. ♾️💙", unlocked: currentStreak >= 365, ...p(currentStreak, 365) },
        { id: "comfortable", name: "Getting Comfortable", icon: "💬", tier: "bronze", category: "Messages", lockedText: "500 messages is just the warm-up", unlockedText: "500 messages! You've officially passed 'small talk' territory. Now we're getting somewhere interesting 💬", unlocked: total >= 500, ...p(total, 500) },
        { id: "novelwriters", name: "Novel Writers", icon: "📖", tier: "gold", category: "Messages", lockedText: "The average novel is 90,000 words. You're writing something better.", unlockedText: "Your combined messages have surpassed the word count of a full novel. Tolstoy wrote War & Peace. You two wrote something more personal. 📖✨", unlocked: totalWords >= 90000, ...p(totalWords, 90000) },
        { id: "speedoflight", name: "Speed of Light", icon: "⚡", tier: "silver", category: "Messages", lockedText: "Some conversations move faster than thought", unlockedText: "100 messages exchanged in under 1 hour! Were you even breathing? ⚡😂", unlocked: maxMsgInHour >= 100, ...p(maxMsgInHour, 100) },
        { id: "essaywriter", name: "The Essay Writer", icon: "📝", tier: "silver", category: "Messages", lockedText: "Some feelings can't be rushed", unlockedText: "You sent a single message over 500 words long. That's not a text message. That's a declaration. 📝✨", unlocked: maxWordSingle >= 500, ...p(maxWordSingle, 500) },
        { id: "lovemachine", name: "Love Machine", icon: "❤️", tier: "silver", category: "Love", lockedText: "Say it. Say it again. Keep saying it.", unlockedText: "You've said 'I love you' 100 times. And somehow it still feels just as meaningful every single time. ❤️🥹", unlocked: (kw.love ?? 0) >= 100, ...p(kw.love ?? 0, 100) },
        { id: "warmfuzzy", name: "Warm & Fuzzy", icon: "🫂", tier: "silver", category: "Love", lockedText: "Some people hug with their arms. You hug with your words.", unlockedText: "50 hugs sent! Through a screen, across the distance — your hugs always land. 🫂💛", unlocked: (kw.hug ?? 0) >= 50, ...p(kw.hug ?? 0, 50) },
        { id: "comedian", name: "Comedian", icon: "😂", tier: "bronze", category: "Love", lockedText: "Make them laugh. Every single day.", unlockedText: "200 LOLs exchanged. You've literally laughed together 200 times. You two are immortal. 😂✨", unlocked: (kw.lol ?? 0) >= 200, ...p(kw.lol ?? 0, 200) },
        { id: "throughstorm", name: "Through the Storm", icon: "🌈", tier: "gold", category: "Love", lockedText: "It's not about the sunny days", unlockedText: "You've sent apologies and come back to each other. That's not weakness — that's the bravest thing two people can do. 🌈", unlocked: sorryCount >= 10, ...p(sorryCount, 10) },
        { id: "shutterbug", name: "Shutterbug", icon: "📸", tier: "bronze", category: "Media", lockedText: "A picture is worth a thousand messages", unlockedText: "100 photos shared! Your gallery is becoming a timeline of your story. 📸✨", unlocked: photos >= 100, ...p(photos, 100) },
        { id: "ourplaylist", name: "Our Playlist", icon: "🎵", tier: "silver", category: "Media", lockedText: "Music is the language between souls", unlockedText: "50 songs shared. That's a playlist of YOUR story — press play. 🎵💿", unlocked: musicLinks >= 50, ...p(musicLinks, 50) },
        { id: "voiceheart", name: "Voice of My Heart", icon: "🎤", tier: "silver", category: "Media", lockedText: "Sometimes typing isn't enough", unlockedText: "100 voice notes sent. Your voice has traveled through cables and satellites just to reach them. 🎤💙", unlocked: voiceNotes >= 100, ...p(voiceNotes, 100) },
        { id: "onemonth", name: "One Month In", icon: "🗓️", tier: "bronze", category: "Milestones", lockedText: "30 days since your first message", unlockedText: "30 days ago, someone typed that first message. One month later, look at everything you've built. 🗓️✨", unlocked: daysTogether >= 30, ...p(daysTogether, 30) },
        { id: "oneyear", name: "One Year of Us", icon: "🎂", tier: "platinum", category: "Milestones", lockedText: "365 days since your story began", unlockedText: "ONE YEAR. 365 days of good mornings and good nights. Of laughing at nothing and talking about everything. Happy Anniversary. 🎂🥂❤️", unlocked: daysTogether >= 365, ...p(daysTogether, 365) },
        { id: "aroundclock", name: "Around the Clock", icon: "🕐", tier: "gold", category: "Time", lockedText: "Send a message in every single hour of the day", unlockedText: "You've sent messages at every hour of the day. There's no hour that doesn't have your voice in it. 🕐💫", unlocked: hoursCovered.length >= 24, ...p(hoursCovered.length, 24) },
        { id: "jinx", name: "Jinx!", icon: "🤝", tier: "silver", category: "Secret", lockedText: "???", unlockedText: "You both sent the EXACT same message at the EXACT same time. Statistically impossible. Romantically inevitable. JINX! 🤝😂", isSecret: true, unlocked: hasJinx },
        { id: "1111", name: "11:11", icon: "✨", tier: "gold", category: "Secret", lockedText: "???", unlockedText: "11:11. You know what they say — it's a wish moment. And you were here, talking to them. Maybe that IS the wish coming true. ✨💫", isSecret: true, unlocked: has1111 },
        { id: "newyear", name: "New Year, Same Us", icon: "🎆", tier: "platinum", category: "Secret", lockedText: "???", unlockedText: "You were both online, chatting at the stroke of midnight on New Year's Eve. The first words of a brand new year were meant for each other. 🎆🥂✨", isSecret: true, unlocked: hasNewYear },
        { id: "2secreply", name: "2 Second Reply", icon: "⚡", tier: "silver", category: "Special", lockedText: "Were they sitting there waiting?", unlockedText: "A reply in under 2 seconds. That's not a reply. That's telekinesis. They were WAITING for you. ⚡😭💕", unlocked: fastReply >= 3, ...p(fastReply, 3) },
        { id: "penpal", name: "Pen Pal", icon: "💌", tier: "silver", category: "Features", lockedText: "Some feelings deserve more than a text message", unlockedText: "10 letters written and sent. In an age of 2-word replies, you wrote actual LETTERS. You're different. In the best way. 💌🪶", unlocked: letterCount >= 10, ...p(letterCount, 10) },
        { id: "bottlemsg", name: "Message in a Bottle", icon: "🕰️", tier: "gold", category: "Features", lockedText: "Plant seeds for the future", unlockedText: "Your first time capsule has been sent and received. A gift from a past version of you. Wild, right? 🕰️✉️", unlocked: hasTimeCapsule },
        { id: "timetraveler", name: "Time Traveler", icon: "🔍", tier: "silver", category: "Nostalgia", lockedText: "Some people read old messages. You went DEEP.", unlockedText: "You scrolled all the way back to your very first messages. Does it feel like yesterday or like a different lifetime? 🔍⏪✨", unlocked: hasTimeTraveler },
        { id: "waiter", name: "The One Who Waits", icon: "👁️", tier: "platinum", category: "Secret", lockedText: "???", unlockedText: "They were offline for 24 hours. You opened the app 20+ times just to check. That quiet loyalty — that's love in its truest form. 👁️💙", isSecret: true, unlocked: hasWaiter },
      ];

      // #30: Written in the Stars - all 29 others unlocked
      const allOthersUnlocked = list.every(a => a.unlocked);
      list.push({
        id: "stars", name: "Written in the Stars", icon: "🌌", tier: "platinum", category: "Ultimate",
        lockedText: "???", unlockedText: "You've unlocked every other achievement. There is no algorithm for what you have. No metric for it. But this one comes close. Written in the stars. 🌌✨",
        isSecret: true, unlocked: allOthersUnlocked,
      });

      setAchievements(list);
      setLoading(false);

      // Check for new unlocks (server-synced)
      const stored = await getUnlockedAchievements(userId);
      const currentlyUnlocked = list.filter(a => a.unlocked).map(a => a.id);
      const newUnlocks = currentlyUnlocked.filter(id => !stored.includes(id));

      if (newUnlocks.length > 0) {
        await setUnlockedAchievements(userId, currentlyUnlocked);
        const newAchievements = newUnlocks.map(id => list.find(a => a.id === id)!);
        setCelebration(newAchievements[0]);
        if (newAchievements.length > 1) setCelebrationQueue(newAchievements.slice(1));
      }
    };
    load();
  }, []);

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  // Group by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: achievements.filter(a => a.category === cat),
  })).filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {celebration && (
        <AchievementCelebration
          icon={celebration.icon}
          name={celebration.name}
          unlockedText={celebration.unlockedText}
          tier={celebration.tier}
          onDismiss={showNextCelebration}
        />
      )}

      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Achievements</h2>
        <span className="ml-auto text-xs text-muted-foreground">{unlocked.length}/{achievements.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin">
        {/* Progress Summary */}
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <p className="text-2xl font-bold text-foreground">{unlocked.length}</p>
          <p className="text-xs text-muted-foreground">of {achievements.length} achievements unlocked</p>
          <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(unlocked.length / achievements.length) * 100}%` }}
            />
          </div>
          {/* Tier Summary */}
          <div className="flex justify-center gap-3 mt-3">
            {(["bronze", "silver", "gold", "platinum"] as Tier[]).map(t => {
              const count = achievements.filter(a => a.tier === t && a.unlocked).length;
              const totalT = achievements.filter(a => a.tier === t).length;
              return (
                <div key={t} className="text-center">
                  <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold text-white" style={{ background: TIER_BADGE_GRADIENT[t] }}>
                    {count}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 capitalize">{t}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Groups */}
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {category} {items.filter(a => a.unlocked).length > 0 && `(${items.filter(a => a.unlocked).length}/${items.length})`}
            </h3>
            <div className="space-y-2">
              {items.map(a => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement: a }) => {
  const style = TIER_STYLES[a.tier];
  const isHidden = a.isSecret && !a.unlocked;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
        a.unlocked
          ? `${style.border} ${style.bg} shadow-sm`
          : "border-border bg-card opacity-50"
      } ${style.holographic && a.unlocked ? "achievement-holographic" : ""}`}
      style={style.holographic && a.unlocked ? { animation: "achievement-holographic 6s linear infinite" } : undefined}
    >
      {/* Icon */}
      <div className="relative shrink-0">
        <span className={`text-3xl ${!a.unlocked ? "grayscale" : ""}`}>
          {isHidden ? "❓" : a.icon}
        </span>
        {/* Tier dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-background flex items-center justify-center"
          style={{ background: TIER_BADGE_GRADIENT[a.tier] }}
        >
          <span className="text-[6px]">
            {a.tier === "bronze" ? "B" : a.tier === "silver" ? "S" : a.tier === "gold" ? "G" : "P"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {isHidden ? "???" : a.name}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {a.unlocked ? (a.unlockedText.length > 80 ? a.unlockedText.slice(0, 77) + "..." : a.unlockedText) : (isHidden ? "This achievement is a secret..." : a.lockedText)}
        </p>
        {/* Progress bar */}
        {!a.unlocked && !isHidden && a.progressMax && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all"
                style={{ width: `${Math.min(((a.progressValue ?? 0) / a.progressMax) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{a.progress}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <span className="text-base shrink-0">
        {a.unlocked ? "✅" : "🔒"}
      </span>
    </div>
  );
};

export default Achievements;
