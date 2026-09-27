import React from "react";
import { formatLastSeen } from "@/lib/dateUtils";
import type { Tables } from "@/integrations/supabase/types";

import { Mic } from "lucide-react";

interface PresenceStatusProps {
  partner: Tables<"user_status"> | null;
  partnerTyping: boolean;
  partnerRecording?: boolean;
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

const PresenceStatus: React.FC<PresenceStatusProps> = ({ partner, partnerTyping, partnerRecording, partnerAwayMessage }) => {
  if (partnerAwayMessage) {
    return <span className="text-xs text-orange-400">{partnerAwayMessage}</span>;
  }

  if (partnerRecording) {
    return (
      <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
        <Mic className="h-3 w-3 animate-pulse text-rose-500" />
        <span className="animate-pulse">recording audio...</span>
      </span>
    );
  }

  if (partnerTyping) {
    return <span className="text-xs text-primary font-medium">typing...</span>;
  }

  const isOnline = Boolean(partner?.is_online);
  const rawState = (partner as any)?.activity_state;
  const isOffline = !isOnline || rawState === "offline";

  if (isOffline) {
    return (
      <span className="text-xs text-muted-foreground">
        Last seen {formatLastSeen(partner?.last_seen ?? null)}
      </span>
    );
  }

  const customStatus = (partner as any)?.custom_status;
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

  const activityState = rawState ?? "active";

  switch (activityState) {
    case "active":
      return <span className="text-xs text-green-500 font-medium">🟢 Active now</span>;
    case "away":
    case "idle":
      return <span className="text-xs text-amber-500 font-medium">🟡 Away</span>;
    default:
      return <span className="text-xs text-green-500 font-medium">🟢 Active now</span>;
  }
};

export { STATUS_PRESETS };
export default PresenceStatus;
