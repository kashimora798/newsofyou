import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { useDailyChecklist, useMissedChecklists, useChecklistDates } from "@/hooks/useDailyChecklist";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, isToday, parseISO } from "date-fns";
import { ArrowLeft, Plus, Trash2, RotateCcw, Loader2, CheckCircle2, Circle, BarChart3 } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import WeeklyChart from "@/components/checklist/WeeklyChart";

const motivationalText = (completed: number, total: number) => {
  if (total === 0) return "No tasks yet — add some! ✨";
  const pct = completed / total;
  if (pct === 1) return "All done! 🎉🔥";
  if (pct >= 0.75) return "Almost there! 💪";
  if (pct >= 0.5) return "Halfway — keep going! 🚀";
  if (pct > 0) return "Great start! 🌱";
  return "Let's get started! 💫";
};

const DailyChecklist: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <ChecklistView userId={user.id} />;
};

const ChecklistView: React.FC<{ userId: string }> = ({ userId }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTask, setNewTask] = useState("");
  const partner = usePartner(userId);
  const { myItems, partnerItems, loading, addItem, toggleItem, deleteItem, myProgress, partnerProgress } = useDailyChecklist(selectedDate);
  const { missed, carryForward } = useMissedChecklists();
  const checklistDates = useChecklistDates();
  const isEditable = isToday(selectedDate);

  const handleAdd = async () => {
    const t = newTask.trim();
    if (!t) return;
    await addItem(t);
    setNewTask("");
  };

  const dotDates = checklistDates.map(d => parseISO(d));

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="px-5 pt-6 pb-4 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Daily Checklist</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-9">
          {format(selectedDate, "EEEE, MMMM d, yyyy")}
          {isEditable && <span className="text-primary font-medium"> — Today</span>}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Calendar */}
        <div className="bg-card rounded-2xl border border-border p-2 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            className={cn("p-3 pointer-events-auto")}
            modifiers={{ hasData: dotDates }}
            modifiersStyles={{ hasData: { fontWeight: "bold", textDecoration: "underline", textDecorationColor: "hsl(var(--primary))" } }}
          />
        </div>

        {/* Your Checklist */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Your Checklist</h2>
            <span className="text-xs text-muted-foreground">{myProgress.completed}/{myProgress.total}</span>
          </div>
          <Progress value={myProgress.total > 0 ? (myProgress.completed / myProgress.total) * 100 : 0} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground mb-3">{motivationalText(myProgress.completed, myProgress.total)}</p>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {myItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <Checkbox
                    checked={item.is_completed}
                    onCheckedChange={() => isEditable && toggleItem(item.id, item.is_completed)}
                    disabled={!isEditable}
                    className="shrink-0"
                  />
                  <span className={cn("text-sm flex-1", item.is_completed && "line-through text-muted-foreground")}>
                    {item.title}
                  </span>
                  {isEditable && (
                    <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
              {myItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No tasks for this day</p>}
            </div>
          )}

          {isEditable && (
            <div className="flex gap-2 mt-3">
              <Input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Add a task..."
                className="text-sm h-9"
              />
              <button onClick={handleAdd} className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Partner's Checklist */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">{partner?.name ?? "Partner"}'s Checklist</h2>
            <span className="text-xs text-muted-foreground">{partnerProgress.completed}/{partnerProgress.total}</span>
          </div>
          <Progress value={partnerProgress.total > 0 ? (partnerProgress.completed / partnerProgress.total) * 100 : 0} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground mb-3">{motivationalText(partnerProgress.completed, partnerProgress.total)}</p>

          <div className="space-y-2">
            {partnerItems.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                {item.is_completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn("text-sm", item.is_completed && "line-through text-muted-foreground")}>
                  {item.title}
                </span>
              </div>
            ))}
            {partnerItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No tasks yet</p>}
          </div>
        </div>

        {/* Weekly Productivity Chart */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Weekly Completion Rate
          </h2>
          <WeeklyChart />
        </div>

        {/* Missed / Incomplete */}
        {missed.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Missed Tasks
            </h2>
            <div className="space-y-2">
              {missed.map(item => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <Circle className="h-4 w-4 text-destructive/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm block truncate">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{format(parseISO(item.checklist_date), "MMM d")}</span>
                  </div>
                  <button onClick={() => carryForward(item)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 transition-all" title="Carry forward to today">
                    <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default DailyChecklist;
