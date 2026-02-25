import React, { useEffect, useState, useRef, useMemo } from "react";

export type TouchEmotion =
  | "hug" | "love" | "cuddle" | "miss_you" | "rose"
  | "celebrate" | "proud" | "fire"
  | "tears" | "comfort" | "goodnight" | "good_morning"
  | "lol" | "boo" | "magic";

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
  celebrate:    { emoji: "🎉", label: "Celebrate",    verb: "celebrating with", color: "rgba(255,200,50,0.85)", vibration: [100,50,100,50,100,50,300], particles: ["🎉","🎊","🎈","🥳"] },
  proud:        { emoji: "🏆", label: "Proud",        verb: "proud of",       color: "rgba(255,215,0,0.85)",    vibration: [200,100,200,100,200], particles: ["🏆","✨","💪","👑"] },
  fire:         { emoji: "🔥", label: "Fire",         verb: "hyping up",      color: "rgba(255,100,30,0.85)",   vibration: [100,30,100,30,100,30,500], particles: ["🔥","💥","✨","🌟"] },
  tears:        { emoji: "😢", label: "Tears",        verb: "crying with",    color: "rgba(120,160,200,0.85)",  vibration: [400,300,400],         particles: ["😢","💧","💔","💙"] },
  comfort:      { emoji: "💙", label: "Comfort",      verb: "comforting",     color: "rgba(100,180,230,0.85)",  vibration: [200,200,200,200,200], particles: ["💙","🌊","🫂","🤗"] },
  goodnight:    { emoji: "😴", label: "Goodnight",    verb: "saying goodnight to", color: "rgba(30,40,100,0.85)", vibration: [400,300,300,300,200], particles: ["🌙","⭐","💤","✨"] },
  good_morning: { emoji: "🌅", label: "Good Morning", verb: "saying good morning to", color: "rgba(255,180,80,0.85)", vibration: [100,100,200,100,100], particles: ["🌅","☀️","🌻","🌸"] },
  lol:          { emoji: "😂", label: "LOL",          verb: "laughing with",  color: "rgba(255,230,80,0.85)",   vibration: [50,30,50,30,50,30,50,30], particles: ["😂","🤣","😆","😅"], shake: true },
  boo:          { emoji: "👻", label: "Boo!",         verb: "scaring",        color: "rgba(20,20,40,0.9)",      vibration: [1000],                particles: ["👻","🎃","🕷️","🌚"], flash: true },
  magic:        { emoji: "✨", label: "Magic",        verb: "enchanting",     color: "rgba(140,80,200,0.85)",   vibration: [50,100,50,100,50,100,300], particles: ["✨","💫","🌟","🪄"] },
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

const PARTICLE_COUNT = 35;
const DURATION = 4000;

const TouchReactionOverlay: React.FC<TouchReactionOverlayProps> = ({ emotion, customConfig, senderName, onDismiss, onReactBack }) => {
  // Resolve config from either built-in or custom
  const isCustom = !!customConfig;
  const builtinConfig = emotion ? TOUCH_EMOTIONS[emotion] : null;

  const emoji = isCustom ? customConfig.emoji : builtinConfig?.emoji ?? "❤️";
  const label = isCustom ? customConfig.label : builtinConfig?.label ?? "";
  const verb = isCustom ? customConfig.verb : builtinConfig?.verb ?? "";
  const particlesArr = isCustom ? customConfig.particles : builtinConfig?.particles ?? [];
  const particleSize = isCustom ? customConfig.particle_size : 30;
  const shakeEffect = isCustom ? customConfig.shake : builtinConfig?.shake ?? false;
  const flashEffect = isCustom ? customConfig.flash : builtinConfig?.flash ?? false;
  const vibration = isCustom
    ? VIBRATION_MAP[customConfig.vibration_strength] ?? VIBRATION_MAP.medium
    : builtinConfig?.vibration ?? [];
  const bgStyle = isCustom
    ? customConfig.gradient
    : builtinConfig
      ? `radial-gradient(circle at center, ${builtinConfig.color}, ${builtinConfig.color.replace(/[\d.]+\)$/, "0.4)")})`
      : "rgba(0,0,0,0.7)";

  const [phase, setPhase] = useState<"in" | "show" | "out">("in");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const particleData = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      char: particlesArr.length > 0 ? particlesArr[Math.floor(Math.random() * particlesArr.length)] : "✨",
      size: (isCustom ? particleSize : 20) + Math.random() * 20,
    })),
    [particlesArr, particleSize, isCustom]
  );

  useEffect(() => {
    if (navigator.vibrate && vibration.length > 0) navigator.vibrate(vibration);
    const t1 = setTimeout(() => setPhase("show"), 500);
    const t2 = setTimeout(() => setPhase("out"), DURATION - 500);
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
    setTimeout(onDismiss, 500);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const opacity = phase === "in" ? "animate-[overlay-fade-in_0.5s_ease-out_forwards]"
    : phase === "out" ? "animate-[overlay-fade-out_0.5s_ease-in_forwards]"
    : "";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${opacity} ${shakeEffect ? "animate-[screen-shake_0.5s_ease-in-out_infinite]" : ""} ${flashEffect ? "animate-[flash-scare_0.3s_ease-out]" : ""}`}
      style={{ background: bgStyle }}
      onClick={handleDismiss}
    >
      {/* Particles */}
      {particleData.map((p, i) => {
        const isUrl = p.char.startsWith("http");
        return (
          <span
            key={i}
            className="absolute animate-[particle-float_linear_forwards] pointer-events-none"
            style={{
              left: `${p.left}%`,
              bottom: "-10%",
              fontSize: isUrl ? undefined : `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            {isUrl ? (
              <img src={p.char} alt="" className="pointer-events-none" style={{ width: p.size, height: p.size }} />
            ) : p.char}
          </span>
        );
      })}

      {/* Center content */}
      <div className="animate-[text-scale-in_0.6s_cubic-bezier(0.34,1.56,0.64,1)_forwards] text-center z-10">
        {emoji.startsWith("http") ? (
          <img src={emoji} alt={label} className="mx-auto mb-4" style={{ width: 72, height: 72 }} />
        ) : (
          <div className="text-7xl mb-4">{emoji}</div>
        )}
        <p className="text-white text-xl font-bold drop-shadow-lg font-[Quicksand]">
          {senderName} is {verb} you
        </p>
      </div>

      {/* React back button */}
      {onReactBack && emotion && (
        <button
          onClick={(e) => { e.stopPropagation(); onReactBack(emotion); handleDismiss(); }}
          className="mt-8 z-10 px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white font-semibold text-sm hover:bg-white/30 transition-colors animate-[text-scale-in_0.6s_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]"
        >
          {emoji.startsWith("http") ? "" : emoji + " "}{label} Back
        </button>
      )}
    </div>
  );
};

export default TouchReactionOverlay;
