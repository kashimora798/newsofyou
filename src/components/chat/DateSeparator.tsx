import React from "react";
import { formatDateSeparator } from "@/lib/dateUtils";

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => (
  <div className="flex items-center justify-center my-4 animate-date-chip">
    <span className="px-4 py-1 rounded-full glass-subtle text-[11px] font-semibold text-muted-foreground tracking-wide">
      {formatDateSeparator(date)}
    </span>
  </div>
);

export default DateSeparator;
