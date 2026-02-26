import React, { useEffect, useState } from "react";

interface Flock {
  id: number;
  y: number;
  count: number;
  speed: number;
  size: number;
  direction: "ltr" | "rtl";
}

const Bird: React.FC<{ size: number; offsetY: number }> = ({ size, offsetY }) => (
  <svg
    width={size}
    height={size * 0.5}
    viewBox="0 0 20 10"
    style={{ marginTop: offsetY }}
    className="inline-block mx-0.5"
  >
    <path
      d="M0 5 Q5 0 10 5 Q15 0 20 5"
      stroke="hsla(0,0%,10%,0.7)"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const BirdsFlock: React.FC<{ altitude: number }> = ({ altitude }) => {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const visible = altitude > -4 && altitude < 12;

  useEffect(() => {
    if (!visible) return;

    const spawn = () => {
      const id = Date.now();
      const flock: Flock = {
        id,
        y: 15 + Math.random() * 35,
        count: 3 + Math.floor(Math.random() * 4),
        speed: 12 + Math.random() * 10,
        size: 10 + Math.random() * 8,
        direction: Math.random() > 0.5 ? "ltr" : "rtl",
      };
      setFlocks((prev) => [...prev, flock]);
      setTimeout(() => setFlocks((prev) => prev.filter((f) => f.id !== id)), flock.speed * 1000);
    };

    spawn();
    const interval = setInterval(spawn, (20 + Math.random() * 25) * 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible || flocks.length === 0) return null;

  return (
    <>
      {flocks.map((f) => (
        <div
          key={f.id}
          className="absolute flex flex-wrap gap-0 pointer-events-none"
          style={{
            top: `${f.y}%`,
            animation: `birdFly ${f.speed}s linear forwards`,
            left: f.direction === "ltr" ? "-10%" : undefined,
            right: f.direction === "rtl" ? "-10%" : undefined,
            "--bird-dir": f.direction === "ltr" ? "110vw" : "-110vw",
          } as React.CSSProperties}
        >
          {Array.from({ length: f.count }, (_, i) => (
            <Bird key={i} size={f.size} offsetY={Math.sin(i * 1.5) * 6} />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes birdFly {
          0% { transform: translateX(0); }
          100% { transform: translateX(var(--bird-dir, 110vw)); }
        }
      `}</style>
    </>
  );
};

export default BirdsFlock;
