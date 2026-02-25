import React, { useEffect, useState, useCallback } from "react";

export type EffectType =
  | "hearts" | "confetti" | "snow" | "fireworks" | "stars"
  | "goodnight" | "goodmorning" | "sorry" | "thankyou" | "flowers"
  | "cute" | "hug" | "rainbow" | "promise" | "holi"
  | "proud" | "diwali" | "surprise" | "valentine" | "forever"
  | null;

export { detectEffect };

const KEYWORD_MAP: [RegExp, EffectType][] = [
  // Most frequent first for priority
  [/good\s*night|gn\b|shubh\s*ratri/i, "goodnight"],
  [/sorry|maaf/i, "sorry"],
  [/i\s*love\s*you|love\s*you|pyaar|mohabbat/i, "hearts"],
  [/thank\s*you|thanks|shukriya|dhanyavaad/i, "thankyou"],
  [/good\s*morning|gm\b|suprabhat/i, "goodmorning"],
  [/beautiful|sundar|khoobsurat/i, "flowers"],
  [/cute|cutiepie|cutie/i, "cute"],
  [/\bhug\b|gale\s*lag|jaadu\s*ki\s*jhappi/i, "hug"],
  [/happy\s*birthday/i, "confetti"],
  [/\bhappy\b|khush|khushi/i, "rainbow"],
  [/promise|vaada|kasam/i, "promise"],
  [/holi/i, "holi"],
  [/miss\s*you|yaad/i, "stars"],
  [/congratulations|congrats|badhai/i, "fireworks"],
  [/proud|garv/i, "proud"],
  [/diwali|deepavali/i, "diwali"],
  [/merry\s*christmas/i, "snow"],
  [/happy\s*new\s*year/i, "fireworks"],
  [/surprise/i, "surprise"],
  [/valentine/i, "valentine"],
  [/forever|hamesha|humesha/i, "forever"],
];

function detectEffect(content: string): EffectType {
  for (const [regex, effect] of KEYWORD_MAP) {
    if (regex.test(content)) return effect;
  }
  return null;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  char: string;
  duration: number;
}

const EFFECT_CHARS: Record<string, string[]> = {
  hearts: ["❤️", "💕", "💖", "💗", "💘", "💝"],
  confetti: ["🎉", "🎊", "✨", "🎈", "🥳", "🎁"],
  snow: ["❄️", "🌨️", "⛄", "❅", "❆", "✧"],
  fireworks: ["🎆", "🎇", "✨", "💫", "⭐", "🌟"],
  stars: ["⭐", "✨", "💫", "🌟", "⭐", "✨"],
  goodnight: ["🌙", "⭐", "✨", "💤", "🌟", "🫶"],
  goodmorning: ["🌅", "🌻", "☀️", "🌸", "🌤️", "🌈"],
  sorry: ["🥺", "💧", "😔", "🫂", "💙", "🤗"],
  thankyou: ["✨", "🌟", "💛", "🙏", "💫", "🌸"],
  flowers: ["🌸", "🌺", "🌹", "💐", "🌷", "🪷"],
  cute: ["🥰", "💖", "✨", "🌟", "💕", "😍"],
  hug: ["🤗", "🫂", "💛", "🧸", "🤍", "💞"],
  rainbow: ["🌈", "😊", "✨", "🎉", "💛", "🌟"],
  promise: ["🤙", "💫", "🤝", "✨", "💜", "🫶"],
  holi: ["🟣", "🔴", "🟡", "🟢", "🔵", "🎨"],
  proud: ["🏆", "✨", "💪", "🌟", "👑", "💫"],
  diwali: ["🪔", "✨", "🎆", "🎇", "🌟", "🕯️"],
  surprise: ["🎁", "🎊", "🎉", "😱", "✨", "💫"],
  valentine: ["🌹", "💘", "💝", "💖", "❤️", "💕"],
  forever: ["♾️", "✨", "💫", "💖", "🌟", "⭐"],
};

const MessageEffects: React.FC<{ lastMessage: string | null; enabled?: boolean; externalEffect?: EffectType }> = ({
  lastMessage,
  enabled = true,
  externalEffect,
}) => {
  const [effect, setEffect] = useState<EffectType>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prevMsg, setPrevMsg] = useState<string | null>(null);

  const triggerEffect = useCallback((type: EffectType) => {
    if (!type) return;
    const chars = EFFECT_CHARS[type];
    const newParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.5,
      char: chars[Math.floor(Math.random() * chars.length)],
      duration: 2 + Math.random() * 2,
    }));
    setParticles(newParticles);
    setEffect(type);
    setTimeout(() => {
      setEffect(null);
      setParticles([]);
    }, 4000);
  }, []);

  // External trigger from animation queue
  useEffect(() => {
    if (externalEffect) triggerEffect(externalEffect);
  }, [externalEffect, triggerEffect]);

  useEffect(() => {
    if (!enabled || !lastMessage || lastMessage === prevMsg) return;
    setPrevMsg(lastMessage);
    const detected = detectEffect(lastMessage);
    if (detected) triggerEffect(detected);
  }, [lastMessage, enabled, prevMsg, triggerEffect]);

  if (!effect || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-2xl animate-fall"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
};

export default MessageEffects;
