import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  onChallenge: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

const GameLobbyCard: React.FC<Props> = ({ icon: Icon, label, description, color, onChallenge, disabled, comingSoon }) => {
  return (
    <motion.button
      whileHover={!disabled ? { y: -3, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      onClick={disabled ? undefined : onChallenge}
      disabled={disabled}
      className={`glass rounded-2xl p-4 text-left w-full transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/30"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-11 w-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">{label}</h4>
            {comingSoon && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                Soon
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </motion.button>
  );
};

export default GameLobbyCard;
