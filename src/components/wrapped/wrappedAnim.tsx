import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

/** Smoothly animates a number from 0 → value over `duration` ms. */
export const CountUp: React.FC<{ value: number; duration?: number; className?: string }> = ({
  value,
  duration = 1600,
  className,
}) => {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // easeOutExpo for a satisfying deceleration
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
};

const PARTICLE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];

/** Burst of confetti from the top. Mount it to trigger. */
export const ConfettiBurst: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 1.8,
        rotate: Math.random() * 720 - 360,
        size: 6 + Math.random() * 8,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        round: Math.random() > 0.5,
      })),
    [count]
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: "-10%", opacity: 1, rotate: 0 }}
          animate={{ y: "110%", opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
};

/** Soft, slow-rising hearts/sparkles behind a card for ambiance. */
export const FloatingHearts: React.FC<{ emoji?: string; count?: number }> = ({ emoji = "💕", count = 14 }) => {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 6,
        size: 14 + Math.random() * 26,
        drift: Math.random() * 40 - 20,
      })),
    [count, emoji]
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((it) => (
        <motion.span
          key={it.id}
          initial={{ y: "110%", x: 0, opacity: 0 }}
          animate={{ y: "-15%", x: it.drift, opacity: [0, 0.6, 0.6, 0] }}
          transition={{ duration: it.duration, delay: it.delay, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{ left: `${it.x}%`, fontSize: it.size }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
};

/** Staggered fade/slide-up wrapper for sequential reveals inside a card. */
export const Reveal: React.FC<{ delay?: number; children: React.ReactNode; className?: string }> = ({
  delay = 0,
  children,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: "spring", stiffness: 220, damping: 22 }}
    className={className}
  >
    {children}
  </motion.div>
);
