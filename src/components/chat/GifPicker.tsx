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

const GifPicker: React.FC<GifPickerProps> = ({ onSelect }) => {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=30&media_filter=tinygif,mediumgif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=30&media_filter=tinygif,mediumgif`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results ?? []);
    } catch {
      setGifs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGifs("");
  }, [fetchGifs]);

  useEffect(() => {
    const timer = setTimeout(() => fetchGifs(search), 400);
    return () => clearTimeout(timer);
  }, [search, fetchGifs]);

  const getGifUrl = (gif: TenorGif) =>
    gif.media_formats.mediumgif?.url ?? gif.media_formats.tinygif?.url ?? gif.media_formats.gif?.url ?? "";

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search GIFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/50 border-0"
          />
        </div>
      </div>

      <div className="h-56 overflow-y-auto scrollbar-thin p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
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
        )}
      </div>

      <div className="px-2 pb-1.5">
        <p className="text-[9px] text-muted-foreground text-center">Powered by Tenor</p>
      </div>
    </div>
  );
};

export default GifPicker;
