import React, { useMemo } from "react";
import { useSoulmateClock, formatSoulmateTime } from "@/hooks/useSoulmateClock";

interface SoulmateClockProps {
  userId: string;
  partnerOnline?: boolean;
  partnerName?: string;
}

const SoulmateClock: React.FC<SoulmateClockProps> = ({ userId, partnerOnline, partnerName }) => {
  const totalSeconds = useSoulmateClock(userId, partnerOnline);
  const { days, hours, minutes } = useMemo(() => formatSoulmateTime(totalSeconds), [totalSeconds]);

  // Analog clock: minute hand represents minutes, hour hand represents hours (mod 12)
  const minuteAngle = (minutes / 60) * 360;
  const hourAngle = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        ⏰ Soulmate Clock
      </h3>
      <p className="text-[10px] text-muted-foreground mb-4">
        Time spent together in the chat
      </p>

      <div className="flex items-center gap-5">
        {/* Analog clock face */}
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Clock face */}
            <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
            <circle cx="50" cy="50" r="46" fill="hsl(var(--muted) / 0.3)" />

            {/* Hour markers */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x1 = 50 + 40 * Math.cos(angle);
              const y1 = 50 + 40 * Math.sin(angle);
              const x2 = 50 + 44 * Math.cos(angle);
              const y2 = 50 + 44 * Math.sin(angle);
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeLinecap="round" />
              );
            })}

            {/* Hour hand */}
            <line x1="50" y1="50"
              x2={50 + 22 * Math.sin(hourAngle * Math.PI / 180)}
              y2={50 - 22 * Math.cos(hourAngle * Math.PI / 180)}
              stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round"
            />

            {/* Minute hand */}
            <line x1="50" y1="50"
              x2={50 + 32 * Math.sin(minuteAngle * Math.PI / 180)}
              y2={50 - 32 * Math.cos(minuteAngle * Math.PI / 180)}
              stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round"
            />

            {/* Center dot */}
            <circle cx="50" cy="50" r="3" fill="hsl(var(--primary))" />

            {/* Glow when partner online */}
            {partnerOnline && (
              <circle cx="50" cy="50" r="46" fill="none"
                stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.4"
                className="animate-pulse" />
            )}
          </svg>

          {/* Active indicator */}
          {partnerOnline && (
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-online border-2 border-card animate-pulse" />
          )}
        </div>

        {/* Digital display */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">{days}</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-semibold text-foreground">{hours}</span>
              <span className="text-[10px] text-muted-foreground">hrs</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-semibold text-foreground">{minutes}</span>
              <span className="text-[10px] text-muted-foreground">min</span>
            </div>
          </div>

          {partnerOnline ? (
            <p className="text-[10px] text-primary mt-2 font-medium">
              🔴 Clock is ticking — {partnerName ?? "they"}'re here!
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-2">
              Clock paused — waiting for {partnerName ?? "them"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoulmateClock;
