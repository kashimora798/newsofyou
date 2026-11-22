import React from "react";
import { Loader2 } from "lucide-react";

interface AlbumGridProps {
  urls: string[];
  sending?: boolean;
  onOpen: (url: string) => void;
}

/**
 * WhatsApp-style photo stack: 2 → side by side, 3 → one tall + two small,
 * 4 → 2×2, 5+ → 2×2 with a "+N" tile. Square, fixed size, so the chat never
 * jumps while photos load.
 */
const AlbumGrid: React.FC<AlbumGridProps> = ({ urls, sending, onOpen }) => {
  const shown = urls.slice(0, 4);
  const extra = urls.length - 4;
  const three = shown.length === 3;

  return (
    <div
      className="relative grid grid-cols-2 gap-[3px] overflow-hidden rounded-[14px] w-[min(68vw,264px)] aspect-square mb-1.5 bg-muted/40"
      style={{ gridTemplateRows: "1fr 1fr" }}
    >
      {shown.map((url, i) => {
        const isLast = i === shown.length - 1;
        const tall = three && i === 0;
        return (
          <button
            key={url + i}
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(url); }}
            className={`relative block overflow-hidden bg-muted/60 active:opacity-80 ${tall ? "row-span-2" : ""}`}
            style={shown.length === 2 ? { gridRow: "1 / span 2" } : undefined}
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {isLast && extra > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-semibold text-white">
                +{extra + 1}
              </span>
            )}
          </button>
        );
      })}
      {sending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );
};

export default React.memo(AlbumGrid);
