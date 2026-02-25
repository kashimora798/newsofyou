import React, { useEffect, useState, useMemo } from "react";

type Tier = "bronze" | "silver" | "gold" | "platinum";

interface Props {
  icon: string;
  name: string;
  unlockedText: string;
  tier: Tier;
  onDismiss: () => void;
}

const TIER_COLORS: Record<Tier, { glow: string; label: string; gradient: string }> = {
  bronze: { glow: "rgba(205,127,50,0.6)", label: "🥉 Bronze", gradient: "linear-gradient(135deg, #cd7f32, #8b4513)" },
  silver: { glow: "rgba(192,192,192,0.6)", label: "🥈 Silver", gradient: "linear-gradient(135deg, #c0c0c0, #808080)" },
  gold: { glow: "rgba(255,215,0,0.6)", label: "🥇 Gold", gradient: "linear-gradient(135deg, #ffd700, #daa520)" },
  platinum: { glow: "rgba(180,180,255,0.6)", label: "💎 Platinum", gradient: "linear-gradient(135deg, #e0e0ff, #b0b0ff, #ff80ff, #80ffff)" },
};

const CONFETTI_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bff", "#ff9f43", "#54a0ff", "#5f27cd"];

const AchievementCelebration: React.FC<Props> = ({ icon, name, unlockedText, tier, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tierInfo = TIER_COLORS[tier];
  const isPlatinum = tier === "platinum";

  const confetti = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.5}s`,
      duration: `${2 + Math.random() * 2}s`,
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 6,
    })), []);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => handleDismiss(), isPlatinum ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={handleDismiss}
      style={{
        opacity: dismissed ? 0 : visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: dismissed ? "none" : "auto",
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

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
            animation: `achievement-confetti-fall ${c.duration} ${c.delay} ease-in forwards`,
            transform: `rotate(${c.rotation}deg)`,
          }}
        />
      ))}

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-4 px-8 max-w-sm text-center z-10">
        {/* Glow ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 160,
            height: 160,
            top: -20,
            background: `radial-gradient(circle, ${tierInfo.glow} 0%, transparent 70%)`,
            animation: "achievement-glow-pulse 2s ease-in-out infinite",
          }}
        />

        {/* Icon */}
        <div
          className="text-7xl relative"
          style={{
            animation: visible ? "achievement-icon-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : "none",
            transform: "scale(0)",
          }}
        >
          {icon}
        </div>

        {/* Tier badge */}
        <div
          className="px-4 py-1 rounded-full text-xs font-bold text-white"
          style={{
            background: tierInfo.gradient,
            animation: visible ? "achievement-text-fade 0.5s 0.4s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          {tierInfo.label}
        </div>

        {/* Name */}
        <h2
          className="text-2xl font-bold text-white"
          style={{
            fontFamily: "'Quicksand', sans-serif",
            animation: visible ? "achievement-text-fade 0.5s 0.6s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          {name}
        </h2>

        {/* Description */}
        <p
          className="text-sm text-white/80 leading-relaxed"
          style={{
            animation: visible ? "achievement-text-fade 0.5s 0.8s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          {unlockedText}
        </p>

        {/* Tap to continue */}
        <p
          className="text-xs text-white/40 mt-4"
          style={{
            animation: visible ? "achievement-text-fade 0.5s 2s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          Tap to continue
        </p>
      </div>
    </div>
  );
};

export default AchievementCelebration;
