import React, { useRef, useEffect } from "react";
import { Search, X, Loader2, Image as ImageIcon, Film, FileText, Link2, Sticker } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface SearchBarProps {
  query: string;
  onSearch: (q: string) => void;
  onClose: () => void;
  results: Tables<"messages">[];
  searching?: boolean;
  onResultClick: (message: Tables<"messages">) => void;
}

function formatResultDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isToday(date)) return "Today, " + format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday, " + format(date, "h:mm a");
  return format(date, "MMM d, yyyy");
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-[3px] px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function mediaMeta(m: any): { icon: React.ReactNode; label: string } | null {
  if (m.image_url) return { icon: <ImageIcon className="h-3.5 w-3.5" />, label: "Photo" };
  if (m.video && m.vidUrl) return { icon: <Film className="h-3.5 w-3.5" />, label: "Video" };
  if (m.sticker_url || m.message_type === "sticker") return { icon: <Sticker className="h-3.5 w-3.5" />, label: "Sticker" };
  if (m.gif_url || m.message_type === "gif") return { icon: <Film className="h-3.5 w-3.5" />, label: "GIF" };
  if (m.file_url) return { icon: <FileText className="h-3.5 w-3.5" />, label: m.file_name ?? "File" };
  if (m.link_preview_active && m.link_title) return { icon: <Link2 className="h-3.5 w-3.5" />, label: "Link" };
  return null;
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
    <div
      className="relative z-50"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Nunito', sans-serif" }}
    >
      {/* Search input bar — material */}
      <div className="flex items-center gap-2 px-3 py-2.5 glass-chat-header">
        <div className="flex-1 flex items-center gap-2 rounded-full bg-muted/60 px-3.5 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder="Search messages"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            className="h-5 text-[15px] bg-transparent border-0 focus-visible:ring-0 p-0 placeholder:text-muted-foreground/70"
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          {query && !searching && (
            <button onClick={() => onSearch("")} className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full bg-foreground/15 text-card">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[15px] font-medium text-primary px-1 tappable shrink-0"
        >
          Cancel
        </button>
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div
          className="absolute left-0 right-0 top-full max-h-[65vh] overflow-y-auto scrollbar-thin border-b border-border/50 shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
          style={{
            background: "hsl(var(--card) / 0.97)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {!searching && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          )}

          {results.length > 0 && (
            <div className="px-5 pt-3 pb-1.5 text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
          )}

          <div className="px-2 pb-2">
            {results.map((r) => {
              const media = mediaMeta(r);
              const preview = r.content?.trim() || media?.label || "Message";
              return (
                <button
                  key={r.id}
                  onClick={() => onResultClick(r)}
                  className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-muted/60 active:bg-muted transition-colors flex items-start gap-3"
                >
                  {/* Thumbnail or media chip */}
                  {(r as any).image_url ? (
                    <img src={(r as any).image_url} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0 bg-muted" loading="lazy" />
                  ) : media ? (
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {media.icon}
                    </div>
                  ) : (
                    <div className="h-11 w-11 rounded-xl bg-muted/70 text-muted-foreground flex items-center justify-center shrink-0 text-[15px] font-semibold">
                      {(r.username ?? "?").charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-foreground truncate">
                        {r.username ?? "Unknown"}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatResultDate(r.created_at)}
                      </span>
                    </div>
                    <p className="text-[13.5px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                      {r.content?.trim()
                        ? highlightMatch(preview, query)
                        : (
                          <span className="inline-flex items-center gap-1">
                            {media?.icon}{media?.label ?? "Message"}
                          </span>
                        )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
