import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Dices, CalendarCheck, ArrowRight } from "lucide-react";
import {
  ACCENTS, MONTHS, PAGE_H, PAGE_W, WEEKDAYS, autoAccent, dayKeyOf, monthCells, plural,
  type DaySummary, type JournalDayStyle, type MonthGroup,
} from "@/lib/journal";
import { Heart, Sprig, Star, Washi } from "./Decor";

const HAND = "Caveat, 'MyHandwriting', 'Comic Neue', cursive";
const TYPE = "'Special Elite', 'Courier New', monospace";
const SCRIPT = "'Kaushan Script', 'Pacifico', cursive";

const dotted: React.CSSProperties = {
  backgroundColor: "#fffdf8",
  backgroundImage: "radial-gradient(circle, rgba(80,70,60,.26) 1px, transparent 1.4px)",
  backgroundSize: "20px 20px",
  backgroundPosition: "10px 14px",
};

const Sheet: React.FC<{ side: "left" | "right" | "single"; children: React.ReactNode }> = ({ side, children }) => (
  <div
    className="relative overflow-hidden"
    style={{ width: PAGE_W, height: PAGE_H, borderRadius: side === "left" ? "6px 2px 2px 6px" : side === "right" ? "2px 6px 6px 2px" : 6, ...dotted }}
  >
    {side !== "single" && (
      <div
        className="pointer-events-none absolute inset-y-0 z-20"
        style={{ width: 46, [side === "left" ? "right" : "left"]: 0, background: `linear-gradient(${side === "left" ? "to left" : "to right"}, rgba(60,40,20,.2), rgba(60,40,20,.06) 45%, transparent)` } as React.CSSProperties}
      />
    )}
    {children}
  </div>
);

export interface ContentsProps {
  mode: "single" | "spread";
  months: MonthGroup[];
  dayMap: Map<string, DaySummary>;
  styleFor: (day: string) => JournalDayStyle;
  hasStyle: (day: string) => boolean;
  selectedMonth: string | null;
  onSelectMonth: (key: string) => void;
  onOpenDay: (day: string) => void;
  onSurprise: () => void;
  totals: { days: number; messages: number; photos: number };
  /** older chats exist that haven't been loaded yet */
  hasMore?: boolean;
  loadingOlder?: boolean;
  loadedMonths?: number | null;
  onLoadOlder?: () => void;
  onLoadAll?: () => void;
}

