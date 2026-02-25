import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import TouchReactionCreator from "@/components/settings/TouchReactionCreator";

export interface CustomReaction {
  id: string;
  user_id: string;
  label: string;
  verb: string;
  emoji: string;
  particles: string[];
  particle_size: number;
  gradient: string;
  vibration_strength: string;
  vibration_duration: number;
  shake: boolean;
  flash: boolean;
  created_at: string;
}

const CustomTouchReactions: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ReactionsView userId={user.id} />;
};

const ReactionsView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [reactions, setReactions] = useState<CustomReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from("custom_touch_reactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setReactions((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchReactions(); }, [userId]);

  const handleDelete = async (id: string) => {
    await supabase.from("custom_touch_reactions").delete().eq("id", id);
    setReactions((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Reaction deleted" });
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/settings")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">Custom Touch Reactions</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {!showCreator && (
          <button
            onClick={() => setShowCreator(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/30 transition-all text-sm text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Create New Reaction
          </button>
        )}

        {showCreator && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Reaction</h3>
              <button onClick={() => setShowCreator(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            <TouchReactionCreator userId={userId} onCreated={() => { setShowCreator(false); fetchReactions(); }} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : reactions.length === 0 && !showCreator ? (
          <p className="text-center text-sm text-muted-foreground py-10">No custom reactions yet. Create your first one!</p>
        ) : (
          <div className="space-y-2">
            {reactions.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card group">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: r.gradient }}
                >
                  {r.emoji?.startsWith("http") ? (
                    <img src={r.emoji} alt={r.label} className="h-6 w-6 object-contain" />
                  ) : (
                    <span className="text-xl">{r.emoji}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{r.verb} · {r.vibration_strength}</p>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomTouchReactions;
