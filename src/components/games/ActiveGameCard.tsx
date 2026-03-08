import React from "react";
import { motion } from "framer-motion";
import { Play, Gamepad2 } from "lucide-react";
import type { GameSession } from "@/hooks/useGameSessions";
import { formatDistanceToNow } from "date-fns";

interface Props {
  game: GameSession;
  partnerName?: string;
  isMyTurn: boolean;
  onResume: () => void;
}

const ActiveGameCard: React.FC<Props> = ({ game, partnerName, isMyTurn, onResume }) => {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onResume}
      className="glass rounded-2xl p-4 w-full text-left"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gamepad2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Tic Tac Toe vs {partnerName ?? "Partner"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isMyTurn ? (
              <span className="text-primary font-bold">Your turn!</span>
            ) : (
              `Waiting for ${partnerName ?? "partner"}…`
            )}
            {" · "}
            {formatDistanceToNow(new Date(game.updated_at), { addSuffix: true })}
          </p>
        </div>
        <motion.div
          animate={isMyTurn ? { scale: [1, 1.2, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Play className={`h-5 w-5 ${isMyTurn ? "text-primary" : "text-muted-foreground"}`} />
        </motion.div>
      </div>
    </motion.button>
  );
};

export default ActiveGameCard;
