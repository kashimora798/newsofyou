import React, { useMemo, useState } from "react";
import { ChevronRight, Heart, PenLine, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";
import HomeScene from "@/components/home/HomeScene";
import { useBookDays, useBookMeta, type BookDayRow } from "@/hooks/useBook";
import { BOOK_STYLES, MOOD_LABELS, bookStyle, monthLabel, shortDayLabel, weekdayLabel } from "@/components/book/bookStyle";
import { Loader2 } from "lucide-react";

/**
 * Book — the index (build-plan Phase 6).
 *
 * The cover sits at the top like an object on a table; below it, the book's
 * table of contents: every day they actually talked, newest first, with a
 * marker for the days that already have a page. Nothing here spends an AI
 * call — a day is composed for free the moment it is opened.
 */

const Cover: React.FC<{ title: string; subtitle: string; dedication: string; styleId: string; stats: { written: number; total: number; favorites: number } }> = ({
  title,
  subtitle,
  dedication,
  styleId,
  stats,
}) => {
  const style = bookStyle(styleId);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-sm"
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[36px] blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 20%, ${style.coverGlow}, transparent 70%)` }}
      />
      <div
        className="relative overflow-hidden rounded-[14px] px-7 py-9 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]"
        style={{ background: style.cover, color: style.coverInk }}
      >
        {/* the spine */}
        <span
          className="absolute inset-y-0 left-0 w-[10px]"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.06) 60%, transparent)" }}
        />
        <div className="pl-3">
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: style.coverInk, opacity: 0.6 }}>
            {stats.written} of {stats.total} days written
          </p>
          <h1 className="mt-3 font-heading text-[34px] leading-tight">{title}</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ opacity: 0.75 }}>
            {subtitle}
          </p>
          {dedication && (
            <p className="mt-6 font-handwriting text-[19px]" style={{ opacity: 0.9 }}>
              {dedication}
            </p>
          )}
          <div className="mt-7 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.18em]" style={{ opacity: 0.6 }}>
            <span className="h-px flex-1" style={{ background: style.rule }} />
            a private book
            <span className="h-px flex-1" style={{ background: style.rule }} />
          </div>
        </div>
      </div>
      {stats.favorites > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          <Heart className="mr-1 inline h-3 w-3 text-primary" />
          {stats.favorites} day{stats.favorites === 1 ? "" : "s"} you marked to keep
        </p>
      )}
    </motion.div>
  );
};

const DayRowItem: React.FC<{ row: BookDayRow; onOpen: () => void }> = ({ row, onOpen }) => {
  const written = Boolean(row.page_id);
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <span className="w-12 shrink-0 text-center">
        <span className="block font-heading text-[17px] leading-none text-foreground">{shortDayLabel(row.day).split(" ")[0]}</span>
        <span className="mt-0.5 block text-[9px] uppercase tracking-wider text-muted-foreground">
          {shortDayLabel(row.day).split(" ")[1]}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-[13.5px] ${written ? "text-foreground" : "text-muted-foreground"}`}>
            {written ? row.title || "untitled" : "not written yet"}
          </span>
          {row.ai_touched && <Sparkles className="h-3 w-3 shrink-0 text-primary/70" />}
          {row.favorite && <Heart className="h-3 w-3 shrink-0 fill-primary text-primary" />}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {weekdayLabel(row.day)} · {row.msg_count} messages
          {row.hours ? ` · ${row.hours}h` : ""}
          {row.mood ? ` · ${MOOD_LABELS[row.mood] ?? row.mood}` : ""}
        </span>
      </span>

      {written ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
      ) : (
        <PenLine className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      )}
    </button>
  );
};

