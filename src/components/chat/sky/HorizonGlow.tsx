import React from "react";

const HorizonGlow: React.FC<{ altitude: number }> = ({ altitude }) => {
  let gradient = "transparent";
  let glowOpacity = 0;

  if (altitude > 0 && altitude <= 15) {
    // Sunrise/sunset warm glow
    glowOpacity = 1 - altitude / 15;
    gradient = `linear-gradient(to top, hsla(30,100%,55%,${glowOpacity * 0.35}) 0%, hsla(40,100%,65%,${glowOpacity * 0.15}) 40%, transparent 100%)`;
  } else if (altitude > -6 && altitude <= 0) {
    // Twilight deep glow
    const t = (altitude + 6) / 6;
    gradient = `linear-gradient(to top, hsla(20,100%,40%,${0.3 * t}) 0%, hsla(280,60%,30%,${0.15 * t}) 50%, transparent 100%)`;
    glowOpacity = 1;
  } else if (altitude <= -6) {
    // Moonlit cool glow
    gradient = `linear-gradient(to top, hsla(220,40%,25%,0.15) 0%, hsla(230,30%,15%,0.05) 40%, transparent 100%)`;
    glowOpacity = 1;
  }

  if (altitude > 15 && glowOpacity === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 w-full pointer-events-none"
      style={{
        height: "35%",
        background: gradient,
        transition: "background 5s ease",
      }}
    />
  );
};

export default HorizonGlow;
