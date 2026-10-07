import React, { useState } from "react";
import { Link } from "react-router-dom";
import BookSpread from "@/components/book/BookSpread";
import { BOOK_STYLES, bookStyle, monthLabel, shortDayLabel, weekdayLabel, type CoverStyle } from "@/components/book/bookStyle";
import type { BookDayRow, BookPage } from "@/hooks/useBook";

/**
 * DevBook — a design preview of the Book (Phase 6).
 *
 * `/book` and `/book/:date` need a session and an indexed chat history. This
 * page shows the same cover, table of contents and spread with invented (but
 * realistic) data, so the layout can be judged without touching the database.
 * Development builds only.
 */

const SAMPLE_DAYS: BookDayRow[] = [
  { day: "2026-10-02", msg_count: 212, hours: 4.2, first_at: null, last_at: null, top_mood: "playful", page_id: 3, title: "The umbrella day", mood: "playful", favorite: true, has_note: true, ai_touched: true },
  { day: "2026-10-01", msg_count: 88, hours: 1.6, first_at: null, last_at: null, top_mood: "sweet", page_id: 2, title: "Biryani and a long call", mood: "sweet", favorite: false, has_note: false, ai_touched: false },
  { day: "2026-09-30", msg_count: 34, hours: 0.7, first_at: null, last_at: null, top_mood: "caring", page_id: null, title: null, mood: null, favorite: false, has_note: false, ai_touched: false },
  { day: "2026-09-29", msg_count: 402, hours: 6.1, first_at: null, last_at: null, top_mood: "serious", page_id: 1, title: "The two-hour argument", mood: "heavy", favorite: false, has_note: true, ai_touched: true },
  { day: "2026-09-28", msg_count: 61, hours: 1.1, first_at: null, last_at: null, top_mood: "flirty", page_id: null, title: null, mood: null, favorite: false, has_note: false, ai_touched: false },
];

const SAMPLE_PAGE: BookPage = {
  id: 3,
  day: "2026-10-02",
  title: "The umbrella day",
  subtitle: "you shared one umbrella and got soaked anyway — then laughed about it for an hour",
  mood: "playful",
  excerpt: [
    { id: 1, who: "owner", name: "Kratagya", text: "umbrella bhool gaya tha main", at: "2026-10-02T18:12:00+05:30", type: "text" },
    { id: 2, who: "partner", name: "Anshika", text: "and then it rained on us the whole way home 😭", at: "2026-10-02T18:14:00+05:30", type: "text" },
    { id: 3, who: "owner", name: "Kratagya", text: "best walk ever though. your hair looked ridiculous", at: "2026-10-02T18:16:00+05:30", type: "text" },
    { id: 4, who: "partner", name: "Anshika", text: "you kept laughing at me the entire time, I'm never forgiving you", at: "2026-10-02T18:18:00+05:30", type: "text" },
    { id: 5, who: "owner", name: "Kratagya", text: "i love you. soggy and all", at: "2026-10-02T18:31:00+05:30", type: "text" },
    { id: 6, who: "partner", name: "Anshika", text: "love you more 🌧️", at: "2026-10-02T18:32:00+05:30", type: "text" },
  ],
  photo_url: null,
  stats: { messages: 212, hours: 4.2, first_at: "2026-10-02T09:40:00+05:30", last_at: "2026-10-02T23:10:00+05:30", tone: "playful" },
  note: "",
  favorite: true,
  generated_by: "llm",
  model: "groq/llama-3.3-70b",
  ai_touched: true,
  status: "ready",
};

const DevBook: React.FC = () => {
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("midnight");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const style = bookStyle(coverStyle);

  const written = SAMPLE_DAYS.filter((d) => d.page_id).length;

  return (
    <div className="night-scene relative flex min-h-dvh flex-col bg-[hsl(var(--night-900))]">
      <header className="px-5 pb-2 pt-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/dev/scene" className="text-[12px] text-muted-foreground hover:text-foreground">
            ← home scene
          </Link>
          <span className="text-[11px] text-muted-foreground">dev preview · the book</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8 scrollbar-thin">
        <div className="mx-auto grid max-w-2xl gap-6">
          {/* cover */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[36px] blur-3xl"
              style={{ background: `radial-gradient(circle at 50% 20%, ${style.coverGlow}, transparent 70%)` }}
            />
            <div
              className="relative overflow-hidden rounded-[14px] px-7 py-9 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]"
              style={{ background: style.cover, color: style.coverInk }}
            >
              <span className="absolute inset-y-0 left-0 w-[10px]" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.06) 60%, transparent)" }} />
              <div className="pl-3">
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ opacity: 0.6 }}>
                  {written} of {SAMPLE_DAYS.length} days written
                </p>
                <h1 className="mt-3 font-heading text-[34px] leading-tight">Us</h1>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ opacity: 0.75 }}>
                  every day we said something worth keeping
                </p>
                <p className="mt-6 font-handwriting text-[19px]" style={{ opacity: 0.9 }}>
                  for you, always
                </p>
              </div>
            </div>
          </div>

          {/* cover styles */}
          <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-2">
            {Object.values(BOOK_STYLES).map((s) => (
              <button
                key={s.id}
                onClick={() => setCoverStyle(s.id)}
                className={`overflow-hidden rounded-xl text-left ring-1 transition-all ${
                  s.id === coverStyle ? "ring-2 ring-primary" : "ring-border/50"
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

          {/* table of contents */}
          <div className="mx-auto w-full max-w-2xl space-y-1">
            <div className="mb-1 flex items-center gap-3 px-3">
              <span className="scene-label">{monthLabel("2026-10-02")}</span>
              <span className="scene-hairline flex-1" />
            </div>
            {SAMPLE_DAYS.map((row) => (
              <div key={row.day} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="w-12 shrink-0 text-center">
                  <span className="block font-heading text-[17px] leading-none text-foreground">{shortDayLabel(row.day).split(" ")[0]}</span>
                  <span className="mt-0.5 block text-[9px] uppercase tracking-wider text-muted-foreground">{shortDayLabel(row.day).split(" ")[1]}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13.5px] ${row.page_id ? "text-foreground" : "text-muted-foreground"}`}>
                    {row.page_id ? row.title : "not written yet"}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {weekdayLabel(row.day)} · {row.msg_count} messages · {row.hours}h
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* a spread */}
          <div>
            <p className="scene-label mb-2 px-1">a day, opened</p>
            <BookSpread
              day={SAMPLE_PAGE.day}
              page={{ ...SAMPLE_PAGE, note, favorite: true }}
              coverStyle={coverStyle}
              animationsEnabled={false}
              noteDraft={note}
              onNoteChange={setNote}
              onSaveNote={() => {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1600);
              }}
              onToggleFavorite={() => undefined}
              noteSaved={saved}
              preview
            />
          </div>

          <p className="pb-2 text-center text-[10.5px] text-muted-foreground">
            dev-only preview · /book renders this from your own days, and costs nothing to browse
          </p>
        </div>
      </div>
    </div>
  );
};

export default DevBook;
