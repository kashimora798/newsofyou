import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircleQuestion, Loader2 } from "lucide-react";

const CACHE_KEY = "daily-question-cache";

const DailyQuestion: React.FC = () => {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestion = async () => {
      // Check local cache first
      const today = new Date().toISOString().split("T")[0];
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.date === today && parsed.question) {
            setQuestion(parsed.question);
            setLoading(false);
            return;
          }
        } catch {}
      }

      try {
        const { data, error } = await supabase.functions.invoke("ai-daily-question");
        if (error) throw error;
        if (data?.question) {
          setQuestion(data.question);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, question: data.question }));
        }
      } catch (e) {
        console.error("Daily question error:", e);
        setQuestion("What's one thing you're grateful for today?");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-accent rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircleQuestion className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
          Today's Question
        </h3>
      </div>
      <p className="text-sm text-foreground font-medium leading-relaxed">
        {question}
      </p>
    </div>
  );
};

export default DailyQuestion;
