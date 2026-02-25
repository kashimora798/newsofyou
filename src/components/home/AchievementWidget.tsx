import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";

const AchievementWidget: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/achievements")}
      className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Trophy className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-foreground">Achievements</p>
        <p className="text-[10px] text-muted-foreground">Unlock milestones together 🏆</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

export default AchievementWidget;
