import React, { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { playSparkle } from "@/lib/secretSounds";

interface LuckyNumberOverlayProps {
  number: number;
  matched: boolean;
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const LuckyNumberOverlay: React.FC<LuckyNumberOverlayProps> = ({ number, matched, senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const [display, setDisplay] = useState(reduced ? number : Math.floor(Math.random() * 99) + 1);
  const [settled, setSettled] = useState(reduced);
  const started = useRef(false);

  // Slot-machine cycle then settle on the real number.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.impact();
    if (reduced) return;

    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += 90;
      setDisplay(Math.floor(Math.random() * 99) + 1);
      haptic.tap();
      if (elapsed >= 1400) {
        clearInterval(tick);
        setDisplay(number);
        setSettled(true);
        haptic.success();
        if (matched) setTimeout(playSparkle, 200);
      }
    }, 90);
    return () => clearInterval(tick);
  }, [number, matched, reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2800 : matched ? 5000 : 4000);
    return () => clearTimeout(t);
  }, [onDismiss, reduced, matched]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: matched
          ? "radial-gradient(circle at 50% 42%, hsl(45 90% 55% / 0.3), hsl(142 50% 14% / 0.6) 72%)"
          : "radial-gradient(circle at 50% 42%, hsl(142 60% 45% / 0.18), hsl(0 0% 0% / 0.55) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="lucky-card" style={{ animation: reduced ? "none" : "lucky-pop 0.5s cubic-bezier(0.34,1.4,0.5,1) both" }}>
        <span className="text-[20px]">🍀</span>
        <span
          className="lucky-number"
          style={{ transform: settled ? "scale(1.08)" : "scale(1)", transition: "transform 0.2s ease" }}
        >
          {display}
        </span>
        <span className="text-[20px]">🍀</span>
      </div>

      <div className="mt-8 text-center px-8" style={{ animation: reduced ? "none" : "lucky-text-in 0.5s ease-out 1.5s both" }}>
        {matched ? (
          <>
            <p className="text-[30px] font-bold tracking-tight text-amber-300 drop-shadow leading-tight">✨ It's a MATCH! ✨</p>
            <p className="mt-2 text-[15px] text-white/85">You both landed on {number} — that's a sign 💞</p>
          </>
        ) : (
          <>
            <p className="text-[26px] font-bold tracking-tight text-white drop-shadow leading-tight">Lucky number {number}</p>
            <p className="mt-2 text-[14px] text-white/70">{senderName} is feeling lucky 🍀 — match it to win a bonus</p>
          </>
        )}
      </div>

      <style>{`
        .lucky-card {
          display: flex; align-items: center; gap: 14px;
          padding: 20px 34px; border-radius: 28px;
          background: linear-gradient(150deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04));
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 18px 50px rgba(0,0,0,0.4);
          backdrop-filter: blur(10px);
        }
        .lucky-number {
          font-size: 76px; font-weight: 800; line-height: 1; color: #fff;
          font-variant-numeric: tabular-nums; min-width: 110px; text-align: center;
          text-shadow: 0 4px 18px rgba(0,0,0,0.35);
        }
        @keyframes lucky-pop {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes lucky-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LuckyNumberOverlay;
