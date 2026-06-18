import React, { useEffect, useState, useRef, useMemo } from "react";

export type TouchEmotion =
  | "hug" | "love" | "cuddle" | "miss_you" | "rose" | "kiss"
  | "celebrate" | "proud" | "fire" | "high_five" | "cheer"
  | "tears" | "comfort" | "goodnight" | "good_morning"
  | "lol" | "boo" | "magic" | "poke" | "blush" | "sleepy" | "butterfly";

/** Each emotion plays one of these distinct choreographies. */
export type TouchMotion =
  | "embrace"    // arms/hearts sweep inward and squeeze — warmth
  | "kiss"       // lips swoop + plant + heart-ring pop
  | "comfort"    // slow warm breathing, gentle falling softness
  | "celebrate"  // confetti cannon from below, big bounce
  | "tears"      // droplets fall, cool tint, slow
  | "hype"       // fast upward energy + shake
  | "poke"       // single sharp nudge, quick
  | "drift";     // dreamy float (default)

interface EmotionConfig {
  emoji: string;
  label: string;
  verb: string;
  color: string;
  vibration: number[];
  particles: string[];
  motion: TouchMotion;
  shake?: boolean;
  flash?: boolean;
}

export const TOUCH_EMOTIONS: Record<TouchEmotion, EmotionConfig> = {
  hug:          { emoji: "🤗", label: "Hug",          verb: "hugging",        color: "rgba(255,183,77,0.85)",   vibration: [120,80,180,80,260], particles: ["🤗","🫂","🧸","💛"], motion: "embrace" },
  love:         { emoji: "❤️", label: "Love",         verb: "sending love to", color: "rgba(220,40,60,0.85)",    vibration: [220,140,220,140,260], particles: ["❤️","💕","💖","💗"], motion: "embrace" },
  cuddle:       { emoji: "🥰", label: "Cuddle",       verb: "cuddling",       color: "rgba(255,200,170,0.85)",  vibration: [300,150,300],         particles: ["🥰","💞","🧸","💝"], motion: "embrace" },
  miss_you:     { emoji: "💕", label: "Miss You",     verb: "missing",        color: "rgba(180,160,220,0.85)",  vibration: [260,260,260],         particles: ["💕","💫","⭐","💜"], motion: "comfort" },
  rose:         { emoji: "🌹", label: "Rose",         verb: "sending a rose to", color: "rgba(220,60,80,0.85)", vibration: [100,50,100,50,100],   particles: ["🌹","🌺","🌷","💐"], motion: "drift" },
  kiss:         { emoji: "💋", label: "Kiss",         verb: "kissing",        color: "rgba(240,80,120,0.85)",   vibration: [90,60,220],           particles: ["💋","💕","❤️","✨"], motion: "kiss" },
  celebrate:    { emoji: "🎉", label: "Celebrate",    verb: "celebrating with", color: "rgba(255,200,50,0.85)", vibration: [80,40,80,40,80,40,260], particles: ["🎉","🎊","🎈","🥳"], motion: "celebrate" },
  proud:        { emoji: "🏆", label: "Proud",        verb: "proud of",       color: "rgba(255,215,0,0.85)",    vibration: [160,90,160,90,200],   particles: ["🏆","✨","💪","👑"], motion: "celebrate" },
  fire:         { emoji: "🔥", label: "Fire",         verb: "hyping up",      color: "rgba(255,100,30,0.85)",   vibration: [80,30,80,30,80,30,400], particles: ["🔥","💥","✨","🌟"], motion: "hype", shake: true },
  high_five:    { emoji: "🙌", label: "High Five",    verb: "high-fiving",    color: "rgba(255,220,60,0.85)",   vibration: [60,40,200],           particles: ["🙌","✋","⭐","💫"], motion: "celebrate", flash: true },
  cheer:        { emoji: "📣", label: "Cheer",        verb: "cheering for",   color: "rgba(255,140,50,0.85)",   vibration: [60,30,60,30,60,30,260], particles: ["📣","🎉","🎊","🥳"], motion: "celebrate" },
  tears:        { emoji: "😢", label: "Tears",        verb: "crying with",    color: "rgba(120,160,200,0.85)",  vibration: [400,300,400],         particles: ["😢","💧","💔","💙"], motion: "tears" },
  comfort:      { emoji: "💙", label: "Comfort",      verb: "comforting",     color: "rgba(100,180,230,0.85)",  vibration: [220,220,220],         particles: ["💙","🌊","🫂","🤗"], motion: "comfort" },
  goodnight:    { emoji: "😴", label: "Goodnight",    verb: "saying goodnight to", color: "rgba(30,40,100,0.85)", vibration: [400,300,300],        particles: ["🌙","⭐","💤","✨"], motion: "drift" },
  good_morning: { emoji: "🌅", label: "Good Morning", verb: "saying good morning to", color: "rgba(255,180,80,0.85)", vibration: [100,100,200],     particles: ["🌅","☀️","🌻","🌸"], motion: "drift" },
  lol:          { emoji: "😂", label: "LOL",          verb: "laughing with",  color: "rgba(255,230,80,0.85)",   vibration: [50,30,50,30,50,30,50], particles: ["😂","🤣","😆","😅"], motion: "hype", shake: true },
  boo:          { emoji: "👻", label: "Boo!",         verb: "scaring",        color: "rgba(20,20,40,0.9)",      vibration: [1000],                particles: ["👻","🎃","🕷️","🌚"], motion: "hype", flash: true },
  magic:        { emoji: "✨", label: "Magic",        verb: "enchanting",     color: "rgba(140,80,200,0.85)",   vibration: [50,100,50,100,260],   particles: ["✨","💫","🌟","🪄"], motion: "hype" },
  poke:         { emoji: "👉", label: "Poke",         verb: "poking",         color: "rgba(255,180,100,0.85)",  vibration: [60,120,60],           particles: ["👉","👈","😜","💨"], motion: "poke", shake: true },
  blush:        { emoji: "😊", label: "Blush",        verb: "making blush",   color: "rgba(255,170,180,0.85)",  vibration: [100,150,100],         particles: ["😊","🌸","💗","✨"], motion: "comfort" },
  sleepy:       { emoji: "🥱", label: "Sleepy",       verb: "yawning with",   color: "rgba(40,50,100,0.85)",    vibration: [300,400,300],         particles: ["🥱","💤","🌙","⭐"], motion: "drift" },
  butterfly:    { emoji: "🦋", label: "Butterflies",  verb: "giving butterflies to", color: "rgba(160,100,220,0.85)", vibration: [50,80,50,80,200], particles: ["🦋","💜","✨","🌸"], motion: "drift" },
};

