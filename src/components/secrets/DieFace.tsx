import React from "react";

// 3x3 pip layout per face value (cell indices 0..8).
const PIP_PATTERNS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface DieFaceProps {
  n: number;
  size?: number;
  rounded?: number;
  /** Extra style merged onto the face — used to position cube faces in 3D. */
  faceStyle?: React.CSSProperties;
  className?: string;
}

/** Self-contained dice face (no external CSS) so it works in the 3D cube and
 *  inline in chat bubbles. */
export const DieFace: React.FC<DieFaceProps> = ({ n, size = 110, rounded = 18, faceStyle, className }) => {
  const pips = PIP_PATTERNS[n] ?? [4];
  const pipSize = Math.max(4, Math.round(size * 0.16));
  const pad = Math.round(size * 0.13);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        padding: pad,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        borderRadius: rounded,
        background: "linear-gradient(145deg, #ffffff, #ece7f7)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05), inset 0 -6px 12px rgba(91,59,214,0.06)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        ...faceStyle,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {pips.includes(i) && (
            <span
              style={{
                width: pipSize,
                height: pipSize,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #8b6cff, #5b3bd6)",
                boxShadow: "0 1px 2px rgba(91,59,214,0.4)",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
};

export default DieFace;
