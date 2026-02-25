import React from "react";
import { formatDateSeparator } from "@/lib/dateUtils";

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => (
  <div className="flex items-center justify-center my-3">
    <span className="px-3 py-1 rounded-full bg-muted text-[11px] font-medium text-muted-foreground shadow-sm">
      {formatDateSeparator(date)}
    </span>
  </div>
);

export default DateSeparator;
