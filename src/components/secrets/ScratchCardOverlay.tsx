import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface ScratchCardOverlayProps {
  quote: string;
  onDismiss: () => void;
}

const W = 300;
const H = 200;

const ScratchCardOverlay: React.FC<ScratchCardOverlayProps> = ({ quote, onDismiss }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const lastBuzz = useRef(0);

  // Paint the scratch-off foil layer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#b59be0");
    grad.addColorStop(0.5, "#8d6fd1");
    grad.addColorStop(1, "#6f4fc7");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 18px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ Scratch to reveal ✨", W / 2, H / 2);
    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("drag your finger across", W / 2, H / 2 + 24);
  }, []);

  const pointFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const scratchAt = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    const now = Date.now();
    if (now - lastBuzz.current > 60) { haptic.tap(); lastBuzz.current = now; }
  }, []);

  const checkRevealed = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { data } = ctx.getImageData(0, 0, W, H);
    let clear = 0;
    for (let i = 3; i < data.length; i += 40) if (data[i] === 0) clear++;
    const ratio = clear / (data.length / 40);
    if (ratio > 0.5 && !revealed) {
      setRevealed(true);
      haptic.success();
    }
  }, [revealed]);

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true;
    const p = pointFromEvent(e);
    scratchAt(p.x, p.y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pointFromEvent(e);
    scratchAt(p.x, p.y);
  };
  const onPointerUp = () => {
    drawing.current = false;
    checkRevealed();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center animate-apple-backdrop"
      style={{
        background: "radial-gradient(circle at 50% 45%, hsl(262 60% 50% / 0.18), hsl(0 0% 0% / 0.6) 72%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onDismiss}
    >
      <div
        className="relative rounded-[24px] overflow-hidden bg-card ring-1 ring-border/50 shadow-2xl animate-apple-modal"
        style={{ width: W, height: H }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden prize underneath */}
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center bg-gradient-to-br from-primary/10 to-accent/30">
          <p className="text-[18px] font-bold text-foreground leading-snug">{quote}</p>
        </div>
        {/* Scratch foil */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
          style={{ opacity: revealed ? 0 : 1, transition: "opacity 0.5s ease" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      <button
        onClick={onDismiss}
        className="mt-6 h-10 w-10 flex items-center justify-center rounded-full bg-white/15 text-white tappable"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ScratchCardOverlay;
