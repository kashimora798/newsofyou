import React, { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, MessageCircle, Image, Film, FileText,
  Clock, Calendar, Heart, TrendingUp, BarChart3, Award, Zap, Snail
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import BottomNav from "@/components/layout/BottomNav";

const Stats: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <StatsView />;
};

interface UserStat { userId: string; name: string; count: number; avgLength: number; }

const SENTIMENT_COLORS = ["hsl(142 70% 49%)", "hsl(0 84% 60%)", "hsl(25 95% 53%)", "hsl(330 80% 60%)"];

const StatsView: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Basic stats
  const [totalMessages, setTotalMessages] = useState(0);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [topEmojis, setTopEmojis] = useState<[string, number][]>([]);
  const [activeHour, setActiveHour] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [mediaCount, setMediaCount] = useState({ photos: 0, videos: 0, files: 0 });
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [firstMessage, setFirstMessage] = useState<{ content: string; date: string; user: string } | null>(null);
  const [chatDays, setChatDays] = useState(0);
  // Advanced stats
  const [monthly, setMonthly] = useState<{ month: string; count: number }[]>([]);
  const [hourlyPerUser, setHourlyPerUser] = useState<any[]>([]);
  const [topWords, setTopWords] = useState<{ word: string; count: number }[]>([]);
  const [records, setRecords] = useState<any>(null);
  const [keywordCounts, setKeywordCounts] = useState<any>(null);
  const [photosCount, setPhotosCount] = useState(0);
  const [nightOwlCount, setNightOwlCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: stats }, { data: advStats }, { data: mediaData }] = await Promise.all([
        supabase.rpc("get_chat_stats" as any),
        supabase.rpc("get_advanced_stats" as any),
        supabase.from("messages").select("image_url, video, file_url").or("image_url.neq.,video.eq.true,file_url.neq.").limit(1000),
      ]);

      // Basic stats
      if (stats) {
        const s = stats as any;
        setTotalMessages(s.total ?? 0);
        if (Array.isArray(s.per_user)) {
          setUserStats(s.per_user.map((u: any) => ({ userId: u.user_id, name: u.name ?? "Unknown", count: u.count ?? 0, avgLength: u.avg_length ?? 0 })));
        }
        if (Array.isArray(s.top_emojis)) setTopEmojis(s.top_emojis.map((e: any) => [e.emoji, e.count] as [string, number]));
        if (Array.isArray(s.by_hour) && s.by_hour.length > 0) setActiveHour(s.by_hour[0].hour);
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (Array.isArray(s.by_day) && s.by_day.length > 0) setActiveDay(days[s.by_day[0].dow] ?? null);
        if (Array.isArray(s.heatmap)) {
          const hd: Record<string, number> = {};
          s.heatmap.forEach((d: any) => { hd[d.day] = d.count; });
          setHeatmap(hd);
        }
        if (s.first_message) {
          const fm = s.first_message;
          const fmDate = fm.created_at ? new Date(fm.created_at) : null;
          setFirstMessage({ content: fm.content ?? "📷 Media", date: fmDate ? fmDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "", user: fm.username ?? "Unknown" });
          if (fmDate) setChatDays(Math.floor((Date.now() - fmDate.getTime()) / 86400000));
        }
      }

      // Advanced stats
      if (advStats) {
        const a = advStats as any;
        if (Array.isArray(a.monthly)) setMonthly(a.monthly);
        if (Array.isArray(a.hourly_per_user)) setHourlyPerUser(a.hourly_per_user);
        if (Array.isArray(a.top_words)) setTopWords(a.top_words.slice(0, 25));
        if (a.records) setRecords(a.records);
        if (a.keyword_counts) setKeywordCounts(a.keyword_counts);
        setPhotosCount(a.photos_count ?? 0);
        setNightOwlCount(a.night_owl_count ?? 0);
      }

      // Media
      if (mediaData) {
        let photos = 0, videos = 0, files = 0;
        mediaData.forEach((m: any) => { if (m.image_url) photos++; if (m.video) videos++; if (m.file_url) files++; });
        setMediaCount({ photos, videos, files });
      }

      setLoading(false);
    };
    load();
  }, []);

  // Hourly chart data (aggregate all users by hour)
  const hourlyChartData = useMemo(() => {
    const byHour: Record<number, Record<string, number>> = {};
    const names = new Set<string>();
    hourlyPerUser.forEach((h: any) => {
      if (!byHour[h.hour]) byHour[h.hour] = {};
      byHour[h.hour][h.name ?? h.user_id] = h.count;
      names.add(h.name ?? h.user_id);
    });
    return Array.from({ length: 24 }, (_, i) => {
      const entry: any = { hour: `${i % 12 || 12}${i >= 12 ? "p" : "a"}` };
      names.forEach((n) => { entry[n] = byHour[i]?.[n] ?? 0; });
      return entry;
    });
  }, [hourlyPerUser]);

  const userNames = useMemo(() => [...new Set(hourlyPerUser.map((h: any) => h.name ?? h.user_id))], [hourlyPerUser]);

  // Sentiment data from keyword counts
  const sentimentData = useMemo(() => {
    if (!keywordCounts) return [];
    return [
      { name: "😂 LOL", value: keywordCounts.lol ?? 0 },
      { name: "❤️ Love", value: keywordCounts.love ?? 0 },
      { name: "🫂 Miss", value: keywordCounts.miss ?? 0 },
      { name: "🌙 Good Night", value: keywordCounts.good_night ?? 0 },
    ].filter((d) => d.value > 0);
  }, [keywordCounts]);

  // Heatmap
  const heatmapDays = useMemo(() => {
    const allDates = Object.keys(heatmap).sort();
    if (allDates.length === 0) return [];
    const firstDate = new Date(allDates[0]);
    const totalDays = Math.min(Math.ceil((Date.now() - firstDate.getTime()) / 86400000) + 1, 300);
    const days: { date: string; count: number }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: heatmap[key] ?? 0 });
    }
    return days;
  }, [heatmap]);

  const maxCount = Math.max(...heatmapDays.map((d) => d.count), 1);
  const avgPerDay = chatDays > 0 ? Math.round(totalMessages / chatDays) : 0;

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/home")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground font-heading">📊 Advanced Analytics</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <MessageCircle className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalMessages.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Messages</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{avgPerDay}</p>
            <p className="text-[10px] text-muted-foreground">Avg / Day</p>
          </div>
        </div>

        {/* Chat Anniversary */}
        {chatDays > 0 && (
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-border p-4 text-center">
            <Heart className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{chatDays} days</p>
            <p className="text-xs text-muted-foreground">Together since {firstMessage?.date}</p>
          </div>
        )}

        {/* Per-user split */}
        <div className="grid grid-cols-2 gap-3">
          {userStats.map((u) => {
            const pct = totalMessages > 0 ? Math.round((u.count / totalMessages) * 100) : 0;
            return (
              <div key={u.userId} className="bg-card rounded-2xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-foreground">{u.count.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.name} ({pct}%)</p>
                <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">Avg {u.avgLength} chars</p>
              </div>
            );
          })}
        </div>

        {/* Monthly Trends Chart */}
        {monthly.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📈 Monthly Trends</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Messages" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Hourly Activity Chart */}
        {hourlyChartData.length > 0 && userNames.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">⏰ Hourly Activity</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  {userNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={i === 0 ? "hsl(var(--primary))" : "hsl(262 52% 70%)"} radius={i === userNames.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {userNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? "hsl(var(--primary))" : "hsl(262 52% 70%)" }} />
                  <span className="text-[10px] text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyword / Sentiment Counts */}
        {keywordCounts && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">💬 Expression Counts</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { emoji: "❤️", label: "I Love You", val: keywordCounts.love },
                { emoji: "😂", label: "LOLs", val: keywordCounts.lol },
                { emoji: "🫂", label: "Miss You", val: keywordCounts.miss },
                { emoji: "🌅", label: "Good Morning", val: keywordCounts.good_morning },
                { emoji: "🌙", label: "Good Night", val: keywordCounts.good_night },
                { emoji: "🤗", label: "Hugs", val: keywordCounts.hug },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 bg-muted/40 rounded-xl">
                  <span className="text-lg">{item.emoji}</span>
                  <p className="text-sm font-bold text-foreground">{(item.val ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentiment Pie */}
        {sentimentData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🎭 Sentiment Breakdown</h3>
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {sentimentData.map((_, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[i % SENTIMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, background: "hsl(var(--card))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Word Cloud */}
        {topWords.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📝 Top Words</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {topWords.map((w, i) => {
                const maxW = topWords[0]?.count ?? 1;
                const scale = 0.6 + (w.count / maxW) * 0.8;
                return (
                  <span
                    key={w.word}
                    className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-medium transition-transform hover:scale-110"
                    style={{ fontSize: `${Math.max(10, scale * 16)}px`, opacity: 0.5 + (w.count / maxW) * 0.5 }}
                    title={`${w.count} times`}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Records */}
        {records && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🏆 Records</h3>
            <div className="space-y-3">
              {records.max_messages_day && (
                <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-xl">
                  <Award className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{records.max_messages_day.count} messages</p>
                    <p className="text-[10px] text-muted-foreground">Most in one day — {records.max_messages_day.day}</p>
                  </div>
                </div>
              )}
              {records.longest_message && (
                <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-xl">
                  <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{records.longest_message.length} characters</p>
                    <p className="text-[10px] text-muted-foreground truncate">Longest message — by {records.longest_message.username}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-xl">
                <Zap className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{nightOwlCount} messages</p>
                  <p className="text-[10px] text-muted-foreground">Sent between 2-4 AM 🦉</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Emojis */}
        {topEmojis.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">😊 Top Emojis</h3>
            <div className="flex flex-wrap gap-3">
              {topEmojis.map(([emoji, count]) => (
                <div key={emoji} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs text-muted-foreground font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">
              {activeHour !== null ? `${activeHour % 12 || 12}${activeHour >= 12 ? "PM" : "AM"}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Peak Hour</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-3 text-center">
            <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{activeDay ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Peak Day</p>
          </div>
        </div>

        {/* Media Stats */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📸 Media Shared</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Image className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{mediaCount.photos}</p>
              <p className="text-[10px] text-muted-foreground">Photos</p>
            </div>
            <div className="text-center">
              <Film className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{mediaCount.videos}</p>
              <p className="text-[10px] text-muted-foreground">Videos</p>
            </div>
            <div className="text-center">
              <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{mediaCount.files}</p>
              <p className="text-[10px] text-muted-foreground">Files</p>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        {heatmapDays.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              🗓️ Activity Heatmap ({heatmapDays.length} Days)
            </h3>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
              {heatmapDays.map((d) => {
                const intensity = d.count / maxCount;
                return (
                  <div
                    key={d.date}
                    className="aspect-square rounded-sm"
                    title={`${d.date}: ${d.count} messages`}
                    style={{
                      backgroundColor: d.count === 0
                        ? "hsl(var(--muted))"
                        : `hsl(262 52% 56% / ${0.2 + intensity * 0.8})`,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-1 mt-2">
              <span className="text-[9px] text-muted-foreground">Less</span>
              {[0.2, 0.4, 0.6, 0.8, 1].map((o) => (
                <div key={o} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `hsl(262 52% 56% / ${o})` }} />
              ))}
              <span className="text-[9px] text-muted-foreground">More</span>
            </div>
          </div>
        )}

        {/* First Message */}
        {firstMessage && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">💬 First Message Ever</h3>
            <p className="text-sm text-foreground italic">"{firstMessage.content}"</p>
            <p className="text-[10px] text-muted-foreground mt-2">— {firstMessage.user}, {firstMessage.date}</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      <BottomNav />
    </div>
  );
};

export default Stats;