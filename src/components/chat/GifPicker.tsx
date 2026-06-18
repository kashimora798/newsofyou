import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

interface TenorGif {
  id: string;
  media_formats: {
    tinygif?: { url: string };
    gif?: { url: string };
    mediumgif?: { url: string };
  };
}

const TENOR_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Free public Tenor API key

// Quick-tap categories for couples — one-word chips that run a search.
const GIF_CATEGORIES = [
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

const GifPicker: React.FC<GifPickerProps> = ({ onSelect }) => {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [next, setNext] = useState<string>("");

  const buildUrl = (query: string, pos: string) => {
    const base = query.trim()
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}`
      : `https://tenor.googleapis.com/v2/featured?`;
    return `${base}&key=${TENOR_KEY}&limit=24&media_filter=tinygif,mediumgif${pos ? `&pos=${pos}` : ""}`;
  };

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    setGifs([]);
    try {
      const res = await fetch(buildUrl(query, ""));
      const data = await res.json();
      setGifs(data.results ?? []);
      setNext(data.next ?? "");
    } catch {
      setGifs([]);
      setNext("");
    }
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(search, next));
      const data = await res.json();
      setGifs((prev) => [...prev, ...(data.results ?? [])]);
      setNext(data.next ?? "");
    } catch {
      /* keep what we have */
    }
    setLoadingMore(false);
  }, [next, loadingMore, search]);

  useEffect(() => {
    fetchGifs("");
  }, [fetchGifs]);

  useEffect(() => {
    const timer = setTimeout(() => fetchGifs(search), 400);
    return () => clearTimeout(timer);
  }, [search, fetchGifs]);

  const runCategory = (cat: { label: string; q: string }) => {
    setActiveCat(cat.label);
    setSearch(cat.q);
  };

  const getGifUrl = (gif: TenorGif) =>
    gif.media_formats.mediumgif?.url ?? gif.media_formats.tinygif?.url ?? gif.media_formats.gif?.url ?? "";

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search GIFs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCat(""); }}
            className="h-8 pl-8 text-xs bg-muted/50 border-0"
          />
        </div>
        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
          {GIF_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => runCategory(cat)}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                activeCat === cat.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 overflow-y-auto scrollbar-thin p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">No GIFs found</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map((gif, i) => (
                <button
                  key={`${gif.id}-${i}`}
                  onClick={() => onSelect(getGifUrl(gif))}
                  className="rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all"
                >
                  <img
                    src={gif.media_formats.tinygif?.url ?? getGifUrl(gif)}
                    alt="gif"
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            {next && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full mt-2 h-8 rounded-lg bg-muted text-xs text-muted-foreground flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      <div className="px-2 pb-1.5">
        <p className="text-[9px] text-muted-foreground text-center">Powered by Tenor</p>
      </div>
    </div>
  );
};

export default GifPicker;
