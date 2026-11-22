import React from "react";
import type { WashiKey } from "@/lib/journal";

/* ───────────────────────── washi tape ───────────────────────── */

const washiBackground = (kind: WashiKey, c: string): React.CSSProperties => {
  switch (kind) {
    case "stripes":
      return { backgroundColor: c, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 5px, transparent 5px 11px)" };
    case "dots":
      return { backgroundColor: c, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.85) 2px, transparent 2.6px)", backgroundSize: "10px 10px" };
    case "checks":
      return {
        backgroundColor: c,
        backgroundImage:
          "conic-gradient(rgba(255,255,255,.55) 25%, transparent 0 50%, rgba(255,255,255,.55) 0 75%, transparent 0)",
        backgroundSize: "12px 12px",
      };
    case "stars":
      return {
        backgroundColor: c,
        backgroundImage:
          "radial-gradient(circle at 25% 30%, rgba(255,255,255,.9) 1.5px, transparent 2px), radial-gradient(circle at 70% 70%, rgba(255,255,255,.7) 2.5px, transparent 3px)",
        backgroundSize: "16px 16px",
      };
    case "zigzag":
      return {
        backgroundColor: c,
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,.5) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,.5) 25%, transparent 25%)",
        backgroundSize: "12px 12px",
      };
    default:
      return { backgroundColor: c };
  }
};

export const Washi: React.FC<{
  kind: WashiKey;
  color: string;
  width?: number;
  height?: number;
  rot?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ kind, color, width = 90, height = 22, rot = -4, className = "", style }) => (
  <div
    aria-hidden
    className={`pointer-events-none ${className}`}
    style={{
      width,
      height,
      transform: `rotate(${rot}deg)`,
      opacity: 0.88,
      boxShadow: "0 1px 2px rgba(0,0,0,.12)",
      clipPath:
        "polygon(0 0,3% 12%,0 25%,3% 38%,0 50%,3% 62%,0 75%,3% 88%,0 100%,100% 100%,97% 88%,100% 75%,97% 62%,100% 50%,97% 38%,100% 25%,97% 12%,100% 0)",
      ...washiBackground(kind, color),
      ...style,
    }}
  />
);

/* ───────────────────────── doodle stickers ───────────────────────── */

interface DoodleProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const svgBase = (size: number, vb: string, className?: string, style?: React.CSSProperties) => ({
  width: size,
  height: size,
  viewBox: vb,
  className,
  style,
  "aria-hidden": true as const,
  fill: "none" as const,
});

export const Star: React.FC<DoodleProps> = ({ size = 24, color = "#e8b31f", className, style }) => (
  <svg {...svgBase(size, "0 0 24 24", className, style)}>
    <path d="M12 2.5l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.4l-5.8 3.4 1.5-6.4L2.8 9.1l6.5-.6z" fill={color} stroke="#5b4a2a" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export const Sparkle: React.FC<DoodleProps> = ({ size = 24, color = "#34384a", className, style }) => (
  <svg {...svgBase(size, "0 0 24 24", className, style)}>
    <path d="M12 2c.6 5.2 2.8 8 8 10-5.2 2-7.4 4.800-8 10-.6-5.200-2.800-8-8-10 5.200-2 7.400-4.800 8-10z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const Heart: React.FC<DoodleProps> = ({ size = 24, color = "#e4577a", className, style }) => (
  <svg {...svgBase(size, "0 0 24 24", className, style)}>
    <path d="M12 20.500C5 15.500 3 12 3 8.800 3 6.200 5 4.500 7.300 4.500c1.900 0 3.700 1.100 4.700 2.900 1-1.800 2.800-2.900 4.700-2.900C19 4.500 21 6.200 21 8.800c0 3.200-2 6.700-9 11.700z" fill={color} stroke="#7a2438" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export const Sprig: React.FC<DoodleProps> = ({ size = 60, color = "#5f9a63", className, style }) => (
  <svg {...svgBase(size, "0 0 40 80", className, style)}>
    <path d="M20 78C20 55 21 30 19 4" stroke="#3d6b42" strokeWidth="1.6" strokeLinecap="round" />
    {[12, 26, 40, 54].map((y, i) => (
      <g key={y}>
        <path d={`M20 ${y + 8}C${8 - i} ${y + 4} ${6} ${y - 4} 10 ${y - 8}C${18} ${y - 4} 20 ${y + 2} 20 ${y + 8}z`} fill={color} stroke="#3d6b42" strokeWidth="1" />
        <path d={`M20 ${y + 2}C${32 + i} ${y - 2} 34 ${y - 10} 30 ${y - 14}C22 ${y - 10} 20 ${y - 4} 20 ${y + 2}z`} fill={color} stroke="#3d6b42" strokeWidth="1" />
      </g>
    ))}
  </svg>
);

export const Flower: React.FC<DoodleProps> = ({ size = 40, color = "#f48fb1", className, style }) => (
  <svg {...svgBase(size, "0 0 40 40", className, style)}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="20" cy="10" rx="6" ry="9" fill={color} stroke="#8a3a58" strokeWidth="1" transform={`rotate(${a} 20 20)`} />
    ))}
    <circle cx="20" cy="20" r="5" fill="#ffd54f" stroke="#8a6d00" strokeWidth="1" />
  </svg>
);

