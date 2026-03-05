import React, { useEffect, useState, useRef, useCallback } from "react";
import creepyFace1 from "@/assets/themes/creepy_face1.png";
import creepyFace2 from "@/assets/themes/creepy_face2.png";
import rosePetal1 from "@/assets/themes/rose_petal1.png";
import rosePetal2 from "@/assets/themes/rose_petal2.png";
import glitchOverlay from "@/assets/themes/glitch_overlay.png";

const CREEPY_FACES = [creepyFace1, creepyFace2];
const PETAL_IMAGES = [rosePetal1, rosePetal2];

interface ThemeSurprisesProps {
  surprise: "none" | "jumpscare" | "construction" | "transmission" | "petalBurst" | "pixelGlitch";
  interval: [number, number];
}

const ThemeSurprises: React.FC<ThemeSurprisesProps> = ({ surprise, interval }) => {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    if (surprise === "none" || interval[0] === 0) return;
    const delay = (interval[0] + Math.random() * (interval[1] - interval[0])) * 1000;
    timerRef.current = setTimeout(() => {
      setActive(true);
      const dur = surprise === "jumpscare" ? 400 : 3000;
      dismissRef.current = setTimeout(() => setActive(false), dur);
      scheduleNext();
    }, delay);
  }, [surprise, interval]);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [scheduleNext]);

  if (!active) return null;

  if (surprise === "jumpscare") {
    const face = CREEPY_FACES[Math.random() > 0.5 ? 1 : 0];
    return (
      <div className="fixed inset-0 z-[99999] pointer-events-none animate-[jumpscare-flash_0.4s_ease-out]">
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center">
          <img
            src={face}
            alt=""
            className="w-[70vw] max-w-[400px] object-contain animate-[jumpscare-zoom_0.3s_ease-out] brightness-75 contrast-125"
          />
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
        <div
          className="bg-yellow-300 border-4 border-dashed border-black px-6 py-3 text-black font-bold text-sm text-center"
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
          <img
            key={i}
            src={PETAL_IMAGES[i % 2]}
            alt=""
            className="absolute theme-petal-burst"
            style={{
              left: `${Math.random() * 100}%`,
              top: "-30px",
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              width: `${20 + Math.random() * 16}px`,
              height: `${20 + Math.random() * 16}px`,
              objectFit: "contain",
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>
    );
  }

  if (surprise === "pixelGlitch") {
    return (
      <div className="fixed inset-0 z-[99999] pointer-events-none">
        <img
          src={glitchOverlay}
          alt=""
          className="w-full h-full object-cover opacity-40 mix-blend-overlay animate-[glitch-flicker_0.15s_steps(2)_3]"
        />
      </div>
    );
  }

  return null;
};

export default ThemeSurprises;
