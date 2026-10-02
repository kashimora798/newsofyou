import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, Sparkles, Trash2, RefreshCw, Save, Power, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

/**
 * AdminTwin — /you/twin, owner only.
 *
 * Everything he needs to keep the twin honest and in his voice:
 *   - consent / enabled status (she consents; he can only switch it off)
 *   - greeting bank: filter, edit, delete, activate/deactivate, seed/top-up
 *   - style card: view, edit, regenerate
 *   - export/delete helpers
 */

interface BankRow {
  id: number;
  mood: string;
  daypart: string;
  text: string;
  active: boolean;
  uses: number;
  last_used_at: string | null;
  source: string;
}

const MOODS = [
  "sweet",
  "playful",
  "flirty",
  "missing_you",
  "proud",
  "sleepy",
  "cozy",
  "celebratory",
  "gentle_after_fight",
];

const AdminTwin: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [card, setCard] = useState("");
  const [cardDirty, setCardDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [daypartFilter, setDaypartFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bank, statsRes, cfg, styleCard] = await Promise.all([
        (supabase as any)
          .from("twin_greeting_bank")
          .select("id, mood, daypart, text, active, uses, last_used_at, source")
          .order("mood")
          .order("daypart")
          .order("id")
          .limit(800),
        (supabase.rpc as any)("twin_greeting_stats"),
        (supabase as any).from("twin_config").select("*").eq("id", 1).maybeSingle(),
        (supabase as any).from("twin_style_card").select("card").eq("id", 1).maybeSingle(),
      ]);
      setRows((bank.data ?? []) as BankRow[]);
      setStats((statsRes.data as Record<string, unknown>) ?? null);
      setConfig((cfg.data as Record<string, unknown>) ?? null);
      setCard((styleCard.data?.card as string) ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (moodFilter === "all" || r.mood === moodFilter) && (daypartFilter === "all" || r.daypart === daypartFilter),
      ),
    [rows, moodFilter, daypartFilter],
  );

  const isEmpty = !loading && rows.length === 0;

  const seed = async (replace: boolean) => {
    setBusy("seed");
    try {
      const { data, error } = await supabase.functions.invoke("seed-greetings", {
        body: { replace, per_daypart: 3 },
      });
      if (error) throw error;
      const payload = data as { inserted?: number; skipped?: number; guarded?: number };
      toast({
        title: replace ? "Bank rebuilt" : "Greetings added",
        description: `${payload.inserted ?? 0} new lines, ${payload.skipped ?? 0} duplicates skipped, ${payload.guarded ?? 0} blocked.`,
      });
      await load();
    } catch (e) {
      toast({ title: "Seeding failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const saveRow = async (row: BankRow, patch: Partial<BankRow>) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    const { error } = await (supabase as any).from("twin_greeting_bank").update(patch).eq("id", row.id);
    if (error) toast({ title: "Could not save", description: error.message, variant: "destructive" });
  };

  const removeRow = async (row: BankRow) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const { error } = await (supabase as any).from("twin_greeting_bank").delete().eq("id", row.id);
    if (error) toast({ title: "Could not delete", description: error.message, variant: "destructive" });
  };

  const saveCard = async () => {
    setBusy("card");
    try {
      const { error } = await (supabase as any)
        .from("twin_style_card")
        .upsert({ id: 1, card, updated_at: new Date().toISOString() });
      if (error) throw error;
      setCardDirty(false);
      toast({ title: "Voice profile saved" });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const rebuildCard = async () => {
    setBusy("rebuild-card");
    try {
      const { data, error } = await supabase.functions.invoke("build-style-card", { body: {} });
      if (error) throw error;
      const payload = data as { card?: string };
      if (payload.card) {
        setCard(payload.card);
        setCardDirty(true);
      }
      toast({ title: "Voice profile regenerated", description: "Review it and save if you're happy." });
    } catch (e) {
      toast({ title: "Could not regenerate", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async () => {
    setBusy("power");
    try {
      const next = !(config?.twin_enabled as boolean);
      const { error } = await (supabase.rpc as any)("twin_set_enabled", { p_enabled: next });
      if (error) throw error;
      setConfig((c) => (c ? { ...c, twin_enabled: next } : c));
      toast({ title: next ? "Twin switched on" : "Twin switched off" });
    } catch (e) {
      toast({ title: "Could not change", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const consented = Boolean(config?.partner_consented_at);

  return (
    <div className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> home
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Twin control room
          </h1>
        </div>

        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={config?.twin_enabled ? "default" : "secondary"}>
                {config?.twin_enabled ? "switched on" : "switched off"}
              </Badge>
              <Badge variant={consented ? "default" : "destructive"}>
                {consented ? `she agreed ${new Date(String(config?.partner_consented_at)).toLocaleDateString()}` : "she hasn't agreed yet"}
              </Badge>
              {stats?.shown_total !== undefined && (
                <Badge variant="outline">{String(stats.shown_total)} greetings shown</Badge>
              )}
              {stats?.live_7d !== undefined && <Badge variant="outline">{String(stats.live_7d)} live (7d)</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              He can switch it off, but only she can switch it on — consent is recorded from her account and can be revoked
              any time (Settings → AI, or the greeting itself).
            </p>
            <Button size="sm" variant={config?.twin_enabled ? "outline" : "default"} onClick={toggleEnabled} disabled={busy === "power"}>
              {busy === "power" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              <span className="ml-2">{config?.twin_enabled ? "Switch off" : "Switch on"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Greeting bank */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Greeting bank {stats?.total !== undefined && `(${String(stats.active ?? stats.total)} active)`}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => seed(false)} disabled={busy === "seed"}>
                  {busy === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 hidden sm:inline">Top up</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => seed(true)} disabled={busy === "seed"}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="ml-1.5 hidden sm:inline">Rebuild</span>
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isEmpty && (
              <p className="text-sm text-muted-foreground">
                Nothing yet — tap <strong>Top up</strong> to write ~300 greetings in his voice (uses 9 free AI calls).
              </p>
            )}

            {rows.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <select
                  value={moodFilter}
                  onChange={(e) => setMoodFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">all moods</option>
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <select
                  value={daypartFilter}
                  onChange={(e) => setDaypartFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="all">all times</option>
                  {["morning", "afternoon", "evening", "night", "any"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <span className="self-center text-xs text-muted-foreground">{filtered.length} shown</span>
              </div>
            )}

            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {loading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />}
              {filtered.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/60 p-2">
                  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>{row.mood.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{row.daypart}</span>
                    <span>·</span>
                    <span>used {row.uses}×</span>
                    {row.source !== "seed" && <Badge variant="outline" className="text-[9px]">{row.source}</Badge>}
                  </div>
                  <Textarea
                    defaultValue={row.text}
                    onBlur={(e) => e.target.value !== row.text && saveRow(row, { text: e.target.value })}
                    className="min-h-[52px] resize-none text-sm"
                  />
                  <div className="mt-1 flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => saveRow(row, { active: !row.active })}>
                      {row.active ? "hide" : "show"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeRow(row)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Style card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Voice profile</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={rebuildCard} disabled={busy === "rebuild-card"}>
                  {busy === "rebuild-card" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 hidden sm:inline">Regenerate</span>
                </Button>
                <Button size="sm" onClick={saveCard} disabled={!cardDirty || busy === "card"}>
                  {busy === "card" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Save</span>
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={card}
              onChange={(e) => {
                setCard(e.target.value);
                setCardDirty(true);
              }}
              placeholder="Generate this from your messages — it teaches the twin your voice. Edit freely; the twin uses exactly this."
              className="min-h-[220px] text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Keep it under ~400 words. The twin copies this voice but never impersonates you as a human.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminTwin;
