import React, { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { playSparkle } from "@/lib/secretSounds";

interface MysteryPrizeOverlayProps {
  emoji: string;
  title: string;
  note: string;
  milestone: number;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const MysteryPrizeOverlay: React.FC<MysteryPrizeOverlayProps> = ({ emoji, title, note, milestone, onDismiss }) => {
  const reduced = prefersReduced();
  const [opened, setOpened] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.impact();
  }, []);

  const open = () => {
    if (opened) return;
    setOpened(true);
    haptic.success();
    playSparkle();
    setTimeout(onDismiss, reduced ? 2600 : 4200);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: opened
          ? "radial-gradient(circle at 50% 42%, hsl(45 90% 55% / 0.28), hsl(262 50% 12% / 0.62) 72%)"
          : "radial-gradient(circle at 50% 45%, hsl(262 60% 50% / 0.2), hsl(0 0% 0% / 0.6) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={opened ? onDismiss : undefined}
    >
      <p className="mb-6 text-[13px] font-semibold tracking-widest text-white/70 uppercase">
        Message #{milestone} 🎉
      </p>

      {!opened ? (
        <button
          onClick={open}
          className="flex flex-col items-center"
          style={{ animation: reduced ? "none" : "mp-bob 1.4s ease-in-out infinite" }}
        >
          <span className="text-[120px] leading-none drop-shadow-lg">🎁</span>
          <span className="mt-4 text-[16px] font-semibold text-white/90">Tap to open!</span>
        </button>
      ) : (
        <div className="flex flex-col items-center px-8 text-center">
          <span className="text-[110px] leading-none" style={{ animation: reduced ? "none" : "mp-pop 0.6s cubic-bezier(0.34,1.5,0.5,1) both" }}>
            {emoji}
          </span>
          <p className="mt-4 text-[26px] font-bold tracking-tight text-white drop-shadow leading-tight"
            style={{ animation: reduced ? "none" : "mp-text-in 0.5s ease-out 0.25s both" }}>
            {title}
          </p>
          <p className="mt-2 text-[15px] text-white/80" style={{ animation: reduced ? "none" : "mp-text-in 0.5s ease-out 0.4s both" }}>
            {note}
          </p>
        </div>
      )}

      <style>{`
        @keyframes mp-bob {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
        @keyframes mp-pop {
          from { transform: scale(0.3); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes mp-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MysteryPrizeOverlay;
