import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface HeartbeatOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const HeartbeatOverlay: React.FC<HeartbeatOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Pulse the haptics in time with the visible heartbeat.
    haptic.success();
    if (reduced) return;
    const beats = [1100, 2200, 3300].map((d) => setTimeout(() => haptic.success(), d));
    return () => beats.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2600 : 4200);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 45%, hsl(345 80% 55% / 0.22), hsl(0 0% 0% / 0.5) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="hb-wrap">
        <div className="hb-glow" style={{ animation: reduced ? "none" : "hb-glow 1.1s ease-in-out infinite" }} />
        <div
          className="hb-heart"
          style={{ animation: reduced ? "none" : "heartbeat 1.1s ease-in-out infinite" }}
        >
          ❤️
        </div>
      </div>

      <div
        className="mt-10 text-center"
        style={{ animation: reduced ? "none" : "hb-text-in 0.5s ease-out 0.3s both" }}
      >
        <p className="text-[34px] font-bold tracking-tight text-white drop-shadow-lg leading-tight">
          Yes, always 💕
        </p>
        <p className="mt-2 text-[15px] text-white/75">{senderName} is here for you</p>
      </div>

      <style>{`
        .hb-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .hb-heart { font-size: 120px; line-height: 1; will-change: transform; filter: drop-shadow(0 8px 24px rgba(255,40,90,0.4)); }
        .hb-glow {
          position: absolute; width: 200px; height: 200px; border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,70,110,0.55), transparent 65%);
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.2); }
          28% { transform: scale(1); }
          42% { transform: scale(1.12); }
          56% { transform: scale(1); }
        }
        @keyframes hb-glow {
          0%, 100% { transform: scale(0.9); opacity: 0.4; }
          14% { transform: scale(1.15); opacity: 0.7; }
          42% { transform: scale(1.05); opacity: 0.55; }
        }
        @keyframes hb-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default HeartbeatOverlay;
