import React, { useMemo } from "react";

interface ReactionPreviewProps {
  emoji: string;
  gradient: string;
  particles: string[];
  particleSize: number;
  label: string;
  verb: string;
  shake: boolean;
  flash: boolean;
}

const ReactionPreview: React.FC<ReactionPreviewProps> = ({
  emoji, gradient, particles, particleSize, label, verb, shake, flash,
}) => {
  const displayParticles = particles.length > 0 ? particles : ["✨"];

  const fgData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 30 + Math.random() * 50;
      return {
        burstX: Math.cos(angle) * radius,
        burstY: Math.sin(angle) * radius,
        swayX: (Math.random() - 0.5) * 40,
        delay: Math.random() * 1,
        duration: 2 + Math.random() * 1.5,
        char: displayParticles[i % displayParticles.length],
        size: particleSize * 0.5,
      };
    }),
    [displayParticles, particleSize]
  );

  const bgData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      left: 10 + (i * 16) % 80,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 1.5,
      char: displayParticles[i % displayParticles.length],
      size: particleSize * 0.3,
    })),
    [displayParticles, particleSize]
  );

  return (
    <div
      className={`relative w-full aspect-[9/16] max-h-[300px] rounded-2xl overflow-hidden flex flex-col items-center justify-center ${shake ? "animate-pulse" : ""}`}
      style={{
        background: gradient || "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)))",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Background particles */}
      {bgData.map((p, i) => {
        const isUrl = p.char.startsWith("http");
        return (
          <span
            key={`bg-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${p.left}%`,
              bottom: "5%",
              fontSize: isUrl ? undefined : `${p.size}px`,
              animationName: "particle-drift",
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              animationIterationCount: "infinite",
              opacity: 0.3,
              filter: "blur(1px)",
            }}
          >
            {isUrl ? (
              <img src={p.char} alt="" className="pointer-events-none" style={{ width: p.size, height: p.size }} />
            ) : p.char}
          </span>
        );
      })}

      {/* Foreground particles — burst */}
      {fgData.map((p, i) => {
        const isUrl = p.char.startsWith("http");
        return (
          <span
            key={`fg-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              fontSize: isUrl ? undefined : `${p.size}px`,
              ["--burst-x" as any]: `${p.burstX}px`,
              ["--burst-y" as any]: `${p.burstY}px`,
              ["--sway-x" as any]: `${p.swayX}px`,
              animationName: "particle-burst",
              animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
              animationFillMode: "forwards",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              animationIterationCount: "infinite",
              opacity: 0,
            }}
          >
            {isUrl ? (
              <img src={p.char} alt="" className="pointer-events-none" style={{ width: p.size, height: p.size }} />
            ) : p.char}
          </span>
        );
      })}

      {/* Glow ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 80,
          height: 80,
          background: `radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)`,
          animation: "glow-pulse 2s ease-in-out infinite",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Center */}
      <div className="z-10 text-center" style={{ animation: "emoji-spring-in 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
        {emoji.startsWith("http") ? (
          <img src={emoji} alt={label} className="mx-auto mb-2" style={{ width: 56, height: 56 }} />
        ) : (
          <div className="text-5xl mb-2 drop-shadow-lg">{emoji || "❤️"}</div>
        )}
        <p
          className="text-white text-xs font-bold drop-shadow-lg px-2"
          style={{ animation: "text-slide-up 0.4s ease-out 0.3s both" }}
        >
          You are {verb || "..."} them
        </p>
      </div>

      {flash && (
        <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};

export default ReactionPreview;
