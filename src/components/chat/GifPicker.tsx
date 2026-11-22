import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Heart, Loader2, Search, TrendingUp, X } from "lucide-react";
import { API_ENDPOINTS, getApiKey, saveApiKey } from "@/config/apiKeys";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

/* ───────────────────────── types ───────────────────────── */

interface GiphyImage { url: string; webp?: string; width?: string; height?: string }
interface GiphyGif {
  id: string;
  images: Record<string, GiphyImage | undefined>;
}
/** Slimmed-down gif we keep in memory / localStorage. */
interface Gif {
  id: string;
  /** small preview shown in the grid */
  preview: string;
  /** what actually gets sent in chat (light, ≤ ~2 MB) */
  url: string;
  w: number;
  h: number;
}

const slim = (g: GiphyGif): Gif | null => {
  const prev = g.images.fixed_width_small ?? g.images.fixed_width ?? g.images.fixed_height_small;
  const send = g.images.downsized ?? g.images.fixed_height ?? g.images.original;
  if (!prev?.url || !send?.url) return null;
  return {
    id: g.id,
    // WebP previews are ~⅓ the size of the GIF preview
    preview: prev.webp || prev.url,
    url: send.url,
    w: Number(prev.width) || 200,
    h: Number(prev.height) || 150,
  };
};

/* ───────────────────────── local stores ───────────────────────── */

const RECENT_KEY = "newsofyou_gif_recent";
const FAV_KEY = "newsofyou_gif_fav";
const readList = (k: string): Gif[] => {
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
};
const writeList = (k: string, v: Gif[]) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

/* ───────────────────────── categories ───────────────────────── */

const CATEGORIES = [
  { label: "❤️ Love", q: "love" },
  { label: "🤗 Hug", q: "hug" },
  { label: "💋 Kiss", q: "kiss" },
  { label: "😂 Laugh", q: "laughing" },
  { label: "🥺 Miss you", q: "miss you" },
  { label: "🌙 Goodnight", q: "goodnight" },
  { label: "☀️ Morning", q: "good morning" },
  { label: "🎉 Celebrate", q: "celebrate" },
  { label: "😍 Cute", q: "cute" },
  { label: "👍 Yes", q: "yes" },
  { label: "🙄 Mood", q: "mood" },
  { label: "💃 Dance", q: "dance" },
];

type Mode = "trending" | "search" | "recent" | "fav";
const LIMIT = 24;

// In-memory result cache so flipping between chips is instant.
const cache = new Map<string, { gifs: Gif[]; total: number }>();

/* ───────────────────────── component ───────────────────────── */

