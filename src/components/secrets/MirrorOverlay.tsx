import React, { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface MirrorOverlayProps {
  senderName: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const MirrorOverlay: React.FC<MirrorOverlayProps> = ({ senderName, onDismiss }) => {
  const reduced = prefersReduced();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.tap();
  }, []);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2400 : 3400);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 45%, hsl(200 60% 60% / 0.16), hsl(220 30% 8% / 0.55) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      {/* glass shine sweep */}
      {!reduced && <div className="mirror-shine" />}

      <div className="flex flex-col items-center" style={{ animation: reduced ? "none" : "mirror-in 0.5s ease-out both" }}>
        <p className="text-[44px] font-bold tracking-tight text-white drop-shadow-lg leading-none">
          Same 🪞
        </p>
        {/* reflection */}
        <p
          className="text-[44px] font-bold tracking-tight leading-none mt-1 select-none"
          style={{
            transform: "scaleY(-1)",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.28), transparent 80%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
          aria-hidden
        >
          Same 🪞
        </p>
        <p className="mt-4 text-[15px] text-white/75">{senderName} feels the exact same</p>
      </div>

      <style>{`
        .mirror-shine {
          position: absolute; top: 0; bottom: 0; width: 45%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: skewX(-18deg);
          animation: mirror-sweep 1.4s cubic-bezier(0.4,0,0.2,1) both;
        }
        @keyframes mirror-sweep {
          0% { left: -55%; }
          100% { left: 110%; }
        }
        @keyframes mirror-in {
          from { opacity: 0; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default MirrorOverlay;
