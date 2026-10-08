import { useMemo } from "react";
import { getGrowthStage } from "@/lib/treeGrowth";

/**
 * OurTree — the tree on /forest, drawn as SVG.
 *
 * This replaces the WebGL scene. Same idea (it grows as you talk), none of the
 * weight: no engine, no textures, no models, and it draws the same on every
 * phone. The shape is generated from a fixed seed, so it never jitters between
 * renders, and it is a single <svg> the browser can cache and scale for free.
 */

interface OurTreeProps {
  totalMessages: number;
  /** Skip the falling petals (settings, reduced motion, or a slow phone). */
  still?: boolean;
}

/** Small deterministic PRNG — same tree every time, no randomness on re-render. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Branch {
  d: string;
  width: number;
  depth: number;
  tipX: number;
  tipY: number;
}

/** Grow the skeleton: a trunk that forks `levels` times. */
function buildBranches(levels: number, scale: number): Branch[] {
  const rnd = seeded(20261007);
  const branches: Branch[] = [];
  const baseY = 330;
  const baseX = 200;
  const trunkHeight = 60 + scale * 90;

  const grow = (x: number, y: number, angle: number, length: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.6) return;
    const rad = (angle * Math.PI) / 180;
    const endX = x + Math.sin(rad) * length;
    const endY = y - Math.cos(rad) * length;
    const bend = (rnd() - 0.5) * length * 0.35;
    const midX = x + Math.sin(rad) * length * 0.5 + bend;
    const midY = y - Math.cos(rad) * length * 0.5;

    branches.push({
      d: `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`,
      width,
      depth,
      tipX: endX,
      tipY: endY,
    });

    const spread = 22 + rnd() * 14;
    const shrunk = 0.62 + rnd() * 0.1;
    grow(endX, endY, angle - spread, length * shrunk, width * 0.68, depth - 1);
    grow(endX, endY, angle + spread, length * shrunk, width * 0.68, depth - 1);
  };

  grow(baseX, baseY, 0, trunkHeight, 9 + scale * 6, levels);
  return branches;
}

/** Blossoms sit near the thin branch tips, so the canopy fills out from the middle. */
function buildBlossoms(branches: Branch[], count: number): { x: number; y: number; r: number }[] {
  const rnd = seeded(777);
  const tips = branches.filter((b) => b.depth <= 1);
  if (tips.length === 0) return [];
  const blossoms: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const tip = tips[Math.floor(rnd() * tips.length)];
    blossoms.push({
      x: tip.tipX + (rnd() - 0.5) * 34,
      y: tip.tipY + (rnd() - 0.5) * 30,
      r: 3.2 + rnd() * 3.8,
    });
  }
  return blossoms;
}

const OurTree: React.FC<OurTreeProps> = ({ totalMessages, still = false }) => {
  const stage = useMemo(() => getGrowthStage(totalMessages), [totalMessages]);
  const branches = useMemo(() => buildBranches(stage.branchLevels, stage.scale), [stage.branchLevels, stage.scale]);
  const blossoms = useMemo(() => buildBlossoms(branches, stage.blossomCount), [branches, stage.blossomCount]);

  // A handful of petals drifting down — capped, because more is not prettier.
  const petals = useMemo(() => {
    if (still) return [];
    const rnd = seeded(31337);
    const n = Math.min(18, Math.max(6, Math.round(stage.blossomCount / 5)));
    return Array.from({ length: n }, () => ({
      left: 12 + rnd() * 76,
      delay: rnd() * 9,
      duration: 7 + rnd() * 7,
      size: 5 + rnd() * 5,
      sway: 12 + rnd() * 26,
    }));
  }, [still, stage.blossomCount]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" aria-label={`Our tree: ${stage.label}`}>
      {/* the warm glow behind the canopy */}
      <div
        className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          width: `${180 + stage.scale * 220}px`,
          height: `${160 + stage.scale * 200}px`,
          background: `radial-gradient(circle, ${stage.tint}33 0%, transparent 70%)`,
        }}
      />

      {petals.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-[50%_0_50%_50%]"
          style={{
            left: `${p.left}%`,
            top: "18%",
            width: p.size,
            height: p.size,
            background: stage.tint,
            opacity: 0.75,
            animation: `our-tree-fall ${p.duration}s linear ${p.delay}s infinite`,
            ["--sway" as string]: `${p.sway}px`,
          }}
        />
      ))}

      <svg viewBox="0 0 400 400" className="relative h-full w-full" role="img">
        <defs>
          <linearGradient id="our-tree-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b1430" />
            <stop offset="100%" stopColor="#0d0a1c" />
          </linearGradient>
        </defs>

        {/* ground */}
        <ellipse cx="200" cy="342" rx="150" ry="16" fill="url(#our-tree-ground)" opacity="0.85" />

        {/* branches, thick to thin */}
        {branches.map((b, i) => (
          <path
            key={i}
            d={b.d}
            fill="none"
            stroke={stage.branchTint}
            strokeWidth={b.width}
            strokeLinecap="round"
            opacity={0.55 + Math.min(0.45, b.depth * 0.12)}
          />
        ))}

        {/* blossoms */}
        {blossoms.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={stage.tint} opacity={0.9} />
        ))}

        {/* the two of you, at the roots */}
        <circle cx="188" cy="344" r="4" fill="#f5d0dc" />
        <circle cx="200" cy="344" r="4" fill="#c9b6ff" />
      </svg>
    </div>
  );
};

export default OurTree;
