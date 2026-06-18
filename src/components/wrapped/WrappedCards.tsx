import React from "react";
import { motion } from "framer-motion";
import { CountUp, ConfettiBurst, FloatingHearts, Reveal } from "./wrappedAnim";
import { ordinal } from "@/lib/anniversary";
import type { WrappedData } from "@/hooks/useWrappedData";
import { Canvas } from "@react-three/fiber";
import CherryBlossom from "../forest/trees/CherryBlossom";

export interface CardProps {
  data: WrappedData;
  years: number;
}

/** Shared full-screen card frame with a themed gradient background. */
const Frame: React.FC<{ gradient: string; children: React.ReactNode; ambiance?: React.ReactNode }> = ({
  gradient,
  children,
  ambiance,
}) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center overflow-hidden" style={{ background: gradient }}>
    {ambiance}
    <div className="relative z-10 w-full max-w-sm flex flex-col items-center">{children}</div>
  </div>
);

const G = {
  intro: "linear-gradient(160deg, #1e1b4b 0%, #4c1d95 55%, #831843 100%)",
  count: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)",
  busy: "linear-gradient(160deg, #7c2d12 0%, #b91c1c 60%, #f59e0b 100%)",
  night: "linear-gradient(180deg, #020617 0%, #1e1b4b 70%, #312e81 100%)",
  words: "linear-gradient(160deg, #064e3b 0%, #047857 100%)",
  love: "linear-gradient(160deg, #831843 0%, #be123c 55%, #fb7185 100%)",
  emoji: "linear-gradient(160deg, #92400e 0%, #d97706 60%, #fbbf24 100%)",
  games: "linear-gradient(160deg, #4c1d95 0%, #6d28d9 60%, #a78bfa 100%)",
  first: "linear-gradient(160deg, #1e293b 0%, #334155 100%)",
  finale: "linear-gradient(160deg, #831843 0%, #9d174d 40%, #4c1d95 100%)",
  // New intimate slides
  garden: "linear-gradient(160deg, #831843 0%, #fbcfe8 100%)",
  compliment: "linear-gradient(160deg, #022c22 0%, #065f46 100%)",
  streak: "linear-gradient(160deg, #7c2d12 0%, #ea580c 100%)",
  bookmark: "linear-gradient(160deg, #312e81 0%, #6366f1 100%)",
  milestone: "linear-gradient(160deg, #b45309 0%, #fbbf24 100%)",
};

// 1 — Intro
export const IntroCard: React.FC<CardProps> = ({ data, years }) => (
  <Frame gradient={G.intro} ambiance={<FloatingHearts emoji="✨" count={18} />}>
    <Reveal delay={0.1}>
      <p className="text-white/70 text-sm font-medium tracking-widest uppercase">Our Year</p>
    </Reveal>
    <Reveal delay={0.35}>
      <motion.h1
        className="text-6xl font-black text-white mt-3"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        Wrapped
      </motion.h1>
    </Reveal>
    <Reveal delay={0.7}>
      <p className="text-white/80 text-base mt-6 leading-relaxed">
        {years >= 1 ? `${ordinal(years)} anniversary 💞` : "A year of us 💞"}
        <br />
        <span className="text-white/60 text-sm">
          {data.firstMessage ? `Since ${data.firstMessage.date}` : "Since the very first hello"}
        </span>
      </p>
    </Reveal>
    <Reveal delay={1.1}>
      <p className="text-white/50 text-xs mt-10 animate-pulse">tap to begin →</p>
    </Reveal>
  </Frame>
);

// 2 — Total messages
export const TotalCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.count} ambiance={<FloatingHearts emoji="💬" count={12} />}>
    <Reveal delay={0.15}>
      <p className="text-white/70 text-lg">Together you sent</p>
    </Reveal>
    <Reveal delay={0.4}>
      <CountUp value={data.totalMessages} className="text-7xl font-black text-white my-4 tabular-nums block" />
    </Reveal>
    <Reveal delay={0.7}>
      <p className="text-white/80 text-xl font-semibold">messages 💌</p>
    </Reveal>
    <Reveal delay={1}>
      <p className="text-white/50 text-sm mt-8">
        That's about <span className="font-bold text-white/80">{data.avgPerDay.toLocaleString()}</span> every single day
      </p>
    </Reveal>
  </Frame>
);

