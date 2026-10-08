import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * ImageLightbox — one photo, or a whole album.
 *
 * When a cluster of photos is tapped, the viewer opens on the tapped one and can
 * be stepped through with the arrows or the keyboard (← → Esc), the way a
 * messaging app behaves. A single photo behaves exactly as before.
 */

interface ImageLightboxProps {
  src: string;
  type?: "image" | "video";
  onClose: () => void;
  /** Other photos in the same album, in order. */
  siblings?: string[];
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, type = "image", onClose, siblings }) => {
  const list = siblings && siblings.length > 1 ? siblings : [src];
  const [index, setIndex] = useState(() => {
    const found = list.indexOf(src);
    return found >= 0 ? found : 0;
  });

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = (i + delta + list.length) % list.length;
        return next;
      });
    },
    [list.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (list.length > 1 && e.key === "ArrowRight") step(1);
      if (list.length > 1 && e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length, onClose, step]);

  const current = list[Math.min(index, list.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        aria-label="close"
      >
        <X className="h-6 w-6" />
      </button>

      {list.length > 1 && (
        <>
          <span className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/90 z-10">
            {index + 1} / {list.length}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {type === "video" ? (
        <video
          src={current}
          controls
          autoPlay
          playsInline
          className="max-w-[95vw] max-h-[90vh] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={current}
          alt="Full size"
          className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};

export default ImageLightbox;
