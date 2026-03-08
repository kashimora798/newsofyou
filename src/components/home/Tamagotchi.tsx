import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TamagotchiState {
  emoji: string;
  label: string;
  animation: string;
  statusMessage: string;
}

const STAGES: Record<string, TamagotchiState> = {
  wilting: { emoji: "🥀", label: "Wilting", animation: "", statusMessage: "Talk to each other! I'm getting lonely..." },
  sleeping: { emoji: "🌱", label: "Sleeping", animation: "", statusMessage: "Zzz... No messages today yet" },
  growing: { emoji: "🌿", label: "Growing", animation: "animate-pulse", statusMessage: "Keep chatting! I'm starting to grow!" },
  healthy: { emoji: "🌳", label: "Healthy", animation: "", statusMessage: "Great job! Our plant is thriving!" },
  blooming: { emoji: "🌸", label: "Blooming", animation: "animate-bounce", statusMessage: "Beautiful! Love is in the air! 💕" },
  thriving: { emoji: "💐", label: "Thriving", animation: "animate-bounce", statusMessage: "Amazing! You two are inseparable! ✨" },
};

function getStage(todayCount: number, daysSinceLastMessage: number): TamagotchiState {
  if (daysSinceLastMessage >= 2) return STAGES.wilting;
  if (todayCount === 0) return STAGES.sleeping;
  if (todayCount <= 5) return STAGES.growing;
  if (todayCount <= 15) return STAGES.healthy;
  if (todayCount <= 30) return STAGES.blooming;
  return STAGES.thriving;
}

const Tamagotchi: React.FC = () => {
  const [stage, setStage] = useState<TamagotchiState>(STAGES.sleeping);
  const [showTooltip, setShowTooltip] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const msgCount = count ?? 0;
      setTodayCount(msgCount);

      let daysSince = 0;
      if (lastMsg?.created_at) {
        daysSince = Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 86400000);
      } else {
        daysSince = 99;
      }

      setStage(getStage(msgCount, daysSince));
    };
    fetchData();
  }, []);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className={`relative glass rounded-2xl p-4 hover:shadow-lg hover:shadow-primary/5 transition-all active:scale-95 w-full ${stage.animation}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-4xl">{stage.emoji}</div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Relationship Plant</p>
            <p className="text-[10px] text-muted-foreground">{stage.label} • {todayCount} msgs today</p>
          </div>
          {stage === STAGES.thriving && <span className="text-lg">✨</span>}
        </div>
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-0 right-0 mb-2 glass rounded-xl p-3 shadow-lg animate-scale-in z-10">
          <p className="text-xs text-foreground">{stage.statusMessage}</p>
          <div className="mt-2 flex gap-1">
            {Object.values(STAGES).map((s, i) => (
              <span
                key={i}
                className={`text-lg ${s === stage ? "opacity-100 scale-110" : "opacity-30 grayscale"} transition-all`}
              >
                {s.emoji}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Tamagotchi;
