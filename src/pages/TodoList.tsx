import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTodos, type TodoPriority } from "@/hooks/useTodos";
import { usePartner } from "@/hooks/usePartner";
import BottomNav from "@/components/layout/BottomNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, ArrowLeft, Flag, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";

const priorityColors: Record<TodoPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-amber-500",
  high: "text-destructive",
};

const TodoList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <TodoView userId={user.id} />;
};

const TodoView: React.FC<{ userId: string }> = ({ userId }) => {
  const [tab, setTab] = useState<"shared" | "private">("shared");
  const { todos, loading, addTodo, toggleTodo, deleteTodo } = useTodos(tab);
  const partner = usePartner(userId);

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("medium");
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addTodo(newTitle.trim(), tab === "shared", newPriority);
    setNewTitle("");
    setNewPriority("medium");
    setShowAdd(false);
  };

  const pendingTodos = todos.filter((t) => !t.is_completed);
  const completedTodos = todos.filter((t) => t.is_completed);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="px-5 pt-6 pb-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-1.5 rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">To-Do Lists</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "shared" | "private")}>
          <TabsList className="w-full">
            <TabsTrigger value="shared" className="flex-1">
              🤝 Shared
            </TabsTrigger>
            <TabsTrigger value="private" className="flex-1">
              🔒 Private
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Add button */}
            {!showAdd && (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> Add task
              </Button>
            )}

            {/* Add form */}
            {showAdd && (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <Input
                  placeholder="What needs to be done?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Priority:</span>
                  {(["low", "medium", "high"] as TodoPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`text-xs px-2 py-1 rounded-full border transition-all ${
                        newPriority === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Pending tasks */}
            {pendingTodos.length === 0 && completedTodos.length === 0 && (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">{tab === "shared" ? "🤝" : "🔒"}</p>
                <p className="text-sm text-muted-foreground">
                  {tab === "shared"
                    ? "No shared tasks yet. Add one for you and your partner!"
                    : "No private tasks yet. Add a personal reminder!"}
                </p>
              </div>
            )}

            {pendingTodos.map((todo) => (
              <TodoItemCard
                key={todo.id}
                todo={todo}
                partnerName={partner?.name}
                userId={userId}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))}

            {/* Completed section */}
            {completedTodos.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
                  Completed ({completedTodos.length})
                </p>
                {completedTodos.map((todo) => (
                  <TodoItemCard
                    key={todo.id}
                    todo={todo}
                    partnerName={partner?.name}
                    userId={userId}
                    onToggle={toggleTodo}
                    onDelete={deleteTodo}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

interface TodoItemCardProps {
  todo: import("@/hooks/useTodos").TodoItem;
  partnerName?: string | null;
  userId: string;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

const TodoItemCard: React.FC<TodoItemCardProps> = ({ todo, partnerName, userId, onToggle, onDelete }) => {
  const isOwn = todo.user_id === userId;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        todo.is_completed
          ? "bg-muted/30 border-border/50 opacity-70"
          : "bg-card border-border shadow-sm"
      }`}
    >
      <Checkbox
        checked={todo.is_completed}
        onCheckedChange={() => onToggle(todo.id, todo.is_completed)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            todo.is_completed ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {todo.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Flag className={`h-3 w-3 ${priorityColors[todo.priority]}`} />
          <span className="text-[10px] text-muted-foreground capitalize">{todo.priority}</span>
          {todo.is_shared && (
            <span className="text-[10px] text-muted-foreground">
              · by {isOwn ? "You" : partnerName ?? "Partner"}
            </span>
          )}
          {todo.due_date && (
            <>
              <CalIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(todo.due_date), "MMM d")}
              </span>
            </>
          )}
        </div>
      </div>
      {(isOwn || todo.is_shared) && (
        <button
          onClick={() => onDelete(todo.id)}
          className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default TodoList;
