import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface CoinFlipOverlayProps {
  result: "heads" | "tails";
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// heads lands at a multiple of 360 (front face); tails adds 180 to show the back.
const SPINS = 5;

const CoinFlipOverlay: React.FC<CoinFlipOverlayProps> = ({ result, senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const endDeg = result === "heads" ? SPINS * 360 : SPINS * 360 + 180;
  const haptered = useRef(false);

  useEffect(() => {
    if (!haptered.current) {
      haptered.current = true;
      haptic.impact();
      // soft "landing" buzz when the coin settles
      const land = setTimeout(() => haptic.success(), reduced ? 100 : 2100);
      return () => clearTimeout(land);
    }
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2600 : 4200);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 42%, hsl(45 80% 55% / 0.18), hsl(0 0% 0% / 0.55) 70%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="coin-toss" style={{ perspective: 1200 }}>
        <div
          className="coin"
          style={
            {
              "--end": `${endDeg}deg`,
              animation: reduced ? "none" : "coin-spin 2.2s cubic-bezier(0.25,0.6,0.3,1) forwards",
              transform: reduced ? `rotateY(${endDeg}deg)` : undefined,
            } as React.CSSProperties
          }
        >
          <div className="coin-face coin-heads">💛</div>
          <div className="coin-face coin-tails">⭐️</div>
        </div>
        <div
          className="coin-shadow"
          style={{ animation: reduced ? "none" : "coin-shadow 2.2s cubic-bezier(0.25,0.6,0.3,1) forwards" }}
        />
      </div>

      <div
        className="mt-10 text-center"
        style={{ animation: reduced ? "none" : "coin-label-in 0.5s ease-out 2.05s both" }}
      >
        <p className="text-[40px] font-bold tracking-tight text-white drop-shadow-lg leading-none">
          {result === "heads" ? "Heads" : "Tails"}
        </p>
        <p className="mt-2 text-[15px] text-white/75">{senderName} flipped a coin</p>
      </div>

      <style>{`
        .coin {
          width: 150px; height: 150px; position: relative;
          transform-style: preserve-3d; will-change: transform;
        }
        .coin-face {
          position: absolute; inset: 0; border-radius: 9999px;
          display: flex; align-items: center; justify-content: center;
          font-size: 66px; line-height: 1;
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
          background: radial-gradient(circle at 35% 28%, #fff4c4, #f5c542 46%, #d99a25 76%, #b8791a);
          box-shadow:
            inset 0 0 0 7px rgba(255,255,255,0.22),
            inset 0 -10px 18px rgba(0,0,0,0.22),
            inset 0 8px 14px rgba(255,255,255,0.35),
            0 12px 34px rgba(0,0,0,0.4);
        }
        .coin-tails { transform: rotateY(180deg); }
        .coin-shadow {
          width: 120px; height: 18px; margin: 22px auto 0;
          border-radius: 50%; background: rgba(0,0,0,0.35); filter: blur(7px);
        }
        @keyframes coin-spin {
          0%   { transform: translateY(0) rotateY(0deg); }
          55%  { transform: translateY(-130px) rotateY(calc(var(--end) * 0.62)); }
          100% { transform: translateY(0) rotateY(var(--end)); }
        }
        @keyframes coin-shadow {
          0%   { transform: scale(1);   opacity: 0.35; }
          55%  { transform: scale(0.55); opacity: 0.12; }
          100% { transform: scale(1);   opacity: 0.35; }
        }
        @keyframes coin-label-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CoinFlipOverlay;
