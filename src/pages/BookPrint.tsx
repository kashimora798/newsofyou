import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBookDays, useBookMeta, type BookDayRow, type BookPage } from "@/hooks/useBook";
import { bookStyle, dayLabel, clockOf } from "@/components/book/bookStyle";
import { PRINT_CSS } from "@/components/book/print.css";

/**
 * BookPrint — /book/print (build-plan Phase 9).
 *
 * The finished book, as paper: one day per page, the cover first, then the days
 * they actually talked, then a small closing page. Nothing is spent here — the
 * pages already exist (the browser composes them for free if a day was never
 * opened) — and "Print / Save as PDF" is the export.
 *
 * It deliberately does not try to be a layout tool: A5 portrait, serif, no
 * decoration that a print shop would have to reinterpret.
 */

const LINE_KINDS_WITH_PHOTO = new Set(["image", "photo", "gif"]);

const Cover: React.FC<{ title: string; subtitle: string; dedication: string; styleId: string; stats: { written: number; total: number; favorites: number } }> = ({
  title,
  subtitle,
  dedication,
  styleId,
  stats,
}) => {
  const style = bookStyle(styleId);
  return (
    <section className="print-page print-cover" style={{ background: style.cover, color: style.coverInk, padding: "2.6rem" }}>
      <p style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.65 }}>
        {stats.written} of {stats.total} days written
      </p>
      <h1 className="print-title" style={{ marginTop: 14, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 34, lineHeight: 1.1 }}>
        {title}
      </h1>
      <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, opacity: 0.8 }}>{subtitle}</p>
      {dedication && (
        <p style={{ marginTop: 28, fontFamily: "Lora, Georgia, serif", fontStyle: "italic", fontSize: 17, opacity: 0.9 }}>{dedication}</p>
      )}
      <p style={{ position: "relative", marginTop: 40, fontSize: 10.5, opacity: 0.6 }}>
        Printed from our own words · {stats.favorites} kept close
      </p>
    </section>
  );
};

const DayPage: React.FC<{ day: BookDayRow; page: BookPage | null }> = ({ day, page }) => {
  const title = page?.title ?? day.title ?? "an ordinary day";
  const subtitle = page?.subtitle ?? null;
  const lines = (page?.excerpt ?? []).filter((l) => (l.text ?? "").trim().length > 0);

  return (
    <section className="print-page" style={{ padding: "2.4rem 2.6rem" }}>
      <header style={{ borderBottom: "1px solid rgba(0,0,0,0.12)", paddingBottom: 8 }}>
        <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.55 }}>
          {dayLabel(day.day)}
        </p>
        <h2 className="print-day" style={{ marginTop: 6, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 21, lineHeight: 1.2 }}>
          {title}
        </h2>
        {subtitle && <p style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.55, opacity: 0.75 }}>{subtitle}</p>}
      </header>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((line, i) => {
          const isPhoto = line.type ? LINE_KINDS_WITH_PHOTO.has(line.type) : false;
          return (
            <div key={line.id ?? i} style={{ display: "flex", flexDirection: "column" }}>
              {isPhoto && line.url ? (
                <img src={line.url} alt="" style={{ maxWidth: "70%", borderRadius: 4, marginBottom: 3 }} />
              ) : (
                <p className="print-line" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                  {line.text}
                </p>
              )}
              <span style={{ fontSize: 9, opacity: 0.55, marginTop: 1 }}>
                {line.name} · {clockOf(line.at)}
              </span>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.6 }}>A quiet day — nothing was written down, and that is allowed.</p>
        )}
      </div>

      {page?.note && (
        <p className="print-note" style={{ marginTop: 18, fontFamily: "Lora, Georgia, serif", fontStyle: "italic", fontSize: 11.5, lineHeight: 1.6 }}>
          {page.note}
        </p>
      )}
      <p style={{ marginTop: 14, fontSize: 8.5, opacity: 0.4 }}>
        {day.msg_count} lines that day{page?.ai_touched ? " · the twin helped with the writing" : ""}
      </p>
    </section>
  );
};

