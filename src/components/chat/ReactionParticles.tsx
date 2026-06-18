import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  emoji: string;
  angle: number;
  speed: number;
  size: number;
  delay: number;
}

interface ReactionParticlesProps {
  emoji: string;
  isOwn: boolean;
}

const EMOJI_MAP: Record<string, string[]> = {
  "❤️": ["❤️", "💕", "💗", "💞"],
  "🔥": ["🔥", "✨", "💥"],
  "👍": ["👍", "✨"],
  "😂": ["😂", "🤣", "😆"],
  "😢": ["😢", "💧"],
  "😮": ["😮", "⭐", "✨"],
};

const ReactionParticles: React.FC<ReactionParticlesProps> = ({ emoji, isOwn }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const emojis = EMOJI_MAP[emoji] ?? [emoji];
    // More particles + a wider spray gives the burst real "weight".
    const newParticles: Particle[] = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      angle: -90 + (Math.random() * 120 - 60),
      speed: 45 + Math.random() * 40,
      size: 13 + Math.random() * 11,
      delay: Math.random() * 0.08,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 1100);
    return () => clearTimeout(timer);
  }, [emoji, isOwn]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-30">
      {/* Central pop — the reaction itself springs in big, then settles */}
      <span
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          fontSize: 30,
          transform: "translate(-50%, -50%)",
          animation: "reaction-pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {emoji}
      </span>

      {/* Radial particle burst */}
      {particles.map((p) => {
        const dx = Math.cos((p.angle * Math.PI) / 180) * p.speed;
        const dy = Math.sin((p.angle * Math.PI) / 180) * p.speed;
        return (
          <span
            key={p.id}
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              fontSize: p.size,
              opacity: 0,
              animation: `reaction-fly-${p.id % 4} 1s ease-out ${p.delay}s forwards`,
            }}
          >
            <style>{`
              @keyframes reaction-pop {
                0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
                45% { transform: translate(-50%, -50%) scale(1.35); opacity: 1; }
                70% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -70%) scale(0.85); opacity: 0; }
              }
              @keyframes reaction-fly-${p.id % 4} {
                0% { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
                100% {
                  transform: translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(${dx * 2}deg);
                  opacity: 0;
                }
              }
            `}</style>
            {p.emoji}
          </span>
        );
      })}
    </div>
  );
};

export default ReactionParticles;
