import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface EightBallOverlayProps {
  answer: string;
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const EightBallOverlay: React.FC<EightBallOverlayProps> = ({ answer, senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const haptered = useRef(false);

  useEffect(() => {
    if (!haptered.current) {
      haptered.current = true;
      haptic.impact();
      const land = setTimeout(() => haptic.success(), reduced ? 100 : 1500);
      return () => clearTimeout(land);
    }
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2600 : 4400);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 42%, hsl(262 60% 45% / 0.25), hsl(0 0% 0% / 0.6) 70%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div
        className="eightball"
        style={{ animation: reduced ? "none" : "eightball-shake 1.4s cubic-bezier(0.36,0.07,0.19,0.97) both" }}
      >
        <div className="eightball-number">8</div>
        <div
          className="eightball-window"
          style={{ animation: reduced ? "none" : "eightball-answer-in 0.6s ease-out 1.4s both" }}
        >
          <div className="eightball-triangle" />
        </div>
      </div>

      <div
        className="mt-10 text-center px-8 max-w-sm"
        style={{ animation: reduced ? "none" : "eightball-answer-in 0.55s ease-out 1.55s both" }}
      >
        <p className="text-[26px] font-bold tracking-tight text-white drop-shadow-lg leading-snug">
          {answer}
        </p>
        <p className="mt-2 text-[14px] text-white/70">{senderName} asked the magic 8-ball 🎱</p>
      </div>

      <style>{`
        .eightball {
          width: 200px; height: 200px; border-radius: 9999px; position: relative;
          background: radial-gradient(circle at 34% 28%, #4a4a52 0%, #1a1a1f 55%, #000 100%);
          box-shadow: inset 0 -14px 34px rgba(0,0,0,0.7), inset 0 10px 22px rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
        }
        .eightball-number {
          position: absolute; top: 30px; width: 56px; height: 56px; border-radius: 9999px;
          background: #fff; color: #111; font-weight: 800; font-size: 32px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .eightball-window {
          position: absolute; bottom: 36px; width: 108px; height: 108px;
          border-radius: 9999px;
          background: radial-gradient(circle at 50% 40%, #2a1d6b 0%, #160f3a 70%, #0c0826 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
          overflow: hidden;
        }
        .eightball-triangle {
          width: 74px; height: 74px;
          clip-path: polygon(50% 6%, 94% 90%, 6% 90%);
          background: linear-gradient(160deg, #6b4ce6, #3a25a0);
          box-shadow: inset 0 0 14px rgba(255,255,255,0.22);
        }
        @keyframes eightball-shake {
          0%,100% { transform: translate(0,0) rotate(0); }
          10% { transform: translate(-12px,-6px) rotate(-7deg); }
          22% { transform: translate(12px,6px) rotate(7deg); }
          34% { transform: translate(-10px,8px) rotate(-5deg); }
          46% { transform: translate(10px,-8px) rotate(5deg); }
          58% { transform: translate(-6px,4px) rotate(-3deg); }
          70% { transform: translate(5px,-4px) rotate(2deg); }
          82% { transform: translate(-2px,2px) rotate(-1deg); }
        }
        @keyframes eightball-answer-in {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default EightBallOverlay;
