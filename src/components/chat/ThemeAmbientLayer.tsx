import React, { useState } from "react";
import rosePetal1 from "@/assets/themes/rose_petal1.png";
import rosePetal2 from "@/assets/themes/rose_petal2.png";

interface ThemeAmbientLayerProps {
  ambient: "none" | "petals" | "static" | "scanlines" | "sparkles" | "redlines";
}

const ThemeAmbientLayer: React.FC<ThemeAmbientLayerProps> = ({ ambient }) => {
  if (ambient === "none") return null;
  if (ambient === "scanlines") return <div className="theme-scanlines pointer-events-none fixed inset-0 z-[9998]" />;
  if (ambient === "static") return <div className="theme-static pointer-events-none fixed inset-0 z-[9998]" />;
  if (ambient === "redlines") return <div className="theme-redlines pointer-events-none fixed inset-0 z-[9998]" />;
  if (ambient === "sparkles") return <SparkleParticles />;
  if (ambient === "petals") return <FallingPetals />;
  return null;
};

const PETAL_IMAGES = [rosePetal1, rosePetal2];

const FallingPetals: React.FC = () => {
  const [petals] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 6,
      size: 20 + Math.random() * 18,
      rotation: Math.random() * 360,
      img: PETAL_IMAGES[i % 2],
    }))
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      {petals.map((p) => (
        <img
          key={p.id}
          src={p.img}
          alt=""
          className="absolute theme-petal"
          style={{
            left: `${p.left}%`,
            top: "-40px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            transform: `rotate(${p.rotation}deg)`,
            objectFit: "contain",
          }}
        />
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
