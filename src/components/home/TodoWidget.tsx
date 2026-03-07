import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, ChevronRight } from "lucide-react";

const TodoWidget: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { count } = await supabase
        .from("todo_items" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_completed", false);
      setPendingCount(count ?? 0);
    };
    fetch();
  }, [user]);

  return (
    <button
      onClick={() => navigate("/todos")}
      className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <CheckSquare className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <h3 className="text-sm font-semibold text-foreground">To-Do Lists</h3>
        <p className="text-xs text-muted-foreground">
          {pendingCount > 0 ? `${pendingCount} pending task${pendingCount > 1 ? "s" : ""}` : "All caught up! ✨"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

export default TodoWidget;
