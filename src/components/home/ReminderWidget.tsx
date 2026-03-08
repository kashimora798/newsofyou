import React from "react";
import { useNavigate } from "react-router-dom";
import { useReminders } from "@/hooks/useReminders";
import { Bell, Clock, ChevronRight } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";

const ReminderWidget: React.FC = () => {
  const { reminders } = useReminders();
  const navigate = useNavigate();

  const active = reminders.filter((r) => !r.is_completed);
  const overdue = active.filter((r) => isPast(parseISO(r.remind_at)));
  const upcoming = active.filter((r) => !isPast(parseISO(r.remind_at))).slice(0, 2);

  if (active.length === 0) return null;

  return (
    <button onClick={() => navigate("/reminders")} className="w-full glass rounded-2xl p-4 text-left hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98] group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <Bell className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h3 className="text-xs font-bold text-foreground">Reminders</h3>
        </div>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">{overdue.length} overdue</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      {upcoming.map((r) => (
        <div key={r.id} className="flex items-center gap-2 py-1.5">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground truncate flex-1">{r.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{format(parseISO(r.remind_at), "MMM d")}</span>
        </div>
      ))}
      {active.length > upcoming.length && (
        <p className="text-[10px] text-primary mt-1 font-medium">+{active.length - upcoming.length} more</p>
      )}
    </button>
  );
};

export default ReminderWidget;
