import React from "react";
import { CHAT_THEMES } from "@/lib/chatThemes";
import { Check } from "lucide-react";

interface ThemePickerProps {
  value: string;
  onChange: (themeId: string) => void;
}

const ThemePicker: React.FC<ThemePickerProps> = ({ value, onChange }) => {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Parallel Universe Mode
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Transform the entire chat into an alternate reality
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CHAT_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${
              value === t.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-xl">{t.emoji}</span>
              <span className={`text-xs font-semibold flex-1 truncate ${value === t.id ? "text-primary" : "text-foreground"}`}>
                {t.label}
              </span>
              {value === t.id && <Check className="h-4 w-4 text-primary shrink-0" />}
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemePicker;
