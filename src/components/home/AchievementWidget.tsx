import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const AchievementWidget: React.FC = () => {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate("/achievements")}
      whileHover={{ y: -2, boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.12)" }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 p-4 glass rounded-2xl transition-colors group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
        <Trophy className="h-5 w-5 text-yellow-500" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold text-foreground">Achievements</p>
        <p className="text-[10px] text-muted-foreground">Unlock milestones together 🏆</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </motion.button>
  );
};

export default AchievementWidget;
