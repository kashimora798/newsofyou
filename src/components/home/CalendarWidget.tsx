import React from "react";
import { useNavigate } from "react-router-dom";
import { useSharedCalendar } from "@/hooks/useSharedCalendar";
import { differenceInDays, parseISO, isFuture } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const CalendarWidget: React.FC = () => {
  const { events } = useSharedCalendar();
  const navigate = useNavigate();

  const upcoming = events.filter((e) => isFuture(parseISO(e.event_date))).slice(0, 3);
  if (upcoming.length === 0) return null;

  return (
    <motion.button
      onClick={() => navigate("/calendar")}
      whileHover={{ y: -2, boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.12)" }}
      whileTap={{ scale: 0.98 }}
      className="w-full glass rounded-2xl p-4 text-left transition-colors group"
    >
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
            <motion.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold text-primary"
            >
              {days}d
            </motion.span>
          </div>
        );
      })}
    </motion.button>
  );
};

export default CalendarWidget;
