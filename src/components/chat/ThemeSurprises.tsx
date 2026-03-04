import React, { useEffect, useState, useRef, useCallback } from "react";

interface ThemeSurprisesProps {
  surprise: "none" | "jumpscare" | "construction" | "transmission" | "petalBurst" | "pixelGlitch";
  interval: [number, number];
}

const ThemeSurprises: React.FC<ThemeSurprisesProps> = ({ surprise, interval }) => {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    if (surprise === "none" || interval[0] === 0) return;
    const delay = (interval[0] + Math.random() * (interval[1] - interval[0])) * 1000;
    timerRef.current = setTimeout(() => {
      setActive(true);
      // Auto-dismiss
      const dur = surprise === "jumpscare" ? 350 : 3000;
      setTimeout(() => setActive(false), dur);
      scheduleNext();
    }, delay);
  }, [surprise, interval]);

  useEffect(() => {
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scheduleNext]);

  if (!active) return null;

  if (surprise === "jumpscare") {
    return (
      <div className="fixed inset-0 z-[99999] pointer-events-none theme-jumpscare">
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-[120px] animate-pulse">👁️</div>
        </div>
      </div>
    );
  }

  if (surprise === "transmission") {
    return (
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none animate-fade-in">
        <div className="bg-red-900/90 border border-red-500 px-6 py-3 rounded font-mono text-red-200 text-xs tracking-widest uppercase whitespace-nowrap shadow-lg shadow-red-900/50">
          ⚠ TRANSMISSION INTERCEPTED ⚠
        </div>
      </div>
    );
  }

  if (surprise === "construction") {
    return (
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none animate-fade-in">
        <div className="bg-yellow-300 border-4 border-dashed border-black px-6 py-3 text-black font-bold text-sm text-center"
          style={{ fontFamily: "'Comic Neue', 'Comic Sans MS', cursive" }}
        >
          🚧 UNDER CONSTRUCTION 🚧
          <br />
          <span className="text-xs font-normal">Come back later!</span>
        </div>
      </div>
    );
  }

  if (surprise === "petalBurst") {
    return (
      <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className="absolute theme-petal-burst"
            style={{
              left: `${Math.random() * 100}%`,
              top: "-20px",
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              fontSize: `${16 + Math.random() * 12}px`,
            }}
          >
            🌸
          </div>
        ))}
      </div>
    );
  }

  if (surprise === "pixelGlitch") {
    return (
      <div className="fixed inset-0 z-[99999] pointer-events-none theme-pixel-glitch" />
    );
  }

  return null;
};

export default ThemeSurprises;
