import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadImage } from "@/lib/uploadImage";

interface CustomSticker {
  id: string;
  sticker_url: string;
  label: string | null;
  created_at: string;
}

const CustomStickers: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <StickersView userId={user.id} />;
};

const StickersView: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [stickers, setStickers] = useState<CustomSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStickers = async () => {
    const { data } = await supabase
      .from("custom_stickers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setStickers((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStickers(); }, [userId]);

  const [uploadCount, setUploadCount] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => {
      if (f.size > 2 * 1024 * 1024) {
        toast({ title: `${f.name} too large`, description: "Max 2MB", variant: "destructive" });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadCount(validFiles.length);

    const uploads = validFiles.map(async (file) => {
      try {
        // Sticker-sized before it leaves the phone. PNG keeps transparency; an
        // animated GIF is passed through untouched (see `worthCompressing`).
        const up = await uploadImage(file, {
          prefix: `custom-stickers/${userId}`,
          maxDimension: 512,
          preferType: "image/png",
        });
        await supabase.from("custom_stickers").insert({
          user_id: userId,
          sticker_url: up.url,
          label: file.name.replace(/\.[^.]+$/, ""),
        } as any);
        return true;
      } catch {
        return false;
      }
    });

    const results = await Promise.all(uploads);
    const successCount = results.filter(Boolean).length;

    fetchStickers();
    if (successCount > 0) toast({ title: `${successCount} sticker${successCount > 1 ? "s" : ""} uploaded! ✨` });
    if (successCount < validFiles.length) toast({ title: `${validFiles.length - successCount} upload(s) failed`, variant: "destructive" });

    setUploading(false);
    setUploadCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (sticker: CustomSticker) => {
    await supabase.from("custom_stickers").delete().eq("id", sticker.id);
    setStickers((prev) => prev.filter((s) => s.id !== sticker.id));
    toast({ title: "Sticker removed" });
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => navigate("/settings")} className="p-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">My Stickers</h2>
        {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary ml-auto" />}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 rounded-xl border-2 border-dashed border-border bg-card hover:border-primary/30 transition-all text-sm text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
          {uploading ? `Uploading ${uploadCount} sticker${uploadCount > 1 ? "s" : ""}...` : "Upload Stickers (GIF, PNG, WEBP)"}
        </button>
        <input ref={fileRef} type="file" accept="image/gif,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : stickers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No custom stickers yet. Upload your first one!</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {stickers.map((s) => (
              <div key={s.id} className="relative group aspect-square rounded-xl border border-border bg-card overflow-hidden">
                <img src={s.sticker_url} alt={s.label ?? "sticker"} className="w-full h-full object-contain p-2" />
                <button
                  onClick={() => handleDelete(s)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                {s.label && (
                  <span className="absolute bottom-0 inset-x-0 text-center text-[9px] text-muted-foreground bg-card/80 py-0.5 truncate px-1">
                    {s.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomStickers;
