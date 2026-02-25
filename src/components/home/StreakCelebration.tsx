import React, { useEffect, useState, useMemo } from "react";

interface Props {
  streakCount: number;
  onDismiss: () => void;
}

const FLAME_PARTICLES = ["🔥", "✨", "⭐", "💫", "🌟"];
const CONFETTI_COLORS = [
  "#ff6b35", "#ff9500", "#ffcc02", "#ff3b30",
  "#ff6b6b", "#ffd93d", "#ff9f43", "#ee5a24",
];

const StreakCelebration: React.FC<Props> = ({ streakCount, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      emoji: FLAME_PARTICLES[i % FLAME_PARTICLES.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: 16 + Math.random() * 20,
    })), []);

  const confetti = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.5}s`,
      duration: `${2.5 + Math.random() * 2}s`,
      rotation: Math.random() * 360,
      size: 5 + Math.random() * 7,
    })), []);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(handleDismiss, 7000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(onDismiss, 500);
  };

  const isMilestone = streakCount === 7 || streakCount === 30 || streakCount === 100 || streakCount === 365;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={handleDismiss}
      style={{
        opacity: dismissed ? 0 : visible ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: dismissed ? "none" : "auto",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background: "radial-gradient(circle at center, rgba(255,107,53,0.15) 0%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Confetti */}
      {confetti.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-sm"
          style={{
            width: c.size,
            height: c.size * 0.6,
            background: c.color,
            left: c.left,
            top: "-10px",
            animation: `streak-confetti-fall ${c.duration} ${c.delay} ease-in forwards`,
            transform: `rotate(${c.rotation}deg)`,
          }}
        />
      ))}

      {/* Rising flame particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            fontSize: p.size,
            left: p.left,
            bottom: "-40px",
            animation: `streak-particle-rise ${p.duration} ${p.delay} ease-out forwards`,
            opacity: 0,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-3 px-8 max-w-sm text-center z-10">
        {/* Fire glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            top: -40,
            background: "radial-gradient(circle, rgba(255,149,0,0.5) 0%, rgba(255,59,48,0.2) 50%, transparent 70%)",
            animation: "streak-glow-pulse 1.5s ease-in-out infinite",
          }}
        />

        {/* Big flame icon */}
        <div
          className="relative"
          style={{
            animation: visible ? "streak-flame-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : "none",
            transform: "scale(0)",
          }}
        >
          <span className="text-8xl block" style={{ filter: "drop-shadow(0 0 20px rgba(255,149,0,0.6))" }}>
            🔥
          </span>
        </div>

        {/* Streak number */}
        <div
          style={{
            animation: visible ? "streak-text-pop 0.5s 0.4s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          <p
            className="text-6xl font-black"
            style={{
              fontFamily: "'Quicksand', sans-serif",
              background: "linear-gradient(180deg, #FFD700 0%, #FF6B35 50%, #FF3B30 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 8px rgba(255,107,53,0.4))",
            }}
          >
            {streakCount}
          </p>
          <p className="text-sm font-bold text-white/80 -mt-1">
            {streakCount === 1 ? "day streak!" : "day streak!"}
          </p>
        </div>

        {/* Message */}
        <p
          className="text-sm text-white/70 leading-relaxed max-w-[280px]"
          style={{
            animation: visible ? "streak-text-pop 0.5s 0.7s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          {isMilestone
            ? streakCount === 365
              ? "A FULL YEAR! You two are absolutely legendary! 🌟"
              : streakCount === 100
                ? "100 days! Unstoppable! Nothing can break this bond! 🌋"
                : streakCount === 30
                  ? "A whole month of daily chats! You're on fire! 🔥🔥"
                  : "7 days strong! The spark has been lit! ⚡"
            : "You both hit 50 messages today! Keep the fire alive! 💪"
          }
        </p>

        {/* Tap to continue */}
        <p
          className="text-xs text-white/30 mt-3"
          style={{
            animation: visible ? "streak-text-pop 0.5s 2s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          Tap to continue
        </p>
      </div>
    </div>
  );
};

export default StreakCelebration;
