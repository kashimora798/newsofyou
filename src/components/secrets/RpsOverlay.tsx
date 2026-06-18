import React, { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { RPS_EMOJI, RPS_LABEL, type RpsThrow } from "@/lib/secretCommands";

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Picker (sender chooses a throw) ─────────────────────────────────────────

interface RpsPickerProps {
  onPick: (t: RpsThrow) => void;
  onCancel: () => void;
}

export const RpsPickerOverlay: React.FC<RpsPickerProps> = ({ onPick, onCancel }) => {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 45%, hsl(262 60% 50% / 0.18), hsl(0 0% 0% / 0.55) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onCancel}
    >
      <div
        className="rounded-[28px] px-6 py-7 bg-card ring-1 ring-border/50 shadow-2xl animate-apple-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[18px] font-bold text-foreground mb-1">Rock · Paper · Scissors</p>
        <p className="text-center text-[13px] text-muted-foreground mb-5">Pick your throw</p>
        <div className="flex gap-3">
          {(["rock", "paper", "scissors"] as RpsThrow[]).map((t) => (
            <button
              key={t}
              onClick={() => { haptic.impact(); onPick(t); }}
              className="flex flex-col items-center gap-1.5 w-[88px] py-4 rounded-[20px] bg-muted/60 hover:bg-muted active:scale-95 transition-all"
            >
              <span className="text-[40px] leading-none">{RPS_EMOJI[t]}</span>
              <span className="text-[12px] font-semibold text-foreground">{RPS_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Reveal (both screens see the result) ────────────────────────────────────

interface RpsRevealProps {
  mine: RpsThrow;
  opp: RpsThrow;
  outcome: string; // win | lose | draw (from the player's perspective)
  senderName: string;
  isMine: boolean; // true if the local user is the one who played
  onDismiss: () => void;
}

const OUTCOME_TEXT: Record<string, { label: string; color: string }> = {
  win: { label: "You win! 🎉", color: "#34c759" },
  lose: { label: "You lose 😅", color: "#ff453a" },
  draw: { label: "It's a draw 🤝", color: "#ffd60a" },
};

export const RpsRevealOverlay: React.FC<RpsRevealProps> = ({ mine, opp, outcome, senderName, isMine, onDismiss }) => {
  const reduced = prefersReduced();
  const [phase, setPhase] = useState<"shake" | "reveal">(reduced ? "reveal" : "shake");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic.impact();
    if (reduced) return;
    const beats = [350, 700, 1050].map((d) => setTimeout(() => haptic.tap(), d));
    const toReveal = setTimeout(() => { setPhase("reveal"); haptic.success(); }, 1300);
    return () => { beats.forEach(clearTimeout); clearTimeout(toReveal); };
  }, [reduced]);

  useEffect(() => {
    const t = setTimeout(onDismiss, reduced ? 2800 : 4400);
    return () => clearTimeout(t);
  }, [onDismiss, reduced]);

  // Outcome text is written from the player's perspective; flip it for the viewer.
  const viewerOutcome = isMine || outcome === "draw" ? outcome : outcome === "win" ? "lose" : "win";
  const oc = OUTCOME_TEXT[phase === "reveal" ? viewerOutcome : "draw"];

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 42%, hsl(262 60% 50% / 0.2), hsl(0 0% 0% / 0.55) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[13px] text-white/70">{isMine ? "You" : senderName}</span>
          <span className="text-[72px] leading-none" style={{ animation: phase === "shake" && !reduced ? "rps-shake 0.4s ease-in-out infinite" : "rps-reveal 0.4s cubic-bezier(0.34,1.4,0.5,1) both" }}>
            {phase === "shake" ? "✊" : RPS_EMOJI[mine]}
          </span>
        </div>
        <span className="text-[22px] font-bold text-white/50">vs</span>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[13px] text-white/70">{isMine ? "Fate" : "Fate"}</span>
          <span className="text-[72px] leading-none" style={{ animation: phase === "shake" && !reduced ? "rps-shake-rev 0.4s ease-in-out infinite" : "rps-reveal 0.4s cubic-bezier(0.34,1.4,0.5,1) both" }}>
            {phase === "shake" ? "✊" : RPS_EMOJI[opp]}
          </span>
        </div>
      </div>

      {phase === "reveal" && (
        <p
          className="mt-9 text-[32px] font-bold tracking-tight drop-shadow-lg"
          style={{ color: oc.color, animation: reduced ? "none" : "rps-text-in 0.4s ease-out both" }}
        >
          {oc.label}
        </p>
      )}
      {phase === "shake" && (
        <p className="mt-9 text-[20px] font-semibold text-white/80">Rock… Paper… Scissors…</p>
      )}

      <style>{`
        @keyframes rps-shake {
          0%,100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-18px) rotate(-8deg); }
        }
        @keyframes rps-shake-rev {
          0%,100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-18px) rotate(8deg); }
        }
        @keyframes rps-reveal {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes rps-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
