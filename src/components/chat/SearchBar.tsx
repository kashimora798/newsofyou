import React, { useRef, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday } from "date-fns";

interface SearchResultItem {
  id: string;
  content: string | null;
  created_at: string | null;
  username: string | null;
}

interface SearchBarProps {
  query: string;
  onSearch: (q: string) => void;
  onClose: () => void;
  results: SearchResultItem[];
  searching?: boolean;
  onResultClick: (id: string) => void;
}

function formatResultDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isToday(date)) return "Today, " + format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday, " + format(date, "h:mm a");
  return format(date, "MMM d, yyyy, h:mm a");
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const SearchBar: React.FC<SearchBarProps> = ({
  query, onSearch, onClose, results, searching, onResultClick,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const showResults = query.trim().length > 0;

  return (
    <div className="relative z-50">
      {/* Search input bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border/40"
        style={{
          background: "hsl(var(--card) / 0.95)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
        }}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          ref={inputRef}
          placeholder="Search messages..."
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8 text-sm bg-transparent border-0 focus-visible:ring-0 p-0"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-muted/60 transition-colors shrink-0"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div
          className="absolute left-0 right-0 top-full max-h-[60vh] overflow-y-auto border-b border-border/40 shadow-lg"
          style={{
            background: "hsl(var(--card) / 0.97)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {!searching && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onResultClick(r.id)}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/20 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-semibold text-primary truncate">
                  {r.username ?? "Unknown"}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatResultDate(r.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-2 leading-snug">
                {highlightMatch(r.content ?? "", query)}
              </p>
            </button>
          ))}
          {results.length > 0 && (
            <div className="px-4 py-2 text-center text-[11px] text-muted-foreground font-medium">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
