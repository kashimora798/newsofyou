import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import BottomNav from "@/components/layout/BottomNav";
import { toast } from "@/hooks/use-toast";

const ScheduledMessages: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ScheduledView userId={user.id} />;
};

const ScheduledView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScheduled = async () => {
    const { data } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("sent", false)
      .order("send_at", { ascending: true });
    setMessages(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchScheduled(); }, []);

  const handleCancel = async (id: string) => {
    await supabase.from("scheduled_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Scheduled message cancelled" });
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground font-heading">Scheduled Messages</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No scheduled messages</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground break-words">{msg.content || "📎 Attachment"}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(msg.send_at), "PPP 'at' p")}
              </p>
            </div>
            <button
              onClick={() => handleCancel(msg.id)}
              className="p-2 rounded-full hover:bg-destructive/10 transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default ScheduledMessages;
