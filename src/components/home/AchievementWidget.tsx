import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";

const AchievementWidget: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/achievements")}
      className="w-full flex items-center gap-3 p-4 glass rounded-2xl hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98] group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
        <Trophy className="h-5 w-5 text-yellow-500" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold text-foreground">Achievements</p>
        <p className="text-[10px] text-muted-foreground">Unlock milestones together 🏆</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
};

export default AchievementWidget;
