import React from "react";
import { useNavigate } from "react-router-dom";
import { useReminders } from "@/hooks/useReminders";
import { Bell, Clock } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";

const ReminderWidget: React.FC = () => {
  const { reminders } = useReminders();
  const navigate = useNavigate();

  const active = reminders.filter((r) => !r.is_completed);
  const overdue = active.filter((r) => isPast(parseISO(r.remind_at)));
  const upcoming = active.filter((r) => !isPast(parseISO(r.remind_at))).slice(0, 2);

  if (active.length === 0) return null;

  return (
    <button onClick={() => navigate("/reminders")} className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:shadow-md transition-all active:scale-[0.98]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> Reminders
        </h3>
        {overdue.length > 0 && (
          <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">{overdue.length} overdue</span>
        )}
      </div>
      {upcoming.map((r) => (
        <div key={r.id} className="flex items-center gap-2 py-1">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground truncate flex-1">{r.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{format(parseISO(r.remind_at), "MMM d")}</span>
        </div>
      ))}
      {active.length > upcoming.length && (
        <p className="text-[10px] text-primary mt-1">+{active.length - upcoming.length} more</p>
      )}
    </button>
  );
};

export default ReminderWidget;
