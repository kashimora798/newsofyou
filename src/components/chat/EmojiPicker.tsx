import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, X } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

/* ───────────────────────── data (lazy, loaded once) ───────────────────────── */

interface RawEmoji {
  id: string;
  name: string;
  keywords: string[];
  version: number;
  skins: { native: string }[];
}
interface RawData {
  categories: { id: string; emojis: string[] }[];
  emojis: Record<string, RawEmoji>;
}
interface Entry {
  id: string;
  search: string;
  skins: string[]; // [default, light, medium-light, medium, medium-dark, dark] (or just [default])
}
interface Section {
  id: string;
  label: string;
  tab: string;
  entries: Entry[];
}

const CATEGORY_META: Record<string, { label: string; tab: string }> = {
  people: { label: "Smileys & People", tab: "😀" },
  nature: { label: "Animals & Nature", tab: "🐻" },
  foods: { label: "Food & Drink", tab: "🍔" },
  activity: { label: "Activity", tab: "⚽" },
  places: { label: "Travel & Places", tab: "🚗" },
  objects: { label: "Objects", tab: "💡" },
  symbols: { label: "Symbols", tab: "❤️" },
  flags: { label: "Flags", tab: "🏁" },
};

/** Newest Unicode we assume devices can draw — avoids "tofu" boxes on older phones. */
const MAX_VERSION = 15;

let dataPromise: Promise<Section[]> | null = null;
function loadSections(): Promise<Section[]> {
  if (!dataPromise) {
    dataPromise = import("@emoji-mart/data").then((mod) => {
      const data = ((mod as any).default ?? mod) as RawData;
      return data.categories
        .filter((c) => CATEGORY_META[c.id])
        .map((c) => ({
          id: c.id,
          ...CATEGORY_META[c.id],
          entries: c.emojis
            .map((id) => data.emojis[id])
            .filter((e) => e && e.version <= MAX_VERSION)
            .map((e) => ({
              id: e.id,
              search: `${e.id} ${e.name} ${e.keywords.join(" ")}`.toLowerCase(),
              skins: e.skins.map((s) => s.native),
            })),
        }));
    });
  }
  return dataPromise;
}

/** Warm the cache early (e.g. on hover of the 🙂 button) so the first open is instant. */
export const preloadEmojiData = () => { void loadSections(); };

/* ───────────────────────── recents + skin tone ───────────────────────── */

const RECENT_KEY = "newsofyou_recent_emoji";
const TONE_KEY = "newsofyou_emoji_tone";
const TONES = ["🖐️", "🖐🏻", "🖐🏼", "🖐🏽", "🖐🏾", "🖐🏿"];

const readRecents = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const readTone = (): number => {
  try { return Math.min(5, Math.max(0, Number(localStorage.getItem(TONE_KEY) || 0))); } catch { return 0; }
};

