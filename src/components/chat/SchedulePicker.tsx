import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SchedulePickerProps {
  onSchedule: (date: Date) => void;
  onClose: () => void;
}

const SchedulePicker: React.FC<SchedulePickerProps> = ({ onSchedule, onClose }) => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hours, setHours] = useState("09");
  const [minutes, setMinutes] = useState("00");

  const handleSchedule = () => {
    if (!date) return;
    const scheduled = new Date(date);
    scheduled.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    if (scheduled <= new Date()) return;
    onSchedule(scheduled);
  };

  const isValid = date && new Date(date.getFullYear(), date.getMonth(), date.getDate(), parseInt(hours), parseInt(minutes)) > new Date();

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-lg animate-scale-in space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground font-heading">Schedule Message</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <select
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="bg-muted/50 border-0 rounded-lg px-2 py-1.5 text-sm text-foreground"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={String(i).padStart(2, "0")}>
              {String(i).padStart(2, "0")}
            </option>
          ))}
        </select>
        <span className="text-foreground font-bold">:</span>
        <select
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="bg-muted/50 border-0 rounded-lg px-2 py-1.5 text-sm text-foreground"
        >
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
            <option key={m} value={String(m).padStart(2, "0")}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>

      <Button
        onClick={handleSchedule}
        disabled={!isValid}
        className="w-full"
        size="sm"
      >
        Schedule
      </Button>
    </div>
  );
};

export default SchedulePicker;
