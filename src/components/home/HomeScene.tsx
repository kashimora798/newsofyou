import React, { useEffect, useMemo, useState } from "react";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import { moonPosition, scenePhase, starDensity, type ScenePhase } from "@/lib/sceneTime";

/**
 * HomeScene — the ambient world behind the Home screen (build-plan Phase 3).
 *
 * Pure CSS layers, no three.js: a midnight gradient, drifting mist, a moon that
 * follows the real clock, and a seeded star field. It sits absolutely behind the
 * content and is `pointer-events-none` + `aria-hidden`, so it can never
 * interfere with taps or screen readers.
 *
 * Everything animated stops when `useAnimationsEnabled()` is false (Calm Mode or
 * `prefers-reduced-motion`), in which case the scene renders its still frame.
 */

interface SkyPalette {
  top: string;
  mid: string;
  bottom: string;
  glow: string; // the warm light near the horizon
}

/** The sky shifts with the hour, but stays a night world. */
function paletteFor(phase: ScenePhase): SkyPalette {
  switch (phase) {
    case "dawn":
      return {
        top: "hsl(232 45% 6%)",
        mid: "hsl(240 38% 12%)",
        bottom: "hsl(342 38% 16%)",
        glow: "hsl(28 80% 66%)",
      };
    case "day":
      return {
        top: "hsl(230 42% 8%)",
        mid: "hsl(236 34% 13%)",
        bottom: "hsl(224 30% 18%)",
        glow: "hsl(206 70% 66%)",
      };
    case "dusk":
      return {
        top: "hsl(234 44% 6%)",
        mid: "hsl(248 36% 12%)",
        bottom: "hsl(338 44% 20%)",
        glow: "hsl(340 78% 68%)",
      };
    default:
      return {
        top: "hsl(234 48% 5%)",
        mid: "hsl(238 40% 10%)",
        bottom: "hsl(248 32% 15%)",
        glow: "hsl(342 62% 58%)",
      };
  }
}

/** Deterministic star field — same sky on every render, no layout thrash. */
function useStars(count: number, seed = 20261003) {
  return useMemo(() => {
    let s = seed;
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 78, // keep the lower third clear for the horizon glow
      size: rand() > 0.88 ? 2.2 : rand() > 0.6 ? 1.6 : 1.2,
      opacity: 0.18 + rand() * 0.55,
      delay: rand() * 9,
      drift: 6 + rand() * 12,
    }));
  }, [count, seed]);
}

const HomeScene: React.FC = () => {
  const animationsEnabled = useAnimationsEnabled();
  const [now, setNow] = useState(() => new Date());

  // Re-read the clock every 10 minutes: a long-open tab keeps an honest sky.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);

  const phase = scenePhase(now);
  const palette = paletteFor(phase);
  const stars = useStars(animationsEnabled ? 54 : 26);
  const density = starDensity(phase);
  const moon = moonPosition(phase, now.getHours());
  const moonVisible = phase === "night" || phase === "dusk" || phase === "dawn";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* base sky */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 45%, ${palette.bottom} 100%)` }}
      />

      {/* stars */}
      <div className="absolute inset-0" style={{ opacity: density }}>
        {stars.map((star, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[hsl(var(--moon-white))]"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animation: animationsEnabled ? `scene-twinkle ${star.drift}s ease-in-out ${star.delay}s infinite` : undefined,
            }}
          />
        ))}
      </div>

      {/* the moon — a soft disc with a thin halo */}
      {moonVisible && (
        <div
          className="absolute"
          style={{
            left: `${moon.x * 100}%`,
            top: `${moon.y * 100}%`,
            transform: "translate(-50%, -50%)",
            // The moon slides between renders instead of jumping.
            transition: "left 60s linear, top 60s linear",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, hsl(var(--moon-white) / 0.16), transparent 68%)`,
              opacity: phase === "night" ? 1 : 0.6,
            }}
          />
          <div
            className="relative h-[52px] w-[52px] rounded-full"
            style={{
              background: "radial-gradient(circle at 34% 30%, hsl(var(--moon-white)) 0%, hsl(45 28% 84%) 62%, hsl(232 20% 62%) 100%)",
              boxShadow: "0 0 34px -6px hsl(var(--moon-white) / 0.5), inset -6px -4px 14px hsl(232 40% 30% / 0.45)",
              opacity: 0.92,
            }}
          />
        </div>
      )}

      {/* horizon glow — rose at night, warm at dawn, blue by day */}
      <div
        className="absolute inset-x-0 bottom-0 h-[46%]"
        style={{ background: `radial-gradient(120% 100% at 50% 118%, ${palette.glow} 0%, transparent 62%)`, opacity: 0.3 }}
      />

      {/* drifting mist — three wide, slow bands */}
      {[
        { top: "62%", width: "150%", left: "-25%", height: 120, opacity: 0.16, duration: 64 },
        { top: "74%", width: "130%", left: "-10%", height: 150, opacity: 0.13, duration: 88 },
        { top: "48%", width: "120%", left: "-15%", height: 90, opacity: 0.08, duration: 112 },
      ].map((band, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            top: band.top,
            left: band.left,
            width: band.width,
            height: band.height,
            opacity: band.opacity,
            background: `linear-gradient(90deg, transparent, hsl(var(--mist) / 0.5) 35%, hsl(var(--mist) / 0.35) 65%, transparent)`,
            animation: animationsEnabled ? `scene-drift ${band.duration}s ease-in-out ${i * -12}s infinite alternate` : undefined,
          }}
        />
      ))}

      {/* a single rose spark near the top, so the screen is never cold */}
      <div
        className="absolute -right-16 -top-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--rose-glow) / 0.18), transparent 68%)" }}
      />

      {/* vignette: keeps the eye on the middle of the screen */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_35%,transparent_35%,hsl(232_48%_4%/0.55)_100%)]" />
    </div>
  );
};

export default HomeScene;