const Book: React.FC = () => {
  const navigate = useNavigate();
  const { days, loading: daysLoading } = useBookDays(400);
  const { stats, config, loading: metaLoading, saveCover } = useBookMeta();
  const [styleOpen, setStyleOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", subtitle: "", dedication: "" });

  const grouped = useMemo(() => {
    const groups: { month: string; rows: BookDayRow[] }[] = [];
    for (const row of days) {
      const month = monthLabel(row.day);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.rows.push(row);
      else groups.push({ month, rows: [row] });
    }
    return groups;
  }, [days]);

  const written = days.filter((d) => d.page_id).length;
  const style = bookStyle(config?.cover_style);

  const startEdit = () => {
    setDraft({
      title: config?.title ?? "Us",
      subtitle: config?.subtitle ?? "",
      dedication: config?.dedication ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await saveCover(draft);
      setEditing(false);
    } catch {
      /* surface nothing fancy — the fields simply stay open */
    }
  };

  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden">
      <HomeScene />

      <header className="relative z-10 shrink-0 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/home")}
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← home
          </button>
          <button
            onClick={() => setStyleOpen((v) => !v)}
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {style.label} cover ▾
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        {styleOpen && (
          <div className="mx-auto mb-4 grid max-w-sm grid-cols-2 gap-2">
            {Object.values(BOOK_STYLES).map((s) => (
              <button
                key={s.id}
                onClick={async () => {
                  await saveCover({ cover_style: s.id });
                  setStyleOpen(false);
                }}
                className={`overflow-hidden rounded-xl text-left ring-1 transition-all ${
                  s.id === style.id ? "ring-2 ring-primary" : "ring-border/50"
                }`}
              >
                <span className="block h-12 w-full" style={{ background: s.cover }} />
                <span className="block px-3 py-2">
                  <span className="block text-[12px] font-medium text-foreground">{s.label}</span>
                  <span className="block text-[10.5px] text-muted-foreground">{s.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {metaLoading || daysLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Cover
              title={config?.title ?? "Us"}
              subtitle={config?.subtitle ?? ""}
              dedication={config?.dedication ?? ""}
              styleId={config?.cover_style ?? "midnight"}
              stats={{ written, total: days.length || stats?.days_total || 0, favorites: stats?.favorites ?? 0 }}
            />

            <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 text-[11.5px]">
              <button onClick={startEdit} className="rounded-full border border-border/60 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground">
                edit the cover
              </button>
              <button
                onClick={() => navigate(`/book/${days[0]?.day ?? stats?.last_day ?? ""}`)}
                disabled={!days.length}
                className="rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-40"
              >
                open the last day
              </button>
            </div>

            {editing && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="pane mx-auto mt-4 max-w-sm space-y-3 p-4"
              >
                {(
                  [
                    ["title", "Title", "Us"],
                    ["subtitle", "Line under the title", "every day we said something worth keeping"],
                    ["dedication", "Dedication (handwriting)", "for you, always"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="block space-y-1">
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    <input
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className={`w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-foreground outline-none focus:border-primary/50 ${
                        key === "dedication" ? "font-handwriting text-[18px]" : "text-[14px]"
                      }`}
                    />
                  </label>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-border/60 py-2 text-[13px] text-muted-foreground">
                    cancel
                  </button>
                  <button onClick={saveEdit} className="flex-1 rounded-xl bg-primary py-2 text-[13px] font-medium text-primary-foreground">
                    save
                  </button>
                </div>
              </motion.div>
            )}

            {/* table of contents */}
            <div className="mx-auto mt-7 max-w-2xl space-y-5">
              {grouped.length === 0 && (
                <p className="pane p-5 text-center text-[13px] text-muted-foreground">
                  The book fills itself from your chats. Once your days are indexed (Phase 1 rebuild), they will appear here —
                  each one a page you can open, edit and keep.
                </p>
              )}

              {grouped.map((group) => (
                <section key={group.month}>
                  <div className="mb-1 flex items-center gap-3 px-3">
                    <span className="scene-label">{group.month}</span>
                    <span className="scene-hairline flex-1" />
                    <span className="text-[10.5px] text-muted-foreground">{group.rows.length} days</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {group.rows.map((row) => (
                      <DayRowItem key={row.day} row={row} onOpen={() => navigate(`/book/${row.day}`)} />
                    ))}
                  </div>
                </section>
              ))}

              {stats && (
                <p className="pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                  {stats.days_written} pages written · {stats.llm_written} with the twin's help · {stats.messages.toLocaleString("en-IN")} messages
                  since {stats.first_day ? new Date(`${stats.first_day}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—"}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="relative z-10">
        <BottomNav />
      </div>
    </div>
  );
};

export default Book;
