import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";

type Season = "spring" | "summer" | "autumn" | "winter";

function getSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

const SEASON_CONFIG: Record<Season, { emoji: string[]; count: number; label: string }> = {
  spring: { emoji: ["🌸", "🎀", "💮"], count: 10, label: "Cherry blossoms" },
  summer: { emoji: ["🌺", "🌻", "🌼"], count: 8, label: "Flower petals" },
  autumn: { emoji: ["🍂", "🍁", "🍃"], count: 10, label: "Falling leaves" },
  winter: { emoji: ["❄️", "✨", "🤍"], count: 12, label: "Snowflakes" },
};

interface Particle {
  id: number;
  emoji: string;
  x: number;
  size: number;
  duration: number;
  delay: number;
  swayAmp: number;
  rotation: number;
}

interface SeasonalParticlesProps {
  altitude: number;
}

// Rare event: particles appear for 30-60s then disappear for 1-3 hours
const SeasonalParticles: React.FC<SeasonalParticlesProps> = ({ altitude }) => {
  const season = useMemo(() => getSeason(), []);
  const config = SEASON_CONFIG[season];
  const [active, setActive] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const scheduleRef = useRef<ReturnType<typeof setTimeout>>();

  // Schedule rare appearances
  useEffect(() => {
    const scheduleNext = () => {
      // Wait 1-3 hours before showing
      const waitTime = (60 + Math.random() * 120) * 60 * 1000;
      scheduleRef.current = setTimeout(() => {
        setActive(true);
        // Show for 30-60 seconds
        const showDuration = (30 + Math.random() * 30) * 1000;
        setTimeout(() => {
          setActive(false);
          scheduleNext();
        }, showDuration);
      }, waitTime);
    };

    // First appearance after 5-15 min
    const firstDelay = (5 + Math.random() * 10) * 60 * 1000;
    scheduleRef.current = setTimeout(() => {
      setActive(true);
      const showDuration = (30 + Math.random() * 30) * 1000;
      setTimeout(() => {
        setActive(false);
        scheduleNext();
      }, showDuration);
    }, firstDelay);

    return () => { if (scheduleRef.current) clearTimeout(scheduleRef.current); };
  }, []);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: config.count }, (_, i) => ({
      id: i,
      emoji: config.emoji[Math.floor(Math.random() * config.emoji.length)],
      x: Math.random() * 100,
      size: 12 + Math.random() * 10,
      duration: 8 + Math.random() * 6,
      delay: Math.random() * 5,
      swayAmp: 30 + Math.random() * 60,
      rotation: Math.random() * 360,
    }));
  }, [config]);

  const opacity = altitude > 10 ? 0.8 : altitude > 0 ? 0.6 : altitude > -6 ? 0.3 : 0.15;

  const handleTap = useCallback((e: React.PointerEvent, particle: Particle) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const burst = {
      id: Date.now() + particle.id,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      emoji: particle.emoji,
    };
    setBursts((prev) => [...prev, burst]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== burst.id)), 800);
  }, []);

  if (!active) return null;

  return (
    <>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute pointer-events-auto cursor-pointer select-none"
          style={{
            left: `${p.x}%`,
            top: "-5%",
            fontSize: p.size,
            opacity,
            animation: `seasonFall ${p.duration}s linear ${p.delay}s infinite`,
            "--sway": `${p.swayAmp}px`,
            "--rot": `${p.rotation}deg`,
          } as React.CSSProperties}
          onPointerDown={(e) => handleTap(e, p)}
        >
          {p.emoji}
        </span>
      ))}

      {bursts.map((b) => (
        <div key={b.id} className="fixed pointer-events-none" style={{ left: b.x, top: b.y, zIndex: 50 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="absolute" style={{
              fontSize: 14,
              animation: "particleBurst 0.6s ease-out forwards",
              transform: `rotate(${(i / 6) * 360}deg)`,
              "--angle": `${(i / 6) * 360}deg`,
            } as React.CSSProperties}>{b.emoji}</span>
          ))}
        </div>
      ))}

      <style>{`
        @keyframes seasonFall {
          0% { transform: translateY(0) translateX(0) rotate(0deg); }
          25% { transform: translateY(28vh) translateX(var(--sway)) rotate(calc(var(--rot) * 0.5)); }
          50% { transform: translateY(55vh) translateX(calc(var(--sway) * -0.5)) rotate(var(--rot)); }
          75% { transform: translateY(82vh) translateX(calc(var(--sway) * 0.3)) rotate(calc(var(--rot) * 1.5)); }
          100% { transform: translateY(110vh) translateX(calc(var(--sway) * -0.2)) rotate(calc(var(--rot) * 2)); }
        }
        @keyframes particleBurst {
          0% { opacity: 1; transform: rotate(var(--angle)) translateY(0); }
          100% { opacity: 0; transform: rotate(var(--angle)) translateY(-35px); }
        }
      `}</style>
    </>
  );
};

export default SeasonalParticles;
