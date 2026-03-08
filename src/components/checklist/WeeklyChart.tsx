import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useWeeklyChecklistStats } from "@/hooks/useWeeklyChecklistStats";
import { Loader2 } from "lucide-react";

const WeeklyChart: React.FC = () => {
  const { stats, loading } = useWeeklyChecklistStats();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = stats.some(s => s.you > 0 || s.partner > 0);

  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No checklist data this week yet
      </p>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats} barGap={2} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}%`, undefined]}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="you" name="You" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="partner" name="Partner" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklyChart;
