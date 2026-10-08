import React, { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/uploadImage";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import ReactionPreview from "./ReactionPreview";

const GRADIENT_PRESETS = [
  { label: "Happy", value: "linear-gradient(135deg, #FFE066, #FF9A44)" },
  { label: "Romantic", value: "linear-gradient(135deg, #FF6B8A, #FF4081)" },
  { label: "Calm", value: "linear-gradient(135deg, #89CFF0, #A0D2DB)" },
  { label: "Energetic", value: "linear-gradient(135deg, #FF6F00, #FF3D00)" },
  { label: "Spooky", value: "linear-gradient(135deg, #1a1a2e, #3D0066)" },
  { label: "Dreamy", value: "linear-gradient(135deg, #C084FC, #818CF8)" },
  { label: "Nature", value: "linear-gradient(135deg, #4ADE80, #22D3EE)" },
  { label: "Sunset", value: "linear-gradient(135deg, #F97316, #EC4899)" },
];

const PARTICLE_PRESETS: { label: string; particles: string[] }[] = [
  { label: "Hearts", particles: ["❤️", "💕", "💖", "💗"] },
  { label: "Stars", particles: ["⭐", "✨", "🌟", "💫"] },
  { label: "Nature", particles: ["🌸", "🌺", "🌻", "🍀"] },
  { label: "Food", particles: ["🍕", "🍩", "🍰", "🧁"] },
  { label: "Animals", particles: ["🐱", "🐶", "🦋", "🐰"] },
  { label: "Weather", particles: ["❄️", "🌧️", "⚡", "🌈"] },
];

const VIBRATION_PRESETS: { label: string; value: string }[] = [
  { label: "Off", value: "off" },
  { label: "Light", value: "light" },
  { label: "Medium", value: "medium" },
  { label: "Strong", value: "strong" },
];

interface TouchReactionCreatorProps {
  userId: string;
  onCreated: () => void;
}

const TouchReactionCreator: React.FC<TouchReactionCreatorProps> = ({ userId, onCreated }) => {
  const [label, setLabel] = useState("");
  const [verb, setVerb] = useState("");
  const [emoji, setEmoji] = useState("❤️");
  const [gradient, setGradient] = useState(GRADIENT_PRESETS[0].value);
  const [particles, setParticles] = useState<string[]>(PARTICLE_PRESETS[0].particles);
  const [particleSize, setParticleSize] = useState(30);
  const [vibStrength, setVibStrength] = useState("medium");
  const [vibDuration, setVibDuration] = useState(1000);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Max 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Shrunk to sticker size before it leaves the phone; PNG keeps alpha.
      const up = await uploadImage(file, {
        prefix: `custom-stickers/${userId}`,
        maxDimension: 512,
        preferType: "image/png",
      });
      setEmoji(up.url);
    } catch (err) {
      console.error("touch sticker upload failed", err);
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!label.trim() || !verb.trim()) {
      toast({ title: "Label and verb are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("custom_touch_reactions").insert({
      user_id: userId,
      label: label.trim(),
      verb: verb.trim(),
      emoji,
      particles,
      particle_size: particleSize,
      gradient,
      vibration_strength: vibStrength,
      vibration_duration: vibDuration,
      shake,
      flash,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Reaction created! 🎉" });
      onCreated();
    }
  };

  return (
    <div className="space-y-5">
      {/* Preview toggle */}
      {showPreview && (
        <ReactionPreview
          emoji={emoji}
          gradient={gradient}
          particles={particles}
          particleSize={particleSize}
          label={label}
          verb={verb}
          shake={shake}
          flash={flash}
        />
      )}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="w-full text-xs text-primary font-medium py-1"
      >
        {showPreview ? "Hide Preview" : "Show Preview"}
      </button>

      {/* Label & Verb */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Bear Hug"
          className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verb</label>
        <input
          value={verb}
          onChange={(e) => setVerb(e.target.value)}
          placeholder="e.g. bear-hugging"
          className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Emoji / Sticker */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Emoji / Sticker</label>
        <div className="flex items-center gap-2">
          <input
            value={emoji.startsWith("http") ? "" : emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="Type emoji..."
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:border-primary/30 transition-colors flex items-center gap-1"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Image
          </button>
        </div>
        {emoji.startsWith("http") && (
          <img src={emoji} alt="emoji" className="h-12 w-12 object-contain rounded-lg border border-border" />
        )}
        <input ref={fileRef} type="file" accept="image/gif,image/png,image/webp" className="hidden" onChange={handleStickerUpload} />
      </div>

      {/* Gradient */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background Mood</label>
        <div className="grid grid-cols-4 gap-2">
          {GRADIENT_PRESETS.map((g) => (
            <button
              key={g.label}
              onClick={() => setGradient(g.value)}
              className={`aspect-square rounded-xl border-2 transition-all ${gradient === g.value ? "border-primary shadow-md" : "border-border"}`}
              style={{ background: g.value }}
            >
              <span className="text-[8px] font-semibold text-white drop-shadow">{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Particles */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Particle Set</label>
        <div className="grid grid-cols-3 gap-2">
          {PARTICLE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setParticles(p.particles)}
              className={`px-2 py-2 rounded-xl border text-xs transition-all ${
                JSON.stringify(particles) === JSON.stringify(p.particles) ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground"
              }`}
            >
              {p.particles.join("")} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Particle Size */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Particle Size: {particleSize}px</label>
        <Slider value={[particleSize]} onValueChange={(v) => setParticleSize(v[0])} min={15} max={50} step={1} />
      </div>

      {/* Vibration */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vibration Strength</label>
        <div className="flex gap-2">
          {VIBRATION_PRESETS.map((v) => (
            <button
              key={v.value}
              onClick={() => setVibStrength(v.value)}
              className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                vibStrength === v.value ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vibration Duration: {vibDuration}ms</label>
        <Slider value={[vibDuration]} onValueChange={(v) => setVibDuration(v[0])} min={200} max={3000} step={100} />
      </div>

      {/* Shake & Flash */}
      <div className="flex gap-3">
        <button
          onClick={() => setShake(!shake)}
          className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
            shake ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground"
          }`}
        >
          {shake ? "✓ " : ""}Shake Effect
        </button>
        <button
          onClick={() => setFlash(!flash)}
          className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
            flash ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground"
          }`}
        >
          {flash ? "✓ " : ""}Flash Effect
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !label.trim() || !verb.trim()}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Reaction"}
      </button>
    </div>
  );
};

export default TouchReactionCreator;
