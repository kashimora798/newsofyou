import React, { useEffect, useState } from "react";

interface Plane {
  id: number;
  y: number;
  speed: number;
  direction: "ltr" | "rtl";
}

const AirplaneTrail: React.FC<{ isDaytime: boolean }> = ({ isDaytime }) => {
  const [planes, setPlanes] = useState<Plane[]>([]);

  useEffect(() => {
    if (!isDaytime) return;

    const spawn = () => {
      const id = Date.now();
      const plane: Plane = {
        id,
        y: 8 + Math.random() * 25,
        speed: 25 + Math.random() * 20,
        direction: Math.random() > 0.5 ? "ltr" : "rtl",
      };
      setPlanes((prev) => [...prev, plane]);
      setTimeout(() => setPlanes((prev) => prev.filter((p) => p.id !== id)), plane.speed * 1000);
    };

    const timeout = setTimeout(spawn, (30 + Math.random() * 30) * 1000);
    const interval = setInterval(spawn, (60 + Math.random() * 30) * 1000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [isDaytime]);

  if (!isDaytime || planes.length === 0) return null;

  return (
    <>
      {planes.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            top: `${p.y}%`,
            left: p.direction === "ltr" ? "-2%" : undefined,
            right: p.direction === "rtl" ? "-2%" : undefined,
            animation: `planeFly ${p.speed}s linear forwards`,
            "--plane-dir": p.direction === "ltr" ? "110vw" : "-110vw",
          } as React.CSSProperties}
        >
          {/* Plane dot */}
          <div
            className="rounded-full"
            style={{
              width: 3,
              height: 3,
              background: "white",
              boxShadow: "0 0 4px 1px rgba(255,255,255,0.6)",
            }}
          />
          {/* Contrail */}
          <div
            style={{
              position: "absolute",
              top: 1,
              right: p.direction === "ltr" ? 3 : undefined,
              left: p.direction === "rtl" ? 3 : undefined,
              width: 120,
              height: 1.5,
              background: `linear-gradient(${p.direction === "ltr" ? "to left" : "to right"}, rgba(255,255,255,0.5), transparent)`,
              animation: `contrailFade ${p.speed}s linear forwards`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes planeFly {
          0% { transform: translateX(0); }
          100% { transform: translateX(var(--plane-dir, 110vw)); }
        }
        @keyframes contrailFade {
          0% { width: 0; }
          10% { width: 120px; }
          100% { width: 120px; }
        }
      `}</style>
    </>
  );
};

export default AirplaneTrail;
