import React, { useEffect, useState, useMemo } from "react";

// Moon phase images
import moonNew from "@/assets/moon/new_moon.jpg";
import moonWaxCres from "@/assets/moon/waxing_crescent.jpg";
import moonFirstQ from "@/assets/moon/first_quarter.jpg";
import moonWaxGib from "@/assets/moon/waxing_gibbous.jpg";
import moonFull from "@/assets/moon/full_moon.jpg";
import moonWanGib from "@/assets/moon/waning_gibbous.jpg";
import moonThirdQ from "@/assets/moon/third_quarter.jpg";
import moonWanCres from "@/assets/moon/waning_crescent.jpg";

// Foreground silhouette images
import fgDay from "@/assets/sky/foreground_day.png";
import fgDusk from "@/assets/sky/foreground_dusk.png";
import fgNight from "@/assets/sky/foreground_night.png";

const MOON_PHASES = [moonNew, moonWaxCres, moonFirstQ, moonWaxGib, moonFull, moonWanGib, moonThirdQ, moonWanCres];

function getMoonPhase(date: Date): number {
  const knownNewMoon = new Date(2000, 0, 6, 18, 14); // Jan 6, 2000 18:14 UTC
  const synodicMonth = 29.53058867;
  const diffMs = date.getTime() - knownNewMoon.getTime();
  const diffDays = diffMs / 86400000;
  const cyclePos = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  return Math.floor(cyclePos / (synodicMonth / 8)) % 8;
}

// Kanpur, Rooma coordinates
const LAT = 26.46;
const LNG = 80.35;

