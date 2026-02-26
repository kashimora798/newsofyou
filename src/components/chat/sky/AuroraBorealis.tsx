import React, { useEffect, useState } from "react";

const AuroraBorealis: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isNight) { setActive(false); return; }

    // ~15% chance to show aurora on any clear night check
    const check = () => {
      setActive(Math.random() < 0.15);
    };
    check();
    const interval = setInterval(check, 120000); // re-check every 2 min
    return () => clearInterval(interval);
  }, [isNight]);

  if (!active || !isNight) return null;

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: "40%" }}>
      <div
        className="w-full h-full"
        style={{
          background: `
            linear-gradient(180deg, 
              hsla(140,70%,45%,0.08) 0%, 
              hsla(160,60%,40%,0.05) 20%, 
              hsla(280,50%,50%,0.04) 40%, 
              transparent 100%
            )
          `,
          animation: "auroraWave 8s ease-in-out infinite alternate",
          filter: "blur(20px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(160deg,
              hsla(120,80%,50%,0.06) 0%,
              hsla(170,60%,45%,0.04) 30%,
              hsla(260,50%,55%,0.05) 60%,
              transparent 100%
            )
          `,
          animation: "auroraWave 12s ease-in-out 2s infinite alternate-reverse",
          filter: "blur(30px)",
        }}
      />
      <style>{`
        @keyframes auroraWave {
          0% { opacity: 0.4; transform: scaleY(0.8) translateY(0); }
          50% { opacity: 0.9; transform: scaleY(1.1) translateY(-5%); }
          100% { opacity: 0.5; transform: scaleY(0.9) translateY(3%); }
        }
      `}</style>
    </div>
  );
};

export default AuroraBorealis;
