import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface MendingHeartOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const HEART_PATH =
  "M50 88 C50 88 12 60 12 34 C12 19 24 12 34 14 C42 15 48 22 50 28 C52 22 58 15 66 14 C76 12 88 19 88 34 C88 60 50 88 50 88 Z";

const MendingHeartOverlay: React.FC<MendingHeartOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.warn();
    if (reduced) return;
    const heal = setTimeout(() => haptic.success(), 1500);
    return () => clearTimeout(heal);
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2600 : 4200);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 45%, hsl(345 70% 50% / 0.18), hsl(0 0% 0% / 0.55) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="mend-wrap">
        <div className="mend-seam" style={{ animation: reduced ? "none" : "mend-seam 0.6s ease-out 1.25s both" }} />
        {/* left half */}
        <svg className="mend-half mend-left" viewBox="0 0 100 100" width="180" height="180"
          style={{ animation: reduced ? "none" : "mend-left 1.5s cubic-bezier(0.34,1.3,0.5,1) both" }}>
          <path d={HEART_PATH} fill="url(#mendGrad)" />
          <defs>
            <linearGradient id="mendGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff5d8f" />
              <stop offset="100%" stopColor="#e0245e" />
            </linearGradient>
          </defs>
        </svg>
        {/* right half */}
        <svg className="mend-half mend-right" viewBox="0 0 100 100" width="180" height="180"
          style={{ animation: reduced ? "none" : "mend-right 1.5s cubic-bezier(0.34,1.3,0.5,1) both" }}>
          <path d={HEART_PATH} fill="url(#mendGrad2)" />
          <defs>
            <linearGradient id="mendGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff5d8f" />
              <stop offset="100%" stopColor="#e0245e" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mend-flash" style={{ animation: reduced ? "none" : "mend-flash 0.7s ease-out 1.4s both" }} />
      </div>

      <div
        className="mt-10 text-center"
        style={{ animation: reduced ? "none" : "mend-text-in 0.5s ease-out 1.6s both" }}
      >
        <p className="text-[32px] font-bold tracking-tight text-white drop-shadow-lg leading-tight">
          I'm sorry 💗
        </p>
        <p className="mt-2 text-[15px] text-white/75">{senderName} wants to make up</p>
      </div>

      <style>{`
        .mend-wrap { position: relative; width: 180px; height: 180px; }
        .mend-half { position: absolute; inset: 0; }
        .mend-left  { clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%); filter: drop-shadow(-2px 4px 8px rgba(224,36,94,0.4)); }
        .mend-right { clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); filter: drop-shadow(2px 4px 8px rgba(224,36,94,0.4)); }
        .mend-seam {
          position: absolute; left: 50%; top: 14%; width: 3px; height: 64%;
          transform: translateX(-50%); border-radius: 2px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.95), transparent);
          opacity: 0;
        }
        .mend-flash {
          position: absolute; inset: 0; border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,255,255,0.85), transparent 60%);
          opacity: 0;
        }
        @keyframes mend-left {
          0%   { transform: translateX(-30px) rotate(-10deg); }
          60%  { transform: translateX(2px) rotate(1deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        @keyframes mend-right {
          0%   { transform: translateX(30px) rotate(10deg); }
          60%  { transform: translateX(-2px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        @keyframes mend-seam {
          0% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes mend-flash {
          0% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 0.9; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes mend-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MendingHeartOverlay;