// 3 — Busiest day
export const BusyDayCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.busy} ambiance={<FloatingHearts emoji="🔥" count={14} />}>
    <Reveal delay={0.15}>
      <p className="text-white/80 text-lg">Your most talkative day</p>
    </Reveal>
    <Reveal delay={0.45}>
      <motion.p
        className="text-5xl font-black text-white my-5"
        initial={{ rotateX: 90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ delay: 0.45, type: "spring", stiffness: 120 }}
      >
        {data.busiestDay?.date ?? "—"}
      </motion.p>
    </Reveal>
    <Reveal delay={0.8}>
      <div className="glass rounded-2xl px-6 py-4 bg-white/10">
        <CountUp value={data.busiestDay?.count ?? 0} className="text-4xl font-black text-white tabular-nums" />
        <p className="text-white/70 text-sm mt-1">messages in one day 😮</p>
      </div>
    </Reveal>
    <Reveal delay={1.1}>
      <p className="text-white/60 text-sm mt-6">Somebody had a lot to say…</p>
    </Reveal>
  </Frame>
);

// 4 — Night owls
export const NightOwlCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.night} ambiance={<FloatingHearts emoji="⭐" count={20} />}>
    <Reveal delay={0.15}>
      <motion.div
        className="text-7xl mb-4"
        animate={{ rotate: [0, -8, 8, 0], y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        🦉
      </motion.div>
    </Reveal>
    <Reveal delay={0.45}>
      <p className="text-white/80 text-lg">Late-night whispers</p>
    </Reveal>
    <Reveal delay={0.7}>
      <CountUp value={data.nightOwlCount} className="text-6xl font-black text-white my-3 tabular-nums block" />
    </Reveal>
    <Reveal delay={1}>
      <p className="text-white/70 text-base">messages between 2–4 AM 🌙</p>
    </Reveal>
    <Reveal delay={1.3}>
      <p className="text-white/50 text-sm mt-8">Who needs sleep anyway?</p>
    </Reveal>
  </Frame>
);

// 5 — Top words (word cloud)
export const WordsCard: React.FC<CardProps> = ({ data }) => {
  const max = data.topWords[0]?.count ?? 1;
  return (
    <Frame gradient={G.words} ambiance={<FloatingHearts emoji="💭" count={10} />}>
      <Reveal delay={0.1}>
        <p className="text-white/80 text-lg mb-6">The words of your year 📝</p>
      </Reveal>
      <div className="flex flex-wrap gap-2 justify-center items-center">
        {data.topWords.map((w, i) => {
          const scale = 0.7 + (w.count / max) * 1.1;
          return (
            <motion.span
              key={w.word}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 0.55 + (w.count / max) * 0.45, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 200 }}
              className="font-black text-white leading-none"
              style={{ fontSize: `${Math.max(14, scale * 22)}px` }}
            >
              {w.word}
            </motion.span>
          );
        })}
      </div>
      {data.topWords[0] && (
        <Reveal delay={0.3 + data.topWords.length * 0.06 + 0.2}>
          <p className="text-white/60 text-sm mt-8">
            "<span className="font-bold text-white">{data.topWords[0].word}</span>" said{" "}
            {data.topWords[0].count.toLocaleString()} times
          </p>
        </Reveal>
      )}
    </Frame>
  );
};

// 6 — Love language
export const LoveCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.love} ambiance={<FloatingHearts emoji="❤️" count={22} />}>
    <Reveal delay={0.15}>
      <motion.div
        className="text-7xl mb-4"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        ❤️
      </motion.div>
    </Reveal>
    <Reveal delay={0.4}>
      <p className="text-white/80 text-lg">You said "I love you"</p>
    </Reveal>
    <Reveal delay={0.65}>
      <CountUp value={data.loveCount} className="text-7xl font-black text-white my-3 tabular-nums block" />
    </Reveal>
    <Reveal delay={0.95}>
      <p className="text-white/80 text-base">times this year 🥹</p>
    </Reveal>
    <Reveal delay={1.25}>
      <div className="flex gap-5 mt-8 text-sm text-white/70">
        <span>😂 {data.lolCount.toLocaleString()} laughs</span>
        <span>🫂 {data.missCount.toLocaleString()} "miss you"s</span>
      </div>
    </Reveal>
  </Frame>
);

// 7 — Top emoji
export const EmojiCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.emoji} ambiance={<FloatingHearts emoji={data.topEmoji ?? "😊"} count={16} />}>
    <Reveal delay={0.15}>
      <p className="text-white/80 text-lg">Your signature emoji</p>
    </Reveal>
    <Reveal delay={0.4}>
      <motion.div
        className="text-[7rem] my-4 leading-none"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 180, damping: 12 }}
      >
        {data.topEmoji ?? "😊"}
      </motion.div>
    </Reveal>
    {data.topEmojis.length > 1 && (
      <Reveal delay={0.9}>
        <div className="flex gap-3 mt-4">
          {data.topEmojis.slice(1, 5).map(([e, c]) => (
            <div key={e} className="flex flex-col items-center">
              <span className="text-3xl">{e}</span>
              <span className="text-white/60 text-xs mt-1">{c}</span>
            </div>
          ))}
        </div>
      </Reveal>
    )}
  </Frame>
);

