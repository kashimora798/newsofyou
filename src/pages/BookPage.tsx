import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBookPage } from "@/hooks/useBook";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";
import BookSpread from "@/components/book/BookSpread";
import { supabase } from "@/integrations/supabase/client";

/**
 * BookPage — `/book/:date` (build-plan Phase 6).
 *
 * Thin wrapper: it owns the day's data, the neighbouring days for page turns,
 * and the note draft; the page itself is rendered by `BookSpread`.
 */
const BookPageView: React.FC = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const animationsEnabled = useAnimationsEnabled();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  const { page, loading, writing, error, spentCall, writePage, saveNote, toggleFavorite } = useBookPage(day);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [neighbours, setNeighbours] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });

  useEffect(() => {
    setNoteDraft(page?.note ?? "");
  }, [page?.note, page?.day]);

  // Neighbouring days, so the book can be leafed through.
  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.rpc as any)("book_days", {
        p_limit: 400,
        p_offset: 0,
        p_only_pages: false,
        p_favorites: false,
      });
      const rows = (data ?? []) as { day: string }[];
      const sorted = rows.map((r) => r.day).sort();
      const i = sorted.indexOf(day);
      if (!cancelled && i !== -1) setNeighbours({ prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const submitNote = async () => {
    try {
      await saveNote(noteDraft);
      setNoteSaved(true);
      window.setTimeout(() => setNoteSaved(false), 2000);
    } catch {
      /* leave the draft in place */
    }
  };

  if (!day) {
    return (
      <div className="night-scene flex h-dvh flex-col items-center justify-center gap-3 bg-[hsl(var(--night-900))]">
        <p className="text-[13px] text-muted-foreground">That page does not exist.</p>
        <button onClick={() => navigate("/book")} className="text-[13px] text-primary">
          back to the book
        </button>
      </div>
    );
  }

  return (
    <div className="night-scene relative flex h-dvh flex-col overflow-hidden bg-[hsl(var(--night-900))]">
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate("/book")}
          className="flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> the book
        </button>
        <div className="flex items-center gap-1">
          <button
            disabled={!neighbours.prev}
            onClick={() => neighbours.prev && navigate(`/book/${neighbours.prev}`)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            disabled={!neighbours.next}
            onClick={() => neighbours.next && navigate(`/book/${neighbours.next}`)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-8 scrollbar-thin">
        <AnimatePresence mode="wait">
          <BookSpread
            day={day}
            page={page}
            loading={loading}
            writing={writing}
            error={error}
            spentCall={spentCall}
            animationsEnabled={animationsEnabled}
            noteDraft={noteDraft}
            onNoteChange={setNoteDraft}
            onSaveNote={submitNote}
            onToggleFavorite={toggleFavorite}
            onWrite={writePage}
            noteSaved={noteSaved}
          />
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BookPageView;