export interface CustomEmotionConfig {
  emoji: string;
  label: string;
  verb: string;
  gradient: string;
  particles: string[];
  particle_size: number;
  vibration_strength: string;
  vibration_duration: number;
  shake: boolean;
  flash: boolean;
}

const VIBRATION_MAP: Record<string, number[]> = {
  off: [],
  light: [100, 100],
  medium: [200, 100, 200],
  strong: [400, 200, 400, 200, 400],
};

interface TouchReactionOverlayProps {
  emotion?: TouchEmotion;
  customConfig?: CustomEmotionConfig;
  senderName: string;
  onDismiss: () => void;
  onReactBack?: (emotion: TouchEmotion) => void;
}

const DURATION = 4200;

const TouchReactionOverlay: React.FC<TouchReactionOverlayProps> = ({ emotion, customConfig, senderName, onDismiss, onReactBack }) => {
  const isCustom = !!customConfig;
  const builtinConfig = emotion ? TOUCH_EMOTIONS[emotion] : null;

  const emoji = isCustom ? customConfig.emoji : builtinConfig?.emoji ?? "❤️";
  const label = isCustom ? customConfig.label : builtinConfig?.label ?? "";
  const verb = isCustom ? customConfig.verb : builtinConfig?.verb ?? "";
  const particlesArr = isCustom ? customConfig.particles : builtinConfig?.particles ?? [];
  const particleSize = isCustom ? customConfig.particle_size : 28;
  const shakeEffect = isCustom ? customConfig.shake : builtinConfig?.shake ?? false;
  const flashEffect = isCustom ? customConfig.flash : builtinConfig?.flash ?? false;
  const motion: TouchMotion = isCustom ? "drift" : builtinConfig?.motion ?? "drift";
  const vibration = isCustom
    ? VIBRATION_MAP[customConfig.vibration_strength] ?? VIBRATION_MAP.medium
    : builtinConfig?.vibration ?? [];
  const bgColor = isCustom ? customConfig.gradient : builtinConfig?.color ?? "rgba(0,0,0,0.7)";

  const [phase, setPhase] = useState<"in" | "show" | "out">("in");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const isUrl = (s: string) => s.startsWith("http");
  const pick = () => (particlesArr.length > 0 ? particlesArr[Math.floor(Math.random() * particlesArr.length)] : "✨");

  // Particle field shaped by motion.
  const field = useMemo(() => {
    const count = motion === "poke" ? 8 : motion === "comfort" ? 16 : motion === "tears" ? 18 : 26;
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 130;
      return {
        burstX: Math.cos(angle) * radius,
        burstY: Math.sin(angle) * radius,
        startX: (Math.random() - 0.5) * 100,   // for fall/rise lanes
        drift: (Math.random() - 0.5) * 70,
        left: Math.random() * 100,
        delay: Math.random() * (motion === "celebrate" ? 0.5 : 1.1),
        duration: (motion === "hype" ? 1.6 : motion === "comfort" ? 3.4 : 2.6) + Math.random() * 1.4,
        char: pick(),
        size: (isCustom ? particleSize : 22) + Math.random() * 14,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, particlesArr, particleSize, isCustom]);

  useEffect(() => {
    if (navigator.vibrate && vibration.length > 0) navigator.vibrate(vibration);
    const dur = motion === "poke" ? 2600 : DURATION;
    const t1 = setTimeout(() => setPhase("show"), 400);
    const t2 = setTimeout(() => setPhase("out"), dur - 600);
    timerRef.current = setTimeout(onDismiss, dur);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timerRef.current);
      if (navigator.vibrate) navigator.vibrate(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    setPhase("out");
    setTimeout(onDismiss, 600);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Center-emoji animation per motion.
  const centerAnim: Record<TouchMotion, string> = {
    embrace: "tr-embrace 1s cubic-bezier(0.34,1.56,0.64,1) forwards",
    kiss: "tr-kiss 0.9s cubic-bezier(0.34,1.56,0.64,1) forwards",
    comfort: "tr-breathe 3s ease-in-out infinite",
    celebrate: "tr-bounce-in 0.8s cubic-bezier(0.34,1.7,0.5,1) forwards",
    tears: "tr-sink 1.2s ease-out forwards",
    hype: "tr-hype 0.5s ease-in-out infinite",
    poke: "tr-poke 0.5s cubic-bezier(0.34,1.7,0.5,1) forwards",
    drift: "emoji-spring-in 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards",
  };

  // Particle keyframe per motion.
  const particleAnim = (p: typeof field[number]) => {
    switch (motion) {
      case "tears":
        return `tr-fall ${p.duration}s ease-in ${p.delay}s forwards`;
      case "celebrate":
        return `tr-confetti ${p.duration}s cubic-bezier(0.2,0.8,0.3,1) ${p.delay}s forwards`;
      case "hype":
        return `tr-rise-fast ${p.duration}s ease-out ${p.delay}s forwards`;
      case "comfort":
        return `tr-soft-fall ${p.duration}s ease-in-out ${p.delay}s forwards`;
      case "embrace":
        return `tr-converge ${p.duration}s cubic-bezier(0.22,1,0.36,1) ${p.delay}s forwards`;
      default:
        return `particle-burst ${p.duration}s cubic-bezier(0.22,1,0.36,1) ${p.delay}s forwards`;
    }
  };

  const tint =
    motion === "tears" ? "saturate(0.7) brightness(0.85)" :
    motion === "comfort" ? "saturate(0.95)" : undefined;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${shakeEffect ? "animate-[screen-shake_0.5s_ease-in-out_infinite]" : ""}`}
      style={{
        background: isCustom ? bgColor : `radial-gradient(circle at 50% 50%, ${bgColor}, ${bgColor.replace(/[\d.]+\)$/, "0.3)")})`,
        animation: phase === "in"
          ? "radial-reveal 0.5s cubic-bezier(0.22,1,0.36,1) forwards"
          : phase === "out"
          ? "touch-overlay-out 0.6s ease-in forwards"
          : undefined,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        filter: tint,
      }}
      onClick={handleDismiss}
    >
      <style>{`
        @keyframes tr-embrace { 0%{transform:scale(0.2);opacity:0} 40%{transform:scale(1.4) scaleX(1.5);opacity:1} 70%{transform:scale(0.92) scaleX(0.9)} 100%{transform:scale(1);opacity:1} }
        @keyframes tr-kiss { 0%{transform:translate(-60px,80px) rotate(-25deg) scale(0.3);opacity:0} 55%{transform:translate(0,0) rotate(0) scale(1.5);opacity:1} 72%{transform:scale(0.85)} 100%{transform:scale(1);opacity:1} }
        @keyframes tr-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes tr-bounce-in { 0%{transform:translateY(40px) scale(0.3);opacity:0} 60%{transform:translateY(0) scale(1.35);opacity:1} 80%{transform:scale(0.92)} 100%{transform:scale(1)} }
        @keyframes tr-sink { 0%{transform:translateY(-10px) scale(0.4);opacity:0} 50%{transform:translateY(0) scale(1.1);opacity:1} 100%{transform:translateY(14px) scale(1);opacity:1} }
        @keyframes tr-hype { 0%,100%{transform:scale(1.12) rotate(-4deg)} 50%{transform:scale(1.22) rotate(4deg)} }
        @keyframes tr-poke { 0%{transform:scale(0.4);opacity:0} 45%{transform:scale(1.5) translateX(10px);opacity:1} 65%{transform:translateX(-8px)} 100%{transform:scale(1) translateX(0)} }

        @keyframes tr-fall { 0%{transform:translateY(-20px) scale(0.6);opacity:0} 15%{opacity:1} 100%{transform:translateY(60vh) scale(1);opacity:0} }
        @keyframes tr-confetti { 0%{transform:translateY(0) rotate(0) scale(0.6);opacity:0} 12%{opacity:1} 100%{transform:translateY(-65vh) rotate(540deg) scale(1);opacity:0} }
        @keyframes tr-rise-fast { 0%{transform:translateY(0) scale(0.5);opacity:0} 18%{opacity:1} 100%{transform:translateY(-60vh) scale(1.1);opacity:0} }
        @keyframes tr-soft-fall { 0%{transform:translate(0,-10px) scale(0.5);opacity:0} 25%{opacity:0.85} 100%{transform:translate(var(--sx,0),45vh) scale(1);opacity:0} }
        @keyframes tr-converge { 0%{transform:translate(var(--bx,0),var(--by,0)) scale(0.4);opacity:0} 30%{opacity:1} 70%{transform:translate(0,0) scale(1.1);opacity:1} 100%{transform:translate(0,-40px) scale(0.9);opacity:0} }
      `}</style>

      {/* Flash effect */}
      {flashEffect && phase === "in" && (
        <div className="absolute inset-0 bg-white pointer-events-none animate-[flash-scare_0.3s_ease-out]" />
      )}

      {/* Particle field */}
      {field.map((p, i) => {
        const fall = motion === "tears" || motion === "comfort" || motion === "celebrate" || motion === "hype";
        return (
          <span
            key={`p-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: fall ? `${p.left}%` : "50%",
              top: motion === "tears" ? "0%" : fall ? "auto" : "50%",
              bottom: motion === "celebrate" || motion === "hype" ? "8%" : motion === "comfort" ? "auto" : undefined,
              fontSize: isUrl(p.char) ? undefined : `${p.size}px`,
              ["--bx" as any]: `${p.burstX}px`,
              ["--by" as any]: `${p.burstY}px`,
              ["--sx" as any]: `${p.drift}px`,
              animation: particleAnim(p),
              opacity: 0,
            }}
          >
            {isUrl(p.char) ? <img src={p.char} alt="" style={{ width: p.size, height: p.size }} /> : p.char}
          </span>
        );
      })}

      {/* Embrace: two arms sweep in from the sides */}
      {motion === "embrace" && phase !== "out" && (
        <>
          <span className="absolute text-6xl pointer-events-none" style={{ left: "8%", top: "46%", animation: "tr-arm-l 1.1s cubic-bezier(0.22,1,0.36,1) forwards" }}>🫶</span>
          <style>{`@keyframes tr-arm-l{0%{transform:translateX(-120px) rotate(-30deg);opacity:0}60%{transform:translateX(60px) rotate(0);opacity:1}100%{transform:translateX(80px);opacity:0.9}}`}</style>
        </>
      )}

      {/* Kiss: expanding heart ring */}
      {motion === "kiss" && (
        <div
          className="absolute rounded-full border-2 pointer-events-none"
          style={{
            width: 80, height: 80, borderColor: "rgba(255,120,160,0.7)",
            top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            animation: "tr-ring 1s ease-out 0.4s forwards", opacity: 0,
          }}
        />
      )}
      {motion === "kiss" && <style>{`@keyframes tr-ring{0%{width:20px;height:20px;opacity:0.9}100%{width:320px;height:320px;opacity:0}}`}</style>}

      {/* Glow ring behind emoji */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 140, height: 140,
          background: `radial-gradient(circle, ${bgColor.replace(/[\d.]+\)$/, "0.5)")}, transparent 70%)`,
          animation: motion === "comfort" ? "glow-pulse 3s ease-in-out infinite" : "glow-pulse 2s ease-in-out infinite",
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        }}
      />

      {/* Center content */}
      <div className="text-center z-10">
        <div style={{ animation: centerAnim[motion] }}>
          {isUrl(emoji) ? (
            <img src={emoji} alt={label} className="mx-auto mb-4" style={{ width: 80, height: 80 }} />
          ) : (
            <div className="text-8xl mb-4 drop-shadow-lg">{emoji}</div>
          )}
        </div>
        <p
          className="text-white text-xl font-bold drop-shadow-lg font-[Quicksand] tracking-wide"
          style={{ animation: "text-slide-up 0.5s ease-out 0.35s both" }}
        >
          {senderName} is {verb} you
        </p>
      </div>

      {/* React back button */}
      {onReactBack && emotion && (
        <button
          onClick={(e) => { e.stopPropagation(); onReactBack(emotion); handleDismiss(); }}
          className="mt-8 z-10 px-7 py-3 rounded-full text-white font-semibold text-sm border border-white/20 shadow-lg hover:bg-white/25 active:scale-95 transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            animation: "react-back-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both",
            boxShadow: "0 0 20px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {isUrl(emoji) ? "" : emoji + " "}{label} Back
        </button>
      )}
    </div>
  );
};

export default TouchReactionOverlay;
