import React, { useEffect, useState, useRef, useMemo } from "react";

export type TouchEmotion =
  | "hug" | "love" | "cuddle" | "miss_you" | "rose" | "kiss"
  | "celebrate" | "proud" | "fire" | "high_five" | "cheer"
  | "tears" | "comfort" | "goodnight" | "good_morning"
  | "lol" | "boo" | "magic" | "poke" | "blush" | "sleepy" | "butterfly";

interface EmotionConfig {
  emoji: string;
  label: string;
  verb: string;
  color: string;
  vibration: number[];
  particles: string[];
  shake?: boolean;
  flash?: boolean;
}

export const TOUCH_EMOTIONS: Record<TouchEmotion, EmotionConfig> = {
  hug:          { emoji: "🤗", label: "Hug",          verb: "hugging",        color: "rgba(255,183,77,0.85)",   vibration: [200,100,200,100,400], particles: ["🤗","🫂","🧸","💛"] },
  love:         { emoji: "❤️", label: "Love",         verb: "sending love to", color: "rgba(220,40,60,0.85)",    vibration: [300,200,300,200,300], particles: ["❤️","💕","💖","💗"] },
  cuddle:       { emoji: "🥰", label: "Cuddle",       verb: "cuddling",       color: "rgba(255,200,170,0.85)",  vibration: [400,200,400],         particles: ["🥰","💞","🧸","💝"] },
  miss_you:     { emoji: "💕", label: "Miss You",     verb: "missing",        color: "rgba(180,160,220,0.85)",  vibration: [300,300,300,300,300], particles: ["💕","💫","⭐","💜"] },
  rose:         { emoji: "🌹", label: "Rose",         verb: "sending a rose to", color: "rgba(220,60,80,0.85)", vibration: [100,50,100,50,100],   particles: ["🌹","🌺","🌷","💐"] },
  kiss:         { emoji: "💋", label: "Kiss",         verb: "kissing",        color: "rgba(240,80,120,0.85)",   vibration: [150,80,150,80,300],   particles: ["💋","💕","❤️","✨"] },
  celebrate:    { emoji: "🎉", label: "Celebrate",    verb: "celebrating with", color: "rgba(255,200,50,0.85)", vibration: [100,50,100,50,100,50,300], particles: ["🎉","🎊","🎈","🥳"] },
  proud:        { emoji: "🏆", label: "Proud",        verb: "proud of",       color: "rgba(255,215,0,0.85)",    vibration: [200,100,200,100,200], particles: ["🏆","✨","💪","👑"] },
  fire:         { emoji: "🔥", label: "Fire",         verb: "hyping up",      color: "rgba(255,100,30,0.85)",   vibration: [100,30,100,30,100,30,500], particles: ["🔥","💥","✨","🌟"] },
  high_five:    { emoji: "🙌", label: "High Five",    verb: "high-fiving",    color: "rgba(255,220,60,0.85)",   vibration: [80,40,80,40,200],     particles: ["🙌","✋","⭐","💫"], flash: true },
  cheer:        { emoji: "📣", label: "Cheer",        verb: "cheering for",   color: "rgba(255,140,50,0.85)",   vibration: [60,30,60,30,60,30,60,30,300], particles: ["📣","🎉","🎊","🥳"] },
  tears:        { emoji: "😢", label: "Tears",        verb: "crying with",    color: "rgba(120,160,200,0.85)",  vibration: [400,300,400],         particles: ["😢","💧","💔","💙"] },
  comfort:      { emoji: "💙", label: "Comfort",      verb: "comforting",     color: "rgba(100,180,230,0.85)",  vibration: [200,200,200,200,200], particles: ["💙","🌊","🫂","🤗"] },
  goodnight:    { emoji: "😴", label: "Goodnight",    verb: "saying goodnight to", color: "rgba(30,40,100,0.85)", vibration: [400,300,300,300,200], particles: ["🌙","⭐","💤","✨"] },
  good_morning: { emoji: "🌅", label: "Good Morning", verb: "saying good morning to", color: "rgba(255,180,80,0.85)", vibration: [100,100,200,100,100], particles: ["🌅","☀️","🌻","🌸"] },
  lol:          { emoji: "😂", label: "LOL",          verb: "laughing with",  color: "rgba(255,230,80,0.85)",   vibration: [50,30,50,30,50,30,50,30], particles: ["😂","🤣","😆","😅"], shake: true },
  boo:          { emoji: "👻", label: "Boo!",         verb: "scaring",        color: "rgba(20,20,40,0.9)",      vibration: [1000],                particles: ["👻","🎃","🕷️","🌚"], flash: true },
  magic:        { emoji: "✨", label: "Magic",        verb: "enchanting",     color: "rgba(140,80,200,0.85)",   vibration: [50,100,50,100,50,100,300], particles: ["✨","💫","🌟","🪄"] },
  poke:         { emoji: "👉", label: "Poke",         verb: "poking",         color: "rgba(255,180,100,0.85)",  vibration: [60,120,60],           particles: ["👉","👈","😜","💨"], shake: true },
  blush:        { emoji: "😊", label: "Blush",        verb: "making blush",   color: "rgba(255,170,180,0.85)",  vibration: [100,150,100],         particles: ["😊","🌸","💗","✨"] },
  sleepy:       { emoji: "🥱", label: "Sleepy",       verb: "yawning with",   color: "rgba(40,50,100,0.85)",    vibration: [300,400,300],         particles: ["🥱","💤","🌙","⭐"] },
  butterfly:    { emoji: "🦋", label: "Butterflies",  verb: "giving butterflies to", color: "rgba(160,100,220,0.85)", vibration: [50,80,50,80,50,80,200], particles: ["🦋","💜","✨","🌸"] },
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

const FG_COUNT = 28;
const BG_COUNT = 14;
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
  const vibration = isCustom
    ? VIBRATION_MAP[customConfig.vibration_strength] ?? VIBRATION_MAP.medium
    : builtinConfig?.vibration ?? [];
  const bgColor = isCustom ? customConfig.gradient : builtinConfig?.color ?? "rgba(0,0,0,0.7)";

  const [phase, setPhase] = useState<"in" | "show" | "out">("in");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Foreground particles — burst outward then float up with sway
  const fgParticles = useMemo(() =>
    Array.from({ length: FG_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 120;
      return {
        burstX: Math.cos(angle) * radius,
        burstY: Math.sin(angle) * radius,
        swayX: (Math.random() - 0.5) * 80,
        delay: Math.random() * 1.2,
        duration: 2.5 + Math.random() * 1.5,
        char: particlesArr.length > 0 ? particlesArr[Math.floor(Math.random() * particlesArr.length)] : "✨",
        size: (isCustom ? particleSize : 22) + Math.random() * 14,
      };
    }),
    [particlesArr, particleSize, isCustom]
  );

  // Background particles — slow, blurred, dreamy
  const bgParticles = useMemo(() =>
    Array.from({ length: BG_COUNT }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 3 + Math.random() * 2,
      char: particlesArr.length > 0 ? particlesArr[Math.floor(Math.random() * particlesArr.length)] : "✨",
      size: (isCustom ? particleSize * 0.5 : 14) + Math.random() * 8,
    })),
    [particlesArr, particleSize, isCustom]
  );

  useEffect(() => {
    if (navigator.vibrate && vibration.length > 0) navigator.vibrate(vibration);
    const t1 = setTimeout(() => setPhase("show"), 400);
    const t2 = setTimeout(() => setPhase("out"), DURATION - 600);
    timerRef.current = setTimeout(onDismiss, DURATION);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timerRef.current);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, []);

  const handleDismiss = () => {
    setPhase("out");
    setTimeout(onDismiss, 600);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

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
      }}
      onClick={handleDismiss}
    >
      {/* Flash effect */}
      {flashEffect && phase === "in" && (
        <div className="absolute inset-0 bg-white pointer-events-none animate-[flash-scare_0.3s_ease-out]" />
      )}

      {/* Background particles — dreamy, blurred, slow */}
      {bgParticles.map((p, i) => {
        const isUrl = p.char.startsWith("http");
        return (
          <span
            key={`bg-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${p.left}%`,
              bottom: "5%",
              fontSize: isUrl ? undefined : `${p.size}px`,
              animationName: "particle-drift",
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: 0,
            }}
          >
            {isUrl ? (
              <img src={p.char} alt="" className="pointer-events-none" style={{ width: p.size, height: p.size }} />
            ) : p.char}
          </span>
        );
      })}

      {/* Foreground particles — burst outward then float with sway */}
      {fgParticles.map((p, i) => {
        const isUrl = p.char.startsWith("http");
        return (
          <span
            key={`fg-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              fontSize: isUrl ? undefined : `${p.size}px`,
              ["--burst-x" as any]: `${p.burstX}px`,
              ["--burst-y" as any]: `${p.burstY}px`,
              ["--sway-x" as any]: `${p.swayX}px`,
              animationName: "particle-burst",
              animationTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
              animationFillMode: "forwards",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: 0,
            }}
          >
            {isUrl ? (
              <img src={p.char} alt="" className="pointer-events-none" style={{ width: p.size, height: p.size }} />
            ) : p.char}
          </span>
        );
      })}

      {/* Glow ring behind emoji */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 140,
          height: 140,
          background: `radial-gradient(circle, ${bgColor.replace(/[\d.]+\)$/, "0.5)")}, transparent 70%)`,
          animation: "glow-pulse 2s ease-in-out infinite",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Center content */}
      <div className="text-center z-10">
        <div style={{ animation: "emoji-spring-in 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
          {emoji.startsWith("http") ? (
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

      {/* React back button — glassmorphic */}
      {onReactBack && emotion && (
        <button
          onClick={(e) => { e.stopPropagation(); onReactBack(emotion); handleDismiss(); }}
          className="mt-8 z-10 px-7 py-3 rounded-full text-white font-semibold text-sm
            border border-white/20 shadow-lg
            hover:bg-white/25 active:scale-95 transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            animation: "react-back-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both",
            boxShadow: "0 0 20px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {emoji.startsWith("http") ? "" : emoji + " "}{label} Back
        </button>
      )}
    </div>
  );
};

export default TouchReactionOverlay;
