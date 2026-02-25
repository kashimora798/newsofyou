import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Memory {
  content: string;
  username: string;
  created_at: string;
}

const OnThisDay: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.rpc("get_on_this_day" as any);
      if (error || !data || !Array.isArray(data)) return;
      setMemories(data);
    };
    fetch();
  }, []);

  if (memories.length === 0) return null;

  const memory = memories[activeIdx];
  const year = memory?.created_at ? new Date(memory.created_at).getFullYear() : 0;
  const yearsAgo = new Date().getFullYear() - year;

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div
        className="p-4"
        style={{
          background: "linear-gradient(135deg, hsl(262 52% 56% / 0.15), hsl(330 50% 60% / 0.15))",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            📅 On This Day
          </h3>
          <span className="text-[10px] text-muted-foreground font-medium">
            {yearsAgo} year{yearsAgo !== 1 ? "s" : ""} ago
          </span>
        </div>

        <div className="bg-card/80 backdrop-blur rounded-xl p-3">
          <p className="text-sm text-foreground leading-relaxed">
            {memory?.content || "💬 Message"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            — {memory?.username ?? "Unknown"},{" "}
            {memory?.created_at
              ? new Date(memory.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : ""}
          </p>
        </div>

        {memories.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {memories.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIdx
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnThisDay;
