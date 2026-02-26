import React, { useState, useEffect, useRef } from "react";

interface HeartCloudProps {
  isDaytime: boolean;
  onCaught?: () => void;
}

const LOVE_MESSAGES = [
  "💕 You caught a heart cloud!",
  "💗 Love is in the air!",
  "💖 A cloud just for you!",
  "💞 Hearts float your way!",
];

// Appears rarely: once every 2-4 hours during daytime
const MIN_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const MAX_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

const HeartCloud: React.FC<HeartCloudProps> = ({ isDaytime, onCaught }) => {
  const [visible, setVisible] = useState(false);
  const [caught, setCaught] = useState(false);
  const [burstParticles, setBurstParticles] = useState<{ id: number; angle: number }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const spawnRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isDaytime) { setVisible(false); return; }

    const scheduleNext = () => {
      const delay = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
      spawnRef.current = setTimeout(() => {
        setVisible(true);
        setCaught(false);
        setBurstParticles([]);
        timerRef.current = setTimeout(() => setVisible(false), 25000);
        scheduleNext();
      }, delay);
    };

    // First spawn after 30-60 min
    const firstDelay = (30 + Math.random() * 30) * 60 * 1000;
    spawnRef.current = setTimeout(() => {
      setVisible(true);
      setCaught(false);
      setBurstParticles([]);
      timerRef.current = setTimeout(() => setVisible(false), 25000);
      scheduleNext();
    }, firstDelay);

    return () => {
      if (spawnRef.current) clearTimeout(spawnRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDaytime]);

  const handleTap = () => {
    if (caught) return;
    setCaught(true);
    const particles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i / 8) * 360,
    }));
    setBurstParticles(particles);
    onCaught?.();
    setTimeout(() => setVisible(false), 1500);
  };

  if (!visible || !isDaytime) return null;

  return (
    <>
      <div
        className="absolute pointer-events-auto cursor-pointer"
        style={{
          top: "12%",
          animation: "heartCloudDrift 25s linear forwards",
          zIndex: 5,
        }}
        onPointerDown={handleTap}
      >
        <div
          style={{
            position: "relative",
            width: 50,
            height: 45,
            filter: caught ? "brightness(1.5)" : "brightness(1.05) drop-shadow(0 2px 8px rgba(255,255,255,0.4))",
            transform: caught ? "scale(1.3)" : "scale(1)",
            transition: "all 0.3s ease-out",
            opacity: caught ? 0 : 1,
          }}
        >
          <div style={{ position: "absolute", width: 50, height: 45 }}>
            <div style={{
              position: "absolute", top: 0, left: 25, width: 25, height: 40,
              background: "rgba(255,255,255,0.85)", borderRadius: "25px 25px 0 0",
              transform: "rotate(-45deg)", transformOrigin: "0 100%",
              boxShadow: "inset 0 0 10px rgba(255,200,220,0.3)",
            }} />
            <div style={{
              position: "absolute", top: 0, left: 0, width: 25, height: 40,
              background: "rgba(255,255,255,0.85)", borderRadius: "25px 25px 0 0",
              transform: "rotate(45deg)", transformOrigin: "100% 100%",
              boxShadow: "inset 0 0 10px rgba(255,200,220,0.3)",
            }} />
          </div>
        </div>

        {caught && burstParticles.map((p) => (
          <span key={p.id} className="absolute" style={{
            left: 25, top: 22, fontSize: 16,
            animation: "heartBurst 0.8s ease-out forwards",
            transform: `rotate(${p.angle}deg)`,
            "--burst-angle": `${p.angle}deg`,
          } as React.CSSProperties}>💕</span>
        ))}

        {caught && (
          <div className="absolute whitespace-nowrap text-sm font-medium" style={{
            top: -30, left: "50%", transform: "translateX(-50%)",
            color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            animation: "heartCaughtText 1s ease-out forwards",
          }}>
            {LOVE_MESSAGES[Math.floor(Math.random() * LOVE_MESSAGES.length)]}
          </div>
        )}
      </div>

      <style>{`
        @keyframes heartCloudDrift {
          0% { left: -8%; }
          100% { left: 108%; }
        }
        @keyframes heartBurst {
          0% { opacity: 1; transform: rotate(var(--burst-angle)) translateY(0); }
          100% { opacity: 0; transform: rotate(var(--burst-angle)) translateY(-50px); }
        }
        @keyframes heartCaughtText {
          0% { opacity: 0; transform: translateX(-50%) translateY(0); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `}</style>
    </>
  );
};

export default HeartCloud;
