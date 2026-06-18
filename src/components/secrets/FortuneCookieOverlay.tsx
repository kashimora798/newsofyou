import React, { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

interface FortuneCookieOverlayProps {
  fortune: string;
  onDismiss: () => void;
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const FortuneCookieOverlay: React.FC<FortuneCookieOverlayProps> = ({ fortune, onDismiss }) => {
  const reduced = prefersReduced();
  const [cracked, setCracked] = useState(reduced);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.impact();
    if (reduced) return;
    const t = setTimeout(() => { setCracked(true); haptic.success(); }, 900);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 3200 : 5200);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 42%, hsl(35 70% 45% / 0.2), hsl(0 0% 0% / 0.6) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 160 }}>
        {!cracked ? (
          <div
            className="text-[110px] leading-none"
            style={{ animation: reduced ? "none" : "fc-shake 0.5s ease-in-out infinite" }}
          >
            🥠
          </div>
        ) : (
          <>
            <div className="fc-half fc-left" style={{ animation: reduced ? "none" : "fc-left 0.6s cubic-bezier(0.3,1.2,0.5,1) both" }}>🥠</div>
            <div className="fc-half fc-right" style={{ animation: reduced ? "none" : "fc-right 0.6s cubic-bezier(0.3,1.2,0.5,1) both" }}>🥠</div>
          </>
        )}
      </div>

      {cracked && (
        <div
          className="mt-4 mx-8 max-w-sm rounded-[16px] bg-[#fffdf5] px-5 py-4 shadow-xl"
          style={{ animation: reduced ? "none" : "fc-slip-in 0.6s cubic-bezier(0.32,0.72,0,1) 0.2s both" }}
        >
          <p className="text-center text-[15px] font-medium text-[#3a2e16] leading-relaxed" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {fortune}
          </p>
          <p className="mt-2 text-center text-[11px] text-[#a8915a] tracking-widest uppercase">Your couple fortune</p>
        </div>
      )}

      <style>{`
        .fc-half {
          position: absolute; font-size: 110px; line-height: 1;
          width: 100px; overflow: hidden; white-space: nowrap;
        }
        .fc-left  { left: 0;  text-align: left;  clip-path: inset(0 50% 0 0); }
        .fc-right { right: 0; text-align: right; clip-path: inset(0 0 0 50%); }
        @keyframes fc-shake {
          0%,100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(6deg) scale(1.05); }
        }
        @keyframes fc-left {
          from { transform: translateX(0) rotate(0); }
          to   { transform: translateX(-46px) rotate(-22deg); }
        }
        @keyframes fc-right {
          from { transform: translateX(0) rotate(0); }
          to   { transform: translateX(46px) rotate(22deg); }
        }
        @keyframes fc-slip-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default FortuneCookieOverlay;
