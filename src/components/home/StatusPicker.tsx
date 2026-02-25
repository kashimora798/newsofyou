import React from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_PRESETS } from "@/components/chat/PresenceStatus";

interface StatusPickerProps {
  userId: string;
  currentStatus: string | null;
  onClose: () => void;
  onSelect: (status: string | null) => void;
}

const StatusPicker: React.FC<StatusPickerProps> = ({ userId, currentStatus, onClose, onSelect }) => {
  const handleSelect = async (key: string | null) => {
    await supabase.from("user_status").update({ custom_status: key } as any).eq("user_id", userId);
    onSelect(key);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card rounded-t-2xl border border-border shadow-2xl p-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Set Your Status</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Clear status */}
          <button
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
              !currentStatus ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
          >
            <span className="text-lg">✖️</span>
            <span className="text-xs text-foreground">Clear status</span>
          </button>
          {Object.entries(STATUS_PRESETS).map(([key, { emoji, label }]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                currentStatus === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-xs text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatusPicker;
