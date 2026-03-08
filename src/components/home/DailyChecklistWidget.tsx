import React from "react";
import { useNavigate } from "react-router-dom";
import { useDailyChecklist } from "@/hooks/useDailyChecklist";
import { usePartner } from "@/hooks/usePartner";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck } from "lucide-react";

const DailyChecklistWidget: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const partner = usePartner(user?.id);
  const { myProgress, partnerProgress } = useDailyChecklist(new Date());

  return (
    <button
      onClick={() => navigate("/daily-checklist")}
      className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Checklist</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground">You</span>
            <span className="text-[10px] text-muted-foreground">{myProgress.completed}/{myProgress.total}</span>
          </div>
          <Progress value={myProgress.total > 0 ? (myProgress.completed / myProgress.total) * 100 : 0} className="h-1.5" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground">{partner?.name ?? "Partner"}</span>
            <span className="text-[10px] text-muted-foreground">{partnerProgress.completed}/{partnerProgress.total}</span>
          </div>
          <Progress value={partnerProgress.total > 0 ? (partnerProgress.completed / partnerProgress.total) * 100 : 0} className="h-1.5" />
        </div>
      </div>
    </button>
  );
};

export default DailyChecklistWidget;
