import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Dices, Loader2, Palette, Type } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAiMemory } from "@/hooks/useAiMemory";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useJournalDayMessages, useJournalFont, useJournalIndex, useJournalStyles } from "@/hooks/useJournal";
import {
  DEFAULT_STYLE, PAGE_H, PAGE_W, autoAccent, buildBlocks, buildHighlighter, dayKeyOf, describeDay, paginate, resolveFont,
  type Block, type JournalDayStyle, type JournalPage as JPage,
} from "@/lib/journal";
import JournalPageView, { reservedForFirstPage, type DayContext } from "@/components/journal/JournalPage";
import JournalContents from "@/components/journal/JournalContents";
import JournalCover from "@/components/journal/JournalCover";
import DayCustomizer from "@/components/journal/DayCustomizer";
import FontPicker from "@/components/journal/FontPicker";
import ImageLightbox from "@/components/chat/ImageLightbox";

const COVER_PAD = 14;
const LAST_KEY = "journal:lastDay";

type View = { type: "cover" } | { type: "contents" } | { type: "day"; day: string; pageIdx: number };

const BlankPage: React.FC<{ side: "left" | "right" | "single"; text?: string }> = ({ side, text }) => (
  <div
    className="flex items-center justify-center"
    style={{
      width: PAGE_W, height: PAGE_H, borderRadius: side === "left" ? "6px 2px 2px 6px" : side === "right" ? "2px 6px 6px 2px" : 6,
      background: "#fffdf8", backgroundImage: "radial-gradient(circle, rgba(80,70,60,.2) 1px, transparent 1.4px)", backgroundSize: "20px 20px",
      fontFamily: "Caveat, cursive", fontSize: 22, color: "#a79fb3",
    }}
  >
    {text ?? "· · ·"}
  </div>
);

const Journal: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) {
    return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <JournalView userId={user.id} />;
};