const BookPrint: React.FC = () => {
  const meta = useBookMeta();
  const { days } = useBookDays(400);
  const [pages, setPages] = useState<Record<string, BookPage>>({});
  const [loading, setLoading] = useState(true);
  const [onlyWithPages, setOnlyWithPages] = useState(false);

  const coverStyleId = (meta.config as { cover_style?: string } | null)?.cover_style ?? "midnight";

  const selected = useMemo(() => {
    const list = [...days];
    return onlyWithPages ? list.filter((d) => d.page_id) : list;
  }, [days, onlyWithPages]);

  /**
   * Read the pages that already exist. Days that were never opened have no row
   * — they still print, with their lines, because the browser composes a page
   * for free. We only fetch the ones that were written, to show their prose.
   */
  const loadPages = useCallback(async () => {
    setLoading(true);
    const written = days.filter((d) => d.page_id).slice(0, 120);
    if (written.length === 0) {
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("book_pages")
      .select("id, day, title, subtitle, mood, excerpt, photo_url, stats, note, favorite, generated_by, model, ai_touched, status")
      .in("id", written.map((d) => d.page_id));
    const map: Record<string, BookPage> = {};
    for (const row of (data ?? []) as BookPage[]) map[row.day] = row;
    setPages(map);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  // The stylesheet lives only on this route.
  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-book-print", "true");
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    document.title = `${meta.config?.title ?? "Our Book"} — to print`;
    return () => {
      el.remove();
    };
  }, [meta.config?.title]);

  return (
    <div className="min-h-dvh">
      <div className="print-toolbar no-print">
        <Link to="/book" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> the book
        </Link>
        <span className="flex-1 text-[13px] text-muted-foreground">
          {selected.length} day{selected.length === 1 ? "" : "s"} · A5 portrait · colours survive to PDF
        </span>
        <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <input type="checkbox" checked={onlyWithPages} onChange={(e) => setOnlyWithPages(e.target.checked)} />
          only days with a written page
        </label>
        <button className="primary" onClick={() => window.print()} disabled={loading}>
          {loading ? "loading…" : "Print / Save as PDF"}
        </button>
      </div>

      {loading && (
        <div className="no-print flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> gathering the days…
        </div>
      )}

      <div className="print-wrap">
        <Cover
          title={meta.config?.title ?? "Our Book"}
          subtitle={meta.config?.subtitle ?? "the days we actually talked"}
          dedication={meta.config?.dedication ?? ""}
          styleId={coverStyleId}
          stats={{ written: meta.stats?.days_written ?? 0, total: meta.stats?.days_total ?? days.length, favorites: meta.stats?.favorites ?? 0 }}
        />

        {selected.map((day) => (
          <DayPage key={day.day} day={day} page={pages[day.day] ?? null} />
        ))}

        <section className="print-page" style={{ padding: "2.4rem 2.6rem" }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.55 }}>the last page</p>
          <p style={{ marginTop: 8, fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, lineHeight: 1.35 }}>
            {meta.stats?.messages ?? 0} lines, {meta.stats?.days_total ?? days.length} days, and one book nobody else has.
          </p>
          <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.6, opacity: 0.7 }}>
            Every word in here was said by one of us. The twin only helped lay some days out — the days are ours.
          </p>
        </section>
      </div>

      <div className="no-print px-4 pb-10 text-center">
        <Button variant="outline" onClick={() => window.print()} disabled={loading}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
        </Button>
        <p className="mx-auto mt-2 max-w-md text-[11.5px] text-muted-foreground">
          A print shop wants A5, portrait, colour — the pages above are already sized for that. Ask for “print as-is, no scaling”.
        </p>
      </div>
    </div>
  );
};

export default BookPrint;
