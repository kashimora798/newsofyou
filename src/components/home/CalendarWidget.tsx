import React from "react";
import { useNavigate } from "react-router-dom";
import { useSharedCalendar } from "@/hooks/useSharedCalendar";
import { differenceInDays, parseISO, isFuture } from "date-fns";

const CalendarWidget: React.FC = () => {
  const { events } = useSharedCalendar();
  const navigate = useNavigate();

  const upcoming = events.filter((e) => isFuture(parseISO(e.event_date))).slice(0, 3);
  if (upcoming.length === 0) return null;

  return (
    <button onClick={() => navigate("/calendar")} className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:shadow-md transition-all active:scale-[0.98]">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">📅 Upcoming Events</h3>
      {upcoming.map((e) => {
        const days = differenceInDays(parseISO(e.event_date), new Date());
        return (
          <div key={e.id} className="flex items-center gap-2 py-1">
            <span className="text-lg">{e.emoji}</span>
            <span className="text-sm text-foreground truncate flex-1">{e.title}</span>
            <span className="text-xs font-bold text-primary">{days}d</span>
          </div>
        );
      })}
    </button>
  );
};

export default CalendarWidget;
