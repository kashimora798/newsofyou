import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  type?: "image" | "video";
  /** every photo in the chat — enables swipe / arrow-key browsing */
  images?: string[];
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, type = "image", images, onClose }) => {
  const gallery = type === "image" && images && images.length > 1 ? images : null;
  const [index, setIndex] = useState(() => Math.max(0, gallery ? gallery.indexOf(src) : 0));
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (!gallery) return;
      setIndex((i) => Math.min(gallery.length - 1, Math.max(0, i + delta)));
    },
    [gallery]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const current = gallery ? gallery[index] : src;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center animate-fade-in select-none"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {gallery && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-white/80 tabular-nums">
          {index + 1} / {gallery.length}
        </div>
      )}

      {gallery && index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          className="hidden md:flex absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {gallery && index < gallery.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); go(1); }}
          className="hidden md:flex absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {type === "video" ? (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="max-w-[95vw] max-h-[90vh] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          key={current}
          src={current}
          alt="Full size"
          draggable={false}
          className="max-w-[96vw] max-h-[90vh] object-contain rounded-lg animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};

export default ImageLightbox;
