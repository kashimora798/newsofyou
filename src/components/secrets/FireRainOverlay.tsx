import React, { useEffect, useMemo, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface FireRainOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const FireRainOverlay: React.FC<FireRainOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  const drops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.4,
        duration: 1.6 + Math.random() * 1.4,
        size: 22 + Math.random() * 22,
        char: Math.random() < 0.85 ? "🔥" : "😤",
      })),
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.warn();
  }, []);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2400 : 3600);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 30%, hsl(14 90% 50% / 0.28), hsl(0 70% 12% / 0.55) 75%)",
        animation: reduced ? undefined : "fire-shake 0.5s ease-in-out 3",
      }}
      onClick={onDismiss}
    >
      <div className="absolute inset-0 fire-vignette" />

      {!reduced &&
        drops.map((d) => (
          <span
            key={d.id}
            className="fire-drop"
            style={{
              left: `${d.left}%`,
              fontSize: `${d.size}px`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          >
            {d.char}
          </span>
        ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[64px] leading-none" style={{ animation: reduced ? "none" : "fire-pop 0.5s ease-out both" }}>
          🔥🔥🔥
        </div>
        <p className="mt-4 text-[15px] text-white/80">{senderName} is fuming</p>
      </div>

      <style>{`
        .fire-vignette {
          background: radial-gradient(circle at 50% 50%, transparent 45%, rgba(120,10,0,0.35) 100%);
        }
        .fire-drop {
          position: absolute; top: -8%; will-change: transform, opacity;
          animation-name: fire-fall; animation-timing-function: ease-in; animation-fill-mode: forwards;
          filter: drop-shadow(0 0 8px rgba(255,120,0,0.7));
        }
        @keyframes fire-fall {
          0%   { transform: translateY(0) rotate(0deg) scale(0.8); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translateY(112vh) rotate(40deg) scale(1.1); opacity: 0.9; }
        }
        @keyframes fire-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fire-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  );
};

export default FireRainOverlay;
