import React, { useCallback, useRef } from "react";

const STAR_COUNT = 80;

const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 70}%`,
  size: Math.random() * 2 + 0.5,
  delay: `${Math.random() * 4}s`,
  duration: `${2 + Math.random() * 2}s`,
}));

const AuroraBackground: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.setProperty("--mx", `${x * 30}px`);
    el.style.setProperty("--my", `${y * 15}px`);
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className="fixed inset-0 overflow-hidden"
      style={
        {
          background: "linear-gradient(180deg, #050510 0%, #0a0a1a 40%, #0d1117 100%)",
          "--mx": "0px",
          "--my": "0px",
        } as React.CSSProperties
      }
    >
      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            backgroundColor: "white",
            animation: `star-twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}

      {/* Aurora bands */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          filter: `blur(60px) brightness(${0.8 + intensity * 0.4})`,
          transition: "filter 1.5s ease",
        }}
      >
        {/* Band 1 — green */}
        <div
          className="absolute aurora-band"
          style={{
            width: "120%",
            height: "35%",
            top: "5%",
            left: "-10%",
            background:
              "linear-gradient(180deg, transparent 0%, hsla(140,80%,45%,0.15) 30%, hsla(160,70%,40%,0.08) 70%, transparent 100%)",
            animation: "aurora-wave-1 10s ease-in-out infinite",
            transform: "translate(var(--mx), var(--my))",
          }}
        />
        {/* Band 2 — teal */}
        <div
          className="absolute aurora-band"
          style={{
            width: "100%",
            height: "40%",
            top: "10%",
            left: "0%",
            background:
              "linear-gradient(170deg, transparent 0%, hsla(170,60%,50%,0.12) 25%, hsla(180,50%,45%,0.06) 60%, transparent 100%)",
            animation: "aurora-wave-2 12s ease-in-out 1s infinite",
            transform:
              "translate(calc(var(--mx) * 0.6), calc(var(--my) * 0.8))",
          }}
        />
        {/* Band 3 — purple */}
        <div
          className="absolute aurora-band"
          style={{
            width: "110%",
            height: "30%",
            top: "15%",
            left: "-5%",
            background:
              "linear-gradient(190deg, transparent 0%, hsla(270,50%,55%,0.1) 30%, hsla(280,40%,50%,0.05) 65%, transparent 100%)",
            animation: "aurora-wave-3 14s ease-in-out 2s infinite",
            transform:
              "translate(calc(var(--mx) * 0.4), calc(var(--my) * 0.6))",
          }}
        />
        {/* Band 4 — bright green accent */}
        <div
          className="absolute aurora-band"
          style={{
            width: "80%",
            height: "25%",
            top: "8%",
            left: "10%",
            background:
              "radial-gradient(ellipse at 50% 50%, hsla(130,90%,50%,0.08) 0%, transparent 70%)",
            animation: "aurora-wave-1 8s ease-in-out 0.5s infinite alternate",
            transform:
              "translate(calc(var(--mx) * 0.8), calc(var(--my) * 1.2))",
          }}
        />
      </div>

      {/* Mountain silhouettes */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        style={{ height: "18vh" }}
      >
        <defs>
          <linearGradient id="mtn-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d1117" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#050510" />
          </linearGradient>
        </defs>
        <path
          d="M0,200 L0,120 Q100,60 200,100 Q300,40 400,90 Q500,20 600,80 Q700,30 800,70 Q900,10 1000,60 Q1100,25 1200,80 Q1300,50 1440,100 L1440,200 Z"
          fill="url(#mtn-grad)"
        />
        <path
          d="M0,200 L0,150 Q150,100 300,130 Q450,80 600,120 Q750,70 900,110 Q1050,60 1200,100 Q1350,80 1440,130 L1440,200 Z"
          fill="#050510"
        />
      </svg>

      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes aurora-wave-1 {
          0%, 100% { transform: translate(var(--mx), var(--my)) skewX(0deg) scaleY(1); }
          33% { transform: translate(var(--mx), calc(var(--my) - 20px)) skewX(3deg) scaleY(1.15); }
          66% { transform: translate(var(--mx), calc(var(--my) + 10px)) skewX(-2deg) scaleY(0.9); }
        }
        @keyframes aurora-wave-2 {
          0%, 100% { transform: translate(calc(var(--mx)*0.6), calc(var(--my)*0.8)) skewX(0deg); }
          50% { transform: translate(calc(var(--mx)*0.6 + 15px), calc(var(--my)*0.8 - 25px)) skewX(-4deg) scaleY(1.1); }
        }
        @keyframes aurora-wave-3 {
          0%, 100% { transform: translate(calc(var(--mx)*0.4), calc(var(--my)*0.6)) scaleX(1); }
          40% { transform: translate(calc(var(--mx)*0.4 - 10px), calc(var(--my)*0.6 - 15px)) scaleX(1.1) skewX(2deg); }
          70% { transform: translate(calc(var(--mx)*0.4 + 8px), calc(var(--my)*0.6 + 5px)) scaleX(0.95); }
        }
      `}</style>
    </div>
  );
};

export default AuroraBackground;
