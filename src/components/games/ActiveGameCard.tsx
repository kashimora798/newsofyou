import React, { useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Play, Gamepad2, Zap, Trash2 } from "lucide-react";
import type { GameSession } from "@/hooks/useGameSessions";
import { formatDistanceToNow } from "date-fns";
import { GAME_LABELS, LIVE_GAME_TYPES } from "@/lib/gameCatalog";
import { haptic } from "@/lib/haptics";

interface Props {
  game: GameSession;
  partnerName?: string;
  isMyTurn: boolean;
  isStale?: boolean;
  onResume: () => void;
  onDelete: () => void;
}

const REVEAL = 84;

const ActiveGameCard: React.FC<Props> = ({ game, partnerName, isMyTurn, isStale, onResume, onDelete }) => {
  const isLive = LIVE_GAME_TYPES.has(game.game_type);
  const label = GAME_LABELS[game.game_type] ?? "Game";
  const controls = useAnimationControls();
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);

  return (
    <div className="relative rounded-[18px] overflow-hidden">
      {/* Delete action behind */}
      <button
        onClick={() => { haptic.warn(); onDelete(); }}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-[hsl(5_78%_53%)] text-white"
        style={{ width: REVEAL }}
        aria-label="Delete game"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {/* Foreground card (swipeable) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={0.06}
        animate={controls}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -REVEAL / 2) { controls.start({ x: -REVEAL }); setOpen(true); haptic.tap(); }
          else { controls.start({ x: 0 }); setOpen(false); }
          setTimeout(() => { dragged.current = false; }, 0);
        }}
        onClick={() => {
          if (dragged.current) return;
          if (open) { controls.start({ x: 0 }); setOpen(false); return; }
          onResume();
        }}
        className="relative bg-card ring-1 ring-border/50 p-4 tappable cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[14px] bg-primary/10 flex items-center justify-center shrink-0">
            {isLive ? <Zap className="h-5 w-5 text-primary" /> : <Gamepad2 className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate">
              {label} <span className="text-muted-foreground font-normal">· {partnerName ?? "Partner"}</span>
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isStale ? (
                <span className="text-muted-foreground">Abandoned · swipe to remove</span>
              ) : isLive ? (
                <span className="text-primary font-semibold">Live · tap to join</span>
              ) : isMyTurn ? (
                <span className="text-primary font-semibold">Your turn</span>
              ) : (
                `Waiting for ${partnerName ?? "partner"}…`
              )}
              {" · "}
              {formatDistanceToNow(new Date(game.updated_at), { addSuffix: true })}
            </p>
          </div>
          {!isStale && (
            <motion.div animate={isMyTurn || isLive ? { scale: [1, 1.18, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Play className={`h-5 w-5 ${isMyTurn || isLive ? "text-primary" : "text-muted-foreground"}`} />
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ActiveGameCard;
