import React, { useMemo } from "react";

interface Firefly {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
}

const FIREFLY_COUNT = 14;

const Fireflies: React.FC<{ opacity: number }> = ({ opacity }) => {
  const fireflies = useMemo<Firefly[]>(
    () =>
      Array.from({ length: FIREFLY_COUNT }, (_, i) => ({
        id: i,
        x: 5 + Math.random() * 90,
        y: 55 + Math.random() * 40,
        size: 2 + Math.random() * 3,
        duration: 3 + Math.random() * 4,
        delay: Math.random() * 6,
        driftX: -15 + Math.random() * 30,
        driftY: -20 + Math.random() * 10,
      })),
    []
  );

  if (opacity <= 0) return null;

  return (
    <>
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.size,
            height: f.size,
            opacity: 0,
            background: "radial-gradient(circle, hsla(50,100%,75%,1) 0%, hsla(45,100%,60%,0.6) 60%, transparent 100%)",
            boxShadow: `0 0 ${f.size * 3}px ${f.size}px hsla(50,100%,70%,0.5)`,
            animation: `fireflyGlow ${f.duration}s ease-in-out ${f.delay}s infinite`,
            "--drift-x": `${f.driftX}px`,
            "--drift-y": `${f.driftY}px`,
            "--max-opacity": opacity * 0.8,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes fireflyGlow {
          0%, 100% { opacity: 0; transform: translate(0, 0); }
          25% { opacity: var(--max-opacity, 0.7); }
          50% { opacity: var(--max-opacity, 0.7); transform: translate(var(--drift-x, 10px), var(--drift-y, -10px)); }
          75% { opacity: 0.2; }
        }
      `}</style>
    </>
  );
};

export default Fireflies;
