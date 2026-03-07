import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedCalendar } from "@/hooks/useSharedCalendar";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { format, differenceInDays, parseISO, isFuture } from "date-fns";
import BottomNav from "@/components/layout/BottomNav";

const EMOJI_OPTIONS = ["📅", "🎂", "❤️", "✈️", "🎉", "🏠", "💍", "🎓", "🎄", "🌟"];

const SharedCalendar: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { events, loading, addEvent, deleteEvent } = useSharedCalendar();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [emoji, setEmoji] = useState("📅");
  const [description, setDescription] = useState("");

  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleAdd = async () => {
    if (!title.trim() || !eventDate) return;
    await addEvent(title.trim(), eventDate, emoji, description.trim() || undefined);
    setTitle(""); setEventDate(""); setEmoji("📅"); setDescription(""); setShowAdd(false);
  };

  const upcoming = events.filter((e) => isFuture(parseISO(e.event_date)));
  const past = events.filter((e) => !isFuture(parseISO(e.event_date)));

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="px-4 pt-5 pb-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-lg font-bold text-foreground">Shared Calendar 📅</h1>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title..." className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground" />
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none" />
            <div className="flex gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={`text-xl p-1.5 rounded-lg ${emoji === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={!title.trim() || !eventDate} className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50">Add Event</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</h3>
                {upcoming.map((e) => {
                  const days = differenceInDays(parseISO(e.event_date), new Date());
                  return (
                    <div key={e.id} className="bg-card rounded-xl border border-border p-3 mb-2 flex items-center gap-3 group">
                      <span className="text-2xl">{e.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{e.title}</p>
                        {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(e.event_date), "EEEE, MMM d, yyyy")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{days}</p>
                        <p className="text-[9px] text-muted-foreground">days left</p>
                      </div>
                      <button onClick={() => deleteEvent(e.id)} className="p-1 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Past</h3>
                {past.map((e) => (
                  <div key={e.id} className="bg-card rounded-xl border border-border p-3 mb-2 flex items-center gap-3 opacity-60 group">
                    <span className="text-2xl">{e.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(e.event_date), "MMM d, yyyy")}</p>
                    </div>
                    <button onClick={() => deleteEvent(e.id)} className="p-1 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {events.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">📅</p>
                <p className="text-sm text-muted-foreground">No events yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add anniversaries, trips, and special dates</p>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default SharedCalendar;