/* ───────────────────────── component ───────────────────────── */

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecents);
  const [tone, setTone] = useState<number>(readTone);
  const [showTones, setShowTones] = useState(false);
  const [active, setActive] = useState("recent");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadSections().then((s) => alive && setSections(s));
    return () => { alive = false; };
  }, []);

  const pick = useCallback(
    (native: string) => {
      onSelect(native);
      setRecents((prev) => {
        const next = [native, ...prev.filter((e) => e !== native)].slice(0, 32);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    [onSelect]
  );

  // One click handler for the whole grid (instead of ~1800 closures).
  const onGridClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-e]");
    if (btn?.dataset.e) pick(btn.dataset.e);
  };

  const skinOf = (en: Entry) => (en.skins.length > 1 ? en.skins[tone] ?? en.skins[0] : en.skins[0]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !sections) return null;
    const out: Entry[] = [];
    for (const s of sections) {
      for (const en of s.entries) {
        if (en.search.includes(q)) out.push(en);
        if (out.length >= 160) return out;
      }
    }
    return out;
  }, [query, sections]);

  const jumpTo = (id: string) => {
    setActive(id);
    setQuery("");
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
      if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 4, behavior: "smooth" });
    });
  };

  // Highlight the tab of the section currently in view.
  const onScroll = () => {
    const root = scrollRef.current;
    if (!root || query) return;
    const secs = Array.from(root.querySelectorAll<HTMLElement>("[data-sec]"));
    let cur = secs[0]?.dataset.sec ?? "recent";
    for (const el of secs) if (el.offsetTop - root.scrollTop <= 24) cur = el.dataset.sec!;
    if (cur !== active) setActive(cur);
  };

  const grid = "grid grid-cols-8 gap-0.5 px-2";
  const cell =
    "h-10 w-full flex items-center justify-center rounded-lg text-[26px] leading-none hover:bg-muted active:scale-90 active:bg-muted/80 transition-transform select-none";

  return (
    <div className="w-full rounded-2xl bg-card border border-border/60 shadow-lg overflow-hidden flex flex-col" style={{ height: 320 }}>
      {/* Search + skin tone */}
      <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="h-8 w-full rounded-full bg-muted/60 pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowTones((v) => !v)}
            className="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-base"
            title="Skin tone"
          >
            {TONES[tone]}
          </button>
          {showTones && (
            <div className="absolute right-0 top-9 z-10 flex gap-0.5 rounded-full bg-popover border border-border shadow-xl p-1">
              {TONES.map((t, i) => (
                <button
                  key={t}
                  onClick={() => {
                    setTone(i);
                    setShowTones(false);
                    try { localStorage.setItem(TONE_KEY, String(i)); } catch { /* ignore */ }
                  }}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-base hover:bg-muted ${i === tone ? "bg-muted" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div ref={scrollRef} onScroll={onScroll} onClick={onGridClick} className="flex-1 overflow-y-auto scrollbar-thin overscroll-contain pb-1">
        {!sections ? (
          <div className="grid grid-cols-8 gap-1 p-3">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : results ? (
          results.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12">No emoji found</p>
          ) : (
            <div className={grid + " pt-1"}>
              {results.map((en) => {
                const n = skinOf(en);
                return <button key={en.id} data-e={n} className={cell} type="button">{n}</button>;
              })}
            </div>
          )
        ) : (
          <>
            {recents.length > 0 && (
              <section data-sec="recent">
                <h4 className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</h4>
                <div className={grid}>
                  {recents.map((e) => (
                    <button key={e} data-e={e} className={cell} type="button">{e}</button>
                  ))}
                </div>
              </section>
            )}
            {sections.map((s) => (
              <section key={s.id} data-sec={s.id} style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${Math.ceil(s.entries.length / 8) * 42 + 28}px` }}>
                <h4 className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</h4>
                <div className={grid}>
                  {s.entries.map((en) => {
                    const n = skinOf(en);
                    return <button key={en.id} data-e={n} className={cell} type="button">{n}</button>;
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {/* Category bar — bottom, like WhatsApp */}
      <div className="flex items-center justify-between border-t border-border/50 px-1.5 py-1 bg-card/80">
        {recents.length > 0 && (
          <TabBtn on={active === "recent" && !query} onClick={() => jumpTo("recent")} label="Recent">
            <Clock className="h-[18px] w-[18px]" />
          </TabBtn>
        )}
        {(sections ?? []).map((s) => (
          <TabBtn key={s.id} on={active === s.id && !query} onClick={() => jumpTo(s.id)} label={s.label}>
            <span className="text-[18px] leading-none grayscale-[0.2]">{s.tab}</span>
          </TabBtn>
        ))}
      </div>
    </div>
  );
};

const TabBtn: React.FC<{ on: boolean; onClick: () => void; label: string; children: React.ReactNode }> = ({ on, onClick, label, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`relative h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}
  >
    {children}
    {on && <span className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary" />}
  </button>
);

export default EmojiPicker;