export const Mushroom: React.FC<DoodleProps> = ({ size = 40, color = "#e2483d", className, style }) => (
  <svg {...svgBase(size, "0 0 40 44", className, style)}>
    <path d="M16 24h8l1.500 14c0 2-2 4-5.500 4s-5.500-2-5.500-4z" fill="#f6ead2" stroke="#5b4a2a" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M3 24C3 11 11 3 20 3s17 8 17 21z" fill={color} stroke="#5b2320" strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="13" cy="14" r="2.400" fill="#fff" /><circle cx="25" cy="10" r="2" fill="#fff" /><circle cx="29" cy="18" r="2.600" fill="#fff" /><circle cx="19" cy="19" r="1.800" fill="#fff" />
  </svg>
);

export const Cloud: React.FC<DoodleProps> = ({ size = 50, color = "#cfe6f7", className, style }) => (
  <svg {...svgBase(size, "0 0 60 36", className, style)}>
    <path d="M14 32a10 10 0 010-20 14 14 0 0126-4 12 12 0 0114 12 12 12 0 01-4 12z" fill={color} stroke="#4f7a9e" strokeWidth="1.300" strokeLinejoin="round" />
  </svg>
);

export const Bow: React.FC<DoodleProps> = ({ size = 50, color = "#f4a3b5", className, style }) => (
  <svg {...svgBase(size, "0 0 60 44", className, style)}>
    <path d="M30 20C20 6 6 4 4 12s8 18 26 8z" fill={color} stroke="#8a3a58" strokeWidth="1.200" strokeLinejoin="round" />
    <path d="M30 20C40 6 54 4 56 12s-8 18-26 8z" fill={color} stroke="#8a3a58" strokeWidth="1.200" strokeLinejoin="round" />
    <path d="M30 22l-9 18M30 22l9 18" stroke="#8a3a58" strokeWidth="1.600" strokeLinecap="round" />
    <circle cx="30" cy="20" r="4.500" fill={color} stroke="#8a3a58" strokeWidth="1.200" />
  </svg>
);

export const Squiggle: React.FC<DoodleProps> = ({ size = 60, color = "#34384a", className, style }) => (
  <svg width={size} height={size / 4} viewBox="0 0 60 15" className={className} style={style} aria-hidden fill="none">
    <path d="M2 8c4-8 8-8 12 0s8 8 12 0 8-8 12 0 8 8 12 0 4-4 6-3" stroke={color} strokeWidth="1.800" strokeLinecap="round" />
  </svg>
);

export const Clock: React.FC<DoodleProps> = ({ size = 40, color = "#34384a", className, style }) => (
  <svg {...svgBase(size, "0 0 40 40", className, style)}>
    <circle cx="20" cy="20" r="16" fill="#fffdf8" stroke={color} strokeWidth="1.600" />
    <path d="M20 9v11l7 4" stroke={color} strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
    {[0, 90, 180, 270].map((a) => (<path key={a} d="M20 5.500v2" stroke={color} strokeWidth="1.200" transform={`rotate(${a} 20 20)`} />))}
  </svg>
);

export const DOODLES = [Star, Sparkle, Heart, Sprig, Flower, Mushroom, Cloud, Bow, Squiggle, Clock] as const;
