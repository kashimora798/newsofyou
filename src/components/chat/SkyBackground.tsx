import React, { useEffect, useState, useMemo } from "react";

// Moon phase images
import moonNew from "@/assets/moon/new_moon.png";
import moonWaxCres from "@/assets/moon/waxing_crescent.png";
import moonFirstQ from "@/assets/moon/first_quarter.png";
import moonWaxGib from "@/assets/moon/waxing_gibbous.png";
import moonFull from "@/assets/moon/full_moon.png";
import moonWanGib from "@/assets/moon/waning_gibbous.png";
import moonThirdQ from "@/assets/moon/third_quarter.png";
import moonWanCres from "@/assets/moon/waning_crescent.png";

// Foreground silhouette images
import fgDay from "@/assets/sky/foreground_day.png";
import fgDusk from "@/assets/sky/foreground_dusk.png";
import fgNight from "@/assets/sky/foreground_night.png";

// Realistic cloud images
import cloud1 from "@/assets/sky/cloud1.png";
import cloud2 from "@/assets/sky/cloud2.png";

// Sky enhancement components
import ShootingStars from "./sky/ShootingStars";
import Fireflies from "./sky/Fireflies";
import HorizonGlow from "./sky/HorizonGlow";
import BirdsFlock from "./sky/BirdsFlock";
import AirplaneTrail from "./sky/AirplaneTrail";
import AuroraBorealis from "./sky/AuroraBorealis";
import HeartCloud from "./sky/HeartCloud";
import SkyLanterns from "./sky/SkyLanterns";
import RainbowArc from "./sky/RainbowArc";
import SeasonalParticles from "./sky/SeasonalParticles";

const MOON_PHASES = [moonNew, moonWaxCres, moonFirstQ, moonWaxGib, moonFull, moonWanGib, moonThirdQ, moonWanCres];

function getMoonPhase(date: Date): number {
  const knownNewMoon = new Date(2000, 0, 6, 18, 14);
  const synodicMonth = 29.53058867;
  const diffMs = date.getTime() - knownNewMoon.getTime();
  const diffDays = diffMs / 86400000;
  const cyclePos = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  return Math.floor(cyclePos / (synodicMonth / 8)) % 8;
}

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

function getSunStyle(altitude: number) {
  if (altitude > 30) {
    return { size: 35, color: "hsl(45,100%,88%)", glow: "hsla(45,100%,75%,0.35)", glowSize: 80 };
  }
  if (altitude > 10) {
    return { size: 40, color: "hsl(40,100%,65%)", glow: "hsla(38,100%,60%,0.45)", glowSize: 100 };
  }
  if (altitude > 0) {
    return { size: 48, color: "hsl(25,100%,55%)", glow: "hsla(20,100%,50%,0.55)", glowSize: 130 };
  }
  return { size: 50, color: "hsl(15,100%,50%)", glow: "hsla(10,100%,45%,0.6)", glowSize: 140 };
}

// Cloud tinting based on sun altitude
function getCloudFilter(altitude: number): string {
  if (altitude > 20) return "brightness(1.05)"; // bright white day
  if (altitude > 5) return "brightness(1) sepia(0.15) saturate(1.3)"; // warm golden
  if (altitude > 0) return "brightness(0.9) sepia(0.4) saturate(1.6) hue-rotate(-10deg)"; // orange sunset
  if (altitude > -6) return "brightness(0.6) sepia(0.3) saturate(0.8) hue-rotate(10deg)"; // dusky purple
  return "brightness(0.3) saturate(0.3)"; // dark night
}

const STAR_COUNT = 50;

const CLOUD_INSTANCES = [
  { id: 1, img: "cloud1", x: -10, y: 8, scale: 0.5, speed: 120, baseOpacity: 0.25 },
  { id: 2, img: "cloud2", x: 30, y: 15, scale: 0.45, speed: 130, baseOpacity: 0.2 },
  { id: 3, img: "cloud1", x: 55, y: 10, scale: 0.8, speed: 80, baseOpacity: 0.45 },
  { id: 4, img: "cloud2", x: 5, y: 22, scale: 0.7, speed: 90, baseOpacity: 0.4 },
  { id: 5, img: "cloud1", x: 75, y: 18, scale: 0.6, speed: 100, baseOpacity: 0.3 },
];

const CLOUD_IMAGES = { cloud1, cloud2 };

interface SkyBackgroundProps {
  userId?: string;
  partnerUserId?: string;
  currentUserName?: string;
  onHeartCloudCaught?: () => void;
}

