import React, { useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  query: string;
  onSearch: (q: string) => void;
  onClose: () => void;
  resultCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  searching?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query, onSearch, onClose, resultCount, currentIndex, onNext, onPrev, searching,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-border/40 animate-fade-in"
      style={{
        background: "hsl(var(--card) / 0.92)",
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

      {query && !searching && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium">
          {resultCount > 0 ? `${currentIndex + 1}/${resultCount}` : "No results"}
        </span>
      )}

      {resultCount > 0 && (
        <div className="flex items-center shrink-0">
          <button
            onClick={onPrev}
            className="p-1 rounded-full hover:bg-muted/60 transition-colors"
            aria-label="Previous result"
          >
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onNext}
            className="p-1 rounded-full hover:bg-muted/60 transition-colors"
            aria-label="Next result"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="p-1 rounded-full hover:bg-muted/60 transition-colors shrink-0"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default SearchBar;
