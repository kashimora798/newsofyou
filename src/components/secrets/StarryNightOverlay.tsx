import React, { useEffect, useMemo, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { playNightLullaby } from "@/lib/secretSounds";

interface StarryNightOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const StarryNightOverlay: React.FC<StarryNightOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 70,
        size: 1 + Math.random() * 2.5,
        delay: Math.random() * 2.5,
        dur: 1.6 + Math.random() * 2,
      })),
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.tap();
    playNightLullaby();
  }, []);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2800 : 4800);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden animate-apple-backdrop flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(to bottom, #05060f 0%, #0c1030 55%, #161a44 100%)" }}
      onClick={onDismiss}
    >
      {/* stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="starry-star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: reduced ? "0s" : `${s.dur}s`,
          }}
        />
      ))}

      {/* moon */}
      <div className="absolute right-[16%] top-[16%] text-[72px] leading-none" style={{ animation: reduced ? "none" : "moon-in 1.4s ease-out both", filter: "drop-shadow(0 0 24px rgba(220,230,255,0.5))" }}>
        🌙
      </div>

      <div className="relative z-10 text-center" style={{ animation: reduced ? "none" : "night-text-in 0.7s ease-out 0.6s both" }}>
        <p className="text-[34px] font-bold tracking-tight text-white/95 drop-shadow leading-tight">Good night 🌙</p>
        <p className="mt-1.5 text-[15px] text-white/70">{senderName} wishes you sweet dreams</p>
      </div>

      <style>{`
        .starry-star {
          position: absolute; border-radius: 9999px; background: #fff;
          box-shadow: 0 0 6px rgba(255,255,255,0.9);
          animation-name: star-twinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out;
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes moon-in {
          from { opacity: 0; transform: translateY(-14px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes night-text-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default StarryNightOverlay;
