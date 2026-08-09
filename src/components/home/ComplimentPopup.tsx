import React from "react";
import { useCompliments } from "@/hooks/useCompliments";
import { Heart, X, Clock, Calendar } from "lucide-react";
import { formatFullDate } from "@/lib/dateUtils";

const ComplimentPopup: React.FC = () => {
  const { randomCompliment, dismissCompliment } = useCompliments();

  if (!randomCompliment) return null;

  // Show creation date/time
  const createdAt = randomCompliment.created_at;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ animation: "fadeIn 0.2s ease-out" }}
      onClick={dismissCompliment}
    >
      <div
        className="bg-card rounded-2xl border border-primary/20 p-6 mx-5 max-w-sm w-full shadow-2xl"
        style={{
          animation: "zoomIn 0.25s ease-out",
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.05) 100%)",
          boxShadow: "0 20px 60px -10px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--primary) / 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end mb-1">
          <button
            onClick={dismissCompliment}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Icon */}
        <div className="text-center">
          <div
            className="h-14 w-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(330 80% 70% / 0.25))" }}
          >
            <Heart
              className="h-7 w-7 text-primary"
              style={{ animation: "pulse 1.5s ease-in-out infinite" }}
            />
          </div>

          {/* Label */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-3">
            💌 A Secret Compliment
          </p>

          {/* Message */}
          <p className="text-base text-foreground font-medium leading-relaxed px-1">
            "{randomCompliment.content}"
          </p>

          <p className="text-xs text-muted-foreground mt-3 mb-4">
            Your partner left this just for you 💕
          </p>

          {/* Date & Time of creation */}
          <div className="flex items-center justify-center gap-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatFullDate(createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={dismissCompliment}
          className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(330 80% 60%))" }}
        >
          Aww, thank you! 🥰
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};

export default ComplimentPopup;
