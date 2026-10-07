import React, { useMemo } from "react";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { MOOD_LABELS, bookStyle, clockOf, dayLabel, type CoverStyle } from "@/components/book/bookStyle";
import type { BookPage, BookPageLine } from "@/hooks/useBook";

/**
 * BookSpread — one day, rendered (build-plan Phase 6, §3.9).
 *
 * Presentational on purpose: `BookPage.tsx` feeds it from the server and
 * `/dev/book` feeds it mock data, so the design can be reviewed (and later
 * printed/exported) without a session or a database.
 */

export interface BookSpreadProps {
  day: string;
  page: BookPage | null;
  loading?: boolean;
  writing?: boolean;
  error?: string | null;
  spentCall?: boolean;
  coverStyle?: CoverStyle;
  animationsEnabled?: boolean;
  noteDraft: string;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
  onToggleFavorite: () => void;
  onWrite?: () => void;
  noteSaved?: boolean;
  /** Hide the write button (used by the preview). */
  preview?: boolean;
}

const MOOD_TINT: Record<string, string> = {
  sweet: "hsl(342 68% 74%)",
  playful: "hsl(41 74% 72%)",
  flirty: "hsl(330 70% 72%)",
  caring: "hsl(160 45% 68%)",
  tender: "hsl(266 55% 76%)",
  heavy: "hsl(210 40% 70%)",
  ordinary: "hsl(232 20% 68%)",
};

const Line: React.FC<{ line: BookPageLine; ownerSide: boolean; ink: string; inkSoft: string; accent: string }> = ({
  line,
  ownerSide,
  ink,
  inkSoft,
  accent,
}) => (
  <div className={`flex flex-col ${ownerSide ? "items-start" : "items-end"}`}>
    <p className="max-w-[92%] whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: ink }}>
      {line.text}
    </p>
    <span className="mt-0.5 text-[10px]" style={{ color: inkSoft }}>
      {line.name} · {clockOf(line.at)}
    </span>
    {line.url && (
      <img
        src={line.url}
        alt=""
        loading="lazy"
        className="mt-2 max-h-52 w-auto max-w-[92%] rounded-xl object-cover"
        style={{ boxShadow: `0 10px 30px -18px ${accent}` }}
      />
    )}
  </div>
);

