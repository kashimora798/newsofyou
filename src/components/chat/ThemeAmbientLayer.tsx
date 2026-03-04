import React, { useEffect, useState } from "react";

interface ThemeAmbientLayerProps {
  ambient: "none" | "petals" | "static" | "scanlines" | "sparkles" | "redlines";
}

const ThemeAmbientLayer: React.FC<ThemeAmbientLayerProps> = ({ ambient }) => {
  if (ambient === "none") return null;

  if (ambient === "scanlines") {
    return <div className="theme-scanlines pointer-events-none fixed inset-0 z-[9998]" />;
  }

  if (ambient === "static") {
    return <div className="theme-static pointer-events-none fixed inset-0 z-[9998]" />;
  }

  if (ambient === "redlines") {
    return <div className="theme-redlines pointer-events-none fixed inset-0 z-[9998]" />;
  }

  if (ambient === "sparkles") {
    return <SparkleParticles />;
  }

  if (ambient === "petals") {
    return <FallingPetals />;
  }

  return null;
};

const FallingPetals: React.FC = () => {
  const [petals] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 6,
      size: 14 + Math.random() * 10,
      rotation: Math.random() * 360,
    }))
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      {petals.map((p) => (
        <div
          key={p.id}
          className="absolute theme-petal"
          style={{
            left: `${p.left}%`,
            top: "-30px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}px`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        >
          🌹
        </div>
      ))}
    </div>
  );
};

const SparkleParticles: React.FC = () => {
  const [sparkles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3,
      top: Math.random() * 100,
    }))
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute theme-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          ✦
        </div>
      ))}
    </div>
  );
};

export default ThemeAmbientLayer;
