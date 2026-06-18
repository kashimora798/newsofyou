import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GARDEN_FLOWERS } from "@/lib/secretContent";

interface Bloom {
  key: string;
  emoji: string;
  label: string;
  count: number;
}

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif";

const SecretGarden: React.FC = () => {
  const navigate = useNavigate();
  const [blooms, setBlooms] = useState<Bloom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Each flower's count = how many messages contain its keyword. Cheap
      // head-count queries; no separate garden table needed.
      const results = await Promise.all(
        GARDEN_FLOWERS.map(async (f) => {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .ilike("content", `%${f.match}%`);
          return { key: f.key, emoji: f.emoji, label: f.label, count: count ?? 0 };
        }),
      );
      setBlooms(results);
      setLoading(false);
    };
    load();
  }, []);

  const total = blooms.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="min-h-dvh bg-background" style={{ fontFamily: APPLE_FONT }}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 glass-chat-header flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted/60 tappable">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-[17px] font-semibold text-foreground leading-tight">Secret Garden 🌱</h1>
          <p className="text-[12px] text-muted-foreground">Words you share grow flowers here</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="px-4 py-5 max-w-lg mx-auto">
          {/* Total */}
          <div className="rounded-[20px] bg-gradient-to-br from-primary/10 to-accent/30 ring-1 ring-border/40 p-5 text-center mb-5">
            <p className="text-[40px] font-bold text-foreground leading-none">{total.toLocaleString()}</p>
            <p className="text-[13px] text-muted-foreground mt-1">flowers bloomed so far 🌸</p>
          </div>

          {/* Flower beds */}
          <div className="space-y-2.5">
            {blooms
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((b) => (
                <div key={b.key} className="rounded-[18px] bg-card ring-1 ring-border/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{b.emoji}</span>
                      <div>
                        <p className="text-[14px] font-semibold text-foreground leading-tight">{b.label}</p>
                        <p className="text-[11px] text-muted-foreground">from saying "{b.key}"</p>
                      </div>
                    </div>
                    <span className="text-[18px] font-bold text-primary tabular-nums">{b.count}</span>
                  </div>
                  {/* a little garden row */}
                  <div className="flex flex-wrap gap-0.5 text-base leading-none">
                    {Array.from({ length: Math.min(b.count, 40) }).map((_, i) => (
                      <span key={i} style={{ opacity: 0.55 + (i % 5) * 0.09 }}>{b.emoji}</span>
                    ))}
                    {b.count > 40 && <span className="text-[11px] text-muted-foreground ml-1 self-center">+{b.count - 40} more</span>}
                    {b.count === 0 && <span className="text-[12px] text-muted-foreground italic">not planted yet — say it in chat 🌱</span>}
                  </div>
                </div>
              ))}
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-6 px-6">
            Different words grow different flowers. Keep talking — your garden grows with every message. 💚
          </p>
        </div>
      )}
    </div>
  );
};

export default SecretGarden;
