import React, { useEffect, useState } from "react";

interface LoginTransitionProps {
  active: boolean;
  partnerOnline?: boolean;
  onComplete: () => void;
}

const LoginTransition: React.FC<LoginTransitionProps> = ({ active, partnerOnline, onComplete }) => {
  const [stage, setStage] = useState<"idle" | "taut" | "snap" | "tunnel">("idle");

  useEffect(() => {
    if (!active) return;

    setStage("taut");
    const t1 = setTimeout(() => setStage("snap"), 600);
    const t2 = setTimeout(() => setStage("tunnel"), 900);
    const t3 = setTimeout(onComplete, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, onComplete]);

  if (!active && stage === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" style={{ background: "#000" }}>
      {/* Partner status flash */}
      {partnerOnline && stage === "taut" && (
        <div className="absolute inset-0 flex items-center justify-center animate-[login-text-fade_0.8s_ease-out]">
          <p className="text-sm tracking-[0.25em] uppercase" style={{ color: "#cc3344", fontFamily: "'Quicksand', sans-serif" }}>
            They're waiting...
          </p>
        </div>
      )}

      {/* String going taut */}
      {(stage === "taut" || stage === "snap") && (
        <svg viewBox="0 0 100 10" className="absolute top-1/2 left-0 w-full h-4 -translate-y-1/2" preserveAspectRatio="none">
          <path
            d="M 0 5 L 100 5"
            fill="none"
            stroke={stage === "snap" ? "#ff2222" : "#cc1133"}
            strokeWidth={stage === "snap" ? "0.8" : "0.4"}
            style={{
              filter: `drop-shadow(0 0 ${stage === "snap" ? 30 : 12}px #ff2222)`,
              transition: "all 0.3s ease",
            }}
          />
        </svg>
      )}

      {/* Tunnel zoom effect */}
      {stage === "tunnel" && (
        <div className="absolute inset-0 animate-[tunnel-zoom_0.5s_ease-in_forwards]"
          style={{
            background: "radial-gradient(ellipse at center, #1a0005 0%, #000 50%, #000 100%)",
          }}
        />
      )}
    </div>
  );
};

export default LoginTransition;
