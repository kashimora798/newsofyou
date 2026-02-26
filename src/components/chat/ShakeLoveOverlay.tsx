import React, { useEffect, useMemo } from "react";

interface ShakeLoveOverlayProps {
  partnerName: string;
  onDismiss: () => void;
}

const HEART_EMOJIS = ["❤️", "💕", "💖", "💗", "💓", "💞", "💘", "🥰", "😘", "💝"];

interface HeartParticle {
  id: number;
  emoji: string;
  size: number;
  startX: number;
  swayAmp: number;
  duration: number;
  delay: number;
  rotation: number;
  rotationEnd: number;
}

const ShakeLoveOverlay: React.FC<ShakeLoveOverlayProps> = ({ partnerName, onDismiss }) => {
  const hearts = useMemo<HeartParticle[]>(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
      size: 16 + Math.random() * 32,
      startX: Math.random() * 100,
      swayAmp: 30 + Math.random() * 80,
      duration: 3 + Math.random() * 3,
      delay: Math.random() * 2,
      rotation: Math.random() * 360,
      rotationEnd: (Math.random() - 0.5) * 720,
    }));
  }, []);

  useEffect(() => {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200, 100, 300, 150, 300, 150, 500]);
    }
    const timer = setTimeout(onDismiss, 5500);
    return () => {
      clearTimeout(timer);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-auto flex items-center justify-center"
      onClick={onDismiss}
      style={{ background: "radial-gradient(ellipse at center, rgba(255,50,100,0.15) 0%, rgba(0,0,0,0.4) 100%)" }}
    >
      {/* Floating hearts */}
      {hearts.map((h) => (
        <span
          key={h.id}
          className="absolute"
          style={{
            left: `${h.startX}%`,
            top: "-10%",
            fontSize: `${h.size}px`,
            animation: `heartFloat ${h.duration}s ease-in-out ${h.delay}s both`,
            "--sway": `${h.swayAmp}px`,
            "--rot-start": `${h.rotation}deg`,
            "--rot-end": `${h.rotationEnd}deg`,
          } as React.CSSProperties}
        >
          {h.emoji}
        </span>
      ))}

      {/* Center text */}
      <div
        className="text-center px-6 z-10"
        style={{ animation: "loveTextIn 0.8s ease-out 0.5s both" }}
      >
        <p className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg leading-snug">
          Love you {partnerName} 💕
        </p>
        <p className="text-lg sm:text-xl text-white/90 mt-2 drop-shadow-md">
          I know you miss me !!
        </p>
      </div>

      <style>{`
        @keyframes heartFloat {
          0% {
            transform: translateY(0) translateX(0) rotate(var(--rot-start));
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translateY(55vh) translateX(var(--sway)) rotate(calc(var(--rot-start) + var(--rot-end) * 0.5));
            opacity: 0.9;
          }
          100% {
            transform: translateY(115vh) translateX(calc(var(--sway) * -0.6)) rotate(calc(var(--rot-start) + var(--rot-end)));
            opacity: 0;
          }
        }
        @keyframes loveTextIn {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          60% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default ShakeLoveOverlay;
