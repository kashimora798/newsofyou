import React, { useEffect, useState } from "react";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  duration: number;
  delay: number;
  length: number;
  curve: number;
}

const ShootingStars: React.FC<{ opacity: number }> = ({ opacity }) => {
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    if (opacity <= 0) return;

    const spawn = () => {
      const id = Date.now() + Math.random();
      const star: ShootingStar = {
        id,
        x: 10 + Math.random() * 60,
        y: 5 + Math.random() * 25,
        angle: 20 + Math.random() * 25,
        duration: 1.2 + Math.random() * 1.0,
        delay: 0,
        length: 120 + Math.random() * 100,
        curve: Math.floor(Math.random() * 3),
      };
      setStars((prev) => [...prev, star]);
      setTimeout(() => setStars((prev) => prev.filter((s) => s.id !== id)), (star.duration + 0.5) * 1000);
    };

    spawn();
    const interval = setInterval(spawn, (15 + Math.random() * 20) * 1000);
    return () => clearInterval(interval);
  }, [opacity > 0]);

  if (opacity <= 0) return null;

  const curveNames = ["shootArc0", "shootArc1", "shootArc2"];

  return (
    <>
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute pointer-events-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            opacity,
            transform: `rotate(${s.angle}deg)`,
            animation: `${curveNames[s.curve]} ${s.duration}s ease-out forwards`,
          }}
        >
          {/* Tail */}
          <div
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              width: s.length,
              height: 2,
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.7) 80%, white 100%)",
              borderRadius: 1,
              filter: "blur(0.5px)",
            }}
          />
          {/* Head */}
          <div
            style={{
              position: "relative",
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 0 6px 3px rgba(255,255,255,0.9), 0 0 14px 6px rgba(200,220,255,0.5)",
              zIndex: 1,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes shootArc0 {
          0% { transform: translate(0, 0) rotate(var(--angle)); opacity: 0; }
          8% { opacity: 1; }
          50% { transform: translate(200px, 30px) rotate(var(--angle)); }
          100% { transform: translate(400px, 80px) rotate(var(--angle)); opacity: 0; }
        }
        @keyframes shootArc1 {
          0% { transform: translate(0, 0) rotate(var(--angle)); opacity: 0; }
          8% { opacity: 1; }
          50% { transform: translate(180px, 50px) rotate(var(--angle)); }
          100% { transform: translate(380px, 60px) rotate(var(--angle)); opacity: 0; }
        }
        @keyframes shootArc2 {
          0% { transform: translate(0, 0) rotate(var(--angle)); opacity: 0; }
          8% { opacity: 1; }
          50% { transform: translate(220px, 20px) rotate(var(--angle)); }
          100% { transform: translate(420px, 90px) rotate(var(--angle)); opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default ShootingStars;