const GifPicker: React.FC<GifPickerProps> = ({ onSelect }) => {
  const [apiKey, setApiKey] = useState(() => getApiKey("giphy"));
  const [inputKey, setInputKey] = useState("");

  const [mode, setMode] = useState<Mode>("trending");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState(""); // debounced
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recents, setRecents] = useState<Gif[]>(() => readList(RECENT_KEY));
  const [favs, setFavs] = useState<Gif[]>(() => readList(FAV_KEY));

  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // debounce typing
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (mode === "recent" || mode === "fav") return;
    setMode(term ? "search" : "trending");
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  const endpoint = (m: Mode, q: string, offset: number) =>
    `${API_ENDPOINTS.giphy}/${m === "search" ? `search?q=${encodeURIComponent(q)}&` : "trending?"}` +
    `api_key=${apiKey}&limit=${LIMIT}&rating=pg-13&bundle=messaging_non_clips&offset=${offset}`;

  const fetchPage = useCallback(
    async (m: Mode, q: string, offset: number, replace: boolean) => {
      if (!apiKey) return;
      const cacheKey = `${m}|${q}|${offset}`;
      const hit = cache.get(cacheKey);
      if (hit) {
        setGifs((prev) => (replace ? hit.gifs : [...prev, ...hit.gifs]));
        setTotal(hit.total);
        setError(null);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint(m, q, offset), { signal: ctrl.signal });
        if (res.status === 401 || res.status === 403) throw new Error("This GIPHY key was rejected. Check it and try again.");
        if (res.status === 429) throw new Error("GIPHY rate limit reached — try again in a moment.");
        if (!res.ok) throw new Error("Couldn't load GIFs.");
        const json = await res.json();
        const list: Gif[] = ((json.data ?? []) as GiphyGif[]).map(slim).filter((g): g is Gif => !!g);
        const tot: number = json.pagination?.total_count ?? list.length;
        cache.set(cacheKey, { gifs: list, total: tot });
        setGifs((prev) => {
          const base = replace ? [] : prev;
          const seen = new Set(base.map((g) => g.id));
          return [...base, ...list.filter((g) => !seen.has(g.id))];
        });
        setTotal(tot);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message ?? "Couldn't load GIFs.");
      } finally {
        if (abortRef.current === ctrl) setLoading(false);
      }
    },
    [apiKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // (re)load when the mode / term changes
  useEffect(() => {
    if (mode === "recent" || mode === "fav") {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      return;
    }
    setGifs([]);
    setTotal(0);
    scrollRef.current?.scrollTo({ top: 0 });
    void fetchPage(mode, term, 0, true);
  }, [mode, term, fetchPage]);

  // infinite scroll
  const canLoadMore = (mode === "trending" || mode === "search") && gifs.length > 0 && gifs.length < total;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !canLoadMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) void fetchPage(mode, term, gifs.length, false);
      },
      { root: scrollRef.current, rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, loading, gifs.length, mode, term, fetchPage]);

  // related-search suggestions
  useEffect(() => {
    if (!apiKey || !term) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    fetch(`${API_ENDPOINTS.giphy}/search/tags?q=${encodeURIComponent(term)}&api_key=${apiKey}&limit=6`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setSuggestions((j.data ?? []).map((d: any) => d.name).filter((n: string) => n && n !== term)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [term, apiKey]);

  const send = (g: Gif) => {
    const next = [g, ...recents.filter((r) => r.id !== g.id)].slice(0, 30);
    setRecents(next);
    writeList(RECENT_KEY, next);
    onSelect(g.url);
  };

  const toggleFav = (g: Gif) => {
    const exists = favs.some((f) => f.id === g.id);
    const next = exists ? favs.filter((f) => f.id !== g.id) : [g, ...favs].slice(0, 100);
    setFavs(next);
    writeList(FAV_KEY, next);
  };

  const shown = mode === "recent" ? recents : mode === "fav" ? favs : gifs;

  // Masonry: drop each gif into the currently shorter column.
  const columns = useMemo(() => {
    const cols: Gif[][] = [[], []];
    const heights = [0, 0];
    for (const g of shown) {
      const i = heights[0] <= heights[1] ? 0 : 1;
      cols[i].push(g);
      heights[i] += g.h / Math.max(1, g.w);
    }
    return cols;
  }, [shown]);

  /* ───── no key yet ───── */
  if (!apiKey) {
    return (
      <div className="w-full bg-card border border-border/60 rounded-2xl shadow-lg p-5 space-y-3 text-center">
        <div className="mx-auto h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-xl">🎞️</div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Add a GIPHY key to turn on GIFs</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Free and takes a minute. Put it in <code className="text-[11px]">VITE_GIPHY_API_KEY</code> or in{" "}
            <code className="text-[11px]">src/config/apiKeys.ts</code> — or paste it below to use it on this device.
          </p>
        </div>
        <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-primary hover:underline">
          Get a free GIPHY API key →
        </a>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const k = inputKey.trim();
            if (k) { saveApiKey("giphy", k); setApiKey(k); }
          }}
        >
          <input
            type="password"
            placeholder="Paste GIPHY API key…"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="h-9 flex-1 rounded-lg bg-muted/50 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button type="submit" className="px-4 h-9 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shrink-0">
            Save
          </button>
        </form>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="w-full bg-card border border-border/60 rounded-2xl shadow-lg overflow-hidden flex flex-col" style={{ height: 320 }}>
      <div className="p-2.5 pb-1.5 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search GIFs"
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (mode === "recent" || mode === "fav") setMode("trending"); }}
            className="h-8 w-full rounded-full bg-muted/60 pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button onClick={() => { setSearch(""); setTerm(""); setMode("trending"); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
          <button className={chip(mode === "trending" && !term)} onClick={() => { setSearch(""); setTerm(""); setMode("trending"); }}>
            <TrendingUp className="h-3 w-3" /> Trending
          </button>
          <button className={chip(mode === "recent")} onClick={() => setMode("recent")}>
            <Clock className="h-3 w-3" /> Recent
          </button>
          <button className={chip(mode === "fav")} onClick={() => setMode("fav")}>
            <Heart className="h-3 w-3" /> Saved
          </button>
          <span className="w-px bg-border/70 mx-0.5 shrink-0" />
          {suggestions.map((s) => (
            <button key={s} className={chip(false)} onClick={() => { setSearch(s); setTerm(s); setMode("search"); }}>
              {s}
            </button>
          ))}
          {suggestions.length === 0 &&
            CATEGORIES.map((c) => (
              <button key={c.label} className={chip(term === c.q)} onClick={() => { setSearch(c.q); setTerm(c.q); setMode("search"); }}>
                {c.label}
              </button>
            ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin overscroll-contain px-2 pb-2">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-xs text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchPage(mode, term, 0, true)} className="text-xs font-medium text-primary">Retry</button>
              <button onClick={() => { saveApiKey("giphy", ""); try { localStorage.removeItem("newsofyou_giphy_key"); } catch { /* */ } setApiKey(getApiKey("giphy")); }} className="text-xs text-muted-foreground">Change key</button>
            </div>
          </div>
        ) : shown.length === 0 && !loading ? (
          <p className="text-center text-xs text-muted-foreground py-12">
            {mode === "recent" ? "GIFs you send show up here" : mode === "fav" ? "Tap ♥ on a GIF to save it" : "No GIFs found"}
          </p>
        ) : shown.length === 0 ? (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/50 animate-pulse" style={{ height: 80 + ((i * 37) % 60) }} />
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 items-start pt-1">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-1.5 min-w-0">
                {col.map((g) => (
                  <div key={g.id} className="relative group rounded-xl overflow-hidden bg-muted/50" style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                    <button onClick={() => send(g)} className="absolute inset-0 w-full h-full active:opacity-80" aria-label="Send GIF">
                      <img src={g.preview} alt="" loading="lazy" decoding="async" draggable={false} className="w-full h-full object-cover" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(g); }}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100"
                      aria-label="Save GIF"
                    >
                      <Heart className={`h-3 w-3 ${favs.some((f) => f.id === g.id) ? "fill-rose-500 text-rose-500" : "text-white"}`} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {canLoadMore && (
          <div ref={sentinelRef} className="flex justify-center py-3">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        )}
        {mode !== "recent" && mode !== "fav" && shown.length > 0 && (
          <p className="text-center text-[10px] text-muted-foreground/60 pb-1">Powered by GIPHY</p>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