const SkyBackground: React.FC<SkyBackgroundProps> = ({
  userId,
  partnerUserId,
  currentUserName = "",
  onHeartCloudCaught,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { altitude, azimuth } = useMemo(() => getSunAltitudeAndAzimuth(now), [now]);
  const sky = useMemo(() => getSkyGradient(altitude), [altitude]);
  const moonPhaseIndex = useMemo(() => getMoonPhase(now), [now]);
  const sunStyle = useMemo(() => getSunStyle(altitude), [altitude]);

  const isSunUp = altitude > -6;
  const isMoonVisible = !isSunUp;
  const celestialX = Math.max(5, Math.min(95, ((azimuth - 60) / 240) * 100));
  const celestialY = Math.max(5, Math.min(80, 80 - altitude * 1.2));
  const isNight = altitude < -6;
  const isDusk = altitude >= -6 && altitude <= 0;
  const starOpacity = isNight ? 1 : isDusk ? 1 - (altitude + 6) / 6 : 0;
  const cloudOpacity = altitude > 0 ? 1 : altitude > -6 ? (altitude + 6) / 6 : 0;
  const cloudFilter = useMemo(() => getCloudFilter(altitude), [altitude]);
  const fireflyOpacity = isNight ? 0.9 : isDusk ? 0.5 : 0;

  // Foreground opacity logic
  const fgDayOpacity = altitude > 10 ? 1 : altitude > 0 ? altitude / 10 : 0;
  const fgDuskOpacity = altitude > 10 ? 0 : altitude > 0 ? 1 - altitude / 10 : altitude > -6 ? 1 : 0;
  const fgNightOpacity = altitude > -6 ? 0 : 1;

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 55,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 3,
        speed: 2 + Math.random() * 2,
      })),
    []
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden transition-colors duration-[5000ms]"
      style={{
        background: `linear-gradient(to bottom, ${sky.top}, ${sky.bottom})`,
        animation: "skyShimmer 20s ease-in-out infinite",
      }}
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
          {/* Outer glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: sunStyle.glowSize,
              height: sunStyle.glowSize,
              left: -(sunStyle.glowSize - sunStyle.size) / 2,
              top: -(sunStyle.glowSize - sunStyle.size) / 2,
              background: `radial-gradient(circle, ${sunStyle.glow} 0%, transparent 70%)`,
            }}
          />
          {/* Sun disc */}
          <div
            className="rounded-full"
            style={{
              width: sunStyle.size,
              height: sunStyle.size,
              background: `radial-gradient(circle at 35% 35%, hsl(45,100%,92%), ${sunStyle.color})`,
              boxShadow: `0 0 ${sunStyle.size}px ${sunStyle.size / 3}px ${sunStyle.glow}, 0 0 ${sunStyle.size * 2}px ${sunStyle.size}px ${sunStyle.glow.replace(/[\d.]+\)$/, "0.12)")}`,
            }}
          />
        </div>
      )}

      {/* Moon */}
      {isMoonVisible && (
        <div
          className="absolute transition-all duration-[30000ms] ease-linear"
          style={{
            left: `${100 - celestialX}%`,
            top: `${Math.max(10, 60 + altitude)}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 80, height: 80, left: -16, top: -16,
              background: "radial-gradient(circle, hsla(210,50%,85%,0.25) 0%, hsla(210,50%,80%,0.08) 50%, transparent 70%)",
            }}
          />
          <img
            src={MOON_PHASES[moonPhaseIndex]}
            alt="Moon"
            className=""
            style={{
              width: 48, height: 48, objectFit: "cover",
              borderRadius: "50%",
              border: "none",
              filter: "brightness(1.1) contrast(1.05)",
              boxShadow: "0 0 20px 8px hsla(210,50%,80%,0.3), 0 0 60px 20px hsla(210,50%,80%,0.1)",
            }}
          />
        </div>
      )}

      {/* Realistic cloud layers with time-based tinting */}
      {cloudOpacity > 0 &&
        CLOUD_INSTANCES.map((c) => (
          <img
            key={c.id}
            src={CLOUD_IMAGES[c.img as keyof typeof CLOUD_IMAGES]}
            alt=""
            className="absolute pointer-events-none transition-[filter] duration-[5000ms]"
            style={{
              top: `${c.y}%`,
              width: `${c.scale * 280}px`,
              opacity: c.baseOpacity * cloudOpacity,
              animation: `cloudDrift ${c.speed}s linear infinite`,
              animationDelay: `${-(c.x / 100) * c.speed}s`,
              filter: cloudFilter,
            }}
          />
        ))}

      {/* Horizon glow */}
      <HorizonGlow altitude={altitude} />

      {/* Shooting stars at night */}
      <ShootingStars opacity={starOpacity} />

      {/* Fireflies at dusk/night */}
      <Fireflies opacity={fireflyOpacity} />

      {/* Birds at dawn/dusk */}
      <BirdsFlock altitude={altitude} />

      {/* Airplane contrails during day */}
      <AirplaneTrail isDaytime={altitude > 5} />

      {/* Rare aurora at night */}
      <AuroraBorealis isNight={isNight} />

      {/* Heart-shaped cloud (daytime) */}
      <HeartCloud isDaytime={altitude > 5} onCaught={onHeartCloudCaught} />

      {/* Rainbow arc (daytime) */}
      <RainbowArc isDaytime={altitude > 5} />

      {/* Seasonal falling particles */}
      <SeasonalParticles altitude={altitude} />

      {/* Sky lanterns */}
      {userId && (
        <SkyLanterns
          userId={userId}
          partnerUserId={partnerUserId}
          currentUserName={currentUserName}
        />
      )}

      {/* Foreground silhouettes with crossfade */}
      <img
        src={fgDay}
        alt=""
        className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
        style={{ opacity: fgDayOpacity }}
      />
      <img
        src={fgDusk}
        alt=""
        className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
        style={{ opacity: fgDuskOpacity }}
      />
      <img
        src={fgNight}
        alt=""
        className="absolute bottom-0 left-0 w-full h-auto pointer-events-none transition-opacity duration-[5000ms]"
        style={{ opacity: fgNightOpacity }}
      />

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes cloudDrift {
          0% { left: -20%; }
          100% { left: 110%; }
        }
        @keyframes skyShimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.02); }
        }
      `}</style>
    </div>
  );
};

export default SkyBackground;
