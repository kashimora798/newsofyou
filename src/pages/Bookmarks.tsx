import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBookmarks, BOOKMARK_CATEGORIES, type BookmarkCategory } from "@/hooks/useBookmarks";
import { ArrowLeft, Trash2, Loader2, Search } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import { formatLastSeen } from "@/lib/dateUtils";

const Bookmarks: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { bookmarks, loading, removeBookmark } = useBookmarks();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<BookmarkCategory | "all">("all");
  const [search, setSearch] = useState("");

  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const filtered = bookmarks
    .filter((b) => activeCategory === "all" || b.category === activeCategory)
    .filter((b) => !search || (b.message_content ?? "").toLowerCase().includes(search.toLowerCase()) || (b.note ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="px-4 pt-5 pb-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-bold text-foreground">Remember This 📌</h1>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-xl border-none outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >All</button>
          {BOOKMARK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${activeCategory === cat.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >{cat.emoji} {cat.label}</button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">📌</p>
            <p className="text-sm text-muted-foreground">No bookmarks yet</p>
            <p className="text-xs text-muted-foreground mt-1">Long-press a message in chat to save it</p>
          </div>
        ) : (
          filtered.map((b) => {
            const cat = BOOKMARK_CATEGORIES.find((c) => c.value === b.category);
            return (
              <div key={b.id} className="bg-card rounded-xl border border-border p-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{cat?.emoji}</span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">{cat?.label}</span>
                      <span className="text-[10px] text-muted-foreground">· {formatLastSeen(b.created_at)}</span>
                    </div>
                    {b.message_content && <p className="text-sm text-foreground line-clamp-3">{b.message_content}</p>}
                    {b.message_image_url && <p className="text-xs text-muted-foreground">📷 Photo</p>}
                    {b.note && <p className="text-xs text-muted-foreground mt-1 italic">"{b.note}"</p>}
                  </div>
                  <button onClick={() => removeBookmark(b.id)} className="p-1.5 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Bookmarks;
