import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type TodoPriority = "low" | "medium" | "high";

export interface TodoItem {
  id: string;
  user_id: string;
  assigned_to: string | null;
  title: string;
  notes: string | null;
  is_shared: boolean;
  is_completed: boolean;
  priority: TodoPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTodos(tab: "shared" | "private") {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("todo_items" as any)
      .select("*")
      .order("is_completed", { ascending: true })
      .order("created_at", { ascending: false });

    if (tab === "private") {
      query = query.eq("is_shared", false).eq("user_id", user.id);
    } else {
      query = query.eq("is_shared", true);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching todos:", error);
    } else {
      setTodos((data as unknown as TodoItem[]) ?? []);
    }
    setLoading(false);
  }, [user, tab]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("todo-changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "todo_items" },
        () => {
          fetchTodos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTodos]);

  const addTodo = async (title: string, isShared: boolean, priority: TodoPriority = "medium", dueDate?: string, notes?: string) => {
    if (!user) return;
    const { error } = await supabase.from("todo_items" as any).insert({
      user_id: user.id,
      title,
      is_shared: isShared,
      priority,
      due_date: dueDate || null,
      notes: notes || null,
    } as any);
    if (error) {
      toast({ title: "Error", description: "Could not add task", variant: "destructive" });
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from("todo_items" as any)
      .update({
        is_completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Could not update task", variant: "destructive" });
    }
  };

  const deleteTodo = async (id: string) => {
    const { error } = await supabase
      .from("todo_items" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Could not delete task", variant: "destructive" });
    }
  };

  return { todos, loading, addTodo, toggleTodo, deleteTodo, refetch: fetchTodos };
}
