import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Reel with six spokes. */
const Reel: React.FC<{ cx: number; cy: number; tapeR: number; spinning: boolean }> = ({ cx, cy, tapeR, spinning }) => (
  <g>
    <circle cx={cx} cy={cy} r={tapeR} fill="#4a3426" opacity=".9" />
    <g className={`journal-reel ${spinning ? "journal-reel-spin" : ""}`}>
      <circle cx={cx} cy={cy} r="10" fill="#fdf8ee" stroke="#3a2a20" strokeWidth="1.4" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 1.2} y={cy - 9} width="2.4" height="5.5" rx="1" fill="#3a2a20" transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r="2.6" fill="#3a2a20" />
    </g>
  </g>
);

interface Props {
  src: string;
  mime?: string;
  /** seconds captured at record time (fallback until metadata loads) */
  duration?: number;
  label: string;
  /** cassette | recorder — picked at random by the caller so pages don't repeat */
  variant: "cassette" | "recorder";
  color: string;
  mine?: boolean;
  time?: string;
}

/**
 * A little tape-themed audio player: a cassette or a handheld recorder whose
 * reels spin and whose tape moves from one reel to the other while playing.
 */
const TapeRecorder: React.FC<Props> = ({ src, mime, duration = 0, label, variant, color, mine, time }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    if (mime) a.setAttribute("type", mime);
    a.src = src;
    audioRef.current = a;
    const onMeta = () => isFinite(a.duration) && a.duration > 0 && setTotal(a.duration);
    const onTime = () => {
      setElapsed(a.currentTime);
      if (a.duration && isFinite(a.duration)) setProgress(a.currentTime / a.duration);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); setElapsed(0); };
    const onErr = () => { setFailed(true); setPlaying(false); };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      audioRef.current = null;
    };
  }, [src, mime]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || failed) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      // only one tape plays at a time
      document.querySelectorAll("audio").forEach((el) => el.pause());
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setFailed(true);
      }
    }
  };

  const leftR = 12 + (1 - progress) * 9;
  const rightR = 12 + progress * 9;

  return (
    <div className="relative select-none" style={{ width: 250 }}>
      {variant === "cassette" ? (
        <svg viewBox="0 0 250 122" width="250" height="122" aria-label={`Cassette: ${label}`} className="drop-shadow-[0_3px_3px_rgba(60,40,20,.25)]">
          <rect x="3" y="3" width="244" height="116" rx="12" fill={color} stroke="#3a2a20" strokeWidth="2" />
          <rect x="16" y="12" width="218" height="52" rx="6" fill="#fffaf0" stroke="#3a2a20" strokeWidth="1.400" />
          <path d="M26 30h120M26 40h96" stroke="#d9cdb5" strokeWidth="1" />
          <text x="26" y="28" fontFamily="Caveat, cursive" fontSize="17" fontWeight="700" fill="#3a2a20">
            {label.length > 22 ? `${label.slice(0, 21)}…` : label}
          </text>
          <text x="26" y="56" fontFamily="'Special Elite', monospace" fontSize="9" fill="#8a7a62">
            {mine ? "SIDE A · from me" : "SIDE A · from love"} {time ? `· ${time}` : ""}
          </text>
          <rect x="52" y="72" width="146" height="36" rx="18" fill="#fffaf0" stroke="#3a2a20" strokeWidth="1.400" />
          <Reel cx={82} cy={90} tapeR={leftR} spinning={playing} />
          <Reel cx={168} cy={90} tapeR={rightR} spinning={playing} />
          <path d="M96 100h58" stroke="#4a3426" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="22" cy="106" r="3.5" fill="#fffaf0" stroke="#3a2a20" /><circle cx="228" cy="106" r="3.5" fill="#fffaf0" stroke="#3a2a20" />
        </svg>
      ) : (
        <svg viewBox="0 0 250 122" width="250" height="122" aria-label={`Tape recorder: ${label}`} className="drop-shadow-[0_3px_3px_rgba(60,40,20,.25)]">
          <rect x="4" y="6" width="242" height="112" rx="14" fill="#6b4f3a" stroke="#2f2118" strokeWidth="2" />
          <rect x="10" y="12" width="230" height="100" rx="10" fill={color} stroke="#2f2118" strokeWidth="1.400" />
          {/* speaker grille */}
          <g stroke="#2f2118" strokeWidth="1.800" strokeLinecap="round" opacity=".7">
            {[0, 1, 2, 3, 4, 5].map((i) => (<path key={i} d={`M158 ${24 + i * 7}h66`} />))}
          </g>
          {/* tape window */}
          <rect x="20" y="22" width="122" height="52" rx="8" fill="#fffaf0" stroke="#2f2118" strokeWidth="1.400" />
          <Reel cx={50} cy={48} tapeR={leftR} spinning={playing} />
          <Reel cx={112} cy={48} tapeR={rightR} spinning={playing} />
          {/* VU meter */}
          <rect x="158" y="70" width="66" height="30" rx="5" fill="#fff4d6" stroke="#2f2118" strokeWidth="1.200" />
          <path d="M166 92a28 28 0 0150 0" stroke="#b9a678" strokeWidth="1" />
          <line x1="191" y1="96" x2="191" y2="76" stroke="#d1392f" strokeWidth="1.600" strokeLinecap="round"
            style={{ transformOrigin: "191px 96px", transform: `rotate(${playing ? -30 + (Math.sin(elapsed * 9) + 1) * 28 : -38}deg)`, transition: "transform .12s linear" }} />
          {/* rec light + label */}
          <circle cx="30" cy="90" r="4.500" fill={playing ? "#ff3b30" : "#8a3a35"} className={playing ? "journal-blink" : ""} />
          <text x="40" y="94" fontFamily="'Special Elite', monospace" fontSize="9" fill="#2f2118">
            {label.length > 20 ? `${label.slice(0, 19)}…` : label}
          </text>
          <rect x="20" y="100" width="122" height="5" rx="2.500" fill="#2f2118" opacity=".25" />
        </svg>
      )}

      <div className="mt-1.5 flex items-center gap-2" style={{ fontFamily: "'Special Elite', monospace" }}>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#3a2a20] bg-[#fffaf0] text-[#3a2a20] shadow-[2px_2px_0_#3a2a20] transition-transform active:translate-x-px active:translate-y-px active:shadow-none"
        >
          {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#3a2a20]/60 bg-[#fffaf0]">
          <div className="h-full rounded-full" style={{ width: `${Math.max(progress * 100, playing ? 2 : 0)}%`, background: color, transition: "width .25s linear" }} />
        </div>
        <span className="w-[58px] text-right text-[10px] text-[#6a5a46]">
          {failed ? "no audio" : `${fmt(elapsed)}/${fmt(total)}`}
        </span>
      </div>
    </div>
  );
};

export default TapeRecorder;
