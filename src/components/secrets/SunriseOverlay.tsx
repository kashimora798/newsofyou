import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { playMorningChime } from "@/lib/secretSounds";

interface SunriseOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SunriseOverlay: React.FC<SunriseOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.tap();
    playMorningChime();
  }, []);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2800 : 4600);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden animate-apple-backdrop flex flex-col items-center justify-end"
      style={{ background: "linear-gradient(to bottom, #fcb045 0%, #fd9d5a 35%, #ffd29b 70%, #fff3da 100%)" }}
      onClick={onDismiss}
    >
      {/* sun */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[34%]">
        <div className="sunrise-sun" style={{ animation: reduced ? "none" : "sunrise-rise 2.4s cubic-bezier(0.22,0.7,0.3,1) both" }}>
          <div className="sunrise-rays" style={{ animation: reduced ? "none" : "sunrise-spin 18s linear infinite" }} />
        </div>
      </div>

      {/* birds */}
      {!reduced && (
        <>
          <span className="sunrise-bird" style={{ top: "22%", animationDelay: "0.2s" }}>🐦</span>
          <span className="sunrise-bird" style={{ top: "30%", animationDelay: "0.9s", fontSize: 20 }}>🐦</span>
          <span className="sunrise-bird" style={{ top: "18%", animationDelay: "1.6s", fontSize: 22 }}>🕊️</span>
        </>
      )}

      <div className="relative z-10 mb-[28%] text-center" style={{ animation: reduced ? "none" : "sunrise-text-in 0.6s ease-out 0.8s both" }}>
        <p className="text-[34px] font-bold tracking-tight text-white drop-shadow-md leading-tight">Good morning ☀️</p>
        <p className="mt-1.5 text-[15px] text-white/90 drop-shadow">{senderName} is thinking of you</p>
      </div>

      <style>{`
        .sunrise-sun {
          width: 130px; height: 130px; border-radius: 9999px; position: relative;
          background: radial-gradient(circle at 50% 45%, #fff7e0, #ffd45e 55%, #ffb13c 100%);
          box-shadow: 0 0 70px 30px rgba(255,200,90,0.65);
        }
        .sunrise-rays {
          position: absolute; inset: -36px; border-radius: 9999px;
          background: repeating-conic-gradient(rgba(255,240,190,0.55) 0deg 7deg, transparent 7deg 20deg);
          -webkit-mask: radial-gradient(circle, transparent 62px, #000 64px);
          mask: radial-gradient(circle, transparent 62px, #000 64px);
          opacity: 0.7;
        }
        .sunrise-bird {
          position: absolute; left: -10%; font-size: 24px; z-index: 5;
          animation: sunrise-fly 5s linear forwards;
        }
        @keyframes sunrise-rise {
          from { transform: translateY(120px) scale(0.85); opacity: 0.4; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes sunrise-spin { to { transform: rotate(360deg); } }
        @keyframes sunrise-fly {
          from { transform: translateX(0) translateY(0); }
          to   { transform: translateX(130vw) translateY(-30px); }
        }
        @keyframes sunrise-text-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SunriseOverlay;