// 8 — Game nights
export const GamesCard: React.FC<CardProps> = ({ data }) => {
  const iWonMore = data.myWins > data.theirWins;
  const tied = data.myWins === data.theirWins;
  return (
    <Frame gradient={G.games} ambiance={<FloatingHearts emoji="🎮" count={12} />}>
      <Reveal delay={0.15}>
        <p className="text-white/80 text-lg">Game nights together</p>
      </Reveal>
      <Reveal delay={0.4}>
        <CountUp value={data.gamesPlayed} className="text-6xl font-black text-white my-3 tabular-nums block" />
      </Reveal>
      <Reveal delay={0.7}>
        <p className="text-white/70 text-base">games played 🎮</p>
      </Reveal>
      <Reveal delay={1}>
        <div className="flex items-center gap-6 mt-7">
          <div className="text-center">
            <p className="text-3xl font-black text-white tabular-nums">{data.myWins}</p>
            <p className="text-white/60 text-xs uppercase tracking-widest mt-1">You</p>
          </div>
          <span className="text-white/40 text-xl">vs</span>
          <div className="text-center">
            <p className="text-3xl font-black text-white tabular-nums">{data.theirWins}</p>
            <p className="text-white/60 text-xs uppercase tracking-widest mt-1 truncate max-w-[80px]">
              {data.theirs?.name ?? "Partner"}
            </p>
          </div>
        </div>
      </Reveal>
      <Reveal delay={1.3}>
        <p className="text-white/70 text-sm mt-6">
          {data.gamesPlayed === 0 ? "Time for a rematch year? 😏" : tied ? "Perfectly matched 🤝" : iWonMore ? "You're the champion 👑" : "They've got the edge… for now 😏"}
        </p>
      </Reveal>
    </Frame>
  );
};

// 9 — First message
export const FirstMessageCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.first} ambiance={<FloatingHearts emoji="💌" count={8} />}>
    <Reveal delay={0.15}>
      <p className="text-white/70 text-sm tracking-widest uppercase">Where it all began</p>
    </Reveal>
    <Reveal delay={0.5}>
      <motion.div
        className="glass bg-white/10 rounded-3xl px-6 py-7 mt-6 max-w-[300px]"
        initial={{ rotate: -3, scale: 0.9 }}
        animate={{ rotate: -1.5, scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 150 }}
      >
        <p className="text-white text-lg italic leading-relaxed">
          "{data.firstMessage?.content ?? "…"}"
        </p>
        <p className="text-white/60 text-xs mt-4">
          — {data.firstMessage?.username ?? "you"}, {data.firstMessage?.date ?? ""}
        </p>
      </motion.div>
    </Reveal>
    <Reveal delay={1}>
      <p className="text-white/50 text-sm mt-8">{data.daysTogether.toLocaleString()} days ago 🕰️</p>
    </Reveal>
  </Frame>
);

