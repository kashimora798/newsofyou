import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Send, Scissors, Film, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

interface AiStickerStudioProps {
  onSend: (url: string, kind: "sticker" | "video") => void;
}

const STYLE_PRESETS = [
  { label: "Sticker", suffix: "as a cute die-cut sticker, thick white outline, kawaii, vibrant, plain background" },
  { label: "Cartoon", suffix: "in a playful cartoon style, bold outlines, flat colors, plain background" },
  { label: "3D", suffix: "as a glossy 3D render, soft studio lighting, plain background" },
  { label: "Pixel", suffix: "as retro pixel art, 16-bit, plain background" },
];

const RATIOS = ["1:1", "3:4", "4:3", "9:16"];

const AiStickerStudio: React.FC<AiStickerStudioProps> = ({ onSend }) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLE_PRESETS[0]);
  const [ratio, setRatio] = useState("1:1");
  const [busy, setBusy] = useState<"" | "generating" | "removing" | "saving" | "animating">("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null); // bg-removed + hosted

  const generating = busy === "generating";

  // Call the generation API DIRECTLY from the browser. It's keyless + CORS-open,
  // so we skip the Supabase edge function — which would otherwise 504 on the
  // ~60s+ video generation (edge functions cap well under the API's 120s).
  const GEN_BASE = "https://ahm7xmakki.com/api";
  const callVheer = async (mode: "tti" | "pti" | "ptv", extra: Record<string, unknown> = {}) => {
    const res = await fetch(`${GEN_BASE}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `${prompt.trim()}, ${style.suffix}`, ratio, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Generation failed (${res.status})`);
    }
    return data as { imageUrl?: string; videoUrl?: string };
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    haptic.tap();
    setBusy("generating");
    setResultUrl(null);
    setFinalUrl(null);
    try {
      const data = await callVheer("tti");
      if (!data.imageUrl) throw new Error("No image returned");
      setResultUrl(data.imageUrl);
    } catch (e: any) {
      toast({ title: "Couldn't generate", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  // Fetch the generated image, remove its background in-browser, upload to bucket.
  const handleRemoveBgAndSave = async () => {
    if (!resultUrl || !user) return;
    setBusy("removing");
    try {
      // Lazy-load the (heavy) model only when first needed.
      const { removeBackground } = await import("@imgly/background-removal");
      const srcBlob = await (await fetch(resultUrl)).blob();
      const cutout = await removeBackground(srcBlob);

      setBusy("saving");
      const path = `custom-stickers/${user.id}/ai_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, cutout, {
        contentType: "image/png",
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);

      await supabase.from("custom_stickers").insert({
        user_id: user.id,
        sticker_url: urlData.publicUrl,
        label: prompt.trim().slice(0, 40),
        source: "ai",
      } as any);

      setFinalUrl(urlData.publicUrl);
      haptic.success();
      toast({ title: "Sticker saved! ✨" });
    } catch (e: any) {
      toast({ title: "Background removal failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const handleAnimate = async () => {
    // Animate the ORIGINAL generated image (a normal JPG), not the transparent
    // cutout — motion models expect a full image, and the cutout's alpha
    // channel makes Vheer reject it. Downscale to keep the payload small.
    if (!resultUrl) return;
    setBusy("animating");
    try {
      const b64 = await urlToBase64Downscaled(resultUrl, 768);
      const data = await callVheer("ptv", { imageBase64: b64, duration: 5 });
      if (!data.videoUrl) throw new Error("No video returned");
      haptic.success();
      onSend(data.videoUrl, "video");
      toast({ title: "Animated sticker sent! 🎬" });
    } catch (e: any) {
      toast({ title: "Animation failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const sendSticker = () => {
    const url = finalUrl ?? resultUrl;
    if (url) {
      haptic.tap();
      onSend(url, "sticker");
    }
  };

  return (
    <div className="w-full bg-card rounded-xl p-3 space-y-3">
      {/* Prompt */}
      <div className="relative">
        <Wand2 className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a sticker… e.g. a happy cat holding a heart"
          rows={2}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-muted/50 outline-none resize-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Style + ratio */}
      <div className="flex flex-wrap gap-1.5">
        {STYLE_PRESETS.map((s) => (
          <button
            key={s.label}
            onClick={() => setStyle(s)}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              style.label === s.label ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="w-px bg-border mx-0.5" />
        {RATIOS.map((r) => (
          <button
            key={r}
            onClick={() => setRatio(r)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              ratio === r ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || !!busy}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating…" : "Generate sticker"}
      </button>

      {/* Result */}
      <AnimatePresence>
        {resultUrl && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex justify-center">
              <div className="h-36 w-36 rounded-2xl bg-muted/30 flex items-center justify-center overflow-hidden ring-1 ring-border"
                style={finalUrl ? { backgroundImage: "repeating-conic-gradient(#0001 0% 25%, transparent 0% 50%)", backgroundSize: "16px 16px" } : undefined}
              >
                <img src={finalUrl ?? resultUrl} alt="generated" className="h-full w-full object-contain" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {!finalUrl && (
                <button
                  onClick={handleRemoveBgAndSave}
                  disabled={!!busy}
                  className="h-9 rounded-xl bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busy === "removing" || busy === "saving" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Scissors className="h-3.5 w-3.5" />
                  )}
                  {busy === "removing" ? "Cutting out…" : busy === "saving" ? "Saving…" : "Remove BG + Save"}
                </button>
              )}
              <button
                onClick={sendSticker}
                disabled={!!busy}
                className="h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
              <button
                onClick={handleAnimate}
                disabled={!!busy}
                className={`h-9 rounded-xl bg-fuchsia-500/15 text-fuchsia-600 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 ${finalUrl ? "" : "col-span-2"}`}
              >
                {busy === "animating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
                {busy === "animating" ? "Animating…" : "Animate 🎬"}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center">First cutout downloads a small model — give it a sec.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

async function urlToBase64Downscaled(url: string, maxEdge: number): Promise<string> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // White matte so any transparency becomes solid (motion model needs opaque).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  // JPEG keeps the base64 small and strips alpha.
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

export default AiStickerStudio;
