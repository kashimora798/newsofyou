import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const AiSummary: React.FC = () => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);

  const fetchSummary = async (mode: "recent" | "missed") => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("ai-chat-summary", {
        body: { mode },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary);
      setMsgCount(data.messageCount ?? 0);
    } catch (e: any) {
      setError(e.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          AI Chat Summary
        </h3>
      </div>

      {!summary && !loading && !error && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchSummary("recent")}
            className="text-xs flex-1"
          >
            Recent Chat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchSummary("missed")}
            className="text-xs flex-1"
          >
            What I Missed
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-xs text-muted-foreground">Summarizing...</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {summary && (
        <div className="space-y-2">
          <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Based on {msgCount} messages
            </span>
            <button
              onClick={() => setSummary(null)}
              className="p-1 rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiSummary;
