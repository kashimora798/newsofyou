import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
}

interface ReactionParticlesProps {
  emoji: string;
  isOwn: boolean;
}

const EMOJI_MAP: Record<string, string[]> = {
  "❤️": ["❤️", "💕", "💗"],
  "🔥": ["🔥", "✨", "💥"],
  "👍": ["👍", "👍"],
  "😂": ["😂", "🤣"],
  "😢": ["😢", "💧"],
  "😮": ["😮", "⭐"],
};

const ReactionParticles: React.FC<ReactionParticlesProps> = ({ emoji, isOwn }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const emojis = EMOJI_MAP[emoji] ?? [emoji];
    const newParticles: Particle[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: (isOwn ? -1 : 1) * (Math.random() * 20 - 10),
      y: 0,
      angle: -90 + (Math.random() * 60 - 30),
      speed: 40 + Math.random() * 30,
      size: 12 + Math.random() * 8,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 800);
    return () => clearTimeout(timer);
  }, [emoji, isOwn]);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-30">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            fontSize: p.size,
            animation: `particle-burst-${p.id % 3} 0.7s ease-out forwards`,
            transform: `translate(${p.x}px, 0px)`,
            opacity: 1,
          }}
        >
          <style>{`
            @keyframes particle-burst-${p.id % 3} {
              0% { transform: translate(0, 0) scale(0.5); opacity: 1; }
              100% { 
                transform: translate(${Math.cos((p.angle * Math.PI) / 180) * p.speed}px, ${Math.sin((p.angle * Math.PI) / 180) * p.speed}px) scale(1.2); 
                opacity: 0; 
              }
            }
          `}</style>
          {p.emoji}
        </span>
      ))}
    </div>
  );
};

export default ReactionParticles;
