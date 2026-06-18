import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";
import { DieFace } from "./DieFace";

interface DiceRollOverlayProps {
  result: number; // 1..6
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const CUBE = 110;
const HALF = CUBE / 2;

// Base rotation that brings each face to the front, + extra full tumbles.
const BASE_ROT: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

const FACE_TRANSFORMS: Record<number, string> = {
  1: `rotateY(0deg) translateZ(${HALF}px)`,
  6: `rotateY(180deg) translateZ(${HALF}px)`,
  3: `rotateY(90deg) translateZ(${HALF}px)`,
  4: `rotateY(-90deg) translateZ(${HALF}px)`,
  2: `rotateX(90deg) translateZ(${HALF}px)`,
  5: `rotateX(-90deg) translateZ(${HALF}px)`,
};

const DiceRollOverlay: React.FC<DiceRollOverlayProps> = ({ result, senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const n = Math.min(6, Math.max(1, Math.round(result) || 1));
  const base = BASE_ROT[n];
  const rx = base.rx + 720;
  const ry = base.ry + 720;
  const haptered = useRef(false);

  useEffect(() => {
    if (!haptered.current) {
      haptered.current = true;
      haptic.impact();
      const land = setTimeout(() => haptic.success(), reduced ? 100 : 1900);
      return () => clearTimeout(land);
    }
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2600 : 4000);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 42%, hsl(262 60% 60% / 0.2), hsl(0 0% 0% / 0.55) 70%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div style={{ perspective: 900 }}>
        <div
          className="dice"
          style={
            {
              "--rx": `${rx}deg`,
              "--ry": `${ry}deg`,
              width: CUBE,
              height: CUBE,
              position: "relative",
              transformStyle: "preserve-3d",
              willChange: "transform",
              animation: reduced ? "none" : "dice-roll 2s cubic-bezier(0.2,0.7,0.25,1) forwards",
              transform: reduced ? `rotateX(${rx}deg) rotateY(${ry}deg)` : undefined,
            } as React.CSSProperties
          }
        >
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <DieFace
              key={f}
              n={f}
              size={CUBE}
              faceStyle={{ position: "absolute", inset: 0, transform: FACE_TRANSFORMS[f] }}
            />
          ))}
        </div>
      </div>

      <div
        className="mt-12 text-center"
        style={{ animation: reduced ? "none" : "dice-label-in 0.5s ease-out 1.85s both" }}
      >
        <p className="text-[40px] font-bold tracking-tight text-white drop-shadow-lg leading-none">
          Rolled a {n}
        </p>
        <p className="mt-2 text-[15px] text-white/75">{senderName} rolled the dice</p>
      </div>

      <style>{`
        @keyframes dice-roll {
          0%   { transform: rotateX(0deg) rotateY(0deg) scale(0.6); opacity: 0.5; }
          18%  { opacity: 1; }
          100% { transform: rotateX(var(--rx)) rotateY(var(--ry)) scale(1); opacity: 1; }
        }
        @keyframes dice-label-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DiceRollOverlay;