function getSunAltitudeAndAzimuth(date: Date) {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
  const localHour = date.getHours() + date.getMinutes() / 60;
  const solarNoon = 12 - (LNG - 82.5) / 15;
  const hourAngle = (localHour - solarNoon) * 15;

  const latRad = LAT * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);
  const haRad = hourAngle * (Math.PI / 180);

  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = Math.asin(sinAlt) * (180 / Math.PI);

  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
    (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
  if (hourAngle > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

function getSkyGradient(altitude: number) {
  if (altitude > 20) return { top: "hsl(210,70%,50%)", bottom: "hsl(200,60%,75%)" };
  if (altitude > 10) return { top: "hsl(210,60%,55%)", bottom: "hsl(30,90%,70%)" };
  if (altitude > 0) return { top: "hsl(25,100%,55%)", bottom: "hsl(45,100%,75%)" };
  if (altitude > -6) return { top: "hsl(260,50%,25%)", bottom: "hsl(20,90%,50%)" };
  if (altitude > -12) return { top: "hsl(250,60%,15%)", bottom: "hsl(270,40%,20%)" };
  return { top: "hsl(240,80%,5%)", bottom: "hsl(240,60%,10%)" };
}

const STAR_COUNT = 50;

const SkyBackground: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { altitude, azimuth } = useMemo(() => getSunAltitudeAndAzimuth(now), [now]);
  const sky = useMemo(() => getSkyGradient(altitude), [altitude]);
  const moonPhaseIndex = useMemo(() => getMoonPhase(now), [now]);

  const isSunUp = altitude > -6;
  const isMoonVisible = !isSunUp;
  const celestialX = Math.max(5, Math.min(95, ((azimuth - 60) / 240) * 100));
  const celestialY = Math.max(5, Math.min(80, 80 - altitude * 1.2));
  const isNight = altitude < -6;
  const isDusk = altitude >= -6 && altitude <= 0;
  const starOpacity = isNight ? 1 : isDusk ? 1 - (altitude + 6) / 6 : 0;

  // Foreground opacity logic
  const fgDayOpacity = altitude > 10 ? 1 : altitude > 0 ? altitude / 10 : 0;
  const fgDuskOpacity = altitude > 10 ? 0 : altitude > 0 ? 1 - altitude / 10 : altitude > -6 ? 1 : 0;
  const fgNightOpacity = altitude > -6 ? 0 : 1;

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 60,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 3,
        speed: 2 + Math.random() * 2,
      })),
    []
  );

  const clouds = useMemo(
    () => [
      { id: 1, baseX: 10, y: 20, scale: 1, speed: 0.3 },
      { id: 2, baseX: 45, y: 14, scale: 0.7, speed: 0.2 },
      { id: 3, baseX: 75, y: 28, scale: 0.85, speed: 0.25 },
    ],
    []
  );

  const sunColor = altitude > 15 ? "hsl(45,100%,70%)" : altitude > 0 ? "hsl(35,100%,60%)" : "hsl(20,100%,50%)";
  const sunGlow = altitude > 15 ? "hsla(42,100%,65%,0.4)" : altitude > 0 ? "hsla(30,100%,60%,0.5)" : "hsla(15,100%,50%,0.6)";

  return (
    <div
      className="absolute inset-0 overflow-hidden transition-colors duration-[5000ms]"
      style={{ background: `linear-gradient(to bottom, ${sky.top}, ${sky.bottom})` }}
    >
      {/* Stars */}
      {starOpacity > 0 &&
        stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: starOpacity * 0.7,
              animation: `twinkle ${star.speed}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}

      {/* Sun */}
      {isSunUp && (
        <div
          className="absolute transition-all duration-[30000ms] ease-linear"
          style={{ left: `${celestialX}%`, top: `${celestialY}%`, transform: "translate(-50%, -50%)" }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 100, height: 100, left: -30, top: -30,
              background: `radial-gradient(circle, ${sunGlow} 0%, transparent 70%)`,
            }}
          />
          <div
            className="rounded-full"
            style={{
              width: 40, height: 40,
              background: `radial-gradient(circle at 35% 35%, hsl(45,100%,85%), ${sunColor})`,
              boxShadow: `0 0 30px 10px ${sunGlow}, 0 0 80px 30px ${sunGlow.replace("0.4", "0.15")}`,
            }}
          />
        </div>
      )}

      {/* Moon - realistic phase image */}
      {isMoonVisible && (
        <div
          className="absolute transition-all duration-[30000ms] ease-linear"
          style={{
            left: `${100 - celestialX}%`,
            top: `${Math.max(10, 60 + altitude)}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Glow aura */}
          <div
            className="absolute rounded-full"
            style={{
              width: 80, height: 80,
              left: -16, top: -16,
              background: "radial-gradient(circle, hsla(210,50%,85%,0.25) 0%, hsla(210,50%,80%,0.08) 50%, transparent 70%)",
            }}
          />
          <img
            src={MOON_PHASES[moonPhaseIndex]}
            alt="Moon"
            className="rounded-full"
            style={{
              width: 48, height: 48,
              objectFit: "cover",
              filter: "brightness(1.1) contrast(1.05)",
              boxShadow: "0 0 20px 8px hsla(210,50%,80%,0.3), 0 0 60px 20px hsla(210,50%,80%,0.1)",
            }}
          />
        </div>
      )}

      {/* Clouds */}
      {altitude > -2 &&
        clouds.map((cloud) => (
          <div
            key={cloud.id}
            className="absolute"
            style={{
              left: `${cloud.baseX}%`,
              top: `${cloud.y}%`,
              opacity: Math.min(0.5, (altitude + 2) / 20),
              transform: `scale(${cloud.scale})`,
              animation: `drift ${80 / cloud.speed}s linear infinite`,
            }}
          >
            <svg width="120" height="40" viewBox="0 0 120 40" fill="none">
              <ellipse cx="60" cy="25" rx="50" ry="15" fill="white" opacity="0.8" />
              <ellipse cx="40" cy="18" rx="30" ry="18" fill="white" opacity="0.9" />
              <ellipse cx="75" cy="20" rx="25" ry="14" fill="white" opacity="0.7" />
            </svg>
          </div>
        ))}

      {/* Foreground silhouettes with crossfade */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: "35%", pointerEvents: "none" }}>
        <img
          src={fgDay}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-[5000ms]"
          style={{ opacity: fgDayOpacity }}
        />
        <img
          src={fgDusk}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-[5000ms]"
          style={{ opacity: fgDuskOpacity }}
        />
        <img
          src={fgNight}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-[5000ms]"
          style={{ opacity: fgNightOpacity }}
        />
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(100vw); }
        }
      `}</style>
    </div>
  );
};

export default SkyBackground;