const JournalView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const deepLinkDay = useMemo(() => {
    const d = params.get("d");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    // only the day we landed on matters for the first window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    days, months, dayMap, loading: indexLoading, error: indexError,
    hasMore, loadOlder, loadAll, loadingOlder, loadedMonths,
  } = useJournalIndex(deepLinkDay);
  const { prefs: fontPrefs, setFont } = useJournalFont();
  const font = useMemo(() => resolveFont(fontPrefs), [fontPrefs]);
  const [fontOpen, setFontOpen] = useState(false);
  const { styleFor, hasStyle, saveStyle } = useJournalStyles(userId);
  const { memories } = useAiMemory();
  const { bookmarks } = useBookmarks();

  const [view, setView] = useState<View>(() => {
    const d = params.get("d");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? { type: "day", day: d, pageIdx: 0 } : { type: "cover" };
  });
  const [dir, setDir] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [draft, setDraft] = useState<JournalDayStyle | null>(null);
  const [saving, setSaving] = useState(false);

  /* ───── stage sizing: logical canvas → scaled to fit ───── */
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 560 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spreadW = PAGE_W * 2 + COVER_PAD * 2;
  const singleW = PAGE_W + COVER_PAD * 2;
  const baseH = PAGE_H + COVER_PAD * 2;
  const fit = (w: number) => Math.min((box.w - 16) / w, (box.h - 12) / baseH, 1.5);
  const mode: "single" | "spread" = fit(spreadW) >= 0.72 ? "spread" : "single";
  const baseW = mode === "spread" ? spreadW : singleW;
  const scale = Math.max(0.2, fit(baseW));

  /* ───── index-derived data ───── */
  const totals = useMemo(
    () => ({ days: days.length, messages: days.reduce((a, d) => a + d.count, 0), photos: days.reduce((a, d) => a + d.photos, 0) }),
    [days],
  );
  const dayKeys = useMemo(() => days.map((d) => d.key), [days]);

  useEffect(() => {
    if (!selectedMonth && months.length) setSelectedMonth(months[months.length - 1].key);
  }, [months, selectedMonth]);

  const lastDay = typeof window !== "undefined" ? localStorage.getItem(LAST_KEY) : null;
  const lastDayLabel = lastDay && dayMap.has(lastDay) ? (() => { const d = describeDay(lastDay); return `${d.month} ${d.date}, ${d.year}`; })() : null;

  /* ───── current day pages ───── */
  const currentDay = view.type === "day" ? view.day : null;
  const dayQuery = useJournalDayMessages(currentDay);

  const highlighter = useMemo(
    () => buildHighlighter(memories.map((m) => ({ fact: m.fact, created_at: m.created_at })), bookmarks.map((b) => ({ message_id: b.message_id, category: b.category, note: b.note }))),
    [memories, bookmarks],
  );

  const dayData = useMemo(() => {
    if (!currentDay || !dayQuery.data) return null;
    const blocks: Block[] = buildBlocks(dayQuery.data, { dayKey: currentDay, currentUserId: userId, highlighter, charsPerLine: font.charsPerLine });

    // "remember" sticky: facts saved that day, then bookmark notes / flagged messages
    const facts: string[] = memories.filter((m) => dayKeyOf(m.created_at) === currentDay).map((m) => m.fact);
    for (const b of blocks) {
      if (b.kind !== "text") continue;
      for (const e of b.entries) {
        if (!e.highlight) continue;
        facts.push(e.highlight.note || (e.text.length > 48 ? `${e.text.slice(0, 46)}…` : e.text));
      }
    }
    const uniq = [...new Set(facts.map((f) => f.trim()).filter(Boolean))].slice(0, 3);

    const summary = dayMap.get(currentDay);
    const styleBase = hasStyle(currentDay) ? styleFor(currentDay) : { ...DEFAULT_STYLE, accent: autoAccent(currentDay) };
    const ctx: DayContext = {
      dayKey: currentDay, style: styleBase, facts: uniq,
      messageCount: summary?.count ?? blocks.length, photoCount: summary?.photos ?? 0,
    };
    const pages: JPage[] = paginate(blocks, { firstReserved: reservedForFirstPage(ctx) });
    const photos = blocks.flatMap((b) => (b.kind === "photo" ? [b.url] : b.kind === "album" ? b.urls : []));
    return { ctx, pages, photos };
  }, [currentDay, dayQuery.data, userId, highlighter, memories, dayMap, hasStyle, styleFor, font.charsPerLine]);

  // draft (live preview) overrides the saved style
  const effectiveCtx: DayContext | null = dayData ? { ...dayData.ctx, style: draft ?? dayData.ctx.style } : null;

  /* ───── navigation ───── */
  const step = mode === "spread" ? 2 : 1;
  const pageCount = dayData?.pages.length ?? 0;

  // resolve the "-1 = last page of this day" sentinel once the pages exist
  useEffect(() => {
    if (view.type === "day" && view.pageIdx < 0 && pageCount > 0) {
      setView({ ...view, pageIdx: Math.floor((pageCount - 1) / step) * step });
    }
  }, [view, pageCount, step]);

  const pageIdx = view.type === "day" ? Math.max(0, Math.floor(view.pageIdx / step) * step) : 0;

  useEffect(() => {
    if (view.type === "day") {
      try { localStorage.setItem(LAST_KEY, view.day); } catch { /* ignore */ }
    }
  }, [view]);

  const openDay = useCallback((day: string, d = 1, idx = 0) => {
    setDir(d);
    setDraft(null);
    setView({ type: "day", day, pageIdx: idx });
    setParams({ d: day }, { replace: true });
  }, [setParams]);

  const openContents = useCallback(() => {
    setDir(-1);
    setDraft(null);
    setView({ type: "contents" });
    setParams({}, { replace: true });
  }, [setParams]);

  const pendingPrev = useRef<string | null>(null);

  const goNext = useCallback(() => {
    if (view.type === "cover") return;
    if (view.type === "contents") return;
    if (!dayData) return;
    if (pageIdx + step < pageCount) {
      setDir(1);
      setView({ ...view, pageIdx: pageIdx + step });
      return;
    }
    const i = dayKeys.indexOf(view.day);
    const next = i >= 0 ? dayKeys[i + 1] : dayKeys.find((k) => k > view.day);
    if (next) openDay(next, 1, 0);
    else toast("That's the latest page 💌", { description: "New days appear here as you chat." });
  }, [view, dayData, pageIdx, step, pageCount, dayKeys, openDay]);

  const goPrev = useCallback(() => {
    if (view.type !== "day") return;
    if (pageIdx - step >= 0) {
      setDir(-1);
      setView({ ...view, pageIdx: pageIdx - step });
      return;
    }
    const i = dayKeys.indexOf(view.day);
    const prev = i > 0 ? dayKeys[i - 1] : null;
    if (prev) openDay(prev, -1, -1);
    else if (hasMore) {
      // nothing older is loaded yet → fetch the next window and continue once it lands
      pendingPrev.current = view.day;
      toast("Fetching older pages…");
      loadOlder();
    } else openContents();
  }, [view, pageIdx, step, dayKeys, openDay, openContents, hasMore, loadOlder]);

  // after "older" windows finish loading, carry on to the page the reader was heading for
  useEffect(() => {
    const from = pendingPrev.current;
    if (!from || loadingOlder) return;
    const i = dayKeys.indexOf(from);
    if (i > 0) {
      pendingPrev.current = null;
      openDay(dayKeys[i - 1], -1, -1);
    } else if (hasMore) {
      loadOlder(); // that window was empty — keep digging
    } else {
      pendingPrev.current = null;
      openContents();
    }
  }, [dayKeys, loadingOlder, hasMore, loadOlder, openDay, openContents]);

  const surprise = useCallback(() => {
    if (!dayKeys.length) return;
    openDay(dayKeys[Math.floor(Math.random() * dayKeys.length)], 1, 0);
  }, [dayKeys, openDay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draft || lightbox) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, draft, lightbox]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) (dx < 0 ? goNext : goPrev)();
  };

  /* ───── customizing ───── */
  const startCustomize = () => { if (dayData) setDraft(dayData.ctx.style); };
  const doSave = async () => {
    if (!draft || !currentDay) return;
    setSaving(true);
    const { synced } = await saveStyle(currentDay, draft);
    setSaving(false);
    setDraft(null);
    toast.success("Page decorated ✨", synced ? undefined : { description: "Saved on this device — apply the journal migration to sync it with your partner." });
  };

  /* ───── render ───── */
  const spreadKey = view.type === "day" ? `${view.day}:${pageIdx}:${mode}` : view.type;
  const pages = dayData?.pages ?? [];
  const label =
    view.type === "day"
      ? (() => { const d = describeDay(view.day); return `${d.monthShort} ${d.date}`; })()
      : "Contents";

  const frame = (children: React.ReactNode) => (
    <div className="journal-book relative flex" style={{ padding: COVER_PAD, borderRadius: 16, width: baseW, height: baseH }}>
      {children}
      {mode === "spread" && (
        <div className="pointer-events-none absolute inset-y-[14px] left-1/2 z-30 w-[3px] -translate-x-1/2" style={{ background: "linear-gradient(90deg, rgba(60,40,20,.28), rgba(255,255,255,.35), rgba(60,40,20,.2))" }} />
      )}
      <div className="pointer-events-none absolute -bottom-7 left-1/2 h-9 w-3.5 -translate-x-[-70px]" style={{ background: "#d99a2b", clipPath: "polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)" }} />
    </div>
  );

  const renderSpread = () => {
    if (view.type === "contents") {
      return frame(
        <JournalContents
          mode={mode} months={months} dayMap={dayMap} styleFor={styleFor} hasStyle={hasStyle}
          selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} onOpenDay={(d) => openDay(d, 1, 0)}
          onSurprise={surprise} totals={totals}
          hasMore={hasMore} loadingOlder={loadingOlder} loadedMonths={loadedMonths}
          onLoadOlder={loadOlder} onLoadAll={loadAll}
        />,
      );
    }
    if (view.type !== "day") return null;
    if (dayQuery.isError) {
      return frame(<BlankPage side="single" text="couldn't open this page — check your connection" />);
    }
    if (!effectiveCtx || !dayData) {
      return frame(
        mode === "spread" ? (<><BlankPage side="left" text="turning the page…" /><BlankPage side="right" /></>) : <BlankPage side="single" text="turning the page…" />,
      );
    }
    const left = pages[pageIdx];
    const right = mode === "spread" ? pages[pageIdx + 1] : undefined;
    return frame(
      mode === "spread" ? (
        <>
          <JournalPageView page={left} ctx={effectiveCtx} pageNumber={pageIdx + 1} totalPages={pageCount} side="left" onOpenImage={setLightbox} />
          {right ? (
            <JournalPageView page={right} ctx={effectiveCtx} pageNumber={pageIdx + 2} totalPages={pageCount} side="right" onOpenImage={setLightbox} />
          ) : (
            <BlankPage side="right" text="· the end of the day ·" />
          )}
        </>
      ) : (
        <JournalPageView page={left} ctx={effectiveCtx} pageNumber={pageIdx + 1} totalPages={pageCount} side="single" onOpenImage={setLightbox} />
      ),
    );
  };

  const variants = {
    enter: (d: number) => ({ rotateY: d > 0 ? 55 : -55, x: d > 0 ? 50 : -50, opacity: 0 }),
    center: { rotateY: 0, x: 0, opacity: 1 },
    exit: (d: number) => ({ rotateY: d > 0 ? -55 : 55, x: d > 0 ? -50 : 50, opacity: 0 }),
  };

  const progressLabel = view.type === "day" && pageCount > 0
    ? mode === "spread"
      ? `${label} · pages ${pageIdx + 1}${pageIdx + 2 <= pageCount ? `–${pageIdx + 2}` : ""} of ${pageCount}`
      : `${label} · page ${pageIdx + 1} of ${pageCount}`
    : label;

  return (
    <div
      className="journal-desk flex h-dvh flex-col"
      style={{ ["--journal-hand" as string]: font.css, ["--journal-text-size" as string]: `${font.fontSize}px` } as React.CSSProperties}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    >
      <header className="z-30 flex shrink-0 items-center gap-2 px-3 pb-2 pt-4">
        <button type="button" onClick={() => navigate("/home")} aria-label="Back to home" className="rounded-full bg-card/80 p-2 shadow-sm backdrop-blur hover:bg-card">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-base font-bold leading-tight text-foreground">Our Journal 📖</h1>
          <p className="truncate text-[11px] text-muted-foreground">{view.type === "cover" ? "your chats, bound as a book" : progressLabel}</p>
        </div>
        {view.type !== "cover" && (
          <>
            {view.type === "day" && (
              <button type="button" onClick={startCustomize} disabled={!dayData} aria-label="Decorate this day"
                className="flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur hover:bg-card disabled:opacity-50">
                <Palette className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Decorate</span>
              </button>
            )}
            <button type="button" onClick={() => setFontOpen(true)} aria-label="Change journal font"
              className="rounded-full bg-card/80 p-2 shadow-sm backdrop-blur hover:bg-card"><Type className="h-5 w-5" /></button>
            <button type="button" onClick={surprise} disabled={!dayKeys.length} aria-label="Open a random day"
              className="rounded-full bg-card/80 p-2 shadow-sm backdrop-blur hover:bg-card disabled:opacity-50"><Dices className="h-5 w-5" /></button>
            <button type="button" onClick={openContents} aria-label="Contents"
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm">
              <BookOpen className="h-4 w-4" /> Index
            </button>
          </>
        )}
      </header>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {view.type === "cover" ? (
          <div className="flex h-full items-center justify-center">
            <JournalCover
              totals={totals}
              loading={indexLoading}
              lastDayLabel={lastDayLabel}
              onOpen={() => { setDir(1); setView({ type: "contents" }); }}
              onContinue={() => lastDay && openDay(lastDay, 1, 0)}
            />
            {indexError && <p className="absolute bottom-4 text-xs text-destructive">Couldn't load your chats. Pull to retry.</p>}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center" style={{ perspective: 1800 }}>
            <div style={{ width: baseW * scale, height: baseH * scale, position: "relative" }}>
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.div
                  key={spreadKey}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                  style={{ width: baseW * scale, height: baseH * scale, position: "absolute", top: 0, left: 0 }}
                >
                  <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                    {renderSpread()}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {view.type === "day" && (
              <>
                <button type="button" onClick={goPrev} aria-label="Previous page"
                  className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-card/85 p-2 shadow-md backdrop-blur transition-transform active:scale-90 sm:left-4">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={goNext} aria-label="Next page"
                  className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-card/85 p-2 shadow-md backdrop-blur transition-transform active:scale-90 sm:right-4">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="h-3 shrink-0" />

      <FontPicker open={fontOpen} value={fontPrefs} onChange={setFont} onClose={() => setFontOpen(false)} />

      <DayCustomizer
        open={!!draft && !!currentDay}
        dayKey={currentDay ?? "2000-01-01"}
        value={draft ?? DEFAULT_STYLE}
        saving={saving}
        onChange={setDraft}
        onSave={doSave}
        onCancel={() => setDraft(null)}
        onReset={() => currentDay && setDraft({ ...DEFAULT_STYLE, accent: autoAccent(currentDay) })}
      />

      {lightbox && <ImageLightbox src={lightbox} images={dayData?.photos} onClose={() => setLightbox(null)} />}
    </div>
  );
};

export default Journal;
