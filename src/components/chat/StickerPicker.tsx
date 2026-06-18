import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
}

const STICKER_PACKS: Record<string, string[]> = {
  "Love": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f48b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f618/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f495/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f496/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f49d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f48c/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f491/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f469_200d_2764_fe0f_200d_1f468/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f498/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f49e/512.gif",
  ],
  "Reactions": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44e/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f621/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f631/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.gif",
  ],
  "Animals": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f436/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f431/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f43b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f42d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f430/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f98a/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f981/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f438/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f427/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f40d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f422/512.gif",
  ],
  "Smileys": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f601/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f606/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f605/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f609/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60a/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f911/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f913/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f612/512.gif",
  ],
  "Gestures": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/270c_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f91e/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f918/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f919/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f64f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f91d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f91b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f91c/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f90c/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f90f/512.gif",
  ],
  "Food": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f355/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f354/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f35f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f382/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f36b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f36d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f37f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f363/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f370/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f36a/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f369/512.gif",
  ],
  "Nature": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f33b/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f339/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f33a/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f33c/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f308/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2b50/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f31f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/26a1/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2744_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f30d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f319/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2600_fe0f/512.gif",
  ],
  "Objects": [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f381/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f388/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f38a/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f380/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f3b5/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f3b6/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f3a4/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f3ae/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.gif",
  ],
};

const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect }) => {
  const { user } = useAuth();
  // Default to a populated pack so the grid is never empty on first open.
  const [activePack, setActivePack] = useState<string>("Love");
  const [customStickers, setCustomStickers] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("custom_stickers")
        .select("sticker_url")
        .order("created_at", { ascending: false });
      setCustomStickers((data as any)?.map((d: any) => d.sticker_url) ?? []);
    };
    fetch();
  }, [user]);

  const allPacks = { "My Stickers": customStickers, ...STICKER_PACKS };
  const packs = Object.keys(allPacks);
  const currentStickers = allPacks[activePack] ?? [];

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
      {/* Pack tabs */}
      <div className="flex px-1 py-1.5 gap-1 border-b border-border overflow-x-auto scrollbar-thin">
        {packs.map((pack) => (
          <button
            key={pack}
            onClick={() => setActivePack(pack)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              activePack === pack
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {pack}
          </button>
        ))}
      </div>

      {/* Sticker grid */}
      <div className="h-52 overflow-y-auto scrollbar-thin p-2">
        {currentStickers.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            {activePack === "My Stickers" ? "No custom stickers yet. Upload from Settings → My Stickers" : "No stickers"}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {currentStickers.map((url, i) => (
              <button
                key={i}
                onClick={() => onSelect(url)}
                className="aspect-square rounded-lg hover:bg-muted p-1 transition-transform hover:scale-105 active:scale-95"
              >
                <img src={url} alt="sticker" className="w-full h-full object-contain" loading="lazy" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPicker;
