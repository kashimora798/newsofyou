import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompliments } from "@/hooks/useCompliments";
import { ArrowLeft, Plus, Heart, Trash2, Loader2 } from "lucide-react";
import { formatLastSeen } from "@/lib/dateUtils";
import BottomNav from "@/components/layout/BottomNav";

const ComplimentBox: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { compliments, loading, addCompliment, deleteCompliment } = useCompliments();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [content, setContent] = useState("");

  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleAdd = async () => {
    if (!content.trim()) return;
    await addCompliment(content.trim());
    setContent(""); setShowAdd(false);
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="px-4 pt-5 pb-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-lg font-bold text-foreground">Secret Compliments 💌</h1>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Write sweet notes for your partner — they'll appear randomly when they visit! 💕</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write something sweet for your partner..."
              rows={3}
              className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none resize-none placeholder:text-muted-foreground"
            />
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={!content.trim()} className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Drop in Jar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : compliments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">💌</p>
            <p className="text-sm text-muted-foreground">No compliments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap + to write one for your partner</p>
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Notes ({compliments.length})</h3>
            {compliments.map((c) => (
              <div key={c.id} className="bg-card rounded-xl border border-border p-3 mb-2 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{c.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">{formatLastSeen(c.created_at)}</span>
                      {c.is_delivered ? (
                        <span className="text-[10px] text-primary font-medium">💕 Delivered</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">🕐 Waiting to surprise</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteCompliment(c.id)} className="p-1 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default ComplimentBox;
