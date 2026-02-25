import React from "react";

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

  return (
    <div
      className={`relative w-full aspect-[9/16] max-h-[300px] rounded-2xl overflow-hidden flex flex-col items-center justify-center ${shake ? "animate-pulse" : ""}`}
      style={{ background: gradient || "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)))" }}
    >
      {/* Particles */}
      {Array.from({ length: 10 }).map((_, i) => {
        const p = displayParticles[i % displayParticles.length];
        const isUrl = p.startsWith("http");
        return (
          <span
            key={i}
            className="absolute animate-bounce pointer-events-none opacity-60"
            style={{
              left: `${10 + (i * 8) % 80}%`,
              top: `${5 + (i * 13) % 70}%`,
              fontSize: isUrl ? undefined : `${particleSize * 0.6}px`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + (i % 3) * 0.5}s`,
            }}
          >
            {isUrl ? (
              <img src={p} alt="" className="pointer-events-none" style={{ width: particleSize * 0.6, height: particleSize * 0.6 }} />
            ) : p}
          </span>
        );
      })}

      {/* Center */}
      <div className="z-10 text-center">
        {emoji.startsWith("http") ? (
          <img src={emoji} alt={label} className="mx-auto mb-2" style={{ width: 56, height: 56 }} />
        ) : (
          <div className="text-5xl mb-2">{emoji || "❤️"}</div>
        )}
        <p className="text-white text-xs font-bold drop-shadow-lg px-2">
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
