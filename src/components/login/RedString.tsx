import React, { useEffect, useRef, useState, useCallback } from "react";

interface RedStringProps {
  phase: "ambient" | "reveal" | "pull";
  mousePos: { x: number; y: number };
  intensity?: number; // 0-1, partner awareness glow
}

const RedString: React.FC<RedStringProps> = ({ phase, mousePos, intensity = 0.5 }) => {
  const [time, setTime] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const animate = () => {
      setTime((t) => t + 0.015);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const glowOpacity = 0.4 + intensity * 0.6;
  const glowRadius = 8 + intensity * 16;
  const strokeColor = intensity > 0.7 ? "#ff1a1a" : intensity > 0.3 ? "#cc1133" : "#881122";

  // Normalize mouse position (0-1)
  const mx = mousePos.x;
  const my = mousePos.y;

  const generateAmbientPath = useCallback(() => {
    const w = 100;
    const h = 100;
    const offsetX = (mx - 0.5) * 12;
    const offsetY = (my - 0.5) * 8;

    const points = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
      const t2 = i / segments;
      const x = t2 * w;
      const baseY = h * 0.5;
      const wave1 = Math.sin(time * 1.2 + t2 * Math.PI * 2) * 12;
      const wave2 = Math.sin(time * 0.7 + t2 * Math.PI * 3 + 1) * 6;
      const mouseInfluence = Math.sin(t2 * Math.PI) * offsetY;
      const y = baseY + wave1 + wave2 + mouseInfluence + offsetX * Math.sin(t2 * Math.PI);
      points.push({ x, y });
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const cp1x = points[i].x;
      const cp1y = points[i].y;
      const cp2x = (points[i].x + points[i + 1].x) / 2;
      const cp2y = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${cp1x} ${cp1y} ${cp2x} ${cp2y}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }, [time, mx, my]);

  const generateRevealPath = () => {
    // String coils toward bottom center into a spiral
    const cx = 50;
    const cy = 75;
    const coilProgress = Math.min(1, time * 0.5);
    let d = `M 5 ${30 + Math.sin(time) * 3}`;

    // Curve toward center bottom
    d += ` Q 25 ${40 + Math.sin(time * 0.8) * 2} ${cx - 15 * (1 - coilProgress)} ${cy - 20 * (1 - coilProgress)}`;

    // Spiral coil
    const turns = 2.5 * coilProgress;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * turns * Math.PI * 2;
      const radius = (3 + i * 0.6) * coilProgress;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius * 0.7;
      d += ` L ${px} ${py}`;
    }
    return d;
  };

  const generatePullPath = () => {
    // Taut string going straight with slight vibration
    const vibration = Math.sin(time * 30) * (1 - Math.min(1, time * 0.3)) * 2;
    return `M 10 50 Q 50 ${50 + vibration} 90 50`;
  };

  const path =
    phase === "pull" ? generatePullPath() :
    phase === "reveal" ? generateRevealPath() :
    generateAmbientPath();

  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      style={{ filter: `drop-shadow(0 0 ${glowRadius}px ${strokeColor})` }}
    >
      <defs>
        <filter id="string-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer glow layer */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity={glowOpacity * 0.4}
        style={{ transition: "opacity 1s ease" }}
      />
      {/* Core string */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.35"
        strokeLinecap="round"
        opacity={glowOpacity}
        filter="url(#string-glow)"
        style={{ transition: "opacity 1s ease" }}
      />
      {/* Bright center highlight */}
      <path
        d={path}
        fill="none"
        stroke="#ff4444"
        strokeWidth="0.12"
        strokeLinecap="round"
        opacity={glowOpacity * 0.8}
      />
    </svg>
  );
};

export default RedString;
