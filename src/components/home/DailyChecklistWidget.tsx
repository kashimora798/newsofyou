import React from "react";
import { useNavigate } from "react-router-dom";
import { useDailyChecklist } from "@/hooks/useDailyChecklist";
import { usePartner } from "@/hooks/usePartner";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const DailyChecklistWidget: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const partner = usePartner(user?.id);
  const { myProgress, partnerProgress } = useDailyChecklist(new Date());

  const myPct = myProgress.total > 0 ? Math.round((myProgress.completed / myProgress.total) * 100) : 0;
  const partnerPct = partnerProgress.total > 0 ? Math.round((partnerProgress.completed / partnerProgress.total) * 100) : 0;

  return (
    <motion.button
      onClick={() => navigate("/daily-checklist")}
      whileHover={{ y: -2, boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.12)" }}
      whileTap={{ scale: 0.98 }}
      className="w-full glass rounded-2xl p-4 text-left transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-xs font-bold text-foreground">Daily Checklist</h3>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-foreground">You</span>
            <span className="text-[10px] text-muted-foreground font-medium">{myPct}%</span>
          </div>
          <Progress value={myPct} className="h-1.5" />
          <span className="text-[9px] text-muted-foreground mt-1 block">{myProgress.completed}/{myProgress.total} done</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-foreground">{partner?.name?.split(" ")[0] ?? "Partner"}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{partnerPct}%</span>
          </div>
          <Progress value={partnerPct} className="h-1.5" />
          <span className="text-[9px] text-muted-foreground mt-1 block">{partnerProgress.completed}/{partnerProgress.total} done</span>
        </div>
      </div>
    </motion.button>
  );
};

export default DailyChecklistWidget;