/** Left page: the table of contents — every month the journal covers. */
const MonthsPage: React.FC<ContentsProps & { side: "left" | "single" }> = ({
  months, selectedMonth, onSelectMonth, totals, side, hasMore, loadingOlder, loadedMonths, onLoadOlder, onLoadAll,
}) => {
  const byYear = useMemo(() => {
    const m = new Map<number, MonthGroup[]>();
    for (const g of months) m.set(g.year, [...(m.get(g.year) ?? []), g]);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [months]);

  return (
    <Sheet side={side}>
      <Washi kind="stripes" color="#f7b6c2" width={110} height={24} rot={-5} className="absolute -right-4 top-5 z-10" />
      <div className="absolute inset-x-0 top-0 z-10 px-9 pt-9">
        <p style={{ fontFamily: TYPE, fontSize: 11, letterSpacing: ".22em", color: "#c8324d" }} className="uppercase">our little book</p>
        <h2 style={{ fontFamily: SCRIPT, fontSize: 50, color: "#c8324d", transform: "rotate(-3deg)", transformOrigin: "left bottom", lineHeight: 1.1 }}>Contents</h2>
        <p style={{ fontFamily: HAND, fontSize: 18, color: "#6b6275" }}>
          {plural(totals.days, "day")} · {plural(totals.messages, "note")} · {plural(totals.photos, "photo")}
        </p>
      </div>
      <div className="journal-scroll absolute inset-x-0 z-10 overflow-y-auto px-9" style={{ top: 150, bottom: 40 }}>
        {byYear.length === 0 && (
          <p className="pt-10 text-center" style={{ fontFamily: HAND, fontSize: 22, color: "#8a8296" }}>
            The first page is still blank —<br />go write some memories ✍️
          </p>
        )}
        {byYear.map(([year, list]) => (
          <div key={year} className="mb-3">
            <p style={{ fontFamily: TYPE, fontSize: 12, color: "#8a8296", letterSpacing: ".2em" }}>— {year} —</p>
            {[...list].reverse().map((g) => {
              const active = g.key === selectedMonth;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => onSelectMonth(g.key)}
                  className="group flex w-full items-baseline gap-2 rounded px-1 text-left transition-colors hover:bg-[#fde4e8]/60"
                  style={{ minHeight: 34, background: active ? "linear-gradient(transparent 55%, #fbc9d3 55% 92%, transparent 92%)" : undefined }}
                >
                  <span style={{ fontFamily: HAND, fontSize: 25, fontWeight: 700, color: active ? "#c8324d" : "#2e2a3a" }}>{g.label}</span>
                  <span className="min-w-4 flex-1 translate-y-[-4px] border-b-2 border-dotted" style={{ borderColor: "rgba(80,70,60,.35)" }} />
                  <span style={{ fontFamily: TYPE, fontSize: 11, color: "#6b6275" }}>
                    {g.days.length}d{g.photos ? ` · ${g.photos}📷` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {(hasMore || loadingOlder) && (
          <div className="mb-2 mt-1 flex flex-col items-start gap-1.5">
            <p style={{ fontFamily: HAND, fontSize: 16, color: "#8a8296" }}>
              {loadedMonths ? `showing the latest ${loadedMonths} months…` : "loading the rest…"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={loadingOlder} onClick={onLoadOlder}
                className="rounded-full border border-dashed px-3 py-1 disabled:opacity-50"
                style={{ fontFamily: TYPE, fontSize: 11, color: "#c8324d", borderColor: "#c8324d" }}>
                {loadingOlder ? "turning pages…" : "↓ older months"}
              </button>
              <button type="button" disabled={loadingOlder} onClick={onLoadAll}
                className="rounded-full border border-dashed px-3 py-1 disabled:opacity-50"
                style={{ fontFamily: TYPE, fontSize: 11, color: "#6b6275", borderColor: "#8a8296" }}>
                load everything
              </button>
            </div>
          </div>
        )}
      </div>
      <Sprig size={54} className="absolute bottom-3 left-3 z-10 opacity-90" style={{ transform: "rotate(-20deg)" }} />
    </Sheet>
  );
};

/** Right page: calendar of the selected month, plus jump-to-date. */
const CalendarPage: React.FC<ContentsProps & { side: "right" | "single"; onBack?: () => void }> = ({
  side, months, dayMap, styleFor, hasStyle, selectedMonth, onSelectMonth, onOpenDay, onSurprise, onBack, hasMore, onLoadOlder,
}) => {
  const [jump, setJump] = useState("");
  const idx = months.findIndex((m) => m.key === selectedMonth);
  const month = idx >= 0 ? months[idx] : null;
  const now = new Date();
  const year = month?.year ?? now.getFullYear();
  const mi = month?.month ?? now.getMonth();
  const cells = monthCells(year, mi);
  const todayKey = dayKeyOf(now);

  const go = () => {
    if (jump && dayMap.has(jump)) onOpenDay(jump);
  };
  const jumpMissing = jump !== "" && !dayMap.has(jump);

  return (
    <Sheet side={side}>
      <Washi kind="dots" color="#a5dad7" width={100} height={24} rot={4} className="absolute -left-4 top-4 z-10" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-end justify-between px-9 pt-9">
        <div>
          {onBack && (
            <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1" style={{ fontFamily: TYPE, fontSize: 11, color: "#6b6275" }}>
              <ChevronLeft className="h-3 w-3" /> months
            </button>
          )}
          <h2 style={{ fontFamily: SCRIPT, fontSize: 42, color: "#3b7dc4", transform: "rotate(-2deg)", transformOrigin: "left bottom", lineHeight: 1.1 }}>{MONTHS[mi]}</h2>
          <p style={{ fontFamily: TYPE, fontSize: 12, letterSpacing: ".2em", color: "#8a8296" }}>{year}</p>
        </div>
        <div className="flex gap-1 pb-1">
          <button type="button" disabled={idx < 0 || (idx === 0 && !hasMore)} onClick={() => (idx > 0 ? onSelectMonth(months[idx - 1].key) : onLoadOlder?.())} aria-label="Previous month"
            className="rounded-full border border-[#3b7dc4]/40 p-1.5 text-[#3b7dc4] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" disabled={idx < 0 || idx >= months.length - 1} onClick={() => onSelectMonth(months[idx + 1].key)} aria-label="Next month"
            className="rounded-full border border-[#3b7dc4]/40 p-1.5 text-[#3b7dc4] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="absolute inset-x-0 z-10 px-7" style={{ top: 138 }}>
        <div className="grid grid-cols-7 text-center" style={{ fontFamily: TYPE, fontSize: 10, color: "#8a8296" }}>
          {WEEKDAYS.map((w) => <span key={w}>{w.slice(0, 2)}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((key, i) => {
            if (!key) return <span key={`b${i}`} />;
            const s = dayMap.get(key);
            const st = styleFor(key);
            const accent = ACCENTS[hasStyle(key) ? st.accent : autoAccent(key)];
            const n = Number(key.slice(8));
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                disabled={!s}
                onClick={() => onOpenDay(key)}
                aria-label={s ? `${key}: ${plural(s.count, "note")}` : key}
                className={`relative flex h-[46px] flex-col items-center justify-center rounded-lg transition-transform ${s ? "hover:scale-110 active:scale-95" : "opacity-35"}`}
                style={{
                  background: s ? accent.soft : "transparent",
                  border: isToday ? `1.5px dashed ${accent.ink}` : s ? `1px solid ${accent.tape}` : "none",
                }}
              >
                <span style={{ fontFamily: TYPE, fontSize: 9.5, color: s ? accent.ink : "#8a8296", lineHeight: 1 }}>{n}</span>
                {s ? (
                  <span style={{ fontSize: 18, lineHeight: "20px" }}>
                    {st.emojis[0] ?? <Heart size={11 + Math.min(8, Math.round(s.count / 12))} color={accent.ink} />}
                  </span>
                ) : null}
                {s && s.photos > 0 && <span className="absolute right-0.5 top-0.5 text-[8px]">📷</span>}
                {s && s.audio > 0 && <span className="absolute bottom-0.5 right-0.5 text-[8px]">🎙️</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-9 pb-7">
        <div className="flex items-center gap-2" style={{ fontFamily: TYPE, fontSize: 11, color: "#6b6275" }}>
          <span className="shrink-0">jump to</span>
          <input
            type="date"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            className="min-w-0 flex-1 rounded border border-dashed border-[#8a8296]/60 bg-white/70 px-2 py-1 outline-none focus:border-[#3b7dc4]"
            style={{ fontFamily: TYPE, fontSize: 12 }}
            aria-label="Jump to date"
          />
          <button type="button" onClick={go} disabled={!jump || jumpMissing} aria-label="Go to date"
            className="rounded-full bg-[#3b7dc4] p-1.5 text-white disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
        </div>
        {jumpMissing && <p style={{ fontFamily: HAND, fontSize: 16, color: "#c8324d" }}>no page for that day yet…</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => dayMap.has(todayKey) ? onOpenDay(todayKey) : months.length && onOpenDay(months[months.length - 1].days[months[months.length - 1].days.length - 1].key)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-[#c8324d]/60 py-1.5 text-[#c8324d]"
            style={{ fontFamily: HAND, fontSize: 18, fontWeight: 700 }}>
            <CalendarCheck className="h-4 w-4" /> latest page
          </button>
          <button type="button" onClick={onSurprise}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-[#7a5bc2]/60 py-1.5 text-[#7a5bc2]"
            style={{ fontFamily: HAND, fontSize: 18, fontWeight: 700 }}>
            <Dices className="h-4 w-4" /> surprise me
          </button>
        </div>
      </div>
      <Star size={22} className="absolute right-5 top-[104px] z-10" />
    </Sheet>
  );
};

const JournalContents: React.FC<ContentsProps> = (props) => {
  const [tab, setTab] = useState<"months" | "days">("months");
  if (props.mode === "spread") {
    return (
      <>
        <MonthsPage {...props} side="left" />
        <CalendarPage {...props} side="right" />
      </>
    );
  }
  return tab === "months" ? (
    <MonthsPage {...props} side="single" onSelectMonth={(k) => { props.onSelectMonth(k); setTab("days"); }} />
  ) : (
    <CalendarPage {...props} side="single" onBack={() => setTab("months")} />
  );
};

export default JournalContents;
