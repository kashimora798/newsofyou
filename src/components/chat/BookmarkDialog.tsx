import React, { useState } from "react";
import { useBookmarks, BOOKMARK_CATEGORIES, type BookmarkCategory } from "@/hooks/useBookmarks";
import { X, Bookmark } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

interface BookmarkDialogProps {
  message: Tables<"messages">;
  onClose: () => void;
}

const BookmarkDialog: React.FC<BookmarkDialogProps> = ({ message, onClose }) => {
  const { addBookmark } = useBookmarks();
  const [category, setCategory] = useState<BookmarkCategory>("important");
  const [note, setNote] = useState("");

  const handleSave = async () => {
    await addBookmark(message.id, category, note.trim() || undefined);
    toast({ title: "📌 Saved!", description: "Message bookmarked" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-t-2xl border-t border-border p-5 pb-8 animate-in slide-in-from-bottom safe-area-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Bookmark className="h-4 w-4 text-primary" /> Remember This
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {message.content && (
          <div className="bg-muted rounded-lg px-3 py-2 mb-3 text-xs text-muted-foreground line-clamp-2">"{message.content}"</div>
        )}

        <p className="text-xs text-muted-foreground mb-2">Category</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {BOOKMARK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === cat.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >{cat.emoji} {cat.label}</button>
          ))}
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)..." className="w-full text-sm bg-muted rounded-lg px-3 py-2 mb-4 outline-none placeholder:text-muted-foreground" />

        <button onClick={handleSave} className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">Save Bookmark</button>
      </div>
    </div>
  );
};

export default BookmarkDialog;