const BookSpread: React.FC<BookSpreadProps> = ({
  day,
  page,
  loading = false,
  writing = false,
  error = null,
  spentCall = false,
  coverStyle = "midnight",
  animationsEnabled = true,
  noteDraft,
  onNoteChange,
  onSaveNote,
  onToggleFavorite,
  onWrite,
  noteSaved = false,
  preview = false,
}) => {
  const style = bookStyle(coverStyle);
  const moodTint = MOOD_TINT[page?.mood ?? "ordinary"] ?? MOOD_TINT.ordinary;

  const stats = useMemo(() => {
    const s = (page?.stats ?? {}) as { messages?: number; hours?: number; first_at?: string; last_at?: string };
    return {
      messages: Number(s.messages ?? 0),
      hours: Number(s.hours ?? 0),
      from: clockOf(s.first_at),
      to: clockOf(s.last_at),
    };
  }, [page?.stats]);

  return (
    <motion.article
      key={day}
      initial={animationsEnabled ? { opacity: 0, rotateY: -6, y: 10 } : { opacity: 0 }}
      animate={{ opacity: 1, rotateY: 0, y: 0 }}
      exit={animationsEnabled ? { opacity: 0, rotateY: 6, y: -6 } : { opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className="mx-auto max-w-2xl"
      style={{ perspective: 1200 }}
    >
      <div
        className="relative overflow-hidden rounded-[18px] px-6 py-7 sm:px-9 sm:py-9"
        style={{
          background: style.spread,
          color: style.ink,
          boxShadow: "0 50px 90px -50px rgba(0,0,0,0.95), 0 0 0 0.5px rgba(255,255,255,0.06)",
        }}
      >
        {/* the gutter, so it reads as a spread on wide screens */}
        <span className="pointer-events-none absolute inset-y-6 left-1/2 hidden w-px sm:block" style={{ background: style.rule }} />

        <div className="relative mb-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: style.inkSoft }}>
            {dayLabel(day)}
          </p>
          <h1 className="mt-2 font-heading text-[26px] leading-tight" style={{ color: style.ink }}>
            {loading ? "…" : page?.title ?? "—"}
          </h1>
          {page?.subtitle && (
            <p className="mx-auto mt-2 max-w-md font-handwriting text-[20px]" style={{ color: moodTint }}>
              {page.subtitle}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10.5px]" style={{ color: style.inkSoft }}>
            <span className="rounded-full px-2 py-[2px]" style={{ background: `${moodTint}22`, color: moodTint }}>
              {MOOD_LABELS[page?.mood ?? "ordinary"] ?? page?.mood ?? "ordinary"}
            </span>
            {stats.messages > 0 && <span>{stats.messages} messages</span>}
            {stats.hours > 0 && <span>· {stats.hours}h</span>}
            {stats.from && (
              <span>
                · {stats.from}
                {stats.to ? `–${stats.to}` : ""}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: moodTint }} />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-[13px]" style={{ color: style.inkSoft }}>
            {error}
          </p>
        ) : (
          <div className="relative space-y-4">
            {(page?.excerpt ?? []).map((line, i) => (
              <Line key={`${line.id ?? i}`} line={line} ownerSide={line.who === "owner"} ink={style.ink} inkSoft={style.inkSoft} accent={moodTint} />
            ))}
            {(page?.excerpt ?? []).length === 0 && (
              <p className="py-6 text-center text-[13px]" style={{ color: style.inkSoft }}>
                This day had almost no words in it.
              </p>
            )}
          </div>
        )}

        {/* the margin note */}
        <div className="relative mt-8 border-t pt-5" style={{ borderColor: style.rule }}>
          <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: style.inkSoft }}>
            a line in the margin
          </p>
          <textarea
            value={noteDraft}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="write something only the two of you will read…"
            rows={2}
            className="mt-2 w-full resize-none rounded-xl px-3 py-2 font-handwriting text-[19px] outline-none"
            style={{ background: style.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: style.ink }}
          />
          <div className="mt-2 flex items-center justify-between">
            <button onClick={onToggleFavorite} className="flex items-center gap-1.5 text-[12px]" style={{ color: page?.favorite ? moodTint : style.inkSoft }}>
              <Heart className={`h-3.5 w-3.5 ${page?.favorite ? "fill-current" : ""}`} />
              {page?.favorite ? "kept" : "keep this day"}
            </button>
            <div className="flex items-center gap-2">
              {noteSaved && <span className="text-[11px]" style={{ color: moodTint }}>saved</span>}
              <button
                onClick={onSaveNote}
                disabled={noteDraft === (page?.note ?? "")}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium disabled:opacity-40"
                style={{ background: `${moodTint}22`, color: moodTint }}
              >
                save the line
              </button>
            </div>
          </div>
        </div>

        {/* the one paid action */}
        {!preview && (
          <div className="relative mt-6 flex flex-col items-center gap-2 border-t pt-5 text-center" style={{ borderColor: style.rule }}>
            {page?.generated_by === "llm" ? (
              <p className="text-[11px]" style={{ color: style.inkSoft }}>
                <Sparkles className="mr-1 inline h-3 w-3" />
                written with the twin's help{page.model ? ` · ${page.model}` : ""}
              </p>
            ) : (
              <>
                <button
                  onClick={onWrite}
                  disabled={writing}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
                  style={{ background: `${moodTint}22`, color: moodTint }}
                >
                  {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {writing ? "writing…" : "ask the twin to write this day properly"}
                </button>
                <p className="text-[10.5px]" style={{ color: style.inkSoft }}>
                  one AI call, saved forever. Opening pages is always free.
                </p>
              </>
            )}
            {spentCall && (
              <p className="text-[10.5px]" style={{ color: moodTint }}>
                this page is saved — it will never cost another call.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default BookSpread;
