import React, { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  query: string;
  onSearch: (q: string) => void;
  onClose: () => void;
  resultCount: number;
}

const SearchBar: React.FC<SearchBarProps> = ({ query, onSearch, onClose, resultCount }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border animate-slide-up">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        placeholder="Search messages..."
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        className="h-8 text-sm bg-transparent border-0 focus-visible:ring-0 p-0"
      />
      {query && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {resultCount} found
        </span>
      )}
      <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors shrink-0">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default SearchBar;
