import React, { useEffect, useState } from "react";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  duration: number;
  delay: number;
  length: number;
}

const ShootingStars: React.FC<{ opacity: number }> = ({ opacity }) => {
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    if (opacity <= 0) return;

    const spawn = () => {
      const id = Date.now();
      const star: ShootingStar = {
        id,
        x: 10 + Math.random() * 70,
        y: 5 + Math.random() * 30,
        angle: 25 + Math.random() * 30,
        duration: 0.6 + Math.random() * 0.6,
        delay: 0,
        length: 60 + Math.random() * 80,
      };
      setStars((prev) => [...prev, star]);
      setTimeout(() => setStars((prev) => prev.filter((s) => s.id !== id)), (star.duration + 0.5) * 1000);
    };

    spawn();
    const interval = setInterval(spawn, (15 + Math.random() * 20) * 1000);
    return () => clearInterval(interval);
  }, [opacity > 0]);

  if (opacity <= 0) return null;

  return (
    <>
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.length,
            height: 2,
            opacity,
            transform: `rotate(${s.angle}deg)`,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 40%, white 100%)",
            borderRadius: 1,
            animation: `shootingStar ${s.duration}s ease-out forwards`,
            filter: "blur(0.3px)",
            boxShadow: "0 0 6px 2px rgba(255,255,255,0.4)",
          }}
        />
      ))}
      <style>{`
        @keyframes shootingStar {
          0% { transform: translateX(0) scaleX(0); opacity: 0; }
          10% { opacity: 1; scaleX(0.3); }
          100% { transform: translateX(200px) scaleX(1); opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default ShootingStars;
