import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useReminders } from "@/hooks/useReminders";
import { usePartner } from "@/hooks/usePartner";
import { ArrowLeft, Plus, Bell, Check, Trash2, Loader2, Clock } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import BottomNav from "@/components/layout/BottomNav";

const Reminders: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { reminders, loading, addReminder, completeReminder, deleteReminder } = useReminders();
  const partner = usePartner(user?.id ?? "");
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("09:00");
  const [forPartner, setForPartner] = useState(false);

  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleAdd = async () => {
    if (!title.trim() || !remindDate) return;
    const remindAt = new Date(`${remindDate}T${remindTime}`).toISOString();
    await addReminder(title.trim(), remindAt, forPartner ? partner?.id : undefined, note.trim() || undefined);
    setTitle(""); setNote(""); setRemindDate(""); setRemindTime("09:00"); setForPartner(false); setShowAdd(false);
  };

  const upcoming = reminders.filter((r) => !r.is_completed && !isPast(parseISO(r.remind_at)));
  const overdue = reminders.filter((r) => !r.is_completed && isPast(parseISO(r.remind_at)));
  const completed = reminders.filter((r) => r.is_completed);

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="px-4 pt-5 pb-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-lg font-bold text-foreground">Reminders 🔔</h1>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reminder title..." className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note..." className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground" />
            <div className="flex gap-2">
              <input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 outline-none" />
              <input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} className="w-28 text-sm bg-muted rounded-lg px-3 py-2 outline-none" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={forPartner} onChange={(e) => setForPartner(e.target.checked)} className="rounded" />
                Send to {partner?.name ?? "partner"}
              </label>
              <button onClick={handleAdd} disabled={!title.trim() || !remindDate} className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50">Add</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">⚠️ Overdue</h3>
                {overdue.map((r) => <ReminderCard key={r.id} reminder={r} userId={user.id} onComplete={completeReminder} onDelete={deleteReminder} isOverdue />)}
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</h3>
                {upcoming.map((r) => <ReminderCard key={r.id} reminder={r} userId={user.id} onComplete={completeReminder} onDelete={deleteReminder} />)}
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Done</h3>
                {completed.map((r) => <ReminderCard key={r.id} reminder={r} userId={user.id} onComplete={completeReminder} onDelete={deleteReminder} isDone />)}
              </div>
            )}
            {reminders.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🔔</p>
                <p className="text-sm text-muted-foreground">No reminders yet</p>
                <p className="text-xs text-muted-foreground mt-1">Tap + to create one</p>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const ReminderCard: React.FC<{
  reminder: any; userId: string; onComplete: (id: string) => void; onDelete: (id: string) => void; isOverdue?: boolean; isDone?: boolean;
}> = ({ reminder, userId, onComplete, onDelete, isOverdue, isDone }) => (
  <div className={`bg-card rounded-xl border p-3 mb-2 flex items-start gap-3 ${isOverdue ? "border-destructive/30" : "border-border"} ${isDone ? "opacity-60" : ""}`}>
    <button onClick={() => !isDone && onComplete(reminder.id)} className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isDone ? "bg-primary border-primary" : "border-muted-foreground hover:border-primary"}`}>
      {isDone && <Check className="h-3 w-3 text-primary-foreground" />}
    </button>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{reminder.title}</p>
      {reminder.note && <p className="text-xs text-muted-foreground mt-0.5">{reminder.note}</p>}
      <div className="flex items-center gap-1.5 mt-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className={`text-[10px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {format(parseISO(reminder.remind_at), "MMM d, yyyy · h:mm a")}
        </span>
        {reminder.target_user_id !== reminder.user_id && (
          <span className="text-[10px] text-primary font-medium ml-1">
            {reminder.user_id === userId ? "→ Partner" : "← From partner"}
          </span>
        )}
      </div>
    </div>
    <button onClick={() => onDelete(reminder.id)} className="p-1 rounded-full hover:bg-destructive/10">
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  </div>
);

// Need this import for parseISO in ReminderCard
import { parseISO } from "date-fns";

export default Reminders;
