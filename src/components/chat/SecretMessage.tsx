import React, { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMessageFontStyle } from "@/lib/fontSettings";

interface SecretMessageProps {
  messageId: string;
  content: string;
  revealed: boolean;
  isOwn: boolean;
  fontSizeClass?: string;
  isHandwriting?: boolean;
  customFontSize?: string;
}

const SecretMessage: React.FC<SecretMessageProps> = ({ messageId, content, revealed: initialRevealed, isOwn, fontSizeClass, isHandwriting, customFontSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(initialRevealed);
  const [scratchProgress, setScratchProgress] = useState(0);
  const isDrawing = useRef(false);

  // Own messages are always visible
  const showContent = isOwn || revealed;

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || showContent) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw shimmery overlay
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, "hsl(262, 52%, 56%)");
    gradient.addColorStop(0.5, "hsl(330, 50%, 60%)");
    gradient.addColorStop(1, "hsl(262, 52%, 56%)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Add sparkle dots
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * rect.width, Math.random() * rect.height, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();
    }

    // Text hint
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ Scratch to reveal ✨", rect.width / 2, rect.height / 2);
  }, [showContent]);

  useEffect(() => {
    if (!showContent) {
      // Small delay to ensure container is rendered
      setTimeout(initCanvas, 50);
    }
  }, [initCanvas, showContent]);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Calculate scratch progress
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] === 0) transparent++;
    }
    const progress = transparent / (imageData.data.length / 4);
    setScratchProgress(progress);

    if (progress > 0.5) {
      setRevealed(true);
      // Persist reveal to DB
      supabase.from("messages").update({ revealed: true } as any).eq("id", messageId).then();
    }
  }, [messageId]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDrawing.current = true;
    const pos = getPos(e);
    scratch(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(e);
    scratch(pos.x, pos.y);
  };

  const handleEnd = () => {
    isDrawing.current = false;
  };

  const handwritingStyle = isHandwriting ? getMessageFontStyle(true, customFontSize) : undefined;

  if (showContent) {
    return (
      <div className="relative">
        <div
          style={handwritingStyle}
          className={`whitespace-pre-wrap break-words leading-relaxed animate-fade-in ${fontSizeClass ?? "text-sm"} ${isHandwriting ? "font-handwriting" : ""}`}
        >
          {content}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] opacity-50">🔓 Secret message</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative select-none" style={{ minHeight: 48, minWidth: 160 }}>
      {/* Hidden content underneath */}
      <div
        style={handwritingStyle}
        className={`whitespace-pre-wrap break-words leading-relaxed opacity-0 pointer-events-none ${fontSizeClass ?? "text-sm"} ${isHandwriting ? "font-handwriting" : ""}`}
      >
        {content}
      </div>
      {/* Scratch canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 rounded-lg cursor-pointer touch-none"
        style={{
          animation: "shimmer 2s ease-in-out infinite",
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
      <style>{`
        @keyframes shimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.15); }
        }
      `}</style>
    </div>
  );
};

export default SecretMessage;
