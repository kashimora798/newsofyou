import React from "react";
import { Play } from "lucide-react";
import { albumLayout, thumbUrlFor } from "@/lib/chatMedia";
import type { Tables } from "@/integrations/supabase/types";

/**
 * MediaGrid — several photos drawn as one cluster, the way a messaging app does
 * it: tight 2 px gaps, square tiles, the outer corners rounded, and a "+3" on
 * the last tile when there are more photos than tiles.
 *
 * Tapping any tile opens the usual lightbox (the viewer itself is unchanged), so
 * behaviour for a single photo is identical whether it came alone or in a grid.
 *
 * The cluster knows each photo's width/height from `chat_attachments`, so it
 * reserves the right space before the bytes arrive — the thread does not jump
 * while four photos load.
 */

interface MediaGridProps {
  messages: Tables<"messages">[];
  /** Details keyed by storage path (from useChatAttachments). */
  detailsFor?: (url?: string | null) => { width?: number | null; height?: number | null; thumb_path?: string | null } | null;
  onOpen: (url: string) => void;
  isOwn: boolean;
  /** Grouped photos are usually from one person; this is the bubble of the run. */
  onOpenMessage?: (message: Tables<"messages">) => void;
}

const GAP = 2; // px between tiles — WhatsApp's seam

const MediaGrid: React.FC<MediaGridProps> = ({ messages, detailsFor, onOpen, isOwn }) => {
  const layout = albumLayout(messages.length);

  return (
    <div
      className={`grid ${layout.gridClass} ${layout.aspectClass} w-full max-w-[340px] overflow-hidden`}
      style={{
        gap: GAP,
        borderRadius: 13,
        // inner corners stay tight; outer ones come from the clip below
        background: "hsl(var(--chat-bg))",
      }}
      data-album={messages.length}
    >
      {layout.tiles.map((tile) => {
        const message = messages[tile.index];
        const url = message.image_url!;
        const details = detailsFor?.(url) ?? null;
        const preview = details?.thumb_path ? thumbUrlFor(url) ?? url : url;
        const ratio =
          details?.width && details?.height ? `${details.width} / ${details.height}` : undefined;

        return (
          <button
            key={message.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(url);
            }}
            className={`group relative h-full w-full overflow-hidden ${tile.className}`}
            style={{ aspectRatio: ratio, borderRadius: 3 }}
            aria-label={`photo ${tile.index + 1} of ${messages.length}`}
          >
            <img
              src={preview}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-[200ms] group-hover:scale-[1.02]"
              style={{ background: "hsl(var(--muted))" }}
              onError={(e) => {
                // A missing preview is not a missing photo.
                const img = e.currentTarget;
                if (img.src !== url) img.src = url;
              }}
            />

            {/* "+3" — the rest are behind this tap */}
            {tile.overlay && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[19px] font-medium text-white/95 backdrop-blur-[1px]">
                {tile.overlay}
              </span>
            )}

            {/* a photo that is really a clip */}
            {(message as { video?: boolean }).video && !tile.overlay && (
              <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white">
                <Play className="h-3 w-3 fill-current" />
              </span>
            )}
          </button>
        );
      })}

      {/* keeps the cluster's own corner radius honest in every browser */}
      <span className="pointer-events-none absolute" aria-hidden />
      <span className="sr-only">{isOwn ? "your photos" : "photos"}</span>
    </div>
  );
};

export default MediaGrid;
