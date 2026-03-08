import React from "react";
import { motion } from "framer-motion";
import { Check, X, Gamepad2, Clock } from "lucide-react";
import type { GameSession } from "@/hooks/useGameSessions";
import { formatDistanceToNow } from "date-fns";

interface Props {
  invite: GameSession;
  partnerName?: string;
  isOutgoing?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}

const gameLabels: Record<string, string> = {
  tic_tac_toe: "Tic Tac Toe",
};

const GameInvite: React.FC<Props> = ({ invite, partnerName, isOutgoing, onAccept, onDecline }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 flex items-center gap-3"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
      >
        <Gamepad2 className="h-5 w-5 text-primary" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {isOutgoing ? `Waiting for ${partnerName ?? "partner"}…` : `${partnerName ?? "Partner"} challenges you!`}
        </p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3" />
          {gameLabels[invite.game_type] ?? invite.game_type} · {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
        </p>
      </div>
      {!isOutgoing && (
        <div className="flex gap-2 shrink-0">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onAccept}
            className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Check className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onDecline}
            className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default GameInvite;
