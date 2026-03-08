import React from "react";
import { useNavigate } from "react-router-dom";
import { useSharedCalendar } from "@/hooks/useSharedCalendar";
import { differenceInDays, parseISO, isFuture } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";

const CalendarWidget: React.FC = () => {
  const { events } = useSharedCalendar();
  const navigate = useNavigate();

  const upcoming = events.filter((e) => isFuture(parseISO(e.event_date))).slice(0, 3);
  if (upcoming.length === 0) return null;

  return (
    <button onClick={() => navigate("/calendar")} className="w-full glass rounded-2xl p-4 text-left hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98] group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <h3 className="text-xs font-bold text-foreground">Upcoming Events</h3>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      {upcoming.map((e) => {
        const days = differenceInDays(parseISO(e.event_date), new Date());
        return (
          <div key={e.id} className="flex items-center gap-2 py-1.5">
            <span className="text-base">{e.emoji}</span>
            <span className="text-sm text-foreground truncate flex-1">{e.title}</span>
            <span className="text-xs font-bold text-primary">{days}d</span>
          </div>
        );
      })}
    </button>
  );
};

export default CalendarWidget;