// 10 — Secret Garden
export const SecretGardenCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.garden}>
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas camera={{ position: [0, 4, 15], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <CherryBlossom position={[0, -2, 0]} scale={2} hasPetals={true} />
      </Canvas>
    </div>
    <div className="relative z-10 w-full flex flex-col items-center justify-center text-center px-4 bg-black/20 rounded-3xl py-8 backdrop-blur-md">
      <Reveal delay={0.15}>
        <p className="text-white/80 text-lg mb-2">You didn't just exchange words.</p>
      </Reveal>
      <Reveal delay={0.5}>
        <p className="text-white font-bold text-2xl mb-6">You planted a forest. 🌸</p>
      </Reveal>
      <Reveal delay={0.8}>
        <CountUp value={data.forestCount} className="text-7xl font-black text-white my-2 tabular-nums block drop-shadow-lg" />
      </Reveal>
      <Reveal delay={1.1}>
        <p className="text-white/80 text-base drop-shadow-md">Cherry Blossom trees grown from your love this year.</p>
      </Reveal>
    </div>
  </Frame>
);

// 11 — Compliments
export const ComplimentCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.compliment} ambiance={<FloatingHearts emoji="💌" count={12} />}>
    <Reveal delay={0.15}>
      <motion.div
        className="text-7xl mb-6"
        animate={{ rotate: [-2, 2, -2], y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        💌
      </motion.div>
    </Reveal>
    <Reveal delay={0.4}>
      <p className="text-white/80 text-lg mb-8 font-medium">One of the times you made each other smile...</p>
    </Reveal>
    <Reveal delay={0.7}>
      <div className="glass rounded-3xl p-6 bg-white/10 shadow-2xl relative">
        <p className="text-white font-medium text-xl italic relative z-10 leading-relaxed">
          "{data.randomCompliment}"
        </p>
        <div className="absolute inset-0 bg-white/5 rounded-3xl blur-md pointer-events-none" />
      </div>
    </Reveal>
  </Frame>
);

// 12 — Streaks
export const StreakCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.streak} ambiance={<FloatingHearts emoji="🔥" count={25} />}>
    <Reveal delay={0.15}>
      <motion.div
        className="text-8xl mb-4 drop-shadow-[0_0_15px_rgba(251,146,60,0.8)]"
        animate={{ scale: [1, 1.15, 1], filter: ["hue-rotate(0deg)", "hue-rotate(-10deg)", "hue-rotate(0deg)"] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        🔥
      </motion.div>
    </Reveal>
    <Reveal delay={0.4}>
      <p className="text-white/80 text-xl font-medium">Your strongest connection</p>
    </Reveal>
    <Reveal delay={0.7}>
      <div className="flex items-baseline justify-center gap-2 my-4">
        <CountUp value={data.longestStreak} className="text-8xl font-black text-white tabular-nums drop-shadow-lg block" />
        <span className="text-white/70 text-2xl font-bold">days</span>
      </div>
    </Reveal>
    <Reveal delay={1.0}>
      <p className="text-white/80 text-base leading-relaxed px-4">
        No matter how busy life got, you always found time for each other.
      </p>
    </Reveal>
  </Frame>
);

// 13 — Bookmarks
export const BookmarkCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.bookmark} ambiance={<FloatingHearts emoji="📌" count={10} />}>
    <Reveal delay={0.15}>
      <motion.div className="text-7xl mb-4" animate={{ rotate: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        📸
      </motion.div>
    </Reveal>
    <Reveal delay={0.4}>
      <p className="text-white/80 text-lg mb-8">Some things are too important to forget...</p>
    </Reveal>
    <Reveal delay={0.7}>
      <motion.div 
        className="bg-white rounded-lg p-4 pb-12 shadow-2xl rotate-2 relative max-w-[280px]"
        whileHover={{ rotate: 0, scale: 1.05 }}
      >
        <p className="text-slate-800 text-lg font-medium font-serif leading-relaxed line-clamp-6">
          "{data.randomBookmark}"
        </p>
      </motion.div>
    </Reveal>
    <Reveal delay={1.1}>
      <p className="text-white/60 text-sm mt-8 italic">A memory kept safe.</p>
    </Reveal>
  </Frame>
);

// 14 — Milestone
export const MilestoneCard: React.FC<CardProps> = ({ data }) => (
  <Frame gradient={G.milestone} ambiance={<FloatingHearts emoji="✨" count={20} />}>
    <Reveal delay={0.15}>
      <div className="text-7xl mb-4">🥂</div>
    </Reveal>
    <Reveal delay={0.4}>
      <p className="text-white/80 text-xl font-medium">It's been exactly</p>
    </Reveal>
    <Reveal delay={0.7}>
      <div className="flex items-baseline justify-center gap-2 my-6">
        <CountUp value={data.daysTogether} className="text-8xl font-black text-white tabular-nums block drop-shadow-xl" />
      </div>
    </Reveal>
    <Reveal delay={1.0}>
      <p className="text-white/80 text-xl font-semibold tracking-wide">
        days since everything changed.
      </p>
    </Reveal>
    <Reveal delay={1.5}>
      <p className="text-white/60 text-sm mt-8 uppercase tracking-[0.2em]">And you're just getting started.</p>
    </Reveal>
  </Frame>
);

// 10 — Finale
export const FinaleCard: React.FC<CardProps & { onReplay: () => void; onClose: () => void }> = ({
  years,
  onReplay,
  onClose,
}) => (
  <Frame gradient={G.finale} ambiance={<FloatingHearts emoji="💞" count={20} />}>
    <ConfettiBurst count={80} />
    <Reveal delay={0.2}>
      <motion.div
        className="text-7xl mb-5"
        animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        💞
      </motion.div>
    </Reveal>
    <Reveal delay={0.5}>
      <h2 className="text-4xl font-black text-white leading-tight">
        Here's to
        <br />
        {years >= 1 ? `year ${years + 1}` : "many more"}!
      </h2>
    </Reveal>
    <Reveal delay={0.85}>
      <p className="text-white/80 text-base mt-5 leading-relaxed">
        Thank you for a beautiful year together.
        <br />I can't wait for the next chapter. 🥂
      </p>
    </Reveal>
    <Reveal delay={1.2}>
      <div className="flex gap-3 mt-10">
        <button
          onClick={onReplay}
          className="px-6 h-12 rounded-2xl bg-white/15 text-white font-semibold text-sm backdrop-blur"
        >
          ↺ Replay
        </button>
        <button
          onClick={onClose}
          className="px-6 h-12 rounded-2xl bg-white text-rose-900 font-bold text-sm"
        >
          Close 💕
        </button>
      </div>
    </Reveal>
  </Frame>
);
