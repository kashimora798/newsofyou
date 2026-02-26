import React, { useState, useEffect, useRef } from "react";

interface RainbowArcProps {
  isDaytime: boolean;
}

const LOVE_QUOTES = [
  "In all the world, there is no heart for me like yours. 💖",
  "You are my today and all of my tomorrows. 🌅",
  "Every love story is beautiful, but ours is my favorite. 📖",
  "I choose you. And I'll choose you over and over. 💕",
  "You're the best thing I never planned. ✨",
  "Home is wherever I'm with you. 🏡",
  "My favorite place is inside your hug. 🤗",
  "You make my heart smile. 😊",
];

const RainbowArc: React.FC<RainbowArcProps> = ({ isDaytime }) => {
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isDaytime) { setVisible(false); return; }

    const trySpawn = () => {
      // ~5% chance every 90s
      if (Math.random() < 0.05) {
        setVisible(true);
        setQuote(null);
        // Visible for 30-60s
        const duration = 30000 + Math.random() * 30000;
        timerRef.current = setTimeout(() => setVisible(false), duration);
      }
    };

    const interval = setInterval(trySpawn, 90000);
    const init = setTimeout(trySpawn, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(init);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDaytime]);

  const handleTap = () => {
    if (!quote) {
      setQuote(LOVE_QUOTES[Math.floor(Math.random() * LOVE_QUOTES.length)]);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="absolute pointer-events-auto cursor-pointer"
        style={{
          top: "5%",
          left: "10%",
          right: "10%",
          height: "40%",
          zIndex: 4,
          animation: "rainbowFadeIn 3s ease-out forwards",
        }}
        onPointerDown={handleTap}
      >
        {/* Rainbow arc using border */}
        <div style={{
          width: "100%",
          height: "200%",
          borderRadius: "50%",
          border: "none",
          position: "absolute",
          top: 0,
          background: `conic-gradient(
            from 180deg at 50% 100%,
            transparent 0deg,
            rgba(255,0,0,0.15) 160deg,
            rgba(255,127,0,0.15) 165deg,
            rgba(255,255,0,0.12) 170deg,
            rgba(0,255,0,0.12) 175deg,
            rgba(0,0,255,0.12) 180deg,
            rgba(75,0,130,0.12) 185deg,
            rgba(148,0,211,0.1) 190deg,
            transparent 200deg
          )`,
          filter: "blur(3px)",
          maskImage: "radial-gradient(ellipse 50% 100% at 50% 100%, transparent 60%, black 62%, black 72%, transparent 74%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 100% at 50% 100%, transparent 60%, black 62%, black 72%, transparent 74%)",
        }} />

        {/* Quote overlay */}
        {quote && (
          <div
            className="absolute text-center px-4"
            style={{
              top: "30%",
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: 280,
              color: "white",
              fontSize: 14,
              fontStyle: "italic",
              textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              animation: "quoteReveal 0.6s ease-out forwards",
              lineHeight: 1.5,
            }}
          >
            {quote}
          </div>
        )}
      </div>

      <style>{`
        @keyframes rainbowFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes quoteReveal {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
};

export default RainbowArc;
