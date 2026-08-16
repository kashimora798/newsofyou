/**
 * VoiceNoteBubble
 *
 * Custom audio player for voice_note messages.
 * Shows: play/pause button, animated waveform, elapsed/total time.
 * Does NOT use native <audio> controls.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

const BARS = 24;

interface VoiceNoteBubbleProps {
  src: string;
  mimeType?: string;
  /** Duration in seconds captured at record time (fallback) */
  recordedDuration?: number;
  isOwn: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const VoiceNoteBubble: React.FC<VoiceNoteBubbleProps> = ({
  src,
  mimeType,
  recordedDuration,
  isOwn,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(recordedDuration ?? 0);
  const [progress, setProgress] = useState(0); // 0–1
  const rafRef = useRef<number | null>(null);

  // Build audio element once
  useEffect(() => {
    const audio = new Audio(src);
    if (mimeType) audio.setAttribute("type", mimeType);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    });
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setElapsed(0);
      setProgress(0);
    });
    audio.load();

    return () => {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, mimeType]);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ct = audio.currentTime;
    const dur = isFinite(audio.duration) ? audio.duration : duration;
    setElapsed(ct);
    setProgress(dur > 0 ? ct / dur : 0);
    if (!audio.paused) rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => {
        setPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [tick]);

  // Scrub on bar click
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = isFinite(audio.duration) ? audio.duration : duration;
    audio.currentTime = ratio * dur;
    setProgress(ratio);
    setElapsed(ratio * dur);
  };

  const accent = isOwn ? "bg-white/70" : "bg-primary/70";
  const accentFill = isOwn ? "bg-white" : "bg-primary";
  const textColor = isOwn ? "text-white/70" : "text-muted-foreground";
  const btnBg = isOwn
    ? "bg-white/20 hover:bg-white/30 text-white"
    : "bg-primary/10 hover:bg-primary/20 text-primary";

  return (
    <div className="flex items-center gap-2.5 min-w-[180px] max-w-[240px]">
      {/* Play / Pause */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${btnBg}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </motion.button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Waveform scrubber */}
        <div
          className="flex items-center gap-[2px] h-6 cursor-pointer"
          onClick={handleScrub}
        >
          {Array.from({ length: BARS }).map((_, i) => {
            const barProgress = i / BARS;
            const filled = barProgress <= progress;
            // Vary bar heights for a natural waveform look
            const heights = [0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.4,
                             0.8, 1, 0.6, 0.9, 0.5, 0.7, 1, 0.8, 0.4, 0.6,
                             0.9, 0.7, 0.5, 0.8];
            const h = (heights[i % heights.length] ?? 0.5) * 100;
            return (
              <motion.div
                key={i}
                className={`w-[3px] rounded-full transition-colors duration-100 ${
                  filled ? accentFill : accent
                }`}
                animate={playing && filled ? { scaleY: [0.8, 1.1, 0.8] } : {}}
                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.02 }}
                style={{ height: `${h}%`, originY: "center" }}
              />
            );
          })}
        </div>

        {/* Time */}
        <div className={`flex justify-between text-[10px] font-mono tabular-nums ${textColor}`}>
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceNoteBubble;
