import React from "react";
import { formatLastSeen } from "@/lib/dateUtils";
import type { Tables } from "@/integrations/supabase/types";

interface PresenceStatusProps {
  partner: Tables<"user_status"> | null;
  partnerTyping: boolean;
  partnerAwayMessage?: string | null;
}

const STATUS_PRESETS: Record<string, { emoji: string; label: string }> = {
  coffee: { emoji: "☕", label: "Having coffee" },
  music: { emoji: "🎧", label: "Listening to music" },
  working: { emoji: "💻", label: "Working" },
  gaming: { emoji: "🎮", label: "Gaming" },
  sleeping: { emoji: "😴", label: "Sleeping" },
  reading: { emoji: "📖", label: "Reading" },
  cooking: { emoji: "🍳", label: "Cooking" },
  exercising: { emoji: "🏃", label: "Exercising" },
};

const PresenceStatus: React.FC<PresenceStatusProps> = ({ partner, partnerTyping, partnerAwayMessage }) => {
  if (partnerAwayMessage) {
    return <span className="text-xs text-orange-400">{partnerAwayMessage}</span>;
  }

  if (partnerTyping) {
    return <span className="text-xs text-primary font-medium">typing...</span>;
  }

  const customStatus = (partner as any)?.custom_status;
  const activityState = (partner as any)?.activity_state ?? (partner?.is_online ? "active" : "offline");

  if (customStatus && STATUS_PRESETS[customStatus]) {
    const preset = STATUS_PRESETS[customStatus];
    return (
      <span className="text-xs text-muted-foreground">
        {preset.emoji} {preset.label}
      </span>
    );
  }

  if (customStatus) {
    return <span className="text-xs text-muted-foreground">{customStatus}</span>;
  }

  switch (activityState) {
    case "active":
      return <span className="text-xs text-green-500 font-medium">🟢 Active now</span>;
    case "idle":
      return <span className="text-xs text-yellow-500">🌙 Idle</span>;
    case "away":
      return <span className="text-xs text-orange-400">📱 Away</span>;
    default:
      return (
        <span className="text-xs text-muted-foreground">
          Last seen {formatLastSeen(partner?.last_seen ?? null)}
        </span>
      );
  }
};

export { STATUS_PRESETS };
export default PresenceStatus;
