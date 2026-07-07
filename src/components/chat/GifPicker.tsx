import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

interface GiphyGif {
  id: string;
  images: {
    fixed_height_small?: { url: string };
    original?: { url: string };
    fixed_width?: { url: string };
  };
}

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
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [next, setNext] = useState<string>("");
  
  // Try retrieving key from env or localStorage
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_GIPHY_API_KEY || localStorage.getItem("newsofyou_giphy_key") || "";
  });
  const [inputKey, setInputKey] = useState("");

  const buildUrl = (query: string, pos: string, keyToUse: string) => {
    const base = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}`
      : `https://api.giphy.com/v1/gifs/trending?`;
    return `${base}&api_key=${keyToUse}&limit=24&rating=g${pos ? `&offset=${pos}` : ""}`;
  };

  const fetchGifs = useCallback(async (query: string) => {
    if (!apiKey) return;
    setLoading(true);
    setGifs([]);
    try {
      const res = await fetch(buildUrl(query, "", apiKey));
      const data = await res.json();
      setGifs(data.data ?? []);
      const pagination = data.pagination;
      if (pagination && pagination.offset + pagination.count < pagination.total_count) {
        setNext((pagination.offset + pagination.count).toString());
      } else {
        setNext("");
      }
    } catch {
      setGifs([]);
      setNext("");
    }
    setLoading(false);
  }, [apiKey]);

  const loadMore = useCallback(async () => {
    if (!apiKey || !next || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(search, next, apiKey));
      const data = await res.json();
      setGifs((prev) => [...prev, ...(data.data ?? [])]);
      const pagination = data.pagination;
      if (pagination && pagination.offset + pagination.count < pagination.total_count) {
        setNext((pagination.offset + pagination.count).toString());
      } else {
        setNext("");
      }
    } catch {
      /* keep what we have */
    }
    setLoadingMore(false);
  }, [next, loadingMore, search, apiKey]);

  useEffect(() => {
    if (apiKey) {
      fetchGifs("");
    }
  }, [fetchGifs, apiKey]);

  useEffect(() => {
    if (apiKey) {
      const timer = setTimeout(() => fetchGifs(search), 400);
      return () => clearTimeout(timer);
    }
  }, [search, fetchGifs, apiKey]);

  const runCategory = (cat: { label: string; q: string }) => {
    setActiveCat(cat.label);
    setSearch(cat.q);
  };

  const getGifUrl = (gif: GiphyGif) =>
    gif.images.original?.url ?? gif.images.fixed_height_small?.url ?? "";

  // Render Key input UI if no key is configured
  if (!apiKey) {
    return (
      <div className="w-full bg-card border border-border rounded-xl shadow-lg p-5 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">Giphy Integration Required</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Google discontinued the Tenor API on June 30, 2026. To search and share GIFs, please enter a free GIPHY API key.
          </p>
        </div>
        <div className="space-y-3">
          <a
            href="https://developers.giphy.com/dashboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            Get a free GIPHY API Key →
          </a>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Paste GIPHY API Key..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="h-9 text-xs bg-muted/30"
            />
            <button
              onClick={() => {
                const trimmed = inputKey.trim();
                if (trimmed) {
                  localStorage.setItem("newsofyou_giphy_key", trimmed);
                  setApiKey(trimmed);
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors shrink-0 h-9"
            >
              Save Key
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/85 italic">
            Or add VITE_GIPHY_API_KEY in your .env file
          </p>
        </div>
      </div>
    );
  }

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
                    src={gif.images.fixed_height_small?.url ?? getGifUrl(gif)}
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

      <div className="px-3 pb-2 flex items-center justify-between border-t border-border/50 pt-2">
        <p className="text-[9px] text-muted-foreground">Powered by GIPHY</p>
        <button
          onClick={() => {
            localStorage.removeItem("newsofyou_giphy_key");
            setApiKey(import.meta.env.VITE_GIPHY_API_KEY || "");
          }}
          className="text-[9px] text-destructive hover:underline"
        >
          Reset Key
        </button>
      </div>
    </div>
  );
};

export default GifPicker;
