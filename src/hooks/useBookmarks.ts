import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BookmarkCategory = "restaurants" | "gift_ideas" | "important" | "funny" | "other";

export interface Bookmark {
  id: string;
  user_id: string;
  message_id: string;
  category: BookmarkCategory;
  note: string | null;
  created_at: string;
  message_content?: string | null;
  message_image_url?: string | null;
  message_created_at?: string | null;
  message_user_id?: string | null;
}

export const BOOKMARK_CATEGORIES: { value: BookmarkCategory; label: string; emoji: string }[] = [
  { value: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { value: "gift_ideas", label: "Gift Ideas", emoji: "🎁" },
  { value: "important", label: "Important", emoji: "⭐" },
  { value: "funny", label: "Funny", emoji: "😂" },
  { value: "other", label: "Other", emoji: "📌" },
];

export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bookmarks")
      .select("*, messages(content, image_url, created_at, user_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setBookmarks(
        (data as any[]).map((b) => ({
          ...b,
          message_content: b.messages?.content,
          message_image_url: b.messages?.image_url,
          message_created_at: b.messages?.created_at,
          message_user_id: b.messages?.user_id,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const addBookmark = useCallback(async (messageId: string, category: BookmarkCategory, note?: string) => {
    if (!user) return;
    await (supabase as any).from("bookmarks").insert({
      user_id: user.id,
      message_id: messageId,
      category,
      note: note || null,
    });
    fetchBookmarks();
  }, [user, fetchBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    await (supabase as any).from("bookmarks").delete().eq("id", id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { bookmarks, loading, addBookmark, removeBookmark, refetch: fetchBookmarks };
}
